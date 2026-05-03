"use strict";

const {
  ChannelType,
  auditLogs,
  warnings,
  tickets,
  settings,
  modlogSettings,
  verifSettings,
  welcomeSettings,
  suggestSettings,
  ticketCategories,
  resolveTicketSlaMinutes,
} = require("./runtime");
const { t } = require("../i18n");
const {
  DEFAULT_UPTIME_PERCENTAGE,
  formatMetricDate,
  premiumTierToLabel,
  startOfUtcDay,
  toNullableString,
  toStringList,
  resolveTicketPriority,
  resolveTicketWorkflowStatus,
  buildTicketMacroRows,
  toValidDate,
} = require("./config");
const {
  normalizeOutgoingCommandRateLimitOverrides,
  buildDashboardConfigPayload,
} = require("./transforms");

function buildEnabledModules(records) {
  const modules = [];
  if (records.verificationRecord?.enabled) modules.push("verification");
  if (records.welcomeRecord?.welcome_enabled) modules.push("welcome");
  if (records.welcomeRecord?.goodbye_enabled) modules.push("goodbye");
  if (records.suggestRecord?.enabled) modules.push("suggestions");
  if (records.modlogRecord?.enabled) modules.push("modlogs");
  if (records.settingsRecord?.auto_assign_enabled) modules.push("auto_assign");
  if (records.settingsRecord?.daily_sla_report_enabled) modules.push("daily_report");
  if (records.settingsRecord?.incident_mode_enabled) modules.push("incident_mode");
  if (records.settingsRecord?.maintenance_mode) modules.push("maintenance");
  return modules;
}

function buildGuildPresenceRow(guild, records) {
  const settingsRecord = records.settingsRecord || {};

  return {
    guild_id: guild.id,
    guild_name: guild.name,
    guild_icon: guild.icon || null,
    member_count: Number(guild.memberCount) || 0,
    premium_tier: premiumTierToLabel(guild.premiumTier),
    setup_completed: Boolean(
      settingsRecord.dashboard_channel ||
        settingsRecord.panel_channel_id ||
        settingsRecord.log_channel ||
        settingsRecord.support_role ||
        settingsRecord.admin_role
    ),
    last_heartbeat_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function normalizeChannelType(type) {
  switch (type) {
    case ChannelType.GuildText:
      return "text";
    case ChannelType.GuildVoice:
      return "voice";
    case ChannelType.GuildCategory:
      return "category";
    case ChannelType.GuildAnnouncement:
      return "announcement";
    case ChannelType.GuildForum:
      return "forum";
    default:
      return String(type);
  }
}

function buildInventorySnapshotRow(client, guild, records = {}) {
  const language = records?.settingsRecord?.bot_language === "en" ? "en" : "es";
  const roles = guild.roles.cache
    .filter((role) => role.id !== guild.id)
    .sort((left, right) => right.position - left.position)
    .map((role) => ({
      id: role.id,
      name: role.name,
      colorHex:
        role.hexColor && role.hexColor !== "#000000"
          ? role.hexColor.replace("#", "")
          : null,
      position: role.position,
      managed: role.managed,
    }));

  const channels = guild.channels.cache
    .sort((left, right) => left.rawPosition - right.rawPosition)
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      type: normalizeChannelType(channel.type),
      parentId: channel.parentId || null,
      position: channel.rawPosition || 0,
    }));

  const categories = ticketCategories.map((category) => ({
    id: category.id,
    label: category.label || t(language, category.labelKey) || category.id,
    description: category.description || t(language, category.descriptionKey) || null,
    priority: category.priority || null,
  }));

  const commands = Array.from(client?.commands?.values?.() || [])
    .map((command) => ({
      name: command?.data?.name || command?.name || "",
      label: command?.data?.name || command?.name || "",
      category: command?.meta?.category || null,
    }))
    .filter((command) => command.name)
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    guild_id: guild.id,
    roles,
    channels,
    categories,
    commands,
    updated_at: new Date().toISOString(),
  };
}

