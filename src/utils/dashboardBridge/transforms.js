"use strict";

const {
  buildDashboardGeneralSettingsDefaults,
  buildDashboardModerationSettingsDefaults,
  buildDashboardPreferencesDefaults,
  sanitizeDashboardGeneralSettings,
  sanitizeDashboardModerationSettings,
  sanitizeDashboardPreferences,
} = require("./runtime");
const { normalizeCommercialPlan, buildCommercialSettingsPatch, resolveCommercialState } = require("../commercial");
const {
  isPlainObject,
  toBoolean,
  toInt,
  toNullableDiscordId,
  toNullableString,
  toStringList,
} = require("./config");

function normalizeStoredCommandRateLimitOverrides(value) {
  if (!isPlainObject(value)) return {};

  const out = {};
  for (const [commandName, rawConfig] of Object.entries(value)) {
    const name = String(commandName || "").trim().toLowerCase();
    if (!name) continue;

    if (!isPlainObject(rawConfig)) {
      out[name] = {
        maxActions: toInt(rawConfig, 4, 1, 50),
        windowSeconds: 20,
        enabled: true,
      };
      continue;
    }

    out[name] = {
      maxActions: toInt(rawConfig.max_actions ?? rawConfig.maxActions, 4, 1, 50),
      windowSeconds: toInt(rawConfig.window_seconds ?? rawConfig.windowSeconds, 20, 1, 300),
      enabled: rawConfig.enabled !== false,
    };
  }

  return out;
}

function normalizeOutgoingCommandRateLimitOverrides(value) {
  const normalized = normalizeStoredCommandRateLimitOverrides(value);
  const out = {};

  for (const [commandName, config] of Object.entries(normalized)) {
    out[commandName] = {
      maxActions: config.maxActions,
      windowSeconds: config.windowSeconds,
      enabled: config.enabled,
    };
  }

  return out;
}

function normalizeIncomingCommandRateLimitOverrides(value) {
  if (!isPlainObject(value)) return {};
  const out = {};

  for (const [commandName, rawConfig] of Object.entries(value)) {
    const name = String(commandName || "").trim().toLowerCase();
    if (!name) continue;

    if (!isPlainObject(rawConfig)) {
      out[name] = {
        max_actions: toInt(rawConfig, 4, 1, 50),
        window_seconds: 20,
        enabled: true,
      };
      continue;
    }

    out[name] = {
      max_actions: toInt(rawConfig.maxActions ?? rawConfig.max_actions, 4, 1, 50),
      window_seconds: toInt(rawConfig.windowSeconds ?? rawConfig.window_seconds, 20, 1, 300),
      enabled: rawConfig.enabled !== false,
    };
  }

  return out;
}

function normalizeDashboardAutomodSettings(value) {
  const source = isPlainObject(value) ? value : {};
  const preset = ["off", "balanced", "strict"].includes(String(source.preset || "").toLowerCase())
    ? String(source.preset).toLowerCase()
    : "balanced";

  return {
    enabled: toBoolean(source.enabled, false),
    preset,
    blockInvites: toBoolean(source.blockInvites ?? source.block_invites, true),
    blockLinks: toBoolean(source.blockLinks ?? source.block_links, false),
    blockSpam: toBoolean(source.blockSpam ?? source.block_spam, true),
    blockMassMentions: toBoolean(source.blockMassMentions ?? source.block_mass_mentions, true),
    blockCaps: toBoolean(source.blockCaps ?? source.block_caps, false),
    scamProtection: toBoolean(source.scamProtection ?? source.scam_protection, true),
    regexProtection: toBoolean(source.regexProtection ?? source.regex_protection, false),
    logChannelId: toNullableDiscordId(source.logChannelId ?? source.log_channel_id),
    alertRoleId: toNullableDiscordId(source.alertRoleId ?? source.alert_role_id),
  };
}

