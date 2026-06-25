"use strict";

const {
  auditLogs,
  configBackups,
  modlogSettings,
  notes,
  settings,
  suggestSettings,
  verifSettings,
  warnings,
  welcomeSettings,
  applyBackupSnapshot,
  saveCurrentConfigBackup,
  clearGuildSettingsCache,
} = require("./runtime");
const {
  isPlainObject,
  toInt,
  toIsoOrNull,
  toNullableString,
  toValidDate,
} = require("./config");
const {
  mapCommandsMutationPayload,
  mapGeneralMutationPayload,
  mapAutomodMutationPayload,
  mapModlogMutationPayload,
  mapMusicMutationPayload,
  mapServerRolesMutationPayload,
  mapSuggestionMutationPayload,
  mapSystemMutationPayload,
  mapTicketsMutationPayload,
  mapVerificationMutationPayload,
  mapWelcomeMutationPayload,
} = require("./transforms");
const {
  requestSupabase,
  upsertRows,
  patchRows,
  deleteRows,
  insertDashboardEvent,
} = require("./guilds");
const { applyTicketActionMutation } = require("./tickets");

async function readPendingMutations(guildId) {
  const rows = await requestSupabase("guild_config_mutations", {
    query: {
      select: [
        "id",
        "guild_id",
        "actor_user_id",
        "mutation_type",
        "section",
        "status",
        "requested_payload",
        "applied_payload",
        "metadata",
        "error_message",
        "requested_at",
        "applied_at",
        "failed_at",
        "superseded_at",
        "updated_at",
      ].join(","),
      guild_id: `eq.${guildId}`,
      status: "eq.pending",
      order: "requested_at.asc",
    },
  });

  return Array.isArray(rows) ? rows : [];
}

async function readMutationStatusCounts(guildId) {
  const rows = await requestSupabase("guild_config_mutations", {
    query: {
      select: "status",
      guild_id: `eq.${guildId}`,
    },
  });

  const counts = {
    pending: 0,
    failed: 0,
  };

  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.status === "pending") counts.pending += 1;
    if (row?.status === "failed") counts.failed += 1;
  }

  return counts;
}

async function buildBackupManifestRows(guildId) {
  const backups = await configBackups.listRecent(guildId, 20);

  return backups.map((backup) => ({
    backup_id: backup.backup_id,
    guild_id: guildId,
    actor_user_id: null,
    source: toNullableString(backup.source) || "manual",
    schema_version: toInt(backup.schema_version, 1, 1, 100),
    exported_at: toIsoOrNull(backup.exported_at) || toIsoOrNull(backup.created_at) || new Date().toISOString(),
    created_at: toIsoOrNull(backup.created_at) || new Date().toISOString(),
    metadata: {
      actorId: backup.actor_id || null,
      snapshotSections: backup.payload && typeof backup.payload === "object"
        ? Object.keys(backup.payload)
        : [],
    },
  }));
}

async function syncTicketWorkspaceRows(guildId, inboxRows, eventRows, macroRows) {
  await upsertRows("guild_ticket_inbox", inboxRows, { onConflict: "guild_id,ticket_id" });
  await upsertRows("guild_ticket_events", eventRows, { onConflict: "id" });
  await upsertRows("guild_ticket_macros", macroRows, { onConflict: "guild_id,macro_id" });

  const existingInboxRows = await requestSupabase("guild_ticket_inbox", {
    query: {
      select: "ticket_id",
      guild_id: `eq.${guildId}`,
    },
  });

  const keepTicketIds = new Set(inboxRows.map((row) => row.ticket_id));
  const staleTicketIds = (Array.isArray(existingInboxRows) ? existingInboxRows : [])
    .map((row) => row?.ticket_id)
    .filter((ticketId) => ticketId && !keepTicketIds.has(ticketId));

  if (staleTicketIds.length) {
    await deleteRows("guild_ticket_inbox", {
      guild_id: `eq.${guildId}`,
      ticket_id: `in.(${staleTicketIds.join(",")})`,
    });
  }

  const existingEventRows = await requestSupabase("guild_ticket_events", {
    query: {
      select: "id",
      guild_id: `eq.${guildId}`,
    },
  });

  const keepEventIds = new Set(eventRows.map((row) => row.id));
  const staleEventIds = (Array.isArray(existingEventRows) ? existingEventRows : [])
    .map((row) => row?.id)
    .filter((eventId) => eventId && !keepEventIds.has(eventId));

  if (staleEventIds.length) {
    await deleteRows("guild_ticket_events", {
      guild_id: `eq.${guildId}`,
      id: `in.(${staleEventIds.join(",")})`,
    });
  }
}