async function buildGuildMetricRow(guild, records) {
  const dayStart = startOfUtcDay();
  const [commandsExecuted, moderatedMessages, ticketStats, slaMetrics] = await Promise.all([
    auditLogs.collection().countDocuments({
      guild_id: guild.id,
      kind: "command",
      status: "ok",
      created_at: { $gte: dayStart },
    }),
    warnings.collection().countDocuments({
      guild_id: guild.id,
      created_at: { $gte: dayStart },
    }),
    tickets.getStats(guild.id),
    tickets.getSlaMetrics(
      guild.id,
      records.settingsRecord?.sla_minutes || 0,
      records.settingsRecord || null
    ),
  ]);

  return {
    guild_id: guild.id,
    metric_date: formatMetricDate(dayStart),
    commands_executed: Number(commandsExecuted) || 0,
    moderated_messages: Number(moderatedMessages) || 0,
    active_members: Number(guild.memberCount) || 0,
    uptime_percentage: DEFAULT_UPTIME_PERCENTAGE,
    tickets_opened: Number(ticketStats?.openedToday || 0),
    tickets_closed: Number(ticketStats?.closedToday || 0),
    open_tickets: Number(ticketStats?.open || 0),
    sla_breaches: Number(slaMetrics?.openBreached || 0),
    avg_first_response_minutes:
      typeof slaMetrics?.avgFirstResponseMinutes === "number"
        ? Number(slaMetrics.avgFirstResponseMinutes.toFixed(2))
        : null,
    modules_active: buildEnabledModules(records),
    updated_at: new Date().toISOString(),
  };
}

function resolveTicketSlaSnapshot(ticket, settingsRecord = {}) {
  const workflowStatus = resolveTicketWorkflowStatus(ticket);
  const slaTargetMinutes = Number(resolveTicketSlaMinutes(settingsRecord || {}, ticket || {}, "alert")) || 0;
  const createdAt = toValidDate(ticket?.created_at);
  const firstResponseAt = toValidDate(ticket?.first_staff_response);

  if (workflowStatus === "closed" || workflowStatus === "resolved") {
    return {
      slaTargetMinutes,
      slaDueAt: createdAt && slaTargetMinutes > 0
        ? new Date(createdAt.getTime() + slaTargetMinutes * 60000).toISOString()
        : null,
      slaState: "resolved",
    };
  }

  if (!createdAt || slaTargetMinutes <= 0) {
    return {
      slaTargetMinutes: 0,
      slaDueAt: null,
      slaState: "paused",
    };
  }

  const dueAt = new Date(createdAt.getTime() + slaTargetMinutes * 60000);
  if (firstResponseAt) {
    return {
      slaTargetMinutes,
      slaDueAt: dueAt.toISOString(),
      slaState: "resolved",
    };
  }

  const remainingMs = dueAt.getTime() - Date.now();
  if (remainingMs <= 0) {
    return {
      slaTargetMinutes,
      slaDueAt: dueAt.toISOString(),
      slaState: "breached",
    };
  }

  if (remainingMs <= 15 * 60 * 1000) {
    return {
      slaTargetMinutes,
      slaDueAt: dueAt.toISOString(),
      slaState: "warning",
    };
  }

  return {
    slaTargetMinutes,
    slaDueAt: dueAt.toISOString(),
    slaState: "healthy",
  };
}


function buildSyncStatusRow(guildId, input = {}) {
  const row = {
    guild_id: guildId,
    bridge_status: input.bridgeStatus || "healthy",
    bridge_message: input.bridgeMessage || null,
    pending_mutations: Number(input.pendingMutations) || 0,
    failed_mutations: Number(input.failedMutations) || 0,
    updated_at: new Date().toISOString(),
  };

  if (input.lastHeartbeatAt) row.last_heartbeat_at = input.lastHeartbeatAt;
  if (input.lastInventoryAt) row.last_inventory_at = input.lastInventoryAt;
  if (input.lastConfigSyncAt) row.last_config_sync_at = input.lastConfigSyncAt;
  if (input.lastMutationProcessedAt) {
    row.last_mutation_processed_at = input.lastMutationProcessedAt;
  }
  if (input.lastBackupAt) row.last_backup_at = input.lastBackupAt;

  return row;
}


module.exports = {
  buildEnabledModules,
  buildGuildPresenceRow,
  normalizeChannelType,
  buildInventorySnapshotRow,
  buildGuildMetricRow,
  resolveTicketSlaSnapshot,
  buildSyncStatusRow,
};
