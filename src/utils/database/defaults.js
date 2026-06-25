const { buildCommercialSettingsDefaults } = require("./commercialDefaults");
const {
  buildAutomodPresetSelectionDefaults,
  buildAutomodActionOverridesDefaults,
  buildAutomodKeywordOverridesDefaults,
} = require("../automod");

function buildSettingsDefaults(guildId, dateFactory = () => new Date()) {
  return {
    guild_id: guildId,
    log_channel: null,
    logsChannelId: null,
    transcript_channel: null,
    dashboard_channel: null,
    dashboard_message_id: null,
    weekly_report_channel: null,
    daily_sla_report_enabled: false,
    daily_sla_report_channel: null,
    live_members_channel: null,
    live_role_channel: null,
    live_role_id: null,
    support_role: null,
    admin_role: null,
    verify_role: null,
    max_tickets: 3,
    global_ticket_limit: 0,
    cooldown_minutes: 0,
    min_days: 0,
    auto_close_hours: 0,
    sla_hours: 0,
    smart_ping_hours: 0,
    auto_close_minutes: 0,
    sla_minutes: 0,
    smart_ping_minutes: 0,
    sla_escalation_enabled: false,
    sla_escalation_minutes: 0,
    sla_escalation_role: null,
    sla_escalation_channel: null,
    sla_overrides_priority: {},
    sla_overrides_category: {},
    sla_escalation_overrides_priority: {},
    sla_escalation_overrides_category: {},
    auto_assign_enabled: false,
    auto_assign_require_online: true,
    auto_assign_respect_away: true,
    auto_assign_last_staff_id: null,
    incident_mode_enabled: false,
    incident_paused_categories: [],
    incident_message: null,
    automod_enabled: false,
    automod_presets: buildAutomodPresetSelectionDefaults(),
    automod_alert_channel: null,
    automod_exempt_roles: [],
    automod_exempt_channels: [],
    automod_managed_rule_ids: {},
    automod_last_sync_at: null,
    automod_last_sync_status: "never",
    automod_last_sync_summary: null,
    automod_action_overrides: buildAutomodActionOverridesDefaults(),
    automod_keyword_overrides: buildAutomodKeywordOverridesDefaults(),
    automod_regex_patterns: [],
    ticket_discord_category_id: null,
    ticket_panel_title: null,
    ticket_panel_description: null,
    ticket_panel_footer: null,
    ticket_panel_color: null,
    ticket_welcome_message: null,
    ticket_control_panel_title: null,
    ticket_control_panel_description: null,
    ticket_control_panel_footer: null,
    ticket_control_panel_color: null,
    dm_on_open: true,
    dm_on_close: true,
    dm_transcripts: true,
    dm_alerts: true,
    bot_language: "en",
    language_selected_at: null,
    language_selected_by: null,
    language_onboarding_completed: false,
    simple_help_mode: true,
    log_edits: true,
    log_deletes: true,
    maintenance_mode: false,
    maintenance_reason: null,
    rate_limit_enabled: true,
    rate_limit_window_seconds: 10,
    rate_limit_max_actions: 8,
    rate_limit_bypass_admin: true,
    command_rate_limit_enabled: true,
    command_rate_limit_window_seconds: 20,
    command_rate_limit_max_actions: 4,
    command_rate_limit_overrides: {},
    dashboard_general_settings: buildDashboardGeneralSettingsDefaults(),
    dashboard_moderation_settings: buildDashboardModerationSettingsDefaults(),
    dashboard_automod_settings: buildDashboardAutomodSettingsDefaults(),
    dashboard_music_settings: buildDashboardMusicSettingsDefaults(),
    dashboard_preferences: buildDashboardPreferencesDefaults(),
    commercial_settings: buildCommercialSettingsDefaults(dateFactory),
    dashboard_source_updated_at: null,
    dashboard_last_synced_at: null,
    disabled_commands: [],
    disabled_playbooks: [],
    settings_schema_version: 6,
    ticket_counter: 0,
    panel_message_id: null,
    panel_channel_id: null,
    branding_global_color: null,
    branding_footer_text: null,
    branding_remove_signature: false,
    automod_escalation_enabled: false,
    automod_escalation_keywords: ["hacked", "payment", "exploit", "critical", "urgent"],
    retention_days: 0,
    created_at: dateFactory(),
  };
}

function buildDashboardGeneralSettingsDefaults() {
  return {
    language: "en",
    commandMode: "mention",
    prefix: "!",
    timezone: "UTC",
    moderationPreset: "balanced",
    opsPlan: "free",
  };
}

function buildDashboardPreferencesDefaults() {
  return {
    defaultSection: "overview",
    compactMode: false,
    showAdvancedCards: true,
  };
}