function normalizeDashboardMusicSettings(value) {
  const source = isPlainObject(value) ? value : {};

  return {
    enabled: toBoolean(source.enabled, true),
    defaultVolume: toInt(source.defaultVolume ?? source.default_volume, 80, 1, 100),
    maxFreeQueue: toInt(source.maxFreeQueue ?? source.max_free_queue, 10, 1, 50),
    maxProQueue: toInt(source.maxProQueue ?? source.max_pro_queue, 200, 10, 500),
    maxFreeDurationMinutes: toInt(
      source.maxFreeDurationMinutes ?? source.max_free_duration_minutes,
      5,
      1,
      60
    ),
    maxProDurationMinutes: toInt(
      source.maxProDurationMinutes ?? source.max_pro_duration_minutes,
      360,
      10,
      720
    ),
    allowSpotify: toBoolean(source.allowSpotify ?? source.allow_spotify, true),
    allowPlaylists: toBoolean(source.allowPlaylists ?? source.allow_playlists, true),
    allowFilters: toBoolean(source.allowFilters ?? source.allow_filters, true),
    djRoleId: toNullableDiscordId(source.djRoleId ?? source.dj_role_id),
    announceNowPlaying: toBoolean(source.announceNowPlaying ?? source.announce_now_playing, true),
    disconnectOnEmpty: toBoolean(source.disconnectOnEmpty ?? source.disconnect_on_empty, true),
  };
}

