"use strict";

const { logStructured } = require("./runtime");
const {
  buildTicketMacroRows,
  getMissingBridgeConfigFields,
  isBridgeEnabled,
} = require("./config");
const {
  buildCommercialProjectionFromEntitlement,
  buildDashboardConfigPayload,
} = require("./transforms");
const {
  buildGuildPresenceRow,
  buildInventorySnapshotRow,
  buildGuildMetricRow,
  buildSyncStatusRow,
} = require("./metrics");
const {
  buildTicketInboxRows,
  buildTicketEventRows,
} = require("./tickets");
const {
  buildPlaybookDefinitionRows,
  buildTicketRecommendationRows,
  buildPlaybookRunRows,
} = require("./playbooks");
const {
  readMutationStatusCounts,
  buildBackupManifestRows,
  processPendingMutations,
  syncPlaybookRows,
  syncTicketWorkspaceRows,
  syncBackupManifests,
} = require("./settings");
const {
  fetchGuildEffectiveEntitlement,
  readGuildRecords,
  upsertRows,
  deleteRows,
} = require("./guilds");
const { state } = require("./state");
const { settings } = require("./runtime");

const BRIDGE_GUILD_TABLES = [
  "bot_guilds",
  "guild_inventory_snapshots",
  "guild_metrics_daily",
  "guild_configs",
  "guild_ticket_inbox",
  "guild_ticket_events",
  "guild_ticket_macros",
  "guild_playbook_definitions",
  "guild_playbook_runs",
  "guild_customer_memory",
  "guild_ticket_recommendations",
  "guild_backup_manifests",
  "guild_sync_status",
  "guild_dashboard_events",
  "guild_config_mutations",
];

