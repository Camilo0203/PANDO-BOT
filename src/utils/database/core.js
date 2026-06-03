"use strict";

const { MongoClient } = require("mongodb");
const chalk = require("../../../chalk-compat");
const { parseBoolean } = require("../envHelpers");
const logger = require("../structuredLogger");

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB || "ton618_bot";

let client = null;
let db = null;
let indexesEnsured = false;

function shouldEnsureIndexes(options = {}) {
  if (typeof options.ensureIndexes === "boolean") return options.ensureIndexes;
  return parseBoolean(process.env.MONGO_AUTO_INDEXES, true);
}

async function ensureIndexes(force = false) {
  if (!db) throw new Error("Base de datos no conectada. Llama a connectDB() primero.");
  if (indexesEnsured && !force) return false;
  await createIndexes();
  indexesEnsured = true;
  return true;
}

async function connectDB(options = {}) {
  if (db) {
    // Verify the cached connection is still alive
    const alive = await pingDB(3000).catch(() => false);
    if (!alive) {
      logger.warn('database.mongo', 'Cached DB connection stale, reconnecting...');
      db = null;
      client = null;
    } else {
      if (shouldEnsureIndexes(options)) {
        await ensureIndexes();
      }
      return db;
    }
  }

  try {
    client = new MongoClient(MONGO_URI, {
      maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 10,
      // 10s gives MongoDB Atlas time to elect a primary under network pressure;
      // 5s caused spurious startup failures in Square Cloud cold starts.
      serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 10000,
      connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS) || 15000,
    });

    await client.connect();
    db = client.db(DB_NAME);

    client.on("serverDescriptionChanged", () => {
      pingDB().then(isOk => {
        if (isOk) {
          logger.debug('database.mongo', 'Topology changed, db ping ok');
        } else {
          logger.warn('database.mongo', 'Topology changed, db ping failed');
        }
      }).catch(err => {
        logger.warn('database.mongo', 'Topology changed, ping error', { error: err?.message });
      });
    });

    if (shouldEnsureIndexes(options)) {
      await ensureIndexes();
    }

    logger.info('database.mongo', 'Connected to MongoDB');
    return db;
  } catch (error) {
    logger.error('database.mongo', 'Error connecting to MongoDB', { error: error.message, stack: error.stack });
    throw error;
  }
}

