const { sanitizeCommandRateLimitOverrides } = require("./settingsSchema");

function pick(obj, keys) {
  const out = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj || {}, key)) {
      out[key] = obj[key];
    }
  }
  return out;
}

function toCommandNameList(value) {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => String(item || "").trim().toLowerCase())
    .filter((item) => /^[a-z0-9_-]{1,64}$/.test(item));
  return Array.from(new Set(normalized));
}

function toCategoryIdList(value) {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => String(item || "").trim().toLowerCase())
    .filter((item) => /^[a-z0-9_-]{1,64}$/.test(item));
  return Array.from(new Set(normalized));
}

function sanitizeSlaOverrides(value, keyType) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [rawKey, rawMinutes] of Object.entries(value)) {
    const key = String(rawKey || "").trim().toLowerCase();
    const valid = keyType === "priority"
      ? /^(low|normal|high|urgent)$/.test(key)
      : /^[a-z0-9_-]{1,64}$/.test(key);
    if (!valid) continue;
    const minutes = toClampedInt(rawMinutes, 1, 10080, 0);
    if (minutes > 0) out[key] = minutes;
  }
  return out;
}

const SETTINGS_KEYS = [
  "log_channel",
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
  "automod_enabled",
  "automod_presets",
  "automod_alert_channel",
  "automod_exempt_roles",
  "automod_exempt_channels",
  "automod_action_overrides",
  "automod_keyword_overrides",
  "dm_on_open",
  "dm_on_close",
  "dm_transcripts",
  "dm_alerts",
  "bot_language",
  "language_selected_at",
  "language_selected_by",
  "language_onboarding_completed",
  "simple_help_mode",
  "log_edits",
  "log_deletes",
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
  "dashboard_general_settings",
  "dashboard_moderation_settings",
  "dashboard_automod_settings",
  "dashboard_music_settings",
  "dashboard_preferences",
  "commercial_settings",
  "disabled_commands",
  "disabled_playbooks",
];

const VERIF_KEYS = [
  "enabled",
  "mode",
  "channel",
  "verified_role",
  "unverified_role",
  "log_channel",
  "panel_title",
  "panel_description",
  "panel_color",
  "panel_image",
  "question",
  "question_answer",
  "antiraid_enabled",
  "antiraid_joins",
  "antiraid_seconds",
  "antiraid_action",
  "dm_on_verify",
  "kick_unverified_hours",
];

const WELCOME_KEYS = [
  "welcome_enabled",
  "welcome_channel",
  "welcome_message",
  "welcome_color",
  "welcome_title",
  "welcome_banner",
  "welcome_thumbnail",
  "welcome_footer",
  "welcome_dm",
  "welcome_dm_message",
  "welcome_autorole",
  "goodbye_enabled",
  "goodbye_channel",
  "goodbye_message",
  "goodbye_color",
  "goodbye_title",
  "goodbye_thumbnail",
  "goodbye_footer",
];

const SUGGEST_KEYS = [
  "enabled",
  "channel",
  "log_channel",
  "approved_channel",
  "rejected_channel",
  "dm_on_result",
  "require_reason",
  "cooldown_minutes",
  "anonymous",
];

const MODLOG_KEYS = [
  "enabled",
  "channel",
  "log_bans",
  "log_unbans",
  "log_kicks",
  "log_msg_delete",
  "log_msg_edit",
  "log_role_add",
  "log_role_remove",
  "log_nickname",
  "log_joins",
  "log_leaves",
  "log_voice",
];

function toBool(value, fallback) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function toIdOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const asString = String(value).replace(/[^\d]/g, "");
  return /^\d{16,22}$/.test(asString) ? asString : null;
}

function toClampedInt(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(num)));
}

