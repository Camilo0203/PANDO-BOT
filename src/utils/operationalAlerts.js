"use strict";

const logger = require("./structuredLogger");
const { recordSecurityAuditEvent } = require("./securityAuditLog");

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;
const RECOVERY_COOLDOWN_MS = 30 * 1000;
const lastSent = new Map();
const activeStates = new Map();

function getWebhookUrl() {
  return process.env.ALERT_DISCORD_WEBHOOK || process.env.SECURITY_ALERTS_WEBHOOK_URL || "";
}

function toInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function getCooldownMs() {
  return toInt(process.env.OPERATIONAL_ALERT_COOLDOWN_MS, DEFAULT_COOLDOWN_MS, 10_000, 86_400_000);
}

function sanitizeDetails(details = {}) {
  const out = {};
  for (const [key, value] of Object.entries(details || {})) {
    const lower = key.toLowerCase();
    if (lower.includes("token") || lower.includes("secret") || lower.includes("password")) {
      out[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      out[key] = JSON.stringify(value).slice(0, 300);
    } else {
      out[key] = String(value ?? "").slice(0, 300);
    }
  }
  return out;
}

function shouldSend(key, severity, cooldownMs = getCooldownMs()) {
  if (severity === "critical") return true;
  const now = Date.now();
  const last = lastSent.get(key) || 0;
  if (now - last < cooldownMs) return false;
  lastSent.set(key, now);
  return true;
}

function buildDiscordPayload(alert) {
  const colors = {
    info: 0x57f287,
    warning: 0xf1c40f,
    critical: 0xed4245,
    resolved: 0x57f287,
  };
  const icons = {
    info: "ℹ️",
    warning: "⚠️",
    critical: "🚨",
    resolved: "✅",
  };
  const details = sanitizeDetails(alert.details);
  const fields = Object.entries(details).slice(0, 12).map(([name, value]) => ({
    name: name.slice(0, 256),
    value: value || "n/a",
    inline: true,
  }));

  return {
    username: "TON618 Alerts",
    embeds: [
      {
        title: `${icons[alert.severity] || "ℹ️"} ${alert.title}`,
        description: String(alert.message || "").slice(0, 4000),
        color: colors[alert.severity] || colors.info,
        timestamp: new Date().toISOString(),
        fields,
        footer: {
          text: `TON618 · ${alert.type}`,
        },
      },
    ],
  };
}

async function sendDiscordWebhook(alert) {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) return false;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildDiscordPayload(alert)),
    });
    if (!response.ok) {
      throw new Error(`Discord webhook HTTP ${response.status}`);
    }
    return true;
  } catch (error) {
    logger.warn("operationalAlerts", "Discord alert delivery failed", {
      type: alert.type,
      error: error?.message || String(error),
    });
    return false;
  }
}

async function sendOperationalAlert(input = {}) {
  const severity = ["info", "warning", "critical", "resolved"].includes(input.severity)
    ? input.severity
    : "warning";
  const type = String(input.type || "operational.alert");
  const dedupeKey = String(input.dedupeKey || type);
  const alert = {
    type,
    severity,
    dedupeKey,
    title: input.title || type,
    message: input.message || "",
    details: input.details || {},
  };

  if (!shouldSend(dedupeKey, severity, input.cooldownMs)) {
    return { sent: false, skipped: "cooldown" };
  }

  await recordSecurityAuditEvent({
    source: "operational-alerts",
    action: type,
    severity: severity === "resolved" ? "info" : severity,
    status: "alerted",
    metadata: {
      title: alert.title,
      message: alert.message,
      details: sanitizeDetails(alert.details),
    },
  });

  const sent = await sendDiscordWebhook(alert);
  logger[severity === "critical" ? "error" : severity === "warning" ? "warn" : "info"](
    "operationalAlerts",
    alert.title,
    { type, sent }
  );
  return { sent, skipped: false };
}

async function alertOnStateChange(key, isHealthy, unhealthyAlert, recoveredAlert = {}) {
  const previous = activeStates.get(key);
  activeStates.set(key, Boolean(isHealthy));

  if (previous === undefined) {
    if (!isHealthy) {
      return sendOperationalAlert({ ...unhealthyAlert, dedupeKey: key });
    }
    return { sent: false, skipped: "initial-ok" };
  }

  if (previous === true && !isHealthy) {
    return sendOperationalAlert({ ...unhealthyAlert, dedupeKey: key });
  }

  if (previous === false && isHealthy) {
    return sendOperationalAlert({
      type: recoveredAlert.type || `${unhealthyAlert.type}.resolved`,
      severity: "resolved",
      title: recoveredAlert.title || `Resolved: ${unhealthyAlert.title}`,
      message: recoveredAlert.message || "The service is healthy again.",
      details: recoveredAlert.details || unhealthyAlert.details || {},
      dedupeKey: `${key}:resolved`,
      cooldownMs: RECOVERY_COOLDOWN_MS,
    });
  }

  return { sent: false, skipped: "unchanged" };
}

function resetOperationalAlertState() {
  lastSent.clear();
  activeStates.clear();
}

module.exports = {
  sendOperationalAlert,
  alertOnStateChange,
  resetOperationalAlertState,
  buildDiscordPayload,
};