async function createIndexes() {
  try {
    const ticketCollection = db.collection("tickets");
    const existingTicketIndexes = await ticketCollection.indexes().catch((err) => {
      logger.warn('database.mongo', 'Failed to read ticket indexes', { error: err?.message });
      return [];
    });
    for (const idx of existingTicketIndexes) {
      if (idx?.name === "_id_") continue;
      const keys = Object.keys(idx?.key || {});
      const isLegacyTicketIdIndex = keys.length === 1 && idx.key.ticket_id === 1;
      if (!isLegacyTicketIdIndex) continue;
      await ticketCollection.dropIndex(idx.name).catch((err) => {
        logger.warn('database.mongo', 'Failed to drop legacy index', { index: idx.name, error: err?.message });
      });
    }

    await ticketCollection.createIndex({ channel_id: 1 }, { unique: true , background: true });
    await ticketCollection.createIndex({ guild_id: 1, ticket_id: 1 }, { unique: true , background: true });
    await ticketCollection.createIndex({ guild_id: 1, status: 1 }, { background: true });
    await ticketCollection.createIndex({ user_id: 1, guild_id: 1 }, { background: true });
    await ticketCollection.createIndex({ guild_id: 1, status: 1, last_activity: 1 }, { background: true });
    await ticketCollection.createIndex({ guild_id: 1, status: 1, last_customer_message_at: 1 }, { background: true });
    await ticketCollection.createIndex({ guild_id: 1, status: 1, last_staff_message_at: 1 }, { background: true });
    await ticketCollection.createIndex({ guild_id: 1, status: 1, first_staff_response: 1, created_at: 1 }, { background: true });
    await ticketCollection.createIndex({ guild_id: 1, status: 1, sla_escalated_at: 1, first_staff_response: 1 }, { background: true });
    await ticketCollection.createIndex({ guild_id: 1, created_at: -1, status: 1, category_id: 1, priority: 1 }, { background: true });
    await ticketCollection.createIndex({ guild_id: 1, workflow_status: 1, updated_at: -1 }, { background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create workflow_status index', { error: err?.message });
    });
    await ticketCollection.createIndex({ guild_id: 1, queue_type: 1, status: 1 }, { background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create queue_type index', { error: err?.message });
    });

    await db.collection("settings").createIndex({ guild_id: 1 }, { unique: true , background: true });
    await db.collection("levels").createIndex({ guild_id: 1, user_id: 1 }, { unique: true , background: true });
    await db.collection("levels").createIndex({ guild_id: 1, total_xp: -1 }, { background: true });
    await db.collection("staffStats").createIndex({ key: 1 }, { unique: true , background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create staffStats key index', { error: err?.message });
    });
    await db.collection("staffStats").createIndex({ guild_id: 1, tickets_closed: -1 }, { background: true });
    await db.collection("autoResponses").createIndex({ guild_id: 1, trigger: 1 }, { unique: true , background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create autoResponses index', { error: err?.message });
    });
    await db.collection("autoResponses").createIndex({ guild_id: 1, enabled: 1 }, { background: true });

    await db.collection("notes").createIndex({ ticket_id: 1 }, { background: true });
    await db.collection("notes").createIndex({ guild_id: 1, ticket_id: 1, created_at: 1 }, { background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create notes index', { error: err?.message });
    });
    await db.collection("ticketEvents").createIndex({ event_id: 1 }, { unique: true , background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create ticketEvents event_id index', { error: err?.message });
    });
    await db.collection("ticketEvents").createIndex({ guild_id: 1, ticket_id: 1, created_at: -1 }, { background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create ticketEvents guild_ticket index', { error: err?.message });
    });
    await db.collection("ticketEvents").createIndex({ guild_id: 1, created_at: -1 }, { background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create ticketEvents guild_created index', { error: err?.message });
    });
    await db.collection("ticketCreateLocks").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 , background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create ticketCreateLocks TTL index', { error: err?.message });
    });
    await db.collection("blacklist").createIndex({ guild_id: 1, user_id: 1 }, { background: true });
    await db.collection("reminders").createIndex({ fire_at: 1 }, { background: true });
    await db.collection("giveaways").createIndex({ message_id: 1 }, { unique: true , background: true });
    await db.collection("giveaways").createIndex({ guild_id: 1, ended: 1, end_at: 1 }, { background: true });
    await db.collection("verifSettings").createIndex({ guild_id: 1 }, { unique: true , background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create verifSettings index', { error: err?.message });
    });
    await db.collection("verifCodes").createIndex({ guild_id: 1, user_id: 1 }, { unique: true , background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create verifCodes index', { error: err?.message });
    });

    // Additional production indexes for performance
    await ticketCollection.createIndex({ user_id: 1, status: 1, created_at: -1 }, { background: true });
    await ticketCollection.createIndex({ guild_id: 1, assigned_to: 1, status: 1 }, { background: true });
    await db.collection("verifLogs").createIndex({ created_at: 1 }, { expireAfterSeconds: 2592000 , background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create verifLogs TTL index', { error: err?.message });
    });
    await db.collection("verifCodes").createIndex({ expires_at: 1 }, { background: true });
    await db.collection("verifLogs").createIndex({ guild_id: 1, created_at: -1 }, { background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create verifLogs guild index', { error: err?.message });
    });
    await db.collection("verifLogs").createIndex({ guild_id: 1, user_id: 1, created_at: -1 }, { background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create verifLogs guild_user index', { error: err?.message });
    });
    await db.collection("verifLogs").createIndex({ guild_id: 1, event: 1, created_at: -1 }, { background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create verifLogs guild_event index', { error: err?.message });
    });
    await db.collection("verifMemberStates").createIndex({ guild_id: 1, user_id: 1 }, { unique: true , background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create verifMemberStates index', { error: err?.message });
    });
    await db.collection("verifMemberStates").createIndex({ guild_id: 1, status: 1, updated_at: -1 }, { background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create verifMemberStates status index', { error: err?.message });
    });
    await db.collection("verifMemberStates").createIndex({ guild_id: 1, is_verified: 1, joined_at: 1 }, { background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create verifMemberStates verified index', { error: err?.message });
    });
    await db.collection("verifMemberStates").createIndex({ guild_id: 1, last_joined_at: -1 }, { background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create verifMemberStates last_joined index', { error: err?.message });
    });
    await db.collection("verifMetrics").createIndex({ guild_id: 1 }, { unique: true , background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create verifMetrics index', { error: err?.message });
    });
    await db.collection("verifCaptchas").createIndex({ guild_id: 1, user_id: 1 }, { unique: true , background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create verifCaptchas index', { error: err?.message });
    });
    await db.collection("verifCaptchas").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 , background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create verifCaptchas TTL index', { error: err?.message });
    });
    await db.collection("polls").createIndex({ ended: 1, ends_at: 1 }, { background: true });

    await db.collection("alerts").createIndex({ guild_id: 1 }, { background: true });
    await db.collection("alerts").createIndex({ platform: 1 }, { background: true });
    await db.collection("counters").createIndex({ guild_id: 1, name: 1 }, { unique: true , background: true });
    await db.collection("configBackups").createIndex({ guild_id: 1, created_at: -1 }, { background: true });
    await db.collection("configBackups").createIndex({ guild_id: 1, backup_id: 1 }, { unique: true , background: true });
    await db.collection("botHealth").createIndex({ id: 1 }, { unique: true , background: true });
    await db.collection("auditLogs").createIndex({ guild_id: 1, created_at: -1 }, { background: true });
    await db.collection("auditLogs").createIndex({ guild_id: 1, actor_id: 1, created_at: -1 }, { background: true });
    await db.collection("auditLogs").createIndex({ guild_id: 1, kind: 1, action: 1, created_at: -1 }, { background: true });
    await db.collection("featureFlags").createIndex({ flag_name: 1 }, { unique: true , background: true });
    await db.collection("featureFlags").createIndex({ enabled: 1, updated_at: -1 }, { background: true });

    // Indexes for distributed locks (enterprise feature)
    await db.collection("distributedLocks").createIndex({ lock_name: 1 }, { unique: true , background: true });
    await db.collection("distributedLocks").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 , background: true });
    await db.collection("distributedLocks").createIndex({ instance_id: 1 }, { background: true });

    // Indexes for membership reminders
    await db.collection("membershipReminders").createIndex({ guild_id: 1, days_before: 1 }, { background: true });
    await db.collection("membershipReminders").createIndex({ created_at: 1 }, { expireAfterSeconds: 2592000 , background: true }); // TTL 30 días

    // Indexes for PRO redeem codes
    await db.collection("pro_redeem_codes").createIndex({ code: 1 }, { unique: true , background: true });
    await db.collection("pro_redeem_codes").createIndex({ redeemed: 1, created_at: -1 }, { background: true });
    await db.collection("pro_redeem_codes").createIndex({ created_by: 1 }, { background: true });
    await db.collection("pro_redeem_codes").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 , background: true });
    await db.collection("pro_redemptions").createIndex({ redeemed_by: 1, redeemed_at: -1 }, { background: true });
    await db.collection("pro_redemptions").createIndex({ redeemed_guild_id: 1 }, { background: true });

    // Indexes for webhook idempotency (TTL 90 days)
    await db.collection("webhook_events").createIndex({ payment_id: 1 }, { unique: true , background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create webhook_events payment_id index', { error: err?.message });
    });
    await db.collection("webhook_events").createIndex({ processed_at: 1 }, { expireAfterSeconds: 7776000 , background: true }).catch((err) => {
      logger.warn('database.mongo', 'Failed to create webhook_events TTL index', { error: err?.message });
    });

    logger.info('databaseCore', 'MongoDB indexes created');
  } catch (error) {
    logger.error('databaseCore', 'Error creating MongoDB indexes', { error: error?.message || String(error) });
    throw error;
  }
}

