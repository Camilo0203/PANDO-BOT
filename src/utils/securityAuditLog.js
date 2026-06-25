"use strict";

const { getDB, isDbUnavailableError } = require("./database/core");
const logger = require("./structuredLogger");

const COLLECTION = "security_audit_events";
const MAX_STRING = 500;

function now() {
  return new Date();
}

function sanitizeString(value, max = MAX_STRING) {
  if (value === undefined || value === null) return null;
  return String(value).slice(0, max);
}

function redactValue(key, value) {
  const normalizedKey = String(key || "").toLowerCase();
  if (
    normalizedKey.includes("token") ||
    normalizedKey.includes("secret") ||
    normalizedKey.includes("password") ||
    normalizedKey.includes("api_key") ||
    normalizedKey.includes("authorization")
  ) {
    return "[REDACTED]";
  }
  return value;
}

function sanitizeMetadata(value, depth = 0) {
  if (depth > 3) return "[MAX_DEPTH]";
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") return sanitizeString(value, 1000);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => sanitizeMetadata(item, depth + 1));
  }
  if (typeof value === "object") {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      out[sanitizeString(key, 80)] = sanitizeMetadata(redactValue(key, nested), depth + 1);
    }
    return out;
  }
  return sanitizeString(value);
}

function normalizeEvent(input = {}) {
  const severity = ["info", "warning", "critical"].includes(input.severity)
    ? input.severity
    : "info";
  const source = sanitizeString(input.source || "bot", 80);
  const action = sanitizeString(input.action || "security.event", 120);

  return {
    event_id: input.eventId || `sec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    source,
    action,
    severity,
    guild_id: sanitizeString(input.guildId, 32),
    user_id: sanitizeString(input.userId, 32),
    ip_hash: sanitizeString(input.ipHash, 128),
    request_id: sanitizeString(input.requestId, 128),
    status: sanitizeString(input.status || "recorded", 60),
    metadata: sanitizeMetadata(input.metadata || {}),
    created_at: input.createdAt instanceof Date ? input.createdAt : now(),
  };
}

async function recordSecurityAuditEvent(input = {}) {
  const event = normalizeEvent(input);

  try {
    const db = getDB();
    await db.collection(COLLECTION).insertOne(event);
  } catch (error) {
    if (!isDbUnavailableError(error)) {
      logger.warn("securityAuditLog", "Failed to persist security audit event", {
        action: event.action,
        error: error?.message || String(error),
      });
    }
  }

  logger.info("securityAuditLog", "Security audit event", {
    action: event.action,
    severity: event.severity,
    source: event.source,
    guildId: event.guild_id,
    status: event.status,
  });

  return event;
}

async function ensureSecurityAuditIndexes() {
  const db = getDB();
  const collection = db.collection(COLLECTION);
  await collection.createIndex({ created_at: -1 }, { background: true });
  await collection.createIndex({ action: 1, created_at: -1 }, { background: true });
  await collection.createIndex({ severity: 1, created_at: -1 }, { background: true });
  await collection.createIndex({ guild_id: 1, created_at: -1 }, { background: true });
  await collection.createIndex({ user_id: 1, created_at: -1 }, { background: true });
  return true;
}

module.exports = {
  COLLECTION,
  normalizeEvent,
  recordSecurityAuditEvent,
  ensureSecurityAuditIndexes,
};
