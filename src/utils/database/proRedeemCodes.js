"use strict";

/**
 * Módulo de base de datos para códigos de canje PRO
 * Permite generar, validar y redimir códigos de membresía
 */

const { getDB } = require("./core");
const COLLECTION_NAME = "pro_redeem_codes";
const REDEMPTIONS_COLLECTION = "pro_redemptions";

/**
 * Crea un nuevo código de canje
 * @param {Object} codeData - Datos del código
 * @returns {Promise<Object>} Código creado
 */
async function createCode(codeData) {
  const db = getDB();
  const collection = db.collection(COLLECTION_NAME);

  const code = {
    code: codeData.code.toUpperCase(),
    plan: codeData.plan || "pro",
    duration_days: codeData.duration_days !== undefined ? codeData.duration_days : 30,
    created_by: codeData.created_by,
    created_at: new Date(),
    expires_at: codeData.expires_at || null,
    redeemed: false,
    redeemed_by: null,
    redeemed_at: null,
    redeemed_guild_id: null,
    notes: codeData.notes || null,
    source: codeData.source || "manual",
    tier: codeData.tier || null,
    provider: codeData.provider || null,
    provider_order_id: codeData.provider_order_id || null,
    provider_subscription_id: codeData.provider_subscription_id || null,
    provider_effect_id: codeData.provider_effect_id || null,
    provider_package_id: codeData.provider_package_id || null,
    purchaser_user_id: codeData.purchaser_user_id || null,
    revoked: false,
    revoked_at: null,
    revoke_reason: null,
    used: false,
    _id: undefined,
  };

  await collection.insertOne(code);
  return code;
}

/**
 * Busca un código por su valor
 * @param {string} code - Código a buscar
 * @returns {Promise<Object|null>} Código encontrado o null
 */
async function findByCode(code) {
  const db = getDB();
  const collection = db.collection(COLLECTION_NAME);
  return await collection.findOne({ code: code.toUpperCase() });
}

/**
 * Verifica si un código es válido y puede redimirse
 * @param {string} code - Código a validar
 * @returns {Promise<{valid: boolean, reason?: string, codeData?: Object}>}
 */
async function validateCode(code) {
  const codeData = await findByCode(code);

  if (!codeData) {
    return { valid: false, reason: "not_found" };
  }

  if (codeData.redeemed) {
    return { valid: false, reason: "already_redeemed", codeData };
  }

  if (codeData.revoked) {
    return { valid: false, reason: "revoked", codeData };
  }

  if (codeData.expires_at && new Date() > new Date(codeData.expires_at)) {
    return { valid: false, reason: "expired", codeData };
  }

  return { valid: true, codeData };
}

/**
 * Redime un código para un usuario y servidor específico
 * @param {string} code - Código a redimir
 * @param {string} userId - ID del usuario que redime
 * @param {string} guildId - ID del servidor donde se activa PRO
 * @returns {Promise<{success: boolean, error?: string, redemption?: Object}>}
 */
async function redeemCode(code, userId, guildId) {
  const db = getDB();
  const codesCollection = db.collection(COLLECTION_NAME);
  const redemptionsCollection = db.collection(REDEMPTIONS_COLLECTION);

  const now = new Date();

  // Atomic claim: only succeeds if the code exists, is not redeemed, and is not expired.
  // Using findOneAndUpdate prevents two concurrent requests from both claiming the same code.
  const codeData = await codesCollection.findOneAndUpdate(
    {
      code: code.toUpperCase(),
      redeemed: false,
      revoked: { $ne: true },
      $or: [
        { expires_at: null },
        { expires_at: { $exists: false } },
        { expires_at: { $gt: now } },
      ],
    },
    {
      $set: {
        redeemed: true,
        redeemed_by: userId,
        redeemed_at: now,
        redeemed_guild_id: guildId,
      },
    },
    { returnDocument: "before" }
  );

  if (!codeData) {
    // Determine the specific reason for the failure
    const existing = await codesCollection.findOne({ code: code.toUpperCase() });
    if (!existing) return { success: false, error: "not_found" };
    if (existing.redeemed) return { success: false, error: "already_redeemed" };
    if (existing.revoked) return { success: false, error: "revoked" };
    if (existing.expires_at && new Date() > new Date(existing.expires_at)) {
      return { success: false, error: "expired" };
    }
    return { success: false, error: "not_found" };
  }

  // Registrar la redención
  const redemption = {
    code: code.toUpperCase(),
    plan: codeData.plan,
    duration_days: codeData.duration_days,
    redeemed_by: userId,
    redeemed_guild_id: guildId,
    redeemed_at: now,
    code_created_by: codeData.created_by,
    code_created_at: codeData.created_at,
    source: codeData.source,
    tier: codeData.tier || null,
    provider: codeData.provider || null,
    provider_order_id: codeData.provider_order_id || null,
    provider_subscription_id: codeData.provider_subscription_id || null,
  };

  await redemptionsCollection.insertOne(redemption);

  return { success: true, redemption };
}

/**
 * Lista códigos con filtros opcionales
 * @param {Object} filters - Filtros de búsqueda
 * @param {Object} options - Opciones de paginación
 * @returns {Promise<Array<Object>>}
 */