function buildDashboardConfigPayload(input = {}) {
  const source = isPlainObject(input) &&
    (Object.prototype.hasOwnProperty.call(input, "settingsRecord") ||
      Object.prototype.hasOwnProperty.call(input, "verificationRecord"))
    ? input
    : { settingsRecord: input };

  const settingsRecord = source.settingsRecord || {};
  const verificationRecord = source.verificationRecord || {};
  const welcomeRecord = source.welcomeRecord || {};
  const suggestRecord = source.suggestRecord || {};
  const modlogRecord = source.modlogRecord || {};

  const generalDefaults = buildDashboardGeneralSettingsDefaults();
  const moderationDefaults = buildDashboardModerationSettingsDefaults();
  const preferencesDefaults = buildDashboardPreferencesDefaults();

  const general = sanitizeDashboardGeneralSettings(
    {
      ...generalDefaults,
      ...(settingsRecord.dashboard_general_settings || {}),
      language:
        settingsRecord.bot_language ||
        settingsRecord.dashboard_general_settings?.language ||
        generalDefaults.language,
      opsPlan:
        normalizeCommercialPlan(
          settingsRecord.dashboard_general_settings?.opsPlan ||
            settingsRecord.commercial_settings?.plan,
          generalDefaults.opsPlan,
        ),
    },
    generalDefaults
  );
  const legacyProtection = sanitizeDashboardModerationSettings(
    settingsRecord.dashboard_moderation_settings,
    moderationDefaults
  );
  const preferences = sanitizeDashboardPreferences(
    settingsRecord.dashboard_preferences,
    preferencesDefaults
  );

  // `guild_configs` is the read model the dashboard consumes directly.
  // Keep payload keys stable and dashboard-shaped even if Mongo uses snake_case internally.
  return {
    general_settings: general,
    moderation_settings: legacyProtection,
    server_roles_channels_settings: {
      dashboardChannelId: settingsRecord.dashboard_channel || null,
      ticketPanelChannelId: settingsRecord.panel_channel_id || null,
      logsChannelId: settingsRecord.log_channel || null,
      transcriptChannelId: settingsRecord.transcript_channel || null,
      weeklyReportChannelId: settingsRecord.weekly_report_channel || null,
      liveMembersChannelId: settingsRecord.live_members_channel || null,
      liveRoleChannelId: settingsRecord.live_role_channel || null,
      liveRoleId: settingsRecord.live_role_id || null,
      supportRoleId: settingsRecord.support_role || null,
      adminRoleId: settingsRecord.admin_role || null,
      verifyRoleId: settingsRecord.verify_role || null,
    },
    tickets_settings: {
      maxTickets: toInt(settingsRecord.max_tickets, 3, 1, 10),
      globalTicketLimit: toInt(settingsRecord.global_ticket_limit, 0, 0, 500),
      cooldownMinutes: toInt(settingsRecord.cooldown_minutes, 0, 0, 1440),
      minDays: toInt(settingsRecord.min_days, 0, 0, 365),
      autoCloseMinutes: toInt(settingsRecord.auto_close_minutes, 0, 0, 10080),
      slaMinutes: toInt(settingsRecord.sla_minutes, 0, 0, 1440),
      smartPingMinutes: toInt(settingsRecord.smart_ping_minutes, 0, 0, 1440),
      slaEscalationEnabled: settingsRecord.sla_escalation_enabled === true,
      slaEscalationMinutes: toInt(settingsRecord.sla_escalation_minutes, 0, 0, 10080),
      slaEscalationRoleId: settingsRecord.sla_escalation_role || null,
      slaEscalationChannelId: settingsRecord.sla_escalation_channel || null,
      slaOverridesPriority: isPlainObject(settingsRecord.sla_overrides_priority)
        ? settingsRecord.sla_overrides_priority
        : {},
      slaOverridesCategory: isPlainObject(settingsRecord.sla_overrides_category)
        ? settingsRecord.sla_overrides_category
        : {},
      slaEscalationOverridesPriority: isPlainObject(settingsRecord.sla_escalation_overrides_priority)
        ? settingsRecord.sla_escalation_overrides_priority
        : {},
      slaEscalationOverridesCategory: isPlainObject(settingsRecord.sla_escalation_overrides_category)
        ? settingsRecord.sla_escalation_overrides_category
        : {},
      autoAssignEnabled: settingsRecord.auto_assign_enabled === true,
      autoAssignRequireOnline: settingsRecord.auto_assign_require_online !== false,
      autoAssignRespectAway: settingsRecord.auto_assign_respect_away !== false,
      incidentModeEnabled: settingsRecord.incident_mode_enabled === true,
      incidentPausedCategories: Array.isArray(settingsRecord.incident_paused_categories)
        ? settingsRecord.incident_paused_categories
        : [],
      incidentMessage: settingsRecord.incident_message || null,
      dailySlaReportEnabled: settingsRecord.daily_sla_report_enabled === true,
      dailySlaReportChannelId: settingsRecord.daily_sla_report_channel || null,
      dmOnOpen: settingsRecord.dm_on_open !== false,
      dmOnClose: settingsRecord.dm_on_close !== false,
      dmTranscripts: settingsRecord.dm_transcripts !== false,
      dmAlerts: settingsRecord.dm_alerts !== false,
    },
    verification_settings: {
      enabled: verificationRecord.enabled === true,
      mode: verificationRecord.mode || "button",
      channelId: verificationRecord.channel || null,
      verifiedRoleId: verificationRecord.verified_role || null,
      unverifiedRoleId: verificationRecord.unverified_role || null,
      logChannelId: verificationRecord.log_channel || null,
      panelTitle: verificationRecord.panel_title || "Verification",
      panelDescription:
        verificationRecord.panel_description ||
        "Verify yourself to access the server.",
      panelColor: verificationRecord.panel_color || "57F287",
      panelImage: verificationRecord.panel_image || null,
      question: verificationRecord.question || "Did you read the server rules?",
      questionAnswer: verificationRecord.question_answer || "yes",
      antiraidEnabled: verificationRecord.antiraid_enabled === true,
      antiraidJoins: toInt(verificationRecord.antiraid_joins, 10, 3, 50),
      antiraidSeconds: toInt(verificationRecord.antiraid_seconds, 10, 5, 60),
      antiraidAction: verificationRecord.antiraid_action || "pause",
      dmOnVerify: verificationRecord.dm_on_verify !== false,
      kickUnverifiedHours: toInt(verificationRecord.kick_unverified_hours, 0, 0, 168),
    },
    welcome_settings: {
      welcomeEnabled: welcomeRecord.welcome_enabled === true,
      welcomeChannelId: welcomeRecord.welcome_channel || null,
      welcomeMessage:
        welcomeRecord.welcome_message ||
        "Welcome **{mention}** to **{server}**!",
      welcomeColor: welcomeRecord.welcome_color || "5865F2",
      welcomeTitle: welcomeRecord.welcome_title || "Welcome",
      welcomeBanner: welcomeRecord.welcome_banner || null,
      welcomeThumbnail: welcomeRecord.welcome_thumbnail !== false,
      welcomeFooter: welcomeRecord.welcome_footer || null,
      welcomeDm: welcomeRecord.welcome_dm === true,
      welcomeDmMessage: welcomeRecord.welcome_dm_message || null,
      welcomeAutoroleId: welcomeRecord.welcome_autorole || null,
      goodbyeEnabled: welcomeRecord.goodbye_enabled === true,
      goodbyeChannelId: welcomeRecord.goodbye_channel || null,
      goodbyeMessage:
        welcomeRecord.goodbye_message || "**{user}** left the server.",
      goodbyeColor: welcomeRecord.goodbye_color || "ED4245",
      goodbyeTitle: welcomeRecord.goodbye_title || "See you soon",
      goodbyeThumbnail: welcomeRecord.goodbye_thumbnail !== false,
      goodbyeFooter: welcomeRecord.goodbye_footer || null,
    },
    suggestion_settings: {
      enabled: suggestRecord.enabled === true,
      channelId: suggestRecord.channel || null,
      logChannelId: suggestRecord.log_channel || null,
      approvedChannelId: suggestRecord.approved_channel || null,
      rejectedChannelId: suggestRecord.rejected_channel || null,
      dmOnResult: suggestRecord.dm_on_result !== false,
      requireReason: suggestRecord.require_reason === true,
      cooldownMinutes: toInt(suggestRecord.cooldown_minutes, 5, 0, 1440),
      anonymous: suggestRecord.anonymous === true,
    },
    modlog_settings: {
      enabled: modlogRecord.enabled === true,
      channelId: modlogRecord.channel || null,
      logBans: modlogRecord.log_bans !== false,
      logUnbans: modlogRecord.log_unbans !== false,
      logKicks: modlogRecord.log_kicks !== false,
      logMessageDelete: modlogRecord.log_msg_delete !== false,
      logMessageEdit: modlogRecord.log_msg_edit !== false,
      logRoleAdd: modlogRecord.log_role_add !== false,
      logRoleRemove: modlogRecord.log_role_remove !== false,
      logNickname: modlogRecord.log_nickname !== false,
      logJoins: modlogRecord.log_joins === true,
      logLeaves: modlogRecord.log_leaves === true,
      logVoice: modlogRecord.log_voice === true,
    },
    command_settings: {
      disabledCommands: Array.isArray(settingsRecord.disabled_commands)
        ? settingsRecord.disabled_commands
        : [],
      simpleHelpMode: settingsRecord.simple_help_mode !== false,
      rateLimitEnabled: settingsRecord.rate_limit_enabled !== false,
      rateLimitWindowSeconds: toInt(settingsRecord.rate_limit_window_seconds, 10, 3, 120),
      rateLimitMaxActions: toInt(settingsRecord.rate_limit_max_actions, 8, 1, 50),
      rateLimitBypassAdmin: settingsRecord.rate_limit_bypass_admin !== false,
      commandRateLimitEnabled: settingsRecord.command_rate_limit_enabled !== false,
      commandRateLimitWindowSeconds: toInt(
        settingsRecord.command_rate_limit_window_seconds,
        20,
        1,
        300
      ),
      commandRateLimitMaxActions: toInt(
        settingsRecord.command_rate_limit_max_actions,
        4,
        1,
        50
      ),
      commandRateLimitOverrides: normalizeOutgoingCommandRateLimitOverrides(
        settingsRecord.command_rate_limit_overrides
      ),
    },
    system_settings: {
      maintenanceMode: settingsRecord.maintenance_mode === true,
      maintenanceReason: settingsRecord.maintenance_reason || null,
      legacyProtectionSettings: legacyProtection,
      automodSettings: normalizeDashboardAutomodSettings(
        settingsRecord.dashboard_automod_settings
      ),
      musicSettings: normalizeDashboardMusicSettings(
        settingsRecord.dashboard_music_settings
      ),
    },
    dashboard_preferences: preferences,
    updated_by: null,
    config_source: "bot",
  };
}

