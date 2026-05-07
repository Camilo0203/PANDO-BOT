"use strict";

const express = require("express");
const crypto = require("crypto");

/**
 * Tebex Webhook App
 * Recibe webhooks de pago de Tebex y asigna roles en Discord.
 *
 * Variables de entorno requeridas:
 * - TEBEX_SECRET_KEY   : Secret key para validar firmas
 * - TEBEX_GUILD_ID     : ID del servidor Discord donde asignar roles
 * - TEBEX_ROLE_MAP     : JSON o string con mapeo package_id -> role_id
 *
 * Opcional:
 * - TEBEX_WEBHOOK_PATH : Ruta del webhook (default: /webhook-tebex)
 */

function createTebexApp({ getClient }) {
  const app = express();

  // --- Config ---
  const SECRET_KEY = process.env.TEBEX_SECRET_KEY;
  const GUILD_ID = process.env.TEBEX_GUILD_ID;
  const ROLE_MAP_RAW = process.env.TEBEX_ROLE_MAP || "{}";

  let roleMap = {};
  try {
    roleMap = JSON.parse(ROLE_MAP_RAW);
  } catch {
    // fallback: parsear formato "pkg1:role1,pkg2:role2"
    ROLE_MAP_RAW.split(",").forEach((pair) => {
      const [pkg, role] = pair.trim().split(":");
      if (pkg && role) roleMap[pkg.trim()] = role.trim();
    });
  }

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

  // --- Webhook endpoint ---
  app.post("/webhook-tebex", async (req, res) => {
    const signature = req.headers["x-tebex-signature"] || "";

    if (!SECRET_KEY) {
      console.error("[TebexWebhook] TEBEX_SECRET_KEY no configurado");
      return res.status(500).json({ error: "Server misconfiguration" });
    }

    if (!verifySignature(req.rawBody, signature)) {
      console.warn("[TebexWebhook] Firma inválida - posible intento de spoofing");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const eventType = req.body?.type || req.body?.event || "unknown";
    const payload = req.body?.payload || req.body;

    console.log(`[TebexWebhook] Evento recibido: ${eventType}`);

    // Solo procesar pagos completados
    if (eventType !== "payment.completed" && eventType !== "payment.success") {
      return res.status(200).json({ received: true, processed: false, reason: "Event type ignored" });
    }

    if (!GUILD_ID) {
      console.error("[TebexWebhook] TEBEX_GUILD_ID no configurado");
      return res.status(500).json({ error: "Guild ID not configured" });
    }

    const client = typeof getClient === "function" ? getClient() : null;
    if (!client) {
      console.error("[TebexWebhook] Cliente de Discord no disponible");
      return res.status(503).json({ error: "Discord client unavailable" });
    }

    try {
      const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
      if (!guild) {
        console.error(`[TebexWebhook] Guild ${GUILD_ID} no encontrado`);
        return res.status(404).json({ error: "Guild not found" });
      }

      // Extraer datos del jugador/comprador
      const player = payload?.player || payload?.customer || payload?.subject || {};
      const discordId = player?.uuid || player?.id || player?.discord_id;
      const username = player?.name || player?.username || "desconocido";

      if (!discordId) {
        console.warn("[TebexWebhook] No se encontró Discord ID en el payload");
        return res.status(400).json({ error: "No Discord ID in payload" });
      }

      // Extraer paquetes comprados
      const packages = payload?.packages || payload?.items || payload?.products || [];
      const assignedRoles = [];
      const skippedRoles = [];

      for (const pkg of packages) {
        const packageId = String(pkg?.id || pkg?.package_id || "");
        const roleId = roleMap[packageId];

        if (!roleId) {
          skippedRoles.push({ packageId, reason: "No mapping configured" });
          continue;
        }

        const member = await guild.members.fetch(discordId).catch(() => null);
        if (!member) {
          skippedRoles.push({ packageId, roleId, reason: "Member not in guild" });
          continue;
        }

        if (member.roles.cache.has(roleId)) {
          skippedRoles.push({ packageId, roleId, reason: "Role already assigned" });
          continue;
        }

        await member.roles.add(roleId, `Tebex purchase: package ${packageId}`);
        assignedRoles.push({ packageId, roleId, username, discordId });
        console.log(`[TebexWebhook] Rol ${roleId} asignado a ${username} (${discordId}) por paquete ${packageId}`);
      }

      return res.status(200).json({
        received: true,
        processed: true,
        event: eventType,
        discordId,
        assignedRoles,
        skippedRoles,
      });
    } catch (err) {
      console.error("[TebexWebhook] Error procesando webhook:", err);
      return res.status(500).json({ error: "Internal error", detail: err.message });
    }
  });

  // --- Health check interno ---
  app.get("/webhook-tebex/health", (req, res) => {
    res.json({
      status: "ok",
      configured: !!SECRET_KEY && !!GUILD_ID,
      roleMapEntries: Object.keys(roleMap).length,
    });
  });

  return app;
}

module.exports = { createTebexApp };