function toHex6(value, fallback) {
  if (!value) return fallback;
  const v = String(value).replace("#", "").trim();
  return /^[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : fallback;
}

function toShortString(value, maxLen, fallback = null) {
  if (value === null || value === undefined) return fallback;
  const out = String(value).trim();
  if (!out) return fallback;
  return out.slice(0, maxLen);
}

function toLanguage(value, fallback = "en") {
  const lang = String(value || "").trim().toLowerCase();
  if (lang === "es" || lang === "en") return lang;
  if (lang.startsWith("es")) return "es";
  if (lang.startsWith("en")) return "en";
  return fallback;
}

function sanitizeSettings(raw = {}) {
  return {
    log_channel: toIdOrNull(raw.log_channel),
    transcript_channel: toIdOrNull(raw.transcript_channel),
    weekly_report_channel: toIdOrNull(raw.weekly_report_channel),
    daily_sla_report_enabled: toBool(raw.daily_sla_report_enabled, false),
    daily_sla_report_channel: toIdOrNull(raw.daily_sla_report_channel),
    live_members_channel: toIdOrNull(raw.live_members_channel),
    live_role_channel: toIdOrNull(raw.live_role_channel),
    live_role_id: toIdOrNull(raw.live_role_id),
    support_role: toIdOrNull(raw.support_role),
    admin_role: toIdOrNull(raw.admin_role),
    verify_role: toIdOrNull(raw.verify_role),
    max_tickets: toClampedInt(raw.max_tickets, 1, 10, 3),
    global_ticket_limit: toClampedInt(raw.global_ticket_limit, 0, 500, 0),
    cooldown_minutes: toClampedInt(raw.cooldown_minutes, 0, 1440, 0),
    min_days: toClampedInt(raw.min_days, 0, 365, 0),
    auto_close_minutes: toClampedInt(raw.auto_close_minutes, 0, 10080, 0),
    sla_minutes: toClampedInt(raw.sla_minutes, 0, 1440, 0),
    smart_ping_minutes: toClampedInt(raw.smart_ping_minutes, 0, 1440, 0),
    sla_escalation_enabled: toBool(raw.sla_escalation_enabled, false),
    sla_escalation_minutes: toClampedInt(raw.sla_escalation_minutes, 0, 10080, 0),
    sla_escalation_role: toIdOrNull(raw.sla_escalation_role),
    sla_escalation_channel: toIdOrNull(raw.sla_escalation_channel),
    sla_overrides_priority: sanitizeSlaOverrides(raw.sla_overrides_priority, "priority"),
    sla_overrides_category: sanitizeSlaOverrides(raw.sla_overrides_category, "category"),
    sla_escalation_overrides_priority: sanitizeSlaOverrides(raw.sla_escalation_overrides_priority, "priority"),
    sla_escalation_overrides_category: sanitizeSlaOverrides(raw.sla_escalation_overrides_category, "category"),
    auto_assign_enabled: toBool(raw.auto_assign_enabled, false),
    auto_assign_require_online: toBool(raw.auto_assign_require_online, true),
    auto_assign_respect_away: toBool(raw.auto_assign_respect_away, true),
    incident_mode_enabled: toBool(raw.incident_mode_enabled, false),
    incident_paused_categories: toCategoryIdList(raw.incident_paused_categories),
    incident_message: toShortString(raw.incident_message, 500, null),
    automod_enabled: toBool(raw.automod_enabled, false),
    automod_presets: toCategoryIdList(raw.automod_presets).filter((key) =>
      ["spam", "invites", "scam"].includes(key)
    ),
    automod_alert_channel: toIdOrNull(raw.automod_alert_channel),
    automod_exempt_roles: Array.isArray(raw.automod_exempt_roles)
      ? raw.automod_exempt_roles.map((value) => toIdOrNull(value)).filter(Boolean).slice(0, 20)
      : [],
    automod_exempt_channels: Array.isArray(raw.automod_exempt_channels)
      ? raw.automod_exempt_channels.map((value) => toIdOrNull(value)).filter(Boolean).slice(0, 50)
      : [],
    automod_action_overrides:
      raw.automod_action_overrides && typeof raw.automod_action_overrides === "object"
        ? {
            enableAlerts: toBool(raw.automod_action_overrides.enableAlerts, true),
            timeoutSeconds: toClampedInt(
              raw.automod_action_overrides.timeoutSeconds,
              0,
              2419200,
              0
            ),
            timeoutPresets: toCategoryIdList(
              raw.automod_action_overrides.timeoutPresets
            ).filter((key) => ["spam", "invites", "scam"].includes(key)),
          }
        : undefined,
    automod_keyword_overrides:
      raw.automod_keyword_overrides && typeof raw.automod_keyword_overrides === "object"
        ? {
            inviteAllowList: Array.isArray(raw.automod_keyword_overrides.inviteAllowList)
              ? raw.automod_keyword_overrides.inviteAllowList
                  .map((value) => toShortString(value, 60, null))
                  .filter(Boolean)
                  .slice(0, 100)
              : [],
            scamKeywords: Array.isArray(raw.automod_keyword_overrides.scamKeywords)
              ? raw.automod_keyword_overrides.scamKeywords
                  .map((value) => toShortString(value, 60, null))
                  .filter(Boolean)
                  .slice(0, 50)
              : [],
          }
        : undefined,
    dm_on_open: toBool(raw.dm_on_open, true),
    dm_on_close: toBool(raw.dm_on_close, true),
    dm_transcripts: toBool(raw.dm_transcripts, true),
    dm_alerts: toBool(raw.dm_alerts, true),
    bot_language: toLanguage(raw.bot_language, "en"),
    language_selected_at: raw.language_selected_at || null,
    language_selected_by: toIdOrNull(raw.language_selected_by),
    language_onboarding_completed: toBool(raw.language_onboarding_completed, false),
    dashboard_general_settings: raw.dashboard_general_settings && typeof raw.dashboard_general_settings === "object"
      ? raw.dashboard_general_settings
      : undefined,
    dashboard_moderation_settings: raw.dashboard_moderation_settings && typeof raw.dashboard_moderation_settings === "object"
      ? raw.dashboard_moderation_settings
      : undefined,
    dashboard_automod_settings: raw.dashboard_automod_settings && typeof raw.dashboard_automod_settings === "object"
      ? raw.dashboard_automod_settings
      : undefined,
    dashboard_music_settings: raw.dashboard_music_settings && typeof raw.dashboard_music_settings === "object"
      ? raw.dashboard_music_settings
      : undefined,
    dashboard_preferences: raw.dashboard_preferences && typeof raw.dashboard_preferences === "object"
      ? raw.dashboard_preferences
      : undefined,
    commercial_settings: raw.commercial_settings && typeof raw.commercial_settings === "object"
      ? raw.commercial_settings
      : undefined,
    simple_help_mode: toBool(raw.simple_help_mode, true),
    log_edits: toBool(raw.log_edits, true),
    log_deletes: toBool(raw.log_deletes, true),
    maintenance_mode: toBool(raw.maintenance_mode, false),
    maintenance_reason: toShortString(raw.maintenance_reason, 500, null),
    rate_limit_enabled: toBool(raw.rate_limit_enabled, true),
    rate_limit_window_seconds: toClampedInt(raw.rate_limit_window_seconds, 3, 120, 10),
    rate_limit_max_actions: toClampedInt(raw.rate_limit_max_actions, 1, 50, 8),
    rate_limit_bypass_admin: toBool(raw.rate_limit_bypass_admin, true),
    command_rate_limit_enabled: toBool(raw.command_rate_limit_enabled, true),
    command_rate_limit_window_seconds: toClampedInt(raw.command_rate_limit_window_seconds, 1, 300, 20),
    command_rate_limit_max_actions: toClampedInt(raw.command_rate_limit_max_actions, 1, 50, 4),
    command_rate_limit_overrides: sanitizeCommandRateLimitOverrides(raw.command_rate_limit_overrides),
    panel_channel_id: toIdOrNull(raw.panel_channel_id),
    disabled_commands: toCommandNameList(raw.disabled_commands),
    disabled_playbooks: toCategoryIdList(raw.disabled_playbooks),
  };
}

function sanitizeVerify(raw = {}) {
  const mode = ["button", "code", "question"].includes(raw.mode) ? raw.mode : "button";
  const antiraidAction = ["kick", "pause"].includes(raw.antiraid_action) ? raw.antiraid_action : "pause";
  return {
    enabled: toBool(raw.enabled, false),
    mode,
    channel: toIdOrNull(raw.channel),
    verified_role: toIdOrNull(raw.verified_role),
    unverified_role: toIdOrNull(raw.unverified_role),
    log_channel: toIdOrNull(raw.log_channel),
    panel_title: toShortString(raw.panel_title, 100, "✅ Verificacion"),
    panel_description: toShortString(raw.panel_description, 1000, "Para acceder al servidor, debes verificarte."),
    panel_color: toHex6(raw.panel_color, "57F287"),
    panel_image: toShortString(raw.panel_image, 500, null),
    question: toShortString(raw.question, 200, "¿Leiste las reglas del servidor?"),
    question_answer: toShortString(raw.question_answer, 100, "si")?.toLowerCase() || "si",
    antiraid_enabled: toBool(raw.antiraid_enabled, false),
    antiraid_joins: toClampedInt(raw.antiraid_joins, 3, 50, 10),
    antiraid_seconds: toClampedInt(raw.antiraid_seconds, 5, 60, 10),
    antiraid_action: antiraidAction,
    dm_on_verify: toBool(raw.dm_on_verify, true),
    kick_unverified_hours: toClampedInt(raw.kick_unverified_hours, 0, 168, 0),
  };
}

function sanitizeWelcome(raw = {}) {
  return {
    welcome_enabled: toBool(raw.welcome_enabled, false),
    welcome_channel: toIdOrNull(raw.welcome_channel),
    welcome_message: toShortString(raw.welcome_message, 1000, "Bienvenido {mention}!"),
    welcome_color: toHex6(raw.welcome_color, "5865F2"),
    welcome_title: toShortString(raw.welcome_title, 100, "👋 ¡Bienvenido/a!"),
    welcome_banner: toShortString(raw.welcome_banner, 500, null),
    welcome_thumbnail: toBool(raw.welcome_thumbnail, true),
    welcome_footer: toShortString(raw.welcome_footer, 200, null),
    welcome_dm: toBool(raw.welcome_dm, false),
    welcome_dm_message: toShortString(raw.welcome_dm_message, 1000, null),
    welcome_autorole: toIdOrNull(raw.welcome_autorole),
    goodbye_enabled: toBool(raw.goodbye_enabled, false),
    goodbye_channel: toIdOrNull(raw.goodbye_channel),
    goodbye_message: toShortString(raw.goodbye_message, 1000, "{user} ha abandonado el servidor."),
    goodbye_color: toHex6(raw.goodbye_color, "ED4245"),
    goodbye_title: toShortString(raw.goodbye_title, 100, "👋 Hasta luego"),
    goodbye_thumbnail: toBool(raw.goodbye_thumbnail, true),
    goodbye_footer: toShortString(raw.goodbye_footer, 200, null),
  };
}

function sanitizeSuggest(raw = {}) {
  return {
    enabled: toBool(raw.enabled, false),
    channel: toIdOrNull(raw.channel),
    log_channel: toIdOrNull(raw.log_channel),
    approved_channel: toIdOrNull(raw.approved_channel),
    rejected_channel: toIdOrNull(raw.rejected_channel),
    dm_on_result: toBool(raw.dm_on_result, true),
    require_reason: toBool(raw.require_reason, false),
    cooldown_minutes: toClampedInt(raw.cooldown_minutes, 0, 1440, 5),
    anonymous: toBool(raw.anonymous, false),
  };
}

function sanitizeModlogs(raw = {}) {
  return {
    enabled: toBool(raw.enabled, false),
    channel: toIdOrNull(raw.channel),
    log_bans: toBool(raw.log_bans, true),
    log_unbans: toBool(raw.log_unbans, true),
    log_kicks: toBool(raw.log_kicks, true),
    log_msg_delete: toBool(raw.log_msg_delete, true),
    log_msg_edit: toBool(raw.log_msg_edit, true),
    log_role_add: toBool(raw.log_role_add, true),
    log_role_remove: toBool(raw.log_role_remove, true),
    log_nickname: toBool(raw.log_nickname, true),
    log_joins: toBool(raw.log_joins, false),
    log_leaves: toBool(raw.log_leaves, false),
    log_voice: toBool(raw.log_voice, false),
  };
}

function buildConfigBackup({ settings, verify, welcome, suggest, modlogs }) {
  return {
    schema_version: 2,
    exported_at: new Date().toISOString(),
    settings: pick(settings, SETTINGS_KEYS),
    verify: pick(verify, VERIF_KEYS),
    welcome: pick(welcome, WELCOME_KEYS),
    suggest: pick(suggest, SUGGEST_KEYS),
    modlogs: pick(modlogs, MODLOG_KEYS),
  };
}

function stripCodeFence(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

function parseAndSanitizeBackup(inputText) {
  const rawText = stripCodeFence(inputText);
  const parsed = JSON.parse(rawText);
  return {
    settings: sanitizeSettings(parsed.settings || {}),
    verify: sanitizeVerify(parsed.verify || {}),
    welcome: sanitizeWelcome(parsed.welcome || {}),
    suggest: sanitizeSuggest(parsed.suggest || {}),
    modlogs: sanitizeModlogs(parsed.modlogs || {}),
  };
}

module.exports = {
  buildConfigBackup,
  parseAndSanitizeBackup,
};