async function listCodes(filters = {}, options = {}) {
  const db = getDB();
  const collection = db.collection(COLLECTION_NAME);

  const query = {};

  if (filters.redeemed !== undefined) {
    query.redeemed = filters.redeemed;
  }

  if (filters.plan) {
    query.plan = filters.plan;
  }

  if (filters.created_by) {
    query.created_by = filters.created_by;
  }

  if (filters.source) {
    query.source = filters.source;
  }

  const limit = options.limit || 50;
  const skip = options.skip || 0;

  return await collection
    .find(query)
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();
}

/**
 * Cuenta códigos según filtros
 * @param {Object} filters - Filtros de búsqueda
 * @returns {Promise<number>}
 */
async function countCodes(filters = {}) {
  const db = getDB();
  const collection = db.collection(COLLECTION_NAME);

  const query = {};

  if (filters.redeemed !== undefined) {
    query.redeemed = filters.redeemed;
  }

  if (filters.plan) {
    query.plan = filters.plan;
  }

  if (filters.created_by) {
    query.created_by = filters.created_by;
  }

  return await collection.countDocuments(query);
}

/**
 * Obtiene estadísticas de códigos
 * @returns {Promise<Object>}
 */
async function getStats() {
  const db = getDB();
  const collection = db.collection(COLLECTION_NAME);

  const total = await collection.countDocuments();
  const redeemed = await collection.countDocuments({ redeemed: true });
  const available = await collection.countDocuments({ redeemed: false });
  const expired = await collection.countDocuments({
    redeemed: false,
    expires_at: { $lt: new Date() },
  });

  return {
    total,
    redeemed,
    available: available - expired,
    expired,
  };
}

/**
 * Revoca un código (solo si no ha sido redimido)
 * @param {string} code - Código a revocar
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function revokeCode(code) {
  const db = getDB();
  const collection = db.collection(COLLECTION_NAME);

  const codeData = await findByCode(code);

  if (!codeData) {
    return { success: false, error: "not_found" };
  }

  if (codeData.redeemed) {
    return { success: false, error: "already_redeemed" };
  }

  await collection.deleteOne({ code: code.toUpperCase() });
  return { success: true };
}

/**
 * Revierte una redención cuando la activación de PRO falla
 * Restaura el código a estado no redimido y elimina el registro de redención
 * @param {string} code - Código a restaurar
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function rollbackRedemption(code) {
  const db = getDB();
  const codesCollection = db.collection(COLLECTION_NAME);
  const redemptionsCollection = db.collection(REDEMPTIONS_COLLECTION);

  const codeData = await findByCode(code);

  if (!codeData) {
    return { success: false, error: "not_found" };
  }

  if (!codeData.redeemed) {
    return { success: false, error: "not_redeemed" };
  }

  // Restaurar el código a estado no redimido
  await codesCollection.updateOne(
    { code: code.toUpperCase() },
    {
      $set: {
        redeemed: false,
        updated_at: new Date(),
      },
      $unset: {
        redeemed_by: "",
        redeemed_at: "",
        redeemed_guild_id: "",
      },
    }
  );

  // Eliminar el registro de redención
  await redemptionsCollection.deleteOne({ code: code.toUpperCase() });

  return { success: true };
}

async function findRedemptionByProvider({ provider = "tebex", orderId = null, subscriptionId = null } = {}) {
  const db = getDB();
  const query = { provider };

  if (subscriptionId) {
    query.provider_subscription_id = String(subscriptionId);
  } else if (orderId) {
    query.provider_order_id = String(orderId);
  } else {
    return null;
  }

  return db.collection(REDEMPTIONS_COLLECTION)
    .find(query)
    .sort({ redeemed_at: -1 })
    .limit(1)
    .next();
}

async function findAvailableCodeByProviderEffect({
  provider = "tebex",
  effectId = null,
} = {}) {
  if (!effectId) return null;

  const db = getDB();
  return db.collection(COLLECTION_NAME).findOne({
    provider,
    provider_effect_id: String(effectId),
    revoked: { $ne: true },
  });
}

async function revokeProviderCodes({
  provider = "tebex",
  orderId = null,
  subscriptionId = null,
  reason = "provider_revoked",
} = {}) {
  const db = getDB();
  const query = {
    provider,
    redeemed: false,
  };

  if (subscriptionId) {
    query.provider_subscription_id = String(subscriptionId);
  } else if (orderId) {
    query.provider_order_id = String(orderId);
  } else {
    return { matchedCount: 0, modifiedCount: 0 };
  }

  return db.collection(COLLECTION_NAME).updateMany(query, {
    $set: {
      revoked: true,
      revoked_at: new Date(),
      revoke_reason: reason,
    },
  });
}

module.exports = {
  createCode,
  findByCode,
  validateCode,
  redeemCode,
  listCodes,
  countCodes,
  getStats,
  revokeCode,
  rollbackRedemption,
  findRedemptionByProvider,
  findAvailableCodeByProviderEffect,
  revokeProviderCodes,
  COLLECTION_NAME,
  REDEMPTIONS_COLLECTION,
};
