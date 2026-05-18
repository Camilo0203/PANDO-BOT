"use strict";

/**
 * Servicio de códigos de canje PRO
 * Maneja generación, validación y activación de membresías
 */

const crypto = require("crypto");
const { redeemCode, rollbackRedemption } = require("./database/proRedeemCodes");
const { settings, getDB } = require("./database");
const logger = require("./structuredLogger");
const { buildCommercialSettingsPatch, resolveCommercialState } = require("./commercial");
const { assignSupportRole, notifyRedemption } = require("./supportProRoles");

// Configuración de duraciones predefinidas
const DURATION_PRESETS = {
  "30d": 30,
  "90d": 90,
  "180d": 180,
  "1y": 365,
  "lifetime": null, // Sin expiración
};

/**
 * Genera un código aleatorio de canje
 * @param {number} length - Longitud del código (default: 12)
 * @returns {string} Código generado
 */
function generateCode(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Sin I, O, 0, 1 para evitar confusión
  let result = "";
  const bytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }

  // Formato: XXXX-XXXX-XXXX para legibilidad
  if (length === 12) {
    return `${result.slice(0, 4)}-${result.slice(4, 8)}-${result.slice(8, 12)}`;
  }

  return result;
}

/**
 * Genera múltiples códigos únicos
 * @param {number} count - Cantidad de códigos
 * @param {number} length - Longitud de cada código
 * @returns {Array<string>} Array de códigos generados
 */
function generateCodes(count, length = 12) {
  const codes = new Set();

  while (codes.size < count) {
    codes.add(generateCode(length));
  }

  return Array.from(codes);
}

/**
 * Resuelve la duración en días desde un preset o valor numérico
 * @param {string|number} duration - Preset o número de días
 * @returns {number|null} Días de duración (null para lifetime)
 */
function resolveDuration(duration) {
  if (typeof duration === "number") return duration;

  const normalized = String(duration).toLowerCase().trim();

  if (DURATION_PRESETS[normalized] !== undefined) {
    return DURATION_PRESETS[normalized];
  }

  // Intentar parsear como número
  const parsed = parseInt(normalized, 10);
  if (!isNaN(parsed) && parsed > 0) {
    return parsed;
  }

  return 30; // Default
}

/**
 * Calcula la fecha de expiración de PRO
 * @param {number|null} durationDays - Días de duración (null = lifetime)
 * @returns {Date|null} Fecha de expiración (null para lifetime)
 */
function calculateExpiration(durationDays) {
  if (durationDays === null) return null;

  const now = new Date();
  return new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
}

/**
 * Activa PRO en un servidor usando un código redimido
 * @param {Object} redemption - Datos de la redención
 * @returns {Promise<{success: boolean, error?: string, planExpiresAt?: Date}>}
 */