function buildCommercialProjectionFromEntitlement(currentSettings = {}, entitlementRow = null, options = {}) {
  const source = entitlementRow && typeof entitlementRow === "object" ? entitlementRow : {};
  const now = options.now instanceof Date && !Number.isNaN(options.now.getTime())
    ? options.now
    : (source.updated_at ? new Date(source.updated_at) : new Date());
  const effectivePlan = normalizeCommercialPlan(source.effective_plan, "free");
  const currentState = resolveCommercialState(currentSettings, now);
  const planSource = source.plan_source
    ? `supabase_${String(source.plan_source).trim().toLowerCase()}`
    : "supabase_free";
  const planExpiresAt = source.plan_expires_at || source.current_period_end || null;
  const supporterEnabled = source.supporter_enabled === true;

  return buildCommercialSettingsPatch(
    currentSettings,
    {
      plan: effectivePlan,
      plan_source: planSource,
      plan_started_at:
        effectivePlan !== "free"
          ? currentState.planStartedAt || now
          : null,
      plan_expires_at: effectivePlan !== "free" ? planExpiresAt : null,
      plan_note: currentState.planNote || null,
      supporter_enabled: supporterEnabled,
      supporter_started_at:
        supporterEnabled
          ? currentState.supporterStartedAt || now
          : null,
      supporter_expires_at: supporterEnabled ? (source.supporter_expires_at || null) : null,
    },
    { now }
  );
}

