"use strict";

/**
 * Data Retention & Privacy Compliance
 * Limpieza automática de datos antiguos para cumplimiento GDPR/CCPA
 */

const { getDB } = require("../utils/database/core");
const { logStructured } = require("../utils/observability");
const { circuitBreak } = require("../utils/circuitBreaker");

// Defaults de retención (en días)
const DEFAULT_RETENTION = {
  verif_logs: 30,
  closed_tickets: 90,
  audit_logs: 180,
  user_activity: 365,
  deleted_channels: 7,
  temp_data: 1,
};

/**
 * Obtiene políticas de retención para un guild
 */
async function getRetentionSettings(guildId) {
  const db = getDB();
  const settings = await db.collection("settings").findOne(
    { guild_id: guildId },
    { projection: { data_retention: 1, retention_days: 1 } }
  );

  const base = {
    ...DEFAULT_RETENTION,
    ...(settings?.data_retention || {}),
  };

  // If master retention_days is set (> 0), it acts as a unified policy
  if (settings?.retention_days > 0) {
    const days = Number(settings.retention_days);
    base.closed_tickets = days;
    base.audit_logs = days;
    base.verif_logs = days;
  }

  return base;
}

/**
 * Limpia logs de verificación antiguos
 */
async function cleanupVerifLogs(guildId, retentionDays) {
  const db = getDB();
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await circuitBreak("mongodb", async () => {
    return await db.collection("verifLogs").deleteMany({
      guild_id: guildId,
      created_at: { $lt: cutoffDate },
    });
  });

  return result.deletedCount || 0;
}

/**
 * Limpia tickets cerrados antiguos (y sus datos relacionados)
 */
async function cleanupClosedTickets(guildId, retentionDays) {
  const db = getDB();
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  // Encontrar tickets cerrados antiguos
  const oldTickets = await db.collection("tickets").find({
    guild_id: guildId,
    status: { $in: ["closed", "deleted"] },
    closed_at: { $lt: cutoffDate },
  }, { projection: { _id: 1, ticket_id: 1 } }).toArray();

  if (oldTickets.length === 0) return 0;

  const ticketIds = oldTickets.map(t => t.ticket_id);

  // Eliminar en transacción
  await circuitBreak("mongodb", async () => {
    // Eliminar eventos
    await db.collection("ticketEvents").deleteMany({
      guild_id: guildId,
      ticket_id: { $in: ticketIds },
    });

    // Eliminar notas
    await db.collection("ticketNotes").deleteMany({
      guild_id: guildId,
      ticket_id: { $in: ticketIds },
    });

    // Eliminar tickets
    await db.collection("tickets").deleteMany({
      guild_id: guildId,
      ticket_id: { $in: ticketIds },
    });
  });

  return oldTickets.length;
}

/**
 * Limpia audit logs antiguos
 */
async function cleanupAuditLogs(guildId, retentionDays) {
  const db = getDB();
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await circuitBreak("mongodb", async () => {
    return await db.collection("auditLogs").deleteMany({
      guild_id: guildId,
      created_at: { $lt: cutoffDate },
    });
  });

  return result.deletedCount || 0;
}

/**
 * Limpia datos temporales/expirados
 */
async function cleanupTempData(guildId) {
  const db = getDB();
  const now = new Date();

  let deletedCount = 0;

  await circuitBreak("mongodb", async () => {
    // Códigos de verificación expirados
    const verifCodes = await db.collection("verifCodes").deleteMany({
      guild_id: guildId,
      expires_at: { $lt: now },
    });
    deletedCount += verifCodes.deletedCount || 0;

    // Captchas expirados
    const captchas = await db.collection("verifCaptchas").deleteMany({
      guild_id: guildId,
      expires_at: { $lt: now },
    });
    deletedCount += captchas.deletedCount || 0;

    // Locks de creación expirados (TTL debería manejarlo, pero por si acaso)
    const locks = await db.collection("ticketCreateLocks").deleteMany({
      guild_id: guildId,
      expires_at: { $lt: now },
    });
    deletedCount += locks.deletedCount || 0;
  });

  return deletedCount;
}

/**
 * Limpia datos de usuarios que ya no están en el guild (orphaned data)
 */
async function cleanupOrphanedUserData(guildId) {
  // Esta función requiere acceso al client de Discord
  // Se ejecuta en el cron job con el client como parámetro
  return 0; // Placeholder - implementación abajo
}

/**
 * Ejecuta limpieza completa para un guild
 */
