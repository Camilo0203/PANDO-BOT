"use strict";

const { pingDB } = require("./database/core");
const { buildHealthPayload, updateMongoHealth } = require("./runtimeHealth");
const { alertOnStateChange, sendOperationalAlert } = require("./operationalAlerts");
const logger = require("./structuredLogger");

let interval = null;

function toInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function resolveIntervalMs() {
  return toInt(process.env.HEALTH_MONITOR_INTERVAL_MS || process.env.HEALTH_CHECK_INTERVAL_MS, 30_000, 5_000, 3_600_000);
}

function resolveMemoryWarnMb() {
  return toInt(process.env.MEMORY_WARNING_THRESHOLD_MB, 0, 0, 65_536);
}

function isDiscordHealthy(payload) {
  return payload.discordReady === true;
}

function isMongoHealthy(payload) {
  return payload.mongoConnected === true;
}

function isMemoryHealthy(payload) {
  const threshold = resolveMemoryWarnMb();
  if (!threshold) return true;
  return Number(payload.memory?.rssMB || 0) < threshold;
}

async function runHealthMonitorCheck({ healthState, buildInfo, client = null } = {}) {
  const mongoOk = await pingDB(1500);
  updateMongoHealth(healthState, mongoOk, { checkedAt: new Date().toISOString() });

  const payload = buildHealthPayload({ healthState, buildInfo, client });
  const discordOk = isDiscordHealthy(payload);
  const memoryOk = isMemoryHealthy(payload);

  await alertOnStateChange(
    "health:mongo",
    isMongoHealthy(payload),
    {
      type: "health.mongo.degraded",
      severity: "critical",
      title: "MongoDB health degraded",
      message: "TON618 cannot confirm MongoDB connectivity.",
      details: {
        lastMongoPingAt: payload.lastMongoPingAt,
        lastMongoPingOkAt: payload.lastMongoPingOkAt,
      },
    },
    {
      title: "MongoDB recovered",
      message: "MongoDB connectivity is healthy again.",
    }
  );

  await alertOnStateChange(
    "health:discord",
    discordOk,
    {
      type: "health.discord.degraded",
      severity: "critical",
      title: "Discord gateway degraded",
      message: "TON618 Discord gateway is not ready.",
      details: {
        lastDiscordEvent: payload.lastDiscordEvent,
        lastDiscordEventAt: payload.lastDiscordEventAt,
        discordCloseCode: payload.discordCloseCode,
        ping: payload.discord?.ping,
      },
    },
    {
      title: "Discord gateway recovered",
      message: "Discord gateway is healthy again.",
    }
  );

  await alertOnStateChange(
    "health:memory",
    memoryOk,
    {
      type: "health.memory.warning",
      severity: "warning",
      title: "High memory usage",
      message: "TON618 memory usage crossed the configured warning threshold.",
      details: {
        rssMB: payload.memory?.rssMB,
        heapUsedMB: payload.memory?.heapUsedMB,
        thresholdMB: resolveMemoryWarnMb(),
      },
    },
    {
      title: "Memory usage recovered",
      message: "Memory usage is back under the warning threshold.",
    }
  );

  if (payload.status !== "ok") {
    await sendOperationalAlert({
      type: "health.overall.degraded",
      severity: "warning",
      title: "TON618 health is degraded",
      message: "The public health endpoint would currently report degraded status.",
      details: {
        status: payload.status,
        mongoConnected: payload.mongoConnected,
        discordReady: payload.discordReady,
        uptimeSec: payload.uptimeSec,
      },
      dedupeKey: "health:overall",
    });
  }

  return payload;
}

function startHealthMonitor({ healthState, buildInfo, getClient } = {}) {
  if (interval) return false;
  const intervalMs = resolveIntervalMs();
  interval = setInterval(() => {
    runHealthMonitorCheck({
      healthState,
      buildInfo,
      client: typeof getClient === "function" ? getClient() : null,
    }).catch((error) => {
      logger.warn("healthMonitor", "Health monitor check failed", {
        error: error?.message || String(error),
      });
    });
  }, intervalMs);
  interval.unref?.();
  logger.info("healthMonitor", "Health monitor started", { intervalMs });
  return true;
}

function stopHealthMonitor() {
  if (!interval) return false;
  clearInterval(interval);
  interval = null;
  logger.info("healthMonitor", "Health monitor stopped");
  return true;
}

module.exports = {
  runHealthMonitorCheck,
  startHealthMonitor,
  stopHealthMonitor,
  resolveIntervalMs,
};