async function activateProInGuild(redemption) {
  try {
    const guildId = redemption.redeemed_guild_id;
    const durationDays = redemption.duration_days;

    // Obtener configuración actual
    const guildSettings = await settings.get(guildId);
    if (!guildSettings) {
      return { success: false, error: "guild_not_found" };
    }

    // Calcular nueva expiración
    const currentState = resolveCommercialState(guildSettings);
    const now = new Date();

    let newExpiresAt;
    if (durationDays === null) {
      // Lifetime - sin expiración
      newExpiresAt = null;
    } else if (currentState.isPro && currentState.planExpiresAt && currentState.planExpiresAt > now) {
      // Extender plan existente
      newExpiresAt = new Date(currentState.planExpiresAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
    } else {
      // Nuevo plan
      newExpiresAt = calculateExpiration(durationDays);
    }

    // Aplicar cambios
    const patch = buildCommercialSettingsPatch(guildSettings, {
      plan: "pro",
      plan_source: `redeem:${redemption.code}`,
      plan_started_at: currentState.planStartedAt || now,
      plan_expires_at: newExpiresAt,
      updated_at: now,
    });

    await settings.update(guildId, patch);

    // Sync premium_cache so premiumService reflects activation immediately
    try {
      const db = getDB();
      if (db) {
        const tier = durationDays === null ? "lifetime" : durationDays <= 31 ? "pro_monthly" : "pro_yearly";
        const cacheNow = new Date();
        await db.collection("premium_cache").updateOne(
          { guild_id: guildId },
          {
            $set: {
              guild_id: guildId,
              has_premium: true,
              tier,
              lifetime: durationDays === null,
              expires_at: newExpiresAt ? newExpiresAt.toISOString() : null,
              owner_user_id: redemption.redeemed_by || null,
              app_cache_expires_at: new Date(cacheNow.getTime() + 5 * 60 * 1000),
              ttl_expires_at: newExpiresAt
                ? new Date(newExpiresAt.getTime() + 60 * 60 * 1000)
                : new Date(cacheNow.getTime() + 10 * 365 * 24 * 60 * 60 * 1000),
              cached_at: cacheNow,
              source: "code_redemption",
            },
          },
          { upsert: true }
        );
      }
    } catch (cacheErr) {
      logger.warn("proCodeService", "Failed to sync premium_cache after activation (non-critical)", { error: cacheErr?.message });
    }

    return {
      success: true,
      planExpiresAt: newExpiresAt,
      isExtension: currentState.isPro && currentState.planExpiresAt > now,
    };
  } catch (error) {
    logger.error("proCodeService", "Error activating PRO", { error: error?.message || String(error) });
    return { success: false, error: "activation_failed" };
  }
}

/**
 * Procesa el canje completo: valida, redime, activa PRO y asigna rol en servidor de soporte
 * @param {string} code - Código a canjear
 * @param {string} userId - ID del usuario
 * @param {string} guildId - ID del servidor
 * @param {import('discord.js').Client} client - Cliente de Discord (opcional, para asignar rol)
 * @returns {Promise<{success: boolean, error?: string, redemption?: Object, activation?: Object, roleResult?: Object}>}
 */
async function processRedemption(code, userId, guildId, client = null) {
  // Paso 1: Redimir el código
  const redemptionResult = await redeemCode(code, userId, guildId);

  if (!redemptionResult.success) {
    return {
      success: false,
      error: redemptionResult.error,
    };
  }

  // Paso 2: Activar PRO en el servidor
  const activationResult = await activateProInGuild(redemptionResult.redemption);

  if (!activationResult.success) {
    // Rollback: restaurar el código para que pueda usarse nuevamente
    logger.warn("proCodeService", "Activación PRO falló, ejecutando rollback", {
      code: code.toUpperCase(),
      guildId,
      userId,
      error: activationResult.error,
    });

    const rollbackResult = await rollbackRedemption(code);

    if (!rollbackResult.success) {
      logger.error("proCodeService", "Rollback falló", {
        code: code.toUpperCase(),
        rollbackError: rollbackResult.error,
        originalError: activationResult.error,
      });
    } else {
      logger.info("proCodeService", "Rollback exitoso", {
        code: code.toUpperCase(),
      });
    }

    return {
      success: false,
      error: activationResult.error,
      redemption: redemptionResult.redemption,
      rollback: rollbackResult.success,
    };
  }

  // Paso 3: Asignar rol en servidor de soporte (si hay cliente disponible)
  let roleResult = null;
  if (client) {
    roleResult = await assignSupportRole(client, userId, redemptionResult.redemption);
    
    // Notificar en canal de logs
    await notifyRedemption(client, redemptionResult.redemption, activationResult);
  }

  return {
    success: true,
    redemption: redemptionResult.redemption,
    activation: activationResult,
    roleResult,
  };
}

/**
 * Valida que un usuario sea owner del servidor
 * @param {string} userId - ID del usuario
 * @param {import('discord.js').Guild} guild - Objeto guild de Discord
 * @returns {boolean}
 */
function isGuildOwner(userId, guild) {
  return userId === guild.ownerId;
}

module.exports = {
  generateCode,
  generateCodes,
  resolveDuration,
  calculateExpiration,
  activateProInGuild,
  processRedemption,
  isGuildOwner,
  DURATION_PRESETS,
};