function getDB() {
  if (!db) throw new Error("Base de datos no conectada. Llama a connectDB() primero.");
  return db;
}

async function pingDB(timeoutMs = 1500) {
  if (!db) return false;

  const waitMs = Math.max(250, Number(timeoutMs) || 1500);
  let timerId = null;
  const timeout = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(new Error("MongoDB ping timeout")), waitMs);
  });

  try {
    await Promise.race([
      db.command({ ping: 1 }),
      timeout,
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timerId) clearTimeout(timerId);
  }
}

function isDbUnavailableError(error) {
  if (!error) return false;
  if (error.code === "DB_UNAVAILABLE") return true;
  const message = String(error.message || "");
  return message.includes("Base de datos no conectada");
}

function toDbUnavailableError(error, context = "database") {
  if (error?.code === "DB_UNAVAILABLE") return error;
  const dbError = new Error("DB_UNAVAILABLE:" + context);
  dbError.code = "DB_UNAVAILABLE";
  dbError.context = context;
  dbError.cause = error || null;
  return dbError;
}

async function closeDB() {
  try {
    if (client) {
      await client.close();
    }
  } catch (error) {
    logger.warn('databaseCore', 'Error closing MongoDB', { error: error?.message || String(error) });
  } finally {
    client = null;
    db = null;
    indexesEnsured = false;
  }
}

module.exports = {
  connectDB,
  ensureIndexes,
  getDB,
  getDb: getDB,
  pingDB,
  closeDB,
  isDbUnavailableError,
  toDbUnavailableError,
};