async function runDataRetentionForGuild(guildId, client = null) {
  const startTime = Date.now();
  const retention = await getRetentionSettings(guildId);

  const stats = {
    guildId,
    verifLogsDeleted: 0,
    ticketsDeleted: 0,
    auditLogsDeleted: 0,
    tempDataDeleted: 0,
    orphanedDeleted: 0,
    errors: [],
  };

  try {
    stats.verifLogsDeleted = await cleanupVerifLogs(guildId, retention.verif_logs);
  } catch (error) {
    stats.errors.push({ task: "verifLogs", error: error.message });
  }

  try {
    stats.ticketsDeleted = await cleanupClosedTickets(guildId, retention.closed_tickets);
  } catch (error) {
    stats.errors.push({ task: "tickets", error: error.message });
  }

  try {
    stats.auditLogsDeleted = await cleanupAuditLogs(guildId, retention.audit_logs);
  } catch (error) {
    stats.errors.push({ task: "auditLogs", error: error.message });
  }

  try {
    stats.tempDataDeleted = await cleanupTempData(guildId);
  } catch (error) {
    stats.errors.push({ task: "tempData", error: error.message });
  }

  if (client) {
    try {
      stats.orphanedDeleted = await cleanupOrphanedUserDataImpl(guildId, client);
    } catch (error) {
      stats.errors.push({ task: "orphaned", error: error.message });
    }
  }

  stats.durationMs = Date.now() - startTime;
  stats.totalDeleted = stats.verifLogsDeleted + stats.ticketsDeleted +
                       stats.auditLogsDeleted + stats.tempDataDeleted + stats.orphanedDeleted;

  logStructured("info", "data_retention.completed", {
    guild: guildId,
    totalDeleted: stats.totalDeleted,
    durationMs: stats.durationMs,
    hasErrors: stats.errors.length > 0,
  });

  return stats;
}

/**
 * Implementación de limpieza de datos huérfanos
 *
 * CORRECCIÓN NF3: guild.members.cache es una caché PARCIAL — sólo contiene
 * los miembros vistos desde el último reinicio del shard. En guilds grandes,
 * puede tener 50 entradas de 5000 miembros reales, generando falsos positivos
 * masivos que destruyen datos de verificación de usuarios legítimos.
 *
 * SOLUCIÓN: Verificar cada candidato individualmente contra la API de Discord
 * con force:true para saltarse la caché. Se procesa en lotes para no saturar
 * el rate limit de Discord (50/s por defecto por route).
 */
async function cleanupOrphanedUserDataImpl(guildId, client) {
  const db = getDB();
  let deletedCount = 0;
  const MAX_PER_RUN = 50;    // Máximo de candidatos a verificar por ejecución
  const BATCH_SIZE = 10;     // Requests paralelas por lote
  const INTER_BATCH_MS = 400; // Pausa entre lotes (ms) para respetar rate limits

  let guild;
  try {
    guild = await client.guilds.fetch(guildId);
  } catch {
    return 0;
  }

  const records = await db.collection("verifMemberStates").find(
    { guild_id: guildId },
    { projection: { user_id: 1 } }
  ).limit(MAX_PER_RUN).toArray();

  if (records.length === 0) return 0;

  const orphanedIds = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (record) => {
        try {
          // force: true omite guild.members.cache y hace la request real a Discord.
          // Si el usuario NO está en el guild, Discord devuelve 404 → lanza error.
          await guild.members.fetch({ user: record.user_id, force: true });
        } catch {
          orphanedIds.push(record.user_id);
        }
      })
    );

    if (i + BATCH_SIZE < records.length) {
      await new Promise((r) => setTimeout(r, INTER_BATCH_MS));
    }
  }

  if (orphanedIds.length > 0) {
    await db.collection("verifMemberStates").deleteMany({
      guild_id: guildId,
      user_id: { $in: orphanedIds },
    });
    deletedCount += orphanedIds.length;
  }

  return deletedCount;
}

/**
 * Ejecuta limpieza para todos los guilds
 */
async function runGlobalDataRetention(client) {
  const db = getDB();
  const startTime = Date.now();

  // Obtener todos los guilds que tienen settings
  const guildIds = await db.collection("settings").distinct("guild_id");

  const results = {
    totalGuilds: guildIds.length,
    processed: 0,
    failed: 0,
    totalDeleted: 0,
    guilds: [],
  };

  for (const guildId of guildIds) {
    try {
      const stats = await runDataRetentionForGuild(guildId, client);
      results.processed++;
      results.totalDeleted += stats.totalDeleted;
      results.guilds.push({ id: guildId, ...stats });
    } catch (error) {
      results.failed++;
      logStructured("error", "data_retention.guild_failed", {
        guild: guildId,
        error: error.message,
      });
    }
  }

  results.durationMs = Date.now() - startTime;

  logStructured("info", "data_retention.global_completed", {
    totalGuilds: results.totalGuilds,
    processed: results.processed,
    failed: results.failed,
    totalDeleted: results.totalDeleted,
    durationMs: results.durationMs,
  });

  return results;
}

/**
 * Actualiza configuración de retención para un guild
 */
async function setRetentionSettings(guildId, settings) {
  const db = getDB();
  const validSettings = {};

  // Validar y sanitizar
  const validKeys = Object.keys(DEFAULT_RETENTION);
  for (const key of validKeys) {
    if (settings[key] !== undefined) {
      const val = parseInt(settings[key], 10);
      if (!isNaN(val) && val >= 1 && val <= 3650) {
        validSettings[key] = val;
      }
    }
  }

  await db.collection("settings").updateOne(
    { guild_id: guildId },
    {
      $set: {
        data_retention: validSettings,
        "data_retention.updated_at": new Date(),
      },
    },
    { upsert: true }
  );

  return validSettings;
}

module.exports = {
  // Core functions
  runDataRetentionForGuild,
  runGlobalDataRetention,
  setRetentionSettings,
  getRetentionSettings,

  // Individual cleanup functions
  cleanupVerifLogs,
  cleanupClosedTickets,
  cleanupAuditLogs,
  cleanupTempData,

  // Constants
  DEFAULT_RETENTION,
};