async function syncGuildBridge(client, guild) {
  const heartbeatAt = new Date().toISOString();
  const mutationSummary = await processPendingMutations(guild.id);
  const records = await readGuildRecords(guild.id);
  const entitlementRow = await fetchGuildEffectiveEntitlement(guild.id).catch((error) => {
    logStructured("warn", "dashboard.bridge.entitlement_fetch_failed", {
      guildId: guild.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  });

  if (records.settingsRecord) {
    const projectionPatch = buildCommercialProjectionFromEntitlement(records.settingsRecord, entitlementRow, {
      now: entitlementRow?.updated_at ? new Date(entitlementRow.updated_at) : new Date(),
    });
    const currentCommercial = JSON.stringify(records.settingsRecord.commercial_settings || {});
    const nextCommercial = JSON.stringify(projectionPatch.commercial_settings || {});
    const currentOpsPlan = records.settingsRecord.dashboard_general_settings?.opsPlan || "free";
    const nextOpsPlan = projectionPatch.dashboard_general_settings?.opsPlan || "free";

    if (currentCommercial !== nextCommercial || currentOpsPlan !== nextOpsPlan) {
      const updatedSettings = await settings.update(guild.id, projectionPatch, {
        skipDashboardSync: true,
        dashboardSyncReason: "supabase_entitlement_projection",
      });
      records.settingsRecord = updatedSettings || { ...records.settingsRecord, ...projectionPatch };
    }
  }

  const presenceRow = buildGuildPresenceRow(guild, records);
  const configRow = {
    guild_id: guild.id,
    ...buildDashboardConfigPayload(records),
    updated_at: heartbeatAt,
  };
  const inventoryRow = buildInventorySnapshotRow(client, guild, records);
  const metricRow = await buildGuildMetricRow(guild, records);
  const ticketInboxRows = await buildTicketInboxRows(guild, records);
  const ticketEventRows = await buildTicketEventRows(guild.id);
  const ticketMacroRows = buildTicketMacroRows(guild.id, records);
  const playbookDefinitionRows = buildPlaybookDefinitionRows(guild.id, records);
  const { customerMemoryRows, recommendationRows } = buildTicketRecommendationRows(guild.id, ticketInboxRows, records);
  const playbookRunRows = buildPlaybookRunRows(guild.id, recommendationRows);
  const backupRows = await buildBackupManifestRows(guild.id);
  const mutationCounts = await readMutationStatusCounts(guild.id);
  const latestBackup = backupRows[0] || null;

  await upsertRows("bot_guilds", [presenceRow], { onConflict: "guild_id" });
  await upsertRows("guild_inventory_snapshots", [inventoryRow], { onConflict: "guild_id" });
  await upsertRows("guild_metrics_daily", [metricRow], { onConflict: "guild_id,metric_date" });
  await upsertRows("guild_configs", [configRow], { onConflict: "guild_id" });
  await syncTicketWorkspaceRows(guild.id, ticketInboxRows, ticketEventRows, ticketMacroRows);
  await syncPlaybookRows(guild.id, playbookDefinitionRows, playbookRunRows, customerMemoryRows, recommendationRows);
  await syncBackupManifests(guild.id, backupRows);
  await upsertRows(
    "guild_sync_status",
    [
      buildSyncStatusRow(guild.id, {
        bridgeStatus: mutationCounts.failed > 0 ? "degraded" : "healthy",
        bridgeMessage:
          mutationCounts.failed > 0
            ? `${mutationCounts.failed} mutacion(es) fallidas pendientes de revision.`
            : null,
        pendingMutations: mutationCounts.pending,
        failedMutations: mutationCounts.failed,
        lastHeartbeatAt: heartbeatAt,
        lastInventoryAt: inventoryRow.updated_at,
        lastConfigSyncAt: heartbeatAt,
        lastMutationProcessedAt: mutationSummary.lastProcessedAt,
        lastBackupAt: latestBackup?.created_at || null,
      }),
    ],
    { onConflict: "guild_id" }
  );
}

async function syncDashboardBridge(client = state.client) {
  if (!isBridgeEnabled()) {
    return false;
  }

  if (client) {
    state.client = client;
  }

  if (!state.client) {
    return false;
  }

  if (state.syncInFlight) {
    return state.syncInFlight;
  }

  const queuedGuildIds = Array.from(state.queuedGuildIds);
  const fullSync = state.fullSyncQueued || queuedGuildIds.length === 0;
  state.queuedGuildIds.clear();
  state.fullSyncQueued = false;

  const guilds = fullSync
    ? Array.from(state.client.guilds.cache.values())
    : queuedGuildIds
        .map((guildId) => state.client.guilds.cache.get(guildId))
        .filter(Boolean);

  state.syncInFlight = (async () => {
    let syncedGuilds = 0;

    for (const guild of guilds) {
      try {
        await syncGuildBridge(state.client, guild);
        syncedGuilds += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logStructured("error", "dashboard.bridge.guild_sync_failed", {
          guildId: guild?.id || null,
          message,
        });

        try {
          await upsertRows(
            "guild_sync_status",
            [
              buildSyncStatusRow(guild.id, {
                bridgeStatus: "error",
                bridgeMessage: message,
                lastHeartbeatAt: new Date().toISOString(),
              }),
            ],
            { onConflict: "guild_id" }
          );
        } catch {}
      }
    }

    // Throttled logging: only log every 10th sync or when explicitly debugging
    const syncCount = (state.syncCount || 0) + 1;
    state.syncCount = syncCount;
    if (syncCount % 10 === 1 || process.env.LOG_LEVEL === "debug" || fullSync) {
      logStructured("info", "dashboard.bridge.sync_completed", {
        syncedGuilds,
        fullSync,
        reason: state.queuedReason,
        syncCount,
      });
    }

    return true;
  })()
    .catch((error) => {
      logStructured("error", "dashboard.bridge.sync_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    })
    .finally(() => {
      state.syncInFlight = null;
      if (state.fullSyncQueued || state.queuedGuildIds.size > 0) {
        queueDashboardBridgeSync(state.client, {
          reason: "drain_queue",
          delayMs: 1500,
        });
      }
    });

  return state.syncInFlight;
}

function queueDashboardBridgeSync(client = null, options = {}) {
  if (!isBridgeEnabled()) {
    return false;
  }

  if (client) {
    state.client = client;
  }

  if (options.guildId) {
    state.queuedGuildIds.add(String(options.guildId));
  } else {
    state.fullSyncQueued = true;
  }

  state.queuedReason = options.reason || state.queuedReason || "queued";

  if (state.syncTimer) {
    clearTimeout(state.syncTimer);
  }

  const delayMs = Math.max(0, Number(options.delayMs ?? 2500) || 0);
  state.syncTimer = setTimeout(() => {
    state.syncTimer = null;
    void syncDashboardBridge(state.client);
  }, delayMs);

  if (typeof state.syncTimer.unref === "function") {
    state.syncTimer.unref();
  }

  return true;
}

function queueDashboardConfigExport(guildId, _settingsRecord = null, options = {}) {
  return queueDashboardBridgeSync(state.client, {
    guildId,
    reason: options.reason || "config_export",
    delayMs: options.delayMs ?? 1500,
  });
}

function startDashboardBridge(client) {
  if (!client) {
    logStructured("warn", "dashboard.bridge.disabled", {
      type: "config",
      reason: "missing_client",
      message: "Dashboard bridge was not started because the Discord client is unavailable.",
    });
    return false;
  }

  if (!isBridgeEnabled()) {
    logStructured("warn", "dashboard.bridge.disabled", {
      type: "config",
      reason: "missing_supabase_config",
      missing: getMissingBridgeConfigFields(),
      message: "Dashboard bridge sync disabled because Supabase configuration is incomplete.",
    });
    return false;
  }

  state.client = client;

  if (state.intervalId) {
    return true;
  }

  queueDashboardBridgeSync(client, {
    reason: "bridge_start",
    delayMs: 2500,
  });

  const intervalMs = Math.max(
    30000,
    Number(
      process.env.DASHBOARD_BRIDGE_INTERVAL_MS
      || process.env.SUPABASE_DASHBOARD_SYNC_INTERVAL_MS
      || 60000
    )
  );

  state.intervalId = setInterval(() => {
    queueDashboardBridgeSync(client, {
      reason: "scheduled_sync",
      delayMs: 0,
    });
  }, intervalMs);

  if (typeof state.intervalId.unref === "function") {
    state.intervalId.unref();
  }

  return true;
}

async function removeGuildFromDashboard(guildId, options = {}) {
  const bridgeEnabled = options.skipBridgeEnabledCheck ? true : isBridgeEnabled();
  if (!bridgeEnabled || !guildId) {
    return false;
  }

  try {
    const deleteRowsFn = options.deleteRowsFn || deleteRows;
    await Promise.all(
      BRIDGE_GUILD_TABLES.map((table) => deleteRowsFn(table, {
        guild_id: `eq.${guildId}`,
      }))
    );
    return true;
  } catch (error) {
    logStructured("error", "dashboard.bridge.guild_remove_failed", {
      guildId,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

module.exports = {
  BRIDGE_GUILD_TABLES,
  syncGuildBridge,
  syncDashboardBridge,
  queueDashboardBridgeSync,
  queueDashboardConfigExport,
  startDashboardBridge,
  removeGuildFromDashboard,
};