function mergeExistingOperationalStatus(rows, existingRows, idKey) {
  const existingById = new Map(
    (Array.isArray(existingRows) ? existingRows : [])
      .filter((row) => row && row[idKey])
      .map((row) => [row[idKey], row]),
  );

  return rows.map((row) => {
    const existing = existingById.get(row[idKey]);
    if (!existing) {
      return row;
    }

    return {
      ...row,
      status: existing.status || row.status,
      created_at: existing.created_at || row.created_at,
      updated_at: row.updated_at || existing.updated_at,
    };
  });
}

async function syncPlaybookRows(guildId, definitionRows, runRows, customerMemoryRows, recommendationRows) {
  const [existingRuns, existingRecommendations, existingDefinitions, existingMemory] = await Promise.all([
    requestSupabase("guild_playbook_runs", {
      query: {
        select: "run_id,status,created_at,updated_at",
        guild_id: `eq.${guildId}`,
      },
    }),
    requestSupabase("guild_ticket_recommendations", {
      query: {
        select: "recommendation_id,status,created_at,updated_at",
        guild_id: `eq.${guildId}`,
      },
    }),
    requestSupabase("guild_playbook_definitions", {
      query: {
        select: "playbook_id",
        guild_id: `eq.${guildId}`,
      },
    }),
    requestSupabase("guild_customer_memory", {
      query: {
        select: "user_id",
        guild_id: `eq.${guildId}`,
      },
    }),
  ]);

  const mergedRunRows = mergeExistingOperationalStatus(runRows, existingRuns, "run_id");
  const mergedRecommendationRows = mergeExistingOperationalStatus(
    recommendationRows,
    existingRecommendations,
    "recommendation_id",
  );

  await upsertRows("guild_playbook_definitions", definitionRows, { onConflict: "guild_id,playbook_id" });
  await upsertRows("guild_playbook_runs", mergedRunRows, { onConflict: "guild_id,run_id" });
  await upsertRows("guild_customer_memory", customerMemoryRows, { onConflict: "guild_id,user_id" });
  await upsertRows("guild_ticket_recommendations", mergedRecommendationRows, { onConflict: "guild_id,recommendation_id" });

  const staleDefinitionIds = (Array.isArray(existingDefinitions) ? existingDefinitions : [])
    .map((row) => row?.playbook_id)
    .filter((playbookId) => playbookId && !definitionRows.some((row) => row.playbook_id === playbookId));
  const staleRunIds = (Array.isArray(existingRuns) ? existingRuns : [])
    .map((row) => row?.run_id)
    .filter((runId) => runId && !mergedRunRows.some((row) => row.run_id === runId));
  const staleMemoryIds = (Array.isArray(existingMemory) ? existingMemory : [])
    .map((row) => row?.user_id)
    .filter((userId) => userId && !customerMemoryRows.some((row) => row.user_id === userId));
  const staleRecommendationIds = (Array.isArray(existingRecommendations) ? existingRecommendations : [])
    .map((row) => row?.recommendation_id)
    .filter((recommendationId) => recommendationId && !mergedRecommendationRows.some((row) => row.recommendation_id === recommendationId));

  await Promise.all([
    staleDefinitionIds.length
      ? deleteRows("guild_playbook_definitions", {
          guild_id: `eq.${guildId}`,
          playbook_id: `in.(${staleDefinitionIds.join(",")})`,
        })
      : Promise.resolve(),
    staleRunIds.length
      ? deleteRows("guild_playbook_runs", {
          guild_id: `eq.${guildId}`,
          run_id: `in.(${staleRunIds.join(",")})`,
        })
      : Promise.resolve(),
    staleMemoryIds.length
      ? deleteRows("guild_customer_memory", {
          guild_id: `eq.${guildId}`,
          user_id: `in.(${staleMemoryIds.join(",")})`,
        })
      : Promise.resolve(),
    staleRecommendationIds.length
      ? deleteRows("guild_ticket_recommendations", {
          guild_id: `eq.${guildId}`,
          recommendation_id: `in.(${staleRecommendationIds.join(",")})`,
        })
      : Promise.resolve(),
  ]);
}