function buildSettingsPatchFromDashboardRow(row) {
  const generalDefaults = buildDashboardGeneralSettingsDefaults();

  const general = sanitizeDashboardGeneralSettings(row.general_settings, generalDefaults);
  const moderation = sanitizeDashboardModerationSettings(
    row.moderation_settings,
    buildDashboardModerationSettingsDefaults()
  );
  const preferences = sanitizeDashboardPreferences(
    row.dashboard_preferences,
    buildDashboardPreferencesDefaults()
  );
  const requestedDefaultSection = String(
    row?.dashboard_preferences?.defaultSection || ""
  ).trim().toLowerCase();
  if (requestedDefaultSection === "moderation") {
    preferences.defaultSection = "moderation";
  }
  const commercialPatch = buildCommercialSettingsPatch(
    {},
    {
      plan: general.opsPlan,
      plan_source: "dashboard_sync",
    },
  );

  return {
    bot_language: general.language,
    dashboard_general_settings: {
      ...general,
      ...commercialPatch.dashboard_general_settings,
    },
    commercial_settings: commercialPatch.commercial_settings,
    dashboard_moderation_settings: moderation,
    dashboard_preferences: preferences,
    dashboard_source_updated_at: row.updated_at ? new Date(row.updated_at) : null,
    dashboard_last_synced_at: new Date(),
  };
}

function shouldApplyDashboardRow(currentSettings, row) {
  if (!row?.updated_at) {
    return true;
  }

  const incoming = new Date(row.updated_at);
  if (Number.isNaN(incoming.getTime())) {
    return true;
  }

  const current = currentSettings?.dashboard_source_updated_at
    ? new Date(currentSettings.dashboard_source_updated_at)
    : null;

  if (!current || Number.isNaN(current.getTime())) {
    return true;
  }

  return incoming.getTime() > current.getTime();
}


function normalizeMinutesRecord(value, options = {}) {
  if (!isPlainObject(value)) return {};

  const out = {};
  const allowedKeys = options.allowedKeys instanceof Set ? options.allowedKeys : null;
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = String(rawKey || "").trim().toLowerCase();
    if (!key) continue;
    if (allowedKeys && !allowedKeys.has(key)) continue;

    const minutes = toInt(rawValue, 0, 1, 10080);
    if (minutes > 0) {
      out[key] = minutes;
    }
  }

  return out;
}

function mapGeneralMutationPayload(payload) {
  const source = isPlainObject(payload) ? payload : {};
  const general = sanitizeDashboardGeneralSettings(
    source.generalSettings ?? source.general_settings ?? source,
    buildDashboardGeneralSettingsDefaults()
  );
  const preferences = sanitizeDashboardPreferences(
    source.dashboardPreferences ?? source.dashboard_preferences ?? {},
    buildDashboardPreferencesDefaults()
  );

  return {
    bot_language: general.language,
    dashboard_general_settings: general,
    dashboard_preferences: preferences,
  };
}

function mapServerRolesMutationPayload(payload) {
  const source = isPlainObject(payload) ? payload : {};

  return {
    dashboard_channel: toNullableDiscordId(source.dashboardChannelId ?? source.dashboard_channel),
    panel_channel_id: toNullableDiscordId(source.ticketPanelChannelId ?? source.panel_channel_id),
    log_channel: toNullableDiscordId(source.logsChannelId ?? source.log_channel),
    transcript_channel: toNullableDiscordId(
      source.transcriptChannelId ?? source.transcript_channel
    ),
    weekly_report_channel: toNullableDiscordId(
      source.weeklyReportChannelId ?? source.weekly_report_channel
    ),
    live_members_channel: toNullableDiscordId(
      source.liveMembersChannelId ?? source.live_members_channel
    ),
    live_role_channel: toNullableDiscordId(source.liveRoleChannelId ?? source.live_role_channel),
    live_role_id: toNullableDiscordId(source.liveRoleId ?? source.live_role_id),
    support_role: toNullableDiscordId(source.supportRoleId ?? source.support_role),
    admin_role: toNullableDiscordId(source.adminRoleId ?? source.admin_role),
    verify_role: toNullableDiscordId(source.verifyRoleId ?? source.verify_role),
  };
}

