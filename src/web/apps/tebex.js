"use strict";

const express = require("express");
const crypto = require("crypto");
const { getDB } = require("../utils/database");

/**
 * Tebex Webhook App
 * Recibe webhooks de pago de Tebex Checkout y activa el tier PRO en MongoDB.
 *
 * Variables de entorno requeridas:
 * - TEBEX_SECRET_KEY   : Secret key para validar firmas (Webhook Secret en Tebex dashboard)
 *
 * La URL a configurar en Tebex es: https://ton618bot.xyz/webhook-tebex
 */

function createTebexApp({ getClient }) {
  const app = express();

  // --- Config ---
  const SECRET_KEY = process.env.TEBEX_SECRET_KEY;

  // Mapeo package_id -> tier para premium_cache
  const PACKAGE_TIER_MAP = {
    "7434172": "pro_monthly",
    "7434175": "pro_yearly",
    "7434185": "lifetime",
  };

  // --- Middleware: raw body para validar firma ---
  app.use(
    express.raw({ type: "application/json" }),
    (req, res, next) => {
      if (req.body && Buffer.isBuffer(req.body)) {
        req.rawBody = req.body;
        try {
          req.body = JSON.parse(req.body.toString("utf8"));
        } catch {
          req.body = {};
        }
      }
      next();
    }
  );

  // --- Firma helper ---
  function verifySignature(rawBody, signature) {
    if (!SECRET_KEY || !signature) return false;
    const expected = crypto
      .createHmac("sha256", SECRET_KEY)
      .update(rawBody)
      .digest("hex");
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, "hex"),
        Buffer.from(signature, "hex")
      );
    } catch {
      return false;
    }
  }

  // --- Helper: extraer guild_id del payload ---
  function extractGuildId(body) {
    const subject = body?.subject || body?.payload || body;
    // Custom fields de Tebex Checkout
    const custom = subject?.custom || subject?.variables || {};
    if (custom?.guild_id) return String(custom.guild_id);
    if (custom?.server_id) return String(custom.server_id);
    // Fallback: buscar en todo el payload
    if (body?.guild_id) return String(body.guild_id);
    return null;
  }

  // --- Helper: extraer package_id del payload ---
  function extractPackages(body) {
    const subject = body?.subject || body?.payload || body;
    return subject?.products || subject?.packages || subject?.items || [];
  }

  // --- Helper: determinar tier y expiración ---
  function getTierAndExpiry(pkgId) {
    const tier = PACKAGE_TIER_MAP[String(pkgId)];
    if (!tier) return null;

    const now = new Date();
    if (tier === "lifetime") {
      return { tier, lifetime: true, expires_at: null };
    }
    if (tier === "pro_monthly") {
      const expiry = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
      return { tier, lifetime: false, expires_at: expiry.toISOString() };
    }
    if (tier === "pro_yearly") {
      const expiry = new Date(now.getTime() + 366 * 24 * 60 * 60 * 1000);
      return { tier, lifetime: false, expires_at: expiry.toISOString() };
    }
    return { tier, lifetime: false, expires_at: null };
  }

  // --- Helper: guardar premium en MongoDB ---
  async function savePremiumToCache(guildId, tier, lifetime, expiresAt, ownerUserId) {
    try {
      const db = getDB();
      if (!db) {
        console.warn("[TebexWebhook] DB no disponible, no se pudo guardar premium");
        return false;
      }
      const now = new Date();
      const appCacheExpires = new Date(now.getTime() + 5 * 60 * 1000);
      const ttlExpires = new Date(now.getTime() + 60 * 60 * 1000);

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
            app_cache_expires_at: appCacheExpires,
            ttl_expires_at: ttlExpires,
            cached_at: now,
            source: "tebex_webhook",
          },
        },
        { upsert: true }
      );
      console.log(`[TebexWebhook] Premium guardado para guild ${guildId}: tier=${tier}`);
      return true;
    } catch (err) {
      console.error("[TebexWebhook] Error guardando premium:", err.message);
      return false;
    }
  }

  // --- Webhook endpoint ---
  app.post("/", async (req, res) => {
    const signature = req.headers["x-tebex-signature"] || "";

    if (!SECRET_KEY) {
      console.error("[TebexWebhook] TEBEX_SECRET_KEY no configurado");
      return res.status(200).json({ received: true, error: "Server misconfiguration" });
    }

    if (!verifySignature(req.rawBody, signature)) {
      console.warn("[TebexWebhook] Firma inválida");
      return res.status(200).json({ received: true, error: "Invalid signature" });
    }

    const eventType = req.body?.type || req.body?.event || "unknown";
    console.log(`[TebexWebhook] Evento recibido: ${eventType}`);

    // Aceptar todos los eventos de pago de Tebex Checkout
    const isPaymentEvent = [
      "payment.completed",
      "payment.success",
      "payment.created",
      "payment.refunded",
      "payment.reversed",
      "recurring.payment",
    ].some(e => eventType.toLowerCase().includes("payment"));

    if (!isPaymentEvent) {
      return res.status(200).json({ received: true, processed: false, reason: "Event type ignored" });
    }

    const payload = req.body?.subject || req.body?.payload || req.body;
    const packages = extractPackages(req.body);
    const guildId = extractGuildId(req.body);
    const player = payload?.player || payload?.customer || {};
    const discordId = player?.uuid || player?.id || null;

    if (!guildId) {
      console.warn("[TebexWebhook] No se encontró guild_id en custom fields del checkout");
    }

    // Procesar async sin bloquear la respuesta a Tebex
    (async () => {
      try {
        for (const pkg of packages) {
          const packageId = String(pkg?.id || pkg?.package_id || "");
          const tierInfo = getTierAndExpiry(packageId);
          if (!tierInfo) {
            console.log(`[TebexWebhook] Paquete ${packageId} sin mapeo de tier configurado`);
            continue;
          }

          if (guildId) {
            await savePremiumToCache(
              guildId,
              tierInfo.tier,
              tierInfo.lifetime,
              tierInfo.expires_at,
              discordId
            );
          }
        }
      } catch (err) {
        console.error("[TebexWebhook] Error procesando async:", err.message);
      }
    })();

    // Siempre responder 200 a Tebex para evitar reintentos
    return res.status(200).json({ received: true, processed: true });
  });

  // --- GET handler: Tebex validation probe ---
  app.get("/", (req, res) => {
    res.status(200).json({
      status: "ok",
      message: "TON618 Tebex webhook endpoint ready",
      configured: !!SECRET_KEY,
      packageTierMap: Object.keys(PACKAGE_TIER_MAP),
    });
  });

  // --- Health check ---
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      configured: !!SECRET_KEY,
      packageTierMap: Object.keys(PACKAGE_TIER_MAP),
    });
  });

  return app;
}

module.exports = { createTebexApp };
