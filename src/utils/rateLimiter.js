const logger = require("./structuredLogger");

const buckets = new Map();
let lastCleanupAt = 0;

const CLEANUP_INTERVAL_MS = 60 * 1000;
const MAX_BUCKETS_SIZE = 50000; // Max entries to prevent memory leak
const MAX_BUCKETS_WARNING_THRESHOLD = 45000;

function cleanup(now) {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;

  for (const [key, entry] of buckets.entries()) {
    if (!entry || entry.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function evictLRUEntry() {
  // Remove oldest entry (first in Map) when approaching limit
  const firstKey = buckets.keys().next().value;
  if (firstKey !== undefined) {
    buckets.delete(firstKey);
  }
}

function buildKey(guildId, userId, scope = "global") {
  const g = guildId || "dm";
  return `${g}::${userId}::${scope}`;
}

function checkUserRateLimit({
  guildId,
  userId,
  scope = "global",
  windowSeconds = 10,
  maxActions = 8,
}) {
  const now = Date.now();
  cleanup(now);

  // Memory leak protection: evict oldest entries if approaching limit
  if (buckets.size >= MAX_BUCKETS_SIZE) {
    evictLRUEntry();
  }

  // Log warning if approaching threshold (once per cleanup interval)
  if (buckets.size >= MAX_BUCKETS_WARNING_THRESHOLD && now - lastCleanupAt >= CLEANUP_INTERVAL_MS) {
    logger.warn("rateLimiter", "Approaching max capacity", { current: buckets.size, max: MAX_BUCKETS_SIZE });
  }

  const key = buildKey(guildId, userId, scope);
  const windowMs = Math.max(1, Number(windowSeconds || 10)) * 1000;
  const max = Math.max(1, Number(maxActions || 8));

  let entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs, createdAt: now };
  }

  entry.count += 1;
  entry.lastAccessedAt = now;
  buckets.set(key, entry);

  if (entry.count <= max) {
    return {
      limited: false,
      remaining: Math.max(0, max - entry.count),
      retryAfterMs: 0,
      retryAfterSec: 0,
    };
  }

  const retryAfterMs = Math.max(0, entry.resetAt - now);
  return {
    limited: true,
    remaining: 0,
    retryAfterMs,
    retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
  };
}

// Global cross-guild rate limiting to prevent users from spamming across multiple servers
const globalUserBuckets = new Map();
const GLOBAL_RATE_LIMIT_MAX = 30; // Max actions across all guilds
const GLOBAL_RATE_LIMIT_WINDOW = 10; // seconds
let lastGlobalCleanupAt = 0;
const GLOBAL_CLEANUP_INTERVAL_MS = 60 * 1000;

function cleanupGlobalBuckets(now) {
  if (now - lastGlobalCleanupAt < GLOBAL_CLEANUP_INTERVAL_MS) return;
  lastGlobalCleanupAt = now;

  for (const [key, entry] of globalUserBuckets.entries()) {
    if (!entry || entry.resetAt <= now) {
      globalUserBuckets.delete(key);
    }
  }
}

function checkGlobalUserRateLimit(userId, scope = "commands") {
  const now = Date.now();
  cleanupGlobalBuckets(now);

  const windowMs = GLOBAL_RATE_LIMIT_WINDOW * 1000;
  const key = `${userId}::${scope}`;

  let entry = globalUserBuckets.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
  }

  entry.count += 1;
  entry.lastAccessedAt = now;
  globalUserBuckets.set(key, entry);

  if (entry.count <= GLOBAL_RATE_LIMIT_MAX) {
    return {
      limited: false,
      remaining: Math.max(0, GLOBAL_RATE_LIMIT_MAX - entry.count),
      retryAfterMs: 0,
      retryAfterSec: 0,
    };
  }

  const retryAfterMs = Math.max(0, entry.resetAt - now);
  return {
    limited: true,
    remaining: 0,
    retryAfterMs,
    retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    global: true,
  };
}

function getGlobalRateLimitStats() {
  return {
    bucketsCount: globalUserBuckets.size,
    maxActions: GLOBAL_RATE_LIMIT_MAX,
    windowSeconds: GLOBAL_RATE_LIMIT_WINDOW,
  };
}

function getBucketStats() {
  return {
    size: buckets.size,
    maxSize: MAX_BUCKETS_SIZE,
    warningThreshold: MAX_BUCKETS_WARNING_THRESHOLD,
    cleanupIntervalMs: CLEANUP_INTERVAL_MS,
    lastCleanupAt,
  };
}

function resetRateLimiter() {
  buckets.clear();
  lastCleanupAt = 0;
}

module.exports = {
  checkUserRateLimit,
  resetRateLimiter,
  getBucketStats,
  checkGlobalUserRateLimit,
  getGlobalRateLimitStats,
};