function mapTicketsMutationPayload(payload) {
  const source = isPlainObject(payload) ? payload : {};
  const priorityKeys = new Set(["low", "normal", "high", "urgent"]);

  return {
    max_tickets: toInt(source.maxTickets ?? source.max_tickets, 3, 1, 10),
    global_ticket_limit: toInt(source.globalTicketLimit ?? source.global_ticket_limit, 0, 0, 500),
    cooldown_minutes: toInt(source.cooldownMinutes ?? source.cooldown_minutes, 0, 0, 1440),
    min_days: toInt(source.minDays ?? source.min_days, 0, 0, 365),
    auto_close_minutes: toInt(source.autoCloseMinutes ?? source.auto_close_minutes, 0, 0, 10080),
    sla_minutes: toInt(source.slaMinutes ?? source.sla_minutes, 0, 0, 1440),
    smart_ping_minutes: toInt(source.smartPingMinutes ?? source.smart_ping_minutes, 0, 0, 1440),
    sla_escalation_enabled: toBoolean(
      source.slaEscalationEnabled ?? source.sla_escalation_enabled,
      false
    ),
    sla_escalation_minutes: toInt(
      source.slaEscalationMinutes ?? source.sla_escalation_minutes,
      0,
      0,
      10080
    ),
    sla_escalation_role: toNullableDiscordId(
      source.slaEscalationRoleId ?? source.sla_escalation_role
    ),
    sla_escalation_channel: toNullableDiscordId(
      source.slaEscalationChannelId ?? source.sla_escalation_channel
    ),
    sla_overrides_priority: normalizeMinutesRecord(
      source.slaOverridesPriority ?? source.sla_overrides_priority,
      { allowedKeys: priorityKeys }
    ),
    sla_overrides_category: normalizeMinutesRecord(
      source.slaOverridesCategory ?? source.sla_overrides_category
    ),
    sla_escalation_overrides_priority: normalizeMinutesRecord(
      source.slaEscalationOverridesPriority ?? source.sla_escalation_overrides_priority,
      { allowedKeys: priorityKeys }
    ),
    sla_escalation_overrides_category: normalizeMinutesRecord(
      source.slaEscalationOverridesCategory ?? source.sla_escalation_overrides_category
    ),
    auto_assign_enabled: toBoolean(source.autoAssignEnabled ?? source.auto_assign_enabled, false),
    auto_assign_require_online: toBoolean(
      source.autoAssignRequireOnline ?? source.auto_assign_require_online,
      true
    ),
    auto_assign_respect_away: toBoolean(
      source.autoAssignRespectAway ?? source.auto_assign_respect_away,
      true
    ),
    incident_mode_enabled: toBoolean(
      source.incidentModeEnabled ?? source.incident_mode_enabled,
      false
    ),
    incident_paused_categories: toStringList(
      source.incidentPausedCategories ?? source.incident_paused_categories
    ),
    incident_message: toNullableString(source.incidentMessage ?? source.incident_message),
    daily_sla_report_enabled: toBoolean(
      source.dailySlaReportEnabled ?? source.daily_sla_report_enabled,
      false
    ),
    daily_sla_report_channel: toNullableDiscordId(
      source.dailySlaReportChannelId ?? source.daily_sla_report_channel
    ),
    dm_on_open: toBoolean(source.dmOnOpen ?? source.dm_on_open, true),
    dm_on_close: toBoolean(source.dmOnClose ?? source.dm_on_close, true),
    dm_transcripts: toBoolean(source.dmTranscripts ?? source.dm_transcripts, true),
    dm_alerts: toBoolean(source.dmAlerts ?? source.dm_alerts, true),
  };
}

function mapVerificationMutationPayload(payload) {
  const source = isPlainObject(payload) ? payload : {};

  return {
    enabled: toBoolean(source.enabled, false),
    mode: toNullableString(source.mode) || "button",
    channel: toNullableDiscordId(source.channelId ?? source.channel),
    verified_role: toNullableDiscordId(source.verifiedRoleId ?? source.verified_role),
    unverified_role: toNullableDiscordId(source.unverifiedRoleId ?? source.unverified_role),
    log_channel: toNullableDiscordId(source.logChannelId ?? source.log_channel),
    panel_title: toNullableString(source.panelTitle ?? source.panel_title) || "Verification",
    panel_description:
      toNullableString(source.panelDescription ?? source.panel_description) ||
      "Verify yourself to access the server.",
    panel_color: (toNullableString(source.panelColor ?? source.panel_color) || "57F287")
      .replace("#", "")
      .slice(0, 6)
      .toUpperCase(),
    panel_image: toNullableString(source.panelImage ?? source.panel_image),
    question: toNullableString(source.question) || "Did you read the server rules?",
    question_answer: toNullableString(source.questionAnswer ?? source.question_answer) || "yes",
    antiraid_enabled: toBoolean(source.antiraidEnabled ?? source.antiraid_enabled, false),
    antiraid_joins: toInt(source.antiraidJoins ?? source.antiraid_joins, 10, 3, 50),
    antiraid_seconds: toInt(source.antiraidSeconds ?? source.antiraid_seconds, 10, 5, 60),
    antiraid_action: toNullableString(source.antiraidAction ?? source.antiraid_action) || "pause",
    dm_on_verify: toBoolean(source.dmOnVerify ?? source.dm_on_verify, true),
    kick_unverified_hours: toInt(
      source.kickUnverifiedHours ?? source.kick_unverified_hours,
      0,
      0,
      168
    ),
  };
}

