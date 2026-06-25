"use strict";

const {
  ticketCategories,
} = require("./runtime");

const DASHBOARD_HTTP_TIMEOUT_MS = Math.max(
  3000,
  Number(process.env.DASHBOARD_HTTP_TIMEOUT_MS || process.env.BOT_STATS_HTTP_TIMEOUT_MS || 10000)
);
const DEFAULT_UPTIME_PERCENTAGE = Number(
  Number(process.env.BOT_STATS_UPTIME_PERCENTAGE || 99.9).toFixed(2)
);
const RELEVANT_SETTINGS_KEYS = new Set([
  "dashboard_channel",
  "transcript_channel",
  "weekly_report_channel",
  "daily_sla_report_enabled",
  "daily_sla_report_channel",
  "live_members_channel",
  "live_role_channel",
  "live_role_id",
  "support_role",
  "admin_role",
  "verify_role",
  "max_tickets",
  "global_ticket_limit",
  "cooldown_minutes",
  "min_days",
  "auto_close_minutes",
  "sla_minutes",
  "smart_ping_minutes",
  "sla_escalation_enabled",
  "sla_escalation_minutes",
  "sla_escalation_role",
  "sla_escalation_channel",
  "sla_overrides_priority",
  "sla_overrides_category",
  "sla_escalation_overrides_priority",
  "sla_escalation_overrides_category",
  "auto_assign_enabled",
  "auto_assign_require_online",
  "auto_assign_respect_away",
  "incident_mode_enabled",
  "incident_paused_categories",
  "incident_message",
  "dm_on_open",
  "dm_on_close",
  "dm_transcripts",
  "dm_alerts",
  "bot_language",
  "simple_help_mode",
  "maintenance_mode",
  "maintenance_reason",
  "rate_limit_enabled",
  "rate_limit_window_seconds",
  "rate_limit_max_actions",
  "rate_limit_bypass_admin",
  "command_rate_limit_enabled",
  "command_rate_limit_window_seconds",
  "command_rate_limit_max_actions",
  "command_rate_limit_overrides",
  "panel_channel_id",
  "disabled_commands",
  "disabled_playbooks",
  "dashboard_general_settings",
  "dashboard_moderation_settings",
  "dashboard_automod_settings",
  "dashboard_music_settings",
  "dashboard_preferences",
]);


function fetchWithTimeout(url, options = {}, timeoutMs = DASHBOARD_HTTP_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timer);
  });
}

function getConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  return {
    url,
    key: serviceRoleKey,
    enabled: Boolean(url && serviceRoleKey),
  };
}

function getMissingBridgeConfigFields(config = getConfig()) {
  const missing = [];
  if (!config.url) {
    missing.push("SUPABASE_URL");
  }
  if (!config.key) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  return missing;
}

function getHeaders(config, options = {}) {
  const headers = {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
  };

  if (options.includeBody) {
    headers["Content-Type"] = "application/json";
  }

  if (options.preferResolution) {
    headers.Prefer = "resolution=merge-duplicates,return=representation";
  } else if (options.returnRepresentation) {
    headers.Prefer = "return=representation";
  } else if (options.returnMinimal) {
    headers.Prefer = "return=minimal";
  }

  return headers;
}

function isBridgeEnabled() {
  return getConfig().enabled;
}

function hasDashboardRelevantChange(patch = {}) {
  return Object.keys(patch || {}).some((key) => RELEVANT_SETTINGS_KEYS.has(key));
}

function formatMetricDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toIsoOrNull(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toValidDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toInt(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function toNullableString(value) {
  if (value === null || value === undefined) return null;
  const out = String(value).trim();
  return out ? out : null;
}

function toNullableDiscordId(value) {
  const out = toNullableString(value);
  if (!out) return null;
  const digits = out.replace(/[^\d]/g, "");
  return /^\d{16,22}$/.test(digits) ? digits : null;
}

function toStringList(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

function resolveTicketQueueType(categoryId) {
  const normalized = String(categoryId || "").trim().toLowerCase();
  if (["report", "partnership", "staff", "association", "staff_app"].includes(normalized)) {
    return "community";
  }
  return "support";
}

function resolveTicketPriority(value, fallback = "normal") {
  const normalized = String(value || "").trim().toLowerCase();
  return ["low", "normal", "high", "urgent"].includes(normalized) ? normalized : fallback;
}

function resolveTicketWorkflowStatus(ticket) {
  if (ticket?.status === "closed") {
    return "closed";
  }

  const stored = String(ticket?.workflow_status || "").trim().toLowerCase();
  if ([
    "new",
    "triage",
    "waiting_user",
    "waiting_staff",
    "escalated",
    "resolved",
    "closed",
  ].includes(stored)) {
    return stored;
  }

  if (ticket?.first_staff_response) {
    return "waiting_user";
  }

  return "waiting_staff";
}

function resolveActorKind(userId, ticket) {
  if (!userId) return "system";
  if (ticket?.user_id && userId === ticket.user_id) return "customer";
  return "staff";
}

function resolveTicketActorLabel(ticket, actorId) {
  if (!actorId) return null;
  if (ticket?.user_id === actorId) return ticket?.user_tag || null;
  if (ticket?.claimed_by === actorId) return ticket?.claimed_by_tag || null;
  if (ticket?.assigned_to === actorId) return ticket?.assigned_to_tag || null;
  return null;
}

function buildTicketMacroRows(guildId, records = {}) {
  const language = records?.settingsRecord?.bot_language === "en" ? "en" : "es";
  const macros = language === "en"
    ? [
        ["welcome", "Welcome", "Thanks for reaching out. We are reviewing your ticket and will reply shortly.", "public", 1],
        ["need_details", "Need details", "Could you share the exact steps, screenshots, and any relevant IDs so we can investigate faster?", "public", 2],
        ["handoff", "Handoff note", "Handoff: context captured, impact assessed, pending specialist follow-up.", "internal", 3],
        ["resolved", "Resolved", "We believe this is now resolved. If you need anything else, reply here and we will reopen the case.", "public", 4],
      ]
    : [
        ["welcome", "Bienvenida", "Gracias por escribirnos. Ya estamos revisando tu ticket y te responderemos en breve.", "public", 1],
        ["need_details", "Pedir detalle", "Compartenos pasos exactos, capturas y cualquier ID relevante para investigar mas rapido.", "public", 2],
        ["handoff", "Nota de handoff", "Handoff interno: contexto levantado, impacto validado y pendiente seguimiento del especialista.", "internal", 3],
        ["resolved", "Resolucion", "Creemos que esto ya quedo resuelto. Si necesitas algo mas, responde aqui y reabrimos el caso.", "public", 4],
      ];

  return macros.map(([macroId, label, content, visibility, sortOrder]) => ({
    guild_id: guildId,
    macro_id: macroId,
    label,
    content,
    visibility,
    sort_order: sortOrder,
    is_system: true,
    updated_at: new Date().toISOString(),
  }));
}

function premiumTierToLabel(premiumTier) {
  switch (Number(premiumTier) || 0) {
    case 3:
      return "tier_3";
    case 2:
      return "tier_2";
    case 1:
      return "tier_1";
    default:
      return "free";
  }
}


module.exports = {
  DASHBOARD_HTTP_TIMEOUT_MS,
  DEFAULT_UPTIME_PERCENTAGE,
  RELEVANT_SETTINGS_KEYS,
  fetchWithTimeout,
  getConfig,
  getMissingBridgeConfigFields,
  getHeaders,
  isBridgeEnabled,
  hasDashboardRelevantChange,
  formatMetricDate,
  startOfUtcDay,
  toIsoOrNull,
  toValidDate,
  isPlainObject,
  toInt,
  toBoolean,
  toNullableString,
  toNullableDiscordId,
  toStringList,
  resolveTicketQueueType,
  resolveTicketPriority,
  resolveTicketWorkflowStatus,
  resolveActorKind,
  resolveTicketActorLabel,
  buildTicketMacroRows,
  premiumTierToLabel,
};
