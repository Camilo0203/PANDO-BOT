"use strict";

const express = require("express");

/**
 * Health App (health.ton618bot.xyz)
 * Returns a detailed JSON health overview for Square Cloud monitoring,
 * Discord gateway state, MongoDB connectivity, memory, and build info.
 */
function createHealthApp({ healthState, buildInfo, getClient }) {
  const app = express();
  app.use(express.json());

  const { buildHealthPayload } = require("../../utils/runtimeHealth");
  const { getMemoryState } = require("../../utils/memoryManager");

  // ── Grace period for Square Cloud early probes ──
  const STARTUP_GRACE_MS = Number(process.env.HEALTH_STARTUP_GRACE_MS) || 90_000;
  const startedAt = Date.now();

  function isInGracePeriod() {
    return Date.now() - startedAt < STARTUP_GRACE_MS;
  }

  // ── Rate limiting (per-IP, in-memory) ──
  const RL_WINDOW_MS = 60_000;
  const RL_MAX = 60;
  const rlMap = new Map();
  let lastRateLimitSweepAt = Date.now();

  function sweepRateLimits(now) {
    if (now - lastRateLimitSweepAt < RL_WINDOW_MS) return;
    lastRateLimitSweepAt = now;
    for (const [ip, record] of rlMap) {
      if (now - record.start > RL_WINDOW_MS) {
        rlMap.delete(ip);
      }
    }
  }

  function isRateLimited(ip) {
    const now = Date.now();
    sweepRateLimits(now);
    const record = rlMap.get(ip);
    if (!record) {
      rlMap.set(ip, { count: 1, start: now });
      return false;
    }
    if (now - record.start > RL_WINDOW_MS) {
      rlMap.set(ip, { count: 1, start: now });
      return false;
    }
    record.count += 1;
    return record.count > RL_MAX;
  }

  app.use((req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    if (isRateLimited(ip)) {
      return res.status(429).json({ error: "Too Many Requests", retryAfterSec: Math.ceil(RL_WINDOW_MS / 1000) });
    }
    next();
  });

  // ── Detailed health endpoint ──
  app.get(["/", "/health", "/status"], (req, res) => {
    const client = typeof getClient === "function" ? getClient() : null;
    const payload = buildHealthPayload({ healthState, buildInfo, client });
    const memoryState = getMemoryState();

    // Square Cloud grace period: return 200 while booting so the platform
    // does not restart the process prematurely.
    const booting = payload.status !== "ok" && isInGracePeriod();
    const httpStatus = (payload.status === "ok" || booting) ? 200 : 503;

    const enriched = {
      ...payload,
      booting,
      memoryManager: memoryState,
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };

    res.status(httpStatus).json(enriched);
  });

  // ── Strict readiness probe (no grace period) ──
  app.get("/ready", (req, res) => {
    const client = typeof getClient === "function" ? getClient() : null;
    const payload = buildHealthPayload({ healthState, buildInfo, client });
    const httpStatus = payload.status === "ok" ? 200 : 503;
    res.status(httpStatus).json({ status: payload.status, uptimeSec: payload.uptimeSec, mongoConnected: payload.mongoConnected, discordReady: payload.discordReady });
  });

  // ── Memory-only endpoint ──
  app.get("/memory", (req, res) => {
    const memoryState = getMemoryState();
    const usage = process.memoryUsage();
    res.json({
      status: "ok",
      memoryManager: memoryState,
      raw: {
        rssMB: Math.round(usage.rss / 1024 / 1024),
        heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
        externalMB: Math.round((usage.external || 0) / 1024 / 1024),
      },
    });
  });

  // ── Metrics endpoint (Prometheus-style friendly) ──
  app.get("/metrics", (req, res) => {
    const client = typeof getClient === "function" ? getClient() : null;
    const payload = buildHealthPayload({ healthState, buildInfo, client });
    const mem = process.memoryUsage();
    const lines = [
      `# ton618_bot_health status=${payload.status === "ok" ? 1 : 0}`,
      `ton618_bot_uptime_seconds ${payload.uptimeSec}`,
      `ton618_bot_guilds ${payload.discord?.guilds ?? 0}`,
      `ton618_bot_memory_rss_bytes ${mem.rss}`,
      `ton618_bot_memory_heap_used_bytes ${mem.heapUsed}`,
      `ton618_bot_memory_heap_total_bytes ${mem.heapTotal}`,
      `ton618_bot_discord_ping_ms ${payload.discord?.ping ?? -1}`,
    ];
    res.set("Content-Type", "text/plain");
    res.send(lines.join("\n") + "\n");
  });

  // ── 404 ──
  app.use((req, res) => {
    res.status(404).json({ error: "Not Found", path: req.originalUrl, domain: "health.ton618bot.xyz" });
  });

  return app;
}

module.exports = { createHealthApp };