function mapWelcomeMutationPayload(payload) {
  const source = isPlainObject(payload) ? payload : {};

  return {
    welcome_enabled: toBoolean(source.welcomeEnabled ?? source.welcome_enabled, false),
    welcome_channel: toNullableDiscordId(source.welcomeChannelId ?? source.welcome_channel),
    welcome_message:
      toNullableString(source.welcomeMessage ?? source.welcome_message) ||
      "Welcome **{mention}** to **{server}**!",
    welcome_color: (toNullableString(source.welcomeColor ?? source.welcome_color) || "5865F2")
      .replace("#", "")
      .slice(0, 6)
      .toUpperCase(),
    welcome_title: toNullableString(source.welcomeTitle ?? source.welcome_title) || "Welcome",
    welcome_banner: toNullableString(source.welcomeBanner ?? source.welcome_banner),
    welcome_thumbnail: toBoolean(source.welcomeThumbnail ?? source.welcome_thumbnail, true),
    welcome_footer: toNullableString(source.welcomeFooter ?? source.welcome_footer),
    welcome_dm: toBoolean(source.welcomeDm ?? source.welcome_dm, false),
    welcome_dm_message: toNullableString(source.welcomeDmMessage ?? source.welcome_dm_message),
    welcome_autorole: toNullableDiscordId(source.welcomeAutoroleId ?? source.welcome_autorole),
    goodbye_enabled: toBoolean(source.goodbyeEnabled ?? source.goodbye_enabled, false),
    goodbye_channel: toNullableDiscordId(source.goodbyeChannelId ?? source.goodbye_channel),
    goodbye_message:
      toNullableString(source.goodbyeMessage ?? source.goodbye_message) ||
      "**{user}** left the server.",
    goodbye_color: (toNullableString(source.goodbyeColor ?? source.goodbye_color) || "ED4245")
      .replace("#", "")
      .slice(0, 6)
      .toUpperCase(),
    goodbye_title: toNullableString(source.goodbyeTitle ?? source.goodbye_title) || "See you soon",
    goodbye_thumbnail: toBoolean(source.goodbyeThumbnail ?? source.goodbye_thumbnail, true),
    goodbye_footer: toNullableString(source.goodbyeFooter ?? source.goodbye_footer),
  };
}

function mapSuggestionMutationPayload(payload) {
  const source = isPlainObject(payload) ? payload : {};

  return {
    enabled: toBoolean(source.enabled, false),
    channel: toNullableDiscordId(source.channelId ?? source.channel),
    log_channel: toNullableDiscordId(source.logChannelId ?? source.log_channel),
    approved_channel: toNullableDiscordId(source.approvedChannelId ?? source.approved_channel),
    rejected_channel: toNullableDiscordId(source.rejectedChannelId ?? source.rejected_channel),
    dm_on_result: toBoolean(source.dmOnResult ?? source.dm_on_result, true),
    require_reason: toBoolean(source.requireReason ?? source.require_reason, false),
    cooldown_minutes: toInt(source.cooldownMinutes ?? source.cooldown_minutes, 5, 0, 1440),
    anonymous: toBoolean(source.anonymous, false),
  };
}