function buildDashboardModerationSettingsDefaults() {
  return {
    antiSpamEnabled: true,
    antiSpamThreshold: 6,
    linkFilterEnabled: true,
    capsFilterEnabled: true,
    capsPercentageLimit: 70,
    duplicateFilterEnabled: true,
    duplicateWindowSeconds: 45,
    raidProtectionEnabled: true,
    raidPreset: "balanced",
  };
}

function buildDashboardAutomodSettingsDefaults() {
  return {
    enabled: false,
    preset: "balanced",
    blockInvites: true,
    blockLinks: false,
    blockSpam: true,
    blockMassMentions: true,
    blockCaps: false,
    scamProtection: true,
    regexProtection: false,
    logChannelId: null,
    alertRoleId: null,
  };
}

function buildDashboardMusicSettingsDefaults() {
  return {
    enabled: true,
    defaultVolume: 80,
    maxFreeQueue: 10,
    maxProQueue: 200,
    maxFreeDurationMinutes: 5,
    maxProDurationMinutes: 360,
    allowSpotify: true,
    allowPlaylists: true,
    allowFilters: true,
    djRoleId: null,
    announceNowPlaying: true,
    disconnectOnEmpty: true,
  };
}

function buildDashboardPreferencesDefaults() {
  return {
    defaultSection: "overview",
    compactMode: false,
    showAdvancedCards: true,
  };
}

function buildLevelSettingsDefaults(guildId) {
  return {
    guild_id: guildId,
    enabled: false,
    channel: null,
    xp_per_message: 15,
    xp_cooldown: 60,
    xp_min: 10,
    xp_max: 25,
    levelup_message: "✨ Congrats {mention}! You reached **level {level}**! 🏆",
    ignored_channels: [],
    ignored_roles: [],
    role_rewards: [],
    double_xp_roles: [],
    stack_roles: true,
  };
}

function buildVerifSettingsDefaults(guildId) {
  return {
    guild_id: guildId,
    enabled: false,
    mode: "button",
    channel: null,
    verified_role: null,
    unverified_role: null,
    log_channel: null,
    panel_message_id: null,
    panel_title: "Verification Center",
    panel_description: "Please verify yourself to gain access to the server.",
    panel_color: "57F287",
    panel_image: null,
    question: "Have you read the server rules?",
    question_answer: "yes",
    antiraid_enabled: false,
    antiraid_joins: 10,
    antiraid_seconds: 10,
    antiraid_action: "pause",
    dm_on_verify: true,
    kick_unverified_hours: 0,
  };
}

function buildWelcomeSettingsDefaults(guildId) {
  return {
    guild_id: guildId,
    welcome_enabled: false,
    welcome_channel: null,
    welcome_message: "Welcome **{mention}** to **{server}**! We are glad to have you here. 🎉",
    welcome_color: "5865F2",
    welcome_title: "Welcome!",
    welcome_banner: null,
    welcome_thumbnail: true,
    welcome_footer: "Member ID: {id}",
    welcome_dm: false,
    welcome_dm_message: "Hi **{user}**! Welcome to **{server}**.",
    welcome_autorole: null,
    goodbye_enabled: false,
    goodbye_channel: null,
    goodbye_message: "**{user}** has left the server.",
    goodbye_color: "ED4245",
    goodbye_title: "See you soon!",
    goodbye_thumbnail: true,
    goodbye_footer: "Hope to see you again.",
  };
}

function buildModlogSettingsDefaults(guildId) {
  return {
    guild_id: guildId,
    enabled: false,
    channel: null,
    log_bans: true,
    log_unbans: true,
    log_kicks: true,
    log_msg_delete: true,
    log_msg_edit: true,
    log_role_add: true,
    log_role_remove: true,
    log_nickname: true,
    log_joins: false,
    log_leaves: false,
    log_voice: false,
  };
}

function buildSuggestSettingsDefaults(guildId) {
  return {
    guild_id: guildId,
    enabled: false,
    channel: null,
    log_channel: null,
    approved_channel: null,
    rejected_channel: null,
    dm_on_result: true,
    require_reason: false,
    cooldown_minutes: 5,
    anonymous: false,
    auto_thread: false, // Pro
    staff_notes_enabled: true, // Pro
  };
}

module.exports = {
  buildSettingsDefaults,
  buildDashboardGeneralSettingsDefaults,
  buildDashboardModerationSettingsDefaults,
  buildDashboardAutomodSettingsDefaults,
  buildDashboardMusicSettingsDefaults,
  buildDashboardPreferencesDefaults,
  buildCommercialSettingsDefaults,
  buildLevelSettingsDefaults,
  buildVerifSettingsDefaults,
  buildWelcomeSettingsDefaults,
  buildModlogSettingsDefaults,
  buildSuggestSettingsDefaults,
};