async function applyMutationToMongo(guildId, mutation) {
  const payload = isPlainObject(mutation?.requested_payload) ? mutation.requested_payload : {};
  const syncReason = `dashboardMutation.${mutation.section}`;

  if (mutation?.mutation_type === "ticket_action") {
    return applyTicketActionMutation(guildId, mutation);
  }

  switch (mutation.section) {
    case "general":
      return settings.update(guildId, mapGeneralMutationPayload(payload), {
        skipDashboardSync: true,
        dashboardSyncReason: syncReason,
      });
    case "server_roles_channels":
      return settings.update(guildId, mapServerRolesMutationPayload(payload), {
        skipDashboardSync: true,
        dashboardSyncReason: syncReason,
      });
    case "tickets":
      return settings.update(guildId, mapTicketsMutationPayload(payload), {
        skipDashboardSync: true,
        dashboardSyncReason: syncReason,
      });
    case "verification":
      return verifSettings.update(guildId, mapVerificationMutationPayload(payload), {
        skipDashboardSync: true,
        dashboardSyncReason: syncReason,
      });
    case "welcome":
      return welcomeSettings.update(guildId, mapWelcomeMutationPayload(payload), {
        skipDashboardSync: true,
        dashboardSyncReason: syncReason,
      });
    case "suggestions":
      return suggestSettings.update(guildId, mapSuggestionMutationPayload(payload), {
        skipDashboardSync: true,
        dashboardSyncReason: syncReason,
      });
    case "modlogs":
      return modlogSettings.update(guildId, mapModlogMutationPayload(payload), {
        skipDashboardSync: true,
        dashboardSyncReason: syncReason,
      });
    case "automod":
      return settings.update(guildId, mapAutomodMutationPayload(payload), {
        skipDashboardSync: true,
        dashboardSyncReason: syncReason,
      });
    case "music":
      return settings.update(guildId, mapMusicMutationPayload(payload), {
        skipDashboardSync: true,
        dashboardSyncReason: syncReason,
      });
    case "commands":
      return settings.update(guildId, mapCommandsMutationPayload(payload), {
        skipDashboardSync: true,
        dashboardSyncReason: syncReason,
      });
    case "system":
      return settings.update(guildId, mapSystemMutationPayload(payload), {
        skipDashboardSync: true,
        dashboardSyncReason: syncReason,
      });
    case "create_backup": {
      const backup = await saveCurrentConfigBackup({
        guildId,
        actorId: mutation.actor_user_id || null,
        source: "dashboard_request",
      });
      return {
        backupId: backup?.backup_id || null,
        exportedAt: backup?.exported_at || null,
        createdAt: backup?.created_at || null,
      };
    }
    case "restore_backup": {
      const backupId = toNullableString(payload.backupId ?? payload.backup_id);
      if (!backupId) {
        throw new Error("Backup ID is required for restore.");
      }

      const backup = await configBackups.getById(guildId, backupId);
      if (!backup?.payload) {
        throw new Error(`Backup ${backupId} not found.`);
      }

      const restored = await applyBackupSnapshot(guildId, backup.payload);
      clearGuildSettingsCache(guildId);

      return {
        backupId,
        restored: true,
        sections: restored && typeof restored === "object" ? Object.keys(restored) : [],
      };
    }
    default:
      throw new Error(`Unsupported dashboard mutation section: ${mutation.section}`);
  }
}

function buildMutationEventMetadata(mutation, status, payload = null) {
  return {
    mutationId: mutation.id,
    mutationType: mutation.mutation_type,
    section: mutation.section,
    status,
    payload,
  };
}