function mapModlogMutationPayload(payload) {
  const source = isPlainObject(payload) ? payload : {};

  return {
    enabled: toBoolean(source.enabled, false),
    channel: toNullableDiscordId(source.channelId ?? source.channel),
    log_bans: toBoolean(source.logBans ?? source.log_bans, true),
    log_unbans: toBoolean(source.logUnbans ?? source.log_unbans, true),
    log_kicks: toBoolean(source.logKicks ?? source.log_kicks, true),
    log_msg_delete: toBoolean(source.logMessageDelete ?? source.log_msg_delete, true),
    log_msg_edit: toBoolean(source.logMessageEdit ?? source.log_msg_edit, true),
    log_role_add: toBoolean(source.logRoleAdd ?? source.log_role_add, true),
    log_role_remove: toBoolean(source.logRoleRemove ?? source.log_role_remove, true),
    log_nickname: toBoolean(source.logNickname ?? source.log_nickname, true),
    log_joins: toBoolean(source.logJoins ?? source.log_joins, false),
    log_leaves: toBoolean(source.logLeaves ?? source.log_leaves, false),
    log_voice: toBoolean(source.logVoice ?? source.log_voice, false),
  };
}

function mapCommandsMutationPayload(payload) {
  const source = isPlainObject(payload) ? payload : {};

  return {
    disabled_commands: Array.from(
      new Set(
        toStringList(source.disabledCommands ?? source.disabled_commands).map((command) =>
          command.toLowerCase()
        )
      )
    ),
    simple_help_mode: toBoolean(source.simpleHelpMode ?? source.simple_help_mode, true),
    rate_limit_enabled: toBoolean(source.rateLimitEnabled ?? source.rate_limit_enabled, true),
    rate_limit_window_seconds: toInt(
      source.rateLimitWindowSeconds ?? source.rate_limit_window_seconds,
      10,
      3,
      120
    ),
    rate_limit_max_actions: toInt(
      source.rateLimitMaxActions ?? source.rate_limit_max_actions,
      8,
      1,
      50
    ),
    rate_limit_bypass_admin: toBoolean(
      source.rateLimitBypassAdmin ?? source.rate_limit_bypass_admin,
      true
    ),
    command_rate_limit_enabled: toBoolean(
      source.commandRateLimitEnabled ?? source.command_rate_limit_enabled,
      true
    ),
    command_rate_limit_window_seconds: toInt(
      source.commandRateLimitWindowSeconds ?? source.command_rate_limit_window_seconds,
      20,
      1,
      300
    ),
    command_rate_limit_max_actions: toInt(
      source.commandRateLimitMaxActions ?? source.command_rate_limit_max_actions,
      4,
      1,
      50
    ),
    command_rate_limit_overrides: normalizeIncomingCommandRateLimitOverrides(
      source.commandRateLimitOverrides ?? source.command_rate_limit_overrides
    ),
  };
}

function mapSystemMutationPayload(payload) {
  const source = isPlainObject(payload) ? payload : {};
  const patch = {
    maintenance_mode: toBoolean(source.maintenanceMode ?? source.maintenance_mode, false),
    maintenance_reason: toNullableString(source.maintenanceReason ?? source.maintenance_reason),
  };

  if (
    Object.prototype.hasOwnProperty.call(source, "legacyProtectionSettings") ||
    Object.prototype.hasOwnProperty.call(source, "legacy_protection_settings")
  ) {
    patch.dashboard_moderation_settings = sanitizeDashboardModerationSettings(
      source.legacyProtectionSettings ?? source.legacy_protection_settings,
      buildDashboardModerationSettingsDefaults()
    );
  }

  return patch;
}

function mapAutomodMutationPayload(payload) {
  return {
    dashboard_automod_settings: normalizeDashboardAutomodSettings(payload),
  };
}

function mapMusicMutationPayload(payload) {
  return {
    dashboard_music_settings: normalizeDashboardMusicSettings(payload),
  };
}


module.exports = {
  normalizeStoredCommandRateLimitOverrides,
  normalizeOutgoingCommandRateLimitOverrides,
  normalizeIncomingCommandRateLimitOverrides,
  normalizeDashboardAutomodSettings,
  normalizeDashboardMusicSettings,
  buildDashboardConfigPayload,
  buildCommercialProjectionFromEntitlement,
  buildSettingsPatchFromDashboardRow,
  shouldApplyDashboardRow,
  normalizeMinutesRecord,
  mapGeneralMutationPayload,
  mapServerRolesMutationPayload,
  mapTicketsMutationPayload,
  mapVerificationMutationPayload,
  mapWelcomeMutationPayload,
  mapSuggestionMutationPayload,
  mapModlogMutationPayload,
  mapAutomodMutationPayload,
  mapMusicMutationPayload,
  mapCommandsMutationPayload,
  mapSystemMutationPayload,
};
