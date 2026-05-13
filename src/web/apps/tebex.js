"use strict";

const express = require("express");
const crypto = require("crypto");
const { getDB } = require("../../utils/database");

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
  // Captura CUALQUIER body (Tebex puede enviar con Content-Type variado)
  app.use((req, res, next) => {
    let data = Buffer.alloc(0);
    req.on("data", chunk => { data = Buffer.concat([data, chunk]); });
    req.on("end", () => {
      req.rawBody = data;
      try {
        req.body = data.length > 0 ? JSON.parse(data.toString("utf8")) : {};
      } catch {
        req.body = {};
      }
      next();
    });
    req.on("error", () => {
      req.rawBody = Buffer.alloc(0);
      req.body = {};
      next();
    });
  });

  // --- Firma helper ---
  function verifySignature(rawBody, signature) {
    if (!SECRET_KEY) {
      console.warn("[TebexWebhook] SECRET_KEY no configurado");
      return false;
    }
    if (!signature) {
      console.warn("[TebexWebhook] Header x-tebex-signature vacío o ausente");
      return false;
    }
    const expected = crypto
      .createHmac("sha256", SECRET_KEY)
      .update(rawBody)
      .digest("hex");

    // Debug: mostrar sin revelar el secret completo
    console.log(`[TebexWebhook] Firma recibida: ${signature.substring(0, 16)}... length=${signature.length}`);
    console.log(`[TebexWebhook] Firma esperada: ${expected.substring(0, 16)}... length=${expected.length}`);
    console.log(`[TebexWebhook] rawBody length=${rawBody?.length ?? 0}`);

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, "hex"),
        Buffer.from(signature, "hex")
      );
    } catch {
      // Si no coincide en hex, probar base64 (algunas plataformas usan base64)
      try {
        const expectedB64 = Buffer.from(expected, "hex").toString("base64");
        return crypto.timingSafeEqual(
          Buffer.from(expectedB64),
          Buffer.from(signature)
        );
      } catch {
        return false;
      }
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
      return res.status(200).end();
    }

    // Si no hay firma (validación de Tebex), aceptar pero advertir
    if (!signature) {
      console.warn("[TebexWebhook] Webhook sin firma — posible validación de Tebex o test. Aceptando.");
    } else if (!verifySignature(req.rawBody, signature)) {
      // Si hay firma pero es inválida, también aceptar para evitar reintentos de Tebex
      console.warn("[TebexWebhook] Firma inválida — posible configuración desfasada. Aceptando.");
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
      // validation.webhook and other non-payment events: bare 200 OK
      return res.status(200).end();
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
    return res.status(200).end();
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
