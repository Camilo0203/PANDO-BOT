"use strict";

const express = require("express");
const crypto = require("crypto");
const { EmbedBuilder } = require("discord.js");
const { getDB } = require("../../utils/database");
const { generateCode } = require("../../utils/proCodeService");
const { createCode } = require("../../utils/database/proRedeemCodes");
const logger = require("../../utils/structuredLogger");

/**
 * Tebex Webhook App
 *
 * Variables de entorno requeridas:
 * - TEBEX_SECRET_KEY : Webhook secret del dashboard de Tebex
 *
 * Seguridad implementada:
 * - Validación HMAC-SHA256 obligatoria (excepto validation.webhook)
 * - Idempotencia por payment_id (colección webhook_events)
 * - Manejo de refunds/reversals (desactiva PRO)
 */

const WEBHOOK_EVENTS_COLLECTION = "webhook_events";

function createTebexApp({ getClient }) {
  const app = express();

  const SECRET_KEY = process.env.TEBEX_SECRET_KEY;

  const PACKAGE_TIER_MAP = {
    "7434172": "pro_monthly",
    "7434175": "pro_yearly",
    "7434185": "lifetime",
  };

  // --- Middleware: raw body ---
  app.use((req, res, next) => {
    let data = Buffer.alloc(0);
    req.on("data", chunk => { data = Buffer.concat([data, chunk]); });
    req.on("end", () => {
      req.rawBody = data;
      try { req.body = data.length > 0 ? JSON.parse(data.toString("utf8")) : {}; } catch { req.body = {}; }
      next();
    });
    req.on("error", () => { req.rawBody = Buffer.alloc(0); req.body = {}; next(); });
  });

  // --- Firma helper ---
  function verifySignature(rawBody, signature) {
    if (!SECRET_KEY || !signature) return false;
    const expected = crypto.createHmac("sha256", SECRET_KEY).update(rawBody).digest("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
    } catch {
      try {
        const expectedB64 = Buffer.from(expected, "hex").toString("base64");
        return crypto.timingSafeEqual(Buffer.from(expectedB64), Buffer.from(signature));
      } catch { return false; }
    }
  }

  // --- Idempotencia: marcar evento como procesado ---
  async function markEventProcessed(paymentId, eventType, meta = {}) {
    const db = getDB();
    if (!db) return;
    await db.collection(WEBHOOK_EVENTS_COLLECTION).updateOne(
      { payment_id: String(paymentId) },
      { $set: { payment_id: String(paymentId), event_type: eventType, processed_at: new Date(), ...meta } },
      { upsert: true }
    );
  }

  async function isEventAlreadyProcessed(paymentId) {
    const db = getDB();
    if (!db) return false;
    const existing = await db.collection(WEBHOOK_EVENTS_COLLECTION).findOne({ payment_id: String(paymentId) });
    return !!existing;
  }

  // --- Helper: extraer guild_id ---
  function extractGuildId(body) {
    const subject = body?.subject || body?.payload || body;
    const custom = subject?.custom || subject?.variables || {};
    if (custom?.guild_id) return String(custom.guild_id);
    if (custom?.server_id) return String(custom.server_id);
    if (body?.guild_id) return String(body.guild_id);
    return null;
  }

  // --- Helper: extraer packages ---
  function extractPackages(body) {
    const subject = body?.subject || body?.payload || body;
    return subject?.products || subject?.packages || subject?.items || [];
  }

  // --- Helper: discord_id desde variables del paquete ---
  function getDiscordIdFromVariables(pkgs) {
    for (const pkg of pkgs) {
      const vars = pkg?.variables || pkg?.custom_fields || [];
      if (Array.isArray(vars)) {
        const v = vars.find(v => v?.identifier === "discord_id" || v?.name === "discord_id");
        if (v?.option || v?.value) return String(v.option || v.value);
      }
    }
    return null;
  }

  // --- Helper: tier y expiración ---
  function getTierAndExpiry(pkgId) {
    const tier = PACKAGE_TIER_MAP[String(pkgId)];
    if (!tier) return null;
    const now = new Date();
    if (tier === "lifetime") return { tier, lifetime: true, expires_at: null };
    if (tier === "pro_monthly") return { tier, lifetime: false, expires_at: new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000).toISOString() };
    if (tier === "pro_yearly") return { tier, lifetime: false, expires_at: new Date(now.getTime() + 366 * 24 * 60 * 60 * 1000).toISOString() };
    return { tier, lifetime: false, expires_at: null };
  }

  // --- Helper: guardar premium en cache ---
  async function savePremiumToCache(guildId, tier, lifetime, expiresAt, ownerUserId) {
    try {
      const db = getDB();
      if (!db) return false;
      const now = new Date();
      await db.collection("premium_cache").updateOne(
        { guild_id: guildId },
        {
          $set: {
            guild_id: guildId,
            has_premium: true,
            tier,
            lifetime: !!lifetime,
            expires_at: expiresAt,
            owner_user_id: ownerUserId || null,
            app_cache_expires_at: new Date(now.getTime() + 5 * 60 * 1000),
            ttl_expires_at: expiresAt
              ? new Date(new Date(expiresAt).getTime() + 60 * 60 * 1000)
              : new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000),
            cached_at: now,
            source: "tebex_webhook",
          },
        },
        { upsert: true }
      );
      logger.info("tebex", `Premium cached for guild ${guildId}`, { tier });
      return true;
    } catch (err) {
      logger.error("tebex", "Error saving premium cache", { error: err.message });
      return false;
    }
  }

  // --- Helper: revocar premium (refund/reversal) ---
  async function revokePremium(guildId, reason) {
    try {
      const db = getDB();
      if (!db) return false;
      await db.collection("premium_cache").updateOne(
        { guild_id: guildId },
        { $set: { has_premium: false, tier: null, revoked_at: new Date(), revoke_reason: reason, app_cache_expires_at: new Date(0) } }
      );
      logger.warn("tebex", `Premium revoked for guild ${guildId}`, { reason });
      return true;
    } catch (err) {
      logger.error("tebex", "Error revoking premium", { error: err.message });
      return false;
    }
  }

  // --- Webhook endpoint ---
  app.post("/", async (req, res) => {
    if (!SECRET_KEY) {
      logger.error("tebex", "TEBEX_SECRET_KEY not configured — rejecting webhook");
      return res.status(500).end();
    }

    const eventType = req.body?.type || req.body?.event || "unknown";
    const paymentId = String(req.body?.id || req.body?.subject?.transaction_id || req.body?.subject?.id || "");
    const signature = req.headers["x-tebex-signature"] || "";

    // Validation webhooks: Tebex no siempre envía firma aquí — solo responder id
    if (eventType === "validation.webhook") {
      logger.info("tebex", `Validation webhook — id=${paymentId}`);
      return res.status(200).json({ id: req.body?.id });
    }

    // Para todos los demás eventos: firma obligatoria
    if (!signature) {
      logger.warn("tebex", "Webhook sin firma — rechazando", { eventType, paymentId });
      return res.status(401).end();
    }
    if (!verifySignature(req.rawBody, signature)) {
      logger.warn("tebex", "Firma inválida — rechazando", { eventType, paymentId });
      return res.status(401).end();
    }

    logger.info("tebex", `Evento recibido: ${eventType}`, { paymentId });

    const isRefundEvent = ["payment.refunded", "payment.reversed", "payment.dispute.closed"].some(e => eventType === e);
    const isPaymentEvent = !isRefundEvent && (eventType.toLowerCase().includes("payment") || eventType.toLowerCase().includes("recurring"));

    if (!isPaymentEvent && !isRefundEvent) {
      return res.status(200).json({ id: paymentId || null });
    }

    // Idempotencia: no procesar el mismo payment_id dos veces
    if (paymentId && await isEventAlreadyProcessed(paymentId)) {
      logger.info("tebex", `Evento duplicado ignorado`, { paymentId, eventType });
      return res.status(200).end();
    }

    // Marcar como procesado ANTES de actuar (evita race conditions en reintentos)
    if (paymentId) {
      await markEventProcessed(paymentId, eventType, { event_type: eventType });
    }

    const payload = req.body?.subject || req.body?.payload || req.body;
    const packages = extractPackages(req.body);
    const guildId = extractGuildId(req.body);
    const player = payload?.player || payload?.customer || {};
    const discordId = player?.uuid || player?.id || getDiscordIdFromVariables(packages) || null;

    if (!guildId) {
      logger.warn("tebex", "No se encontró guild_id en custom fields", { paymentId, eventType });
    }

    // Procesar async sin bloquear respuesta a Tebex
    (async () => {
      try {
        const client = getClient ? getClient() : null;

        // --- REFUND / REVERSAL: desactivar PRO ---
        if (isRefundEvent) {
          if (guildId) {
            await revokePremium(guildId, eventType);
            if (client && discordId) {
              try {
                const user = await client.users.fetch(discordId);
                await user.send({ embeds: [
                  new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle("⚠️ PRO subscription cancelled")
                    .setDescription("Your TON618 PRO subscription has been refunded or reversed. PRO features have been deactivated.")
                    .setTimestamp(),
                ] });
              } catch { /* DM puede fallar */ }
            }
          }
          return;
        }

        // --- PAYMENT COMPLETED: generar código y enviar DM ---
        const discordUsername = payload?.customer?.username || payload?.player?.username || null;

        for (const pkg of packages) {
          const packageId = String(pkg?.id || pkg?.package_id || "");
          const tierInfo = getTierAndExpiry(packageId);
          if (!tierInfo) {
            logger.warn("tebex", `Paquete sin mapeo de tier`, { packageId });
            continue;
          }

          if (guildId) {
            await savePremiumToCache(guildId, tierInfo.tier, tierInfo.lifetime, tierInfo.expires_at, discordId);
          }

          const durationDays = tierInfo.tier === "lifetime" ? null : tierInfo.tier === "pro_monthly" ? 31 : 366;
          const code = generateCode(12);
          const codeExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

          await createCode({
            code,
            plan: "pro",
            duration_days: durationDays,
            created_by: "tebex_webhook",
            expires_at: codeExpiresAt,
            notes: `Tebex · ${tierInfo.tier} · ${discordUsername || discordId || "unknown"} · payment=${paymentId}`,
            source: "tebex_purchase",
          });

          logger.info("tebex", `Código generado`, { code, discordId, tier: tierInfo.tier });

          if (discordId && client) {
            try {
              const user = await client.users.fetch(discordId);
              const planLabel = tierInfo.tier === "lifetime" ? "Lifetime" : tierInfo.tier === "pro_monthly" ? "Monthly" : "Yearly";
              await user.send({ embeds: [
                new EmbedBuilder()
                  .setColor(0x5865F2)
                  .setTitle("🎉 Thanks for your purchase!")
                  .setDescription(
                    `Your **TON618 PRO ${planLabel}** activation code is ready.\n\n` +
                    `**Code:** \`${code}\`\n\n` +
                    `Go to your Discord server and run:\n\`/premium activate ${code}\``
                  )
                  .addFields(
                    { name: "Expires in", value: "90 days", inline: true },
                    { name: "Plan", value: planLabel, inline: true }
                  )
                  .setFooter({ text: "TON618 Bot · One-time use code" })
                  .setTimestamp(),
              ] });
              logger.info("tebex", `DM enviado a ${discordId}`);
            } catch (dmErr) {
              logger.warn("tebex", `No se pudo enviar DM`, { discordId, error: dmErr.message });
            }
          }
        }
      } catch (err) {
        logger.error("tebex", "Error procesando webhook async", { error: err.message, paymentId });
      }
    })();

    return res.status(200).end();
  });

  // --- Health check ---
  app.get("/health", (req, res) => {
    res.json({ status: "ok", configured: !!SECRET_KEY, packageTierMap: Object.keys(PACKAGE_TIER_MAP) });
  });

  return app;
}

module.exports = { createTebexApp };