async function processPendingMutations(guildId) {
  const mutations = await readPendingMutations(guildId);
  const summary = {
    processedCount: 0,
    appliedCount: 0,
    failedCount: 0,
    lastProcessedAt: null,
  };

  for (const mutation of mutations) {
    summary.processedCount += 1;
    const processedAt = new Date().toISOString();

    try {
      const appliedPayload = await applyMutationToMongo(guildId, mutation);
      clearGuildSettingsCache(guildId);

      await patchRows(
        "guild_config_mutations",
        { id: `eq.${mutation.id}` },
        {
          status: "applied",
          applied_payload: appliedPayload ?? mutation.requested_payload ?? {},
          error_message: null,
          applied_at: processedAt,
          failed_at: null,
          updated_at: processedAt,
        }
      );

      await insertDashboardEvent({
        guild_id: guildId,
        actor_user_id: mutation.actor_user_id || null,
        event_type:
          mutation.mutation_type === "backup"
            ? "backup_request_applied"
            : mutation.mutation_type === "ticket_action"
              ? "ticket_action_applied"
              : "config_request_applied",
        title:
          mutation.mutation_type === "backup"
            ? "Accion de backup aplicada"
            : mutation.mutation_type === "ticket_action"
              ? "Accion operativa aplicada"
              : "Cambio aplicado por el bot",
        description:
          mutation.mutation_type === "backup"
            ? `El bot aplico la accion ${mutation.section} solicitada desde la dashboard.`
            : mutation.mutation_type === "ticket_action"
              ? `El bot aplico la accion operativa ${mutation.section} solicitada desde la inbox de tickets.`
              : `El bot aplico la seccion ${mutation.section} solicitada desde la dashboard.`,
        metadata: buildMutationEventMetadata(mutation, "applied", appliedPayload),
      });

      await auditLogs.add({
        guild_id: guildId,
        actor_id: mutation.actor_user_id || null,
        kind: "dashboard_mutation",
        action: mutation.section,
        status: "applied",
        source: "dashboard.bridge",
        metadata: buildMutationEventMetadata(mutation, "applied", appliedPayload),
      });

      summary.appliedCount += 1;
      summary.lastProcessedAt = processedAt;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected dashboard mutation error.";

      await patchRows(
        "guild_config_mutations",
        { id: `eq.${mutation.id}` },
        {
          status: "failed",
          error_message: message,
          failed_at: processedAt,
          updated_at: processedAt,
        }
      );

      await insertDashboardEvent({
        guild_id: guildId,
        actor_user_id: mutation.actor_user_id || null,
        event_type:
          mutation.mutation_type === "backup"
            ? "backup_request_failed"
            : mutation.mutation_type === "ticket_action"
              ? "ticket_action_failed"
              : "config_request_failed",
        title:
          mutation.mutation_type === "backup"
            ? "Accion de backup fallida"
            : mutation.mutation_type === "ticket_action"
              ? "Accion operativa fallida"
              : "No pudimos aplicar el cambio solicitado",
        description:
          mutation.mutation_type === "backup"
            ? `La accion ${mutation.section} fallo al procesarse en el bot.`
            : mutation.mutation_type === "ticket_action"
              ? `La accion operativa ${mutation.section} fallo al procesarse en el bot.`
              : `La seccion ${mutation.section} fallo al procesarse en el bot.`,
        metadata: {
          ...buildMutationEventMetadata(mutation, "failed"),
          error: message,
        },
      });

      await auditLogs.add({
        guild_id: guildId,
        actor_id: mutation.actor_user_id || null,
        kind: "dashboard_mutation",
        action: mutation.section,
        status: "failed",
        source: "dashboard.bridge",
        metadata: {
          mutationId: mutation.id,
          error: message,
        },
      });

      summary.failedCount += 1;
      summary.lastProcessedAt = processedAt;
    }
  }

  return summary;
}

async function syncBackupManifests(guildId, rows) {
  await upsertRows("guild_backup_manifests", rows, { onConflict: "backup_id" });

  const existingRows = await requestSupabase("guild_backup_manifests", {
    query: {
      select: "backup_id",
      guild_id: `eq.${guildId}`,
    },
  });

  const keepIds = new Set(rows.map((row) => row.backup_id));
  const staleIds = (Array.isArray(existingRows) ? existingRows : [])
    .map((row) => row?.backup_id)
    .filter((backupId) => backupId && !keepIds.has(backupId));

  if (staleIds.length) {
    await deleteRows("guild_backup_manifests", {
      guild_id: `eq.${guildId}`,
      backup_id: `in.(${staleIds.join(",")})`,
    });
  }
}


module.exports = {
  readPendingMutations,
  readMutationStatusCounts,
  buildBackupManifestRows,
  syncTicketWorkspaceRows,
  syncPlaybookRows,
  applyMutationToMongo,
  buildMutationEventMetadata,
  processPendingMutations,
  syncBackupManifests,
};
