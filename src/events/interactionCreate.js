const { Collection, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { resolveCommand } = require("../utils/commandUtils");
const E = require("../utils/embeds");
const { handleVerif } = require("../handlers/verifHandler");
const { tags, auditLogs, isDbUnavailableError } = require("../utils/database");

const { checkUserRateLimit } = require("../utils/rateLimiter");
const {
  checkAccess,
  getGuildSettings,
  resolveRequiredAccess,
  formatAccessDenied,
  clearGuildSettingsCache,
} = require("../utils/accessControl");
const { resolveInteractionLanguage, t } = require("../utils/i18n");
const { t: musicT } = require("../music/i18n");
const { toMs, logStructured, recordError, recordInteractionMetric } = require("../utils/observability");
const { queueBotStatsSync } = require("../utils/botStatsSync");
const { queueDashboardBridgeSync } = require("../utils/dashboardBridgeSync");
const { isCommandDisabled } = require("../utils/commandToggles");
const {
  isRateLimitedType,
  getInteractionMetricKey,
  resolveCommandRateLimitConfig,
} = require("./interaction/routerHelpers");

const buttons = new Collection();
const selects = new Collection();
const modals = new Collection();
let handlersLoaded = false;
const activeInteractions = new Set();
const SETTINGS_MUTATION_COMMANDS = new Set(["config", "setup", "verify"]);
const SETTINGS_MUTATION_CUSTOM_ID_PREFIXES = ["cfg_center_", "setup_cmd_panel_"];
const MUSIC_COMMANDS = new Set(["play", "skip", "stop", "pause", "resume", "queue", "nowplaying", "volume", "leave"]);
let musicInteractionModule = require("../handlers/music/musicInteractionHandler");

function getMusicInteractionHandler() {
  const handler = musicInteractionModule?.musicInteractionHandler;
  return typeof handler === "function" ? handler : null;
}

async function respondMusicUnavailable(interaction) {
  const language = resolveInteractionLanguage(interaction);
  const payload = {
    content: musicT(language, "error_lavalink"),
    flags: 64,
  };

  if (interaction.isButton?.()) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate().catch(() => {});
    }
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    }
    return;
  }

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload).catch(() => {});
  } else {
    await interaction.reply(payload).catch(() => {});
  }
}

function clearCachedSettings(guildId) {
  if (!guildId) return;
  clearGuildSettingsCache(guildId);
}

function shouldInvalidateSettingsCache(interaction) {
  if (!interaction?.guildId) return false;
  if (interaction.isChatInputCommand?.()) {
    return SETTINGS_MUTATION_COMMANDS.has(interaction.commandName);
  }
  const customId = interaction.customId || "";
  return SETTINGS_MUTATION_CUSTOM_ID_PREFIXES.some((prefix) => customId.startsWith(prefix));
}

function maybeClearCachedSettings(interaction) {
  if (shouldInvalidateSettingsCache(interaction)) {
    clearCachedSettings(interaction.guildId);
  }
}

function maybeSyncDashboardState(interaction, client) {
  if (!interaction?.guildId || !shouldInvalidateSettingsCache(interaction)) {
    return;
  }

  queueDashboardBridgeSync(client, {
    reason: `settingsMutation:${interaction.guildId}`,
    delayMs: 1500,
  });
}

function maybeHandleSettingsMutation(interaction, client) {
  maybeClearCachedSettings(interaction);
  maybeSyncDashboardState(interaction, client);
}

function safeAuditLog(interaction, data = {}) {
  try {
    const guildId = interaction.guildId || interaction.guild?.id;
    if (!guildId) return;

    void auditLogs.add({
      guild_id: guildId,
      actor_id: interaction.user?.id || null,
      target_id: data.targetId || null,
      kind: data.kind || "interaction",
      action: data.action || "unknown",
      status: data.status || "ok",
      source: "interaction.router",
      metadata: data.metadata && typeof data.metadata === "object" ? data.metadata : {},
    });
  } catch {}
}

async function applyCommandRateLimit(interaction, guildSettings, language = "en") {
  if (!interaction?.user || !interaction.guildId || !interaction.isChatInputCommand()) return false;
  if (!interaction.commandName) return false;

  const ownerId = process.env.OWNER_ID || process.env.DISCORD_OWNER_ID;
  if (ownerId && interaction.user.id === ownerId) return false;

  const bypassAdmin = guildSettings?.rate_limit_bypass_admin !== false;
  if (bypassAdmin && interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return false;
  }

  const cfg = resolveCommandRateLimitConfig(guildSettings, interaction.commandName);
  if (!cfg.enabled) return false;

  const result = checkUserRateLimit({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    scope: `command:${interaction.commandName}`,
    maxActions: cfg.maxActions,
    windowSeconds: cfg.windowSeconds,
  });
  if (!result.limited) return false;

  const payload = {
    embeds: [
      E.warningEmbed(
        t(language, "interaction.rate_limit.command", {
          commandName: interaction.commandName,
          retryAfterSec: result.retryAfterSec,
        }),
        null,
        language
      ),
    ],
    flags: 64,
  };

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload).catch((err) => {
      logStructured("warn", "interaction.rate_limit.followUp_failed", { error: err?.message || String(err) });
    });
  } else {
    await interaction.reply(payload).catch((err) => {
      logStructured("warn", "interaction.rate_limit.reply_failed", { error: err?.message || String(err) });
    });
  }

  safeAuditLog(interaction, {
    kind: "command",
    action: interaction.commandName,
    status: "rate_limited",
    metadata: {
      limiter: "per_command",
      retry_after_sec: result.retryAfterSec,
      max_actions: cfg.maxActions,
      window_seconds: cfg.windowSeconds,
    },
  });

  return true;
}

async function runObservedOperation(interaction, kind, name, fn) {
  const startNs = process.hrtime.bigint();
  try {
    const result = await fn();
    const durationMs = toMs(startNs);
    recordInteractionMetric({
      kind,
      name,
      status: "ok",
      durationMs,
      guildId: interaction.guildId || null,
    });
    safeAuditLog(interaction, {
      kind,
      action: name,
      status: "ok",
      metadata: { duration_ms: durationMs },
    });
    return result;
  } catch (error) {
    const durationMs = toMs(startNs);
    recordInteractionMetric({
      kind,
      name,
      status: "error",
      durationMs,
      guildId: interaction.guildId || null,
    });
    recordError(`interaction.${kind}`);
    logStructured("error", "interaction.operation.error", {
      kind,
      name,
      guildId: interaction.guildId || null,
      userId: interaction.user?.id || null,
      error: error?.message || String(error),
    });
    safeAuditLog(interaction, {
      kind,
      action: name,
      status: "error",
      metadata: {
        duration_ms: durationMs,
        error: error?.message || String(error),
      },
    });
    throw error;
  }
}

async function applyInteractionRateLimit(interaction) {
  if (!interaction?.user || !interaction.guildId) return false;
  if (interaction.isAutocomplete()) return false;
  if (!isRateLimitedType(interaction)) return false;

  const guildSettings = await getGuildSettings(interaction.guildId);
  const language = resolveInteractionLanguage(interaction, guildSettings);
  if (guildSettings?.rate_limit_enabled === false) return false;

  const ownerId = process.env.OWNER_ID || process.env.DISCORD_OWNER_ID;
  if (ownerId && interaction.user.id === ownerId) return false;

  const bypassAdmin = guildSettings?.rate_limit_bypass_admin !== false;
  if (bypassAdmin && interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return false;
  }

  const maxActions = guildSettings?.rate_limit_max_actions ?? 8;
  const windowSeconds = guildSettings?.rate_limit_window_seconds ?? 10;

  const result = checkUserRateLimit({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    scope: "interaction",
    maxActions,
    windowSeconds,
  });

  if (!result.limited) return false;

  const payload = {
    embeds: [
      E.warningEmbed(
        t(language, "interaction.rate_limit.global", {
          retryAfterSec: result.retryAfterSec,
        }),
        null,
        language
      ),
    ],
    flags: 64,
  };

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload).catch((err) => {
      logStructured("warn", "interaction.global_rate_limit.followUp_failed", { error: err?.message || String(err) });
    });
  } else {
    await interaction.reply(payload).catch((err) => {
      logStructured("warn", "interaction.global_rate_limit.reply_failed", { error: err?.message || String(err) });
    });
  }

  const metric = getInteractionMetricKey(interaction);
  safeAuditLog(interaction, {
    kind: metric.kind,
    action: metric.name,
    status: "rate_limited",
    metadata: {
      limiter: "global_interaction",
      retry_after_sec: result.retryAfterSec,
      max_actions: maxActions,
      window_seconds: windowSeconds,
    },
  });

  return true;
}

function loadHandlers() {
  const buttonsPath = path.join(__dirname, "../interactions/buttons");
  if (fs.existsSync(buttonsPath)) {
    const buttonFiles = fs.readdirSync(buttonsPath).filter((file) => file.endsWith(".js"));
    for (const file of buttonFiles) {
      const button = require(path.join(buttonsPath, file));
      buttons.set(button.customId, button);
    }
  }

  const selectsPath = path.join(__dirname, "../interactions/selects");
  if (fs.existsSync(selectsPath)) {
    const selectFiles = fs.readdirSync(selectsPath).filter((file) => file.endsWith(".js"));
    for (const file of selectFiles) {
      const select = require(path.join(selectsPath, file));
      selects.set(select.customId, select);
    }
  }

  const modalsPath = path.join(__dirname, "../interactions/modals");
  if (fs.existsSync(modalsPath)) {
    const modalFiles = fs.readdirSync(modalsPath).filter((file) => file.endsWith(".js"));
    for (const file of modalFiles) {
      const modal = require(path.join(modalsPath, file));
      modals.set(modal.customId, modal);
    }
  }

  // Mark AFTER all I/O completes to prevent partially-loaded handlers
  handlersLoaded = true;
}

function findHandler(collection, customId) {
  if (collection.has(customId)) {
    return collection.get(customId);
  }

  return Array.from(collection.entries()).find(([key]) => {
    if (key.endsWith("*")) {
      const prefix = key.slice(0, -1);
      return customId.startsWith(prefix);
    }
    return false;
  })?.[1];
}

async function handleAccessDenied(interaction, kind, name, reason, language = "en") {
  recordInteractionMetric({
    kind,
    name,
    status: "denied",
    durationMs: 0,
    guildId: interaction.guildId || null,
  });
  safeAuditLog(interaction, {
    kind,
    action: name,
    status: "denied",
    metadata: { reason },
  });
  return interaction.reply({
    embeds: [E.errorEmbed(formatAccessDenied(reason, language), null, language)],
    flags: 64,
  }).catch((err) => {
    logStructured("warn", "interaction.access_denied.reply_failed", { error: err?.message || String(err) });
  });
}

async function handleCommandDisabled(interaction, commandName, language = "en") {
  recordInteractionMetric({
    kind: "command",
    name: commandName,
    status: "denied",
    durationMs: 0,
    guildId: interaction.guildId || null,
  });
  safeAuditLog(interaction, {
    kind: "command",
    action: commandName,
    status: "denied",
    metadata: { reason: "command_disabled" },
  });

  return interaction.reply({
    embeds: [E.errorEmbed(t(language, "interaction.command_disabled", { commandName }), null, language)],
    flags: 64,
  }).catch((err) => {
    logStructured("warn", "interaction.command_disabled.reply_failed", { error: err?.message || String(err) });
  });
}

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    if (interaction?.id && activeInteractions.has(interaction.id)) {
      return;
    }
    if (interaction?.id) {
      activeInteractions.add(interaction.id);
    }

    try {
      if (interaction.isChatInputCommand() && MUSIC_COMMANDS.has(interaction.commandName)) {
        const musicInteractionHandler = getMusicInteractionHandler();
        if (client.musicManager && musicInteractionHandler) {
          await musicInteractionHandler(interaction);
        } else {
          await respondMusicUnavailable(interaction);
        }
        return;
      }

      if (interaction.isButton() && interaction.customId?.startsWith("music:")) {
        const musicInteractionHandler = getMusicInteractionHandler();
        if (client.musicManager && musicInteractionHandler) {
          await musicInteractionHandler(interaction);
        } else {
          await respondMusicUnavailable(interaction);
        }
        return;
      }

      if (!handlersLoaded) {
        loadHandlers();
      }

      const blockedByRateLimit = await applyInteractionRateLimit(interaction);
      if (blockedByRateLimit) {
        const metric = getInteractionMetricKey(interaction);
        recordInteractionMetric({
          kind: metric.kind,
          name: metric.name,
          status: "rate_limited",
          durationMs: 0,
          guildId: interaction.guildId || null,
        });
        return;
      }

      if (interaction.isChatInputCommand()) {
        const cmd = resolveCommand(interaction.commandName, client);
        if (cmd) {
          const guildSettings = interaction.guildId
            ? await getGuildSettings(interaction.guildId)
            : null;
          const language = resolveInteractionLanguage(interaction, guildSettings);
          const blockedByCommandRateLimit = await applyCommandRateLimit(
            interaction,
            guildSettings,
            language
          );
          if (blockedByCommandRateLimit) {
            recordInteractionMetric({
              kind: "command",
              name: interaction.commandName,
              status: "rate_limited",
              durationMs: 0,
              guildId: interaction.guildId || null,
            });
            return;
          }
          if (isCommandDisabled(interaction.commandName, guildSettings)) {
            return await handleCommandDisabled(interaction, interaction.commandName, language);
          }

          const requiredAccess = resolveRequiredAccess(cmd);
          const access = await checkAccess(interaction, requiredAccess, guildSettings);
          if (!access.allowed) {
            return await handleAccessDenied(
              interaction,
              "command",
              interaction.commandName,
              access.reason,
              language
            );
          }
          await runObservedOperation(
            interaction,
            "command",
            interaction.commandName,
            () => cmd.execute(interaction, client)
          );
          maybeHandleSettingsMutation(interaction, client);
          queueBotStatsSync(client, {
            commandIncrement: 1,
            reason: `command:${interaction.commandName}`,
            delayMs: 1000,
          });
          return;
        }

        // Delegate to music module if available
        if (client.musicManager) {
          try {
            const musicInteractionHandler = getMusicInteractionHandler();
            if (musicInteractionHandler) {
              await musicInteractionHandler(interaction);
            }
          } catch (err) {
            // Only log actual errors; gracefully skip if command simply not found
            if (err?.message && !err.message.includes("not found") && !err.message.includes("Unknown interaction")) {
              logStructured("warn", "interaction.music_delegate.error", {
                guildId: interaction.guildId,
                commandName: interaction.commandName,
                error: err.message,
              });
            }
          }
        }

        return;
      }

      if (interaction.isAutocomplete()) {
        const cmd = resolveCommand(interaction.commandName, client);
        if (cmd?.autocomplete) {
          const guildSettings = interaction.guildId
            ? await getGuildSettings(interaction.guildId)
            : null;
          if (isCommandDisabled(interaction.commandName, guildSettings)) return;

          const requiredAccess = resolveRequiredAccess(cmd);
          const access = await checkAccess(interaction, requiredAccess, guildSettings);
          if (!access.allowed) return;
          await runObservedOperation(
            interaction,
            "autocomplete",
            interaction.commandName,
            () => cmd.autocomplete(interaction)
          );
        }
        return;
      }

      if (interaction.isButton()) {
        if (interaction.customId.startsWith("verify_")) {
          await runObservedOperation(interaction, "button", interaction.customId, () => handleVerif(interaction));
          maybeHandleSettingsMutation(interaction, client);
          return;
        }


        if (interaction.customId.startsWith("tag_delete_confirm_")) {
          const startNs = process.hrtime.bigint();
          const tagName = interaction.customId.replace("tag_delete_confirm_", "");
          try {
            const guildSettings = await getGuildSettings(interaction.guild.id);
            const language = resolveInteractionLanguage(interaction, guildSettings);
            await tags.delete(interaction.guild.id, tagName);
            recordInteractionMetric({
              kind: "button",
              name: interaction.customId,
              status: "ok",
              durationMs: toMs(startNs),
              guildId: interaction.guildId || null,
            });
            return interaction.update({
              embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(t(language, "interaction.tag_delete.success", { name: tagName }))],
              components: [],
            });
          } catch (error) {
            recordInteractionMetric({
              kind: "button",
              name: interaction.customId,
              status: "error",
              durationMs: toMs(startNs),
              guildId: interaction.guildId || null,
            });
            recordError("interaction.button.tag_delete");
            logStructured("error", "interaction.button.tag_delete_error", { guildId: interaction.guildId, tagName, error: error?.message || String(error) });
            const language = resolveInteractionLanguage(interaction);
            return interaction.update({
              embeds: [E.errorEmbed(t(language, "interaction.tag_delete.error"), null, language)],
              components: [],
            });
          }
        }

        if (interaction.customId === "tag_delete_cancel") {
          const language = resolveInteractionLanguage(interaction);
          return interaction.update({
            embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(t(language, "interaction.tag_delete.cancelled"))],
            components: [],
          });
        }

        const handler = findHandler(buttons, interaction.customId);
        if (handler) {
          if (handler.access) {
            const access = await checkAccess(interaction, handler.access);
            if (!access.allowed) {
              return await handleAccessDenied(
                interaction,
                "button",
                interaction.customId,
                access.reason,
                resolveInteractionLanguage(interaction)
              );
            }
          }
          await runObservedOperation(
            interaction,
            "button",
            interaction.customId,
            () => handler.execute(interaction, client)
          );
          maybeHandleSettingsMutation(interaction, client);
          return;
        }
      }

      const isAnySelectMenu = typeof interaction.isAnySelectMenu === "function"
        ? interaction.isAnySelectMenu()
        : interaction.isStringSelectMenu();

      if (isAnySelectMenu) {
        const handler = findHandler(selects, interaction.customId);
        if (handler) {
          if (handler.access) {
            const access = await checkAccess(interaction, handler.access);
            if (!access.allowed) {
              return await handleAccessDenied(
                interaction,
                "select",
                interaction.customId,
                access.reason,
                resolveInteractionLanguage(interaction)
              );
            }
          }
          await runObservedOperation(
            interaction,
            "select",
            interaction.customId,
            () => handler.execute(interaction, client)
          );
          maybeHandleSettingsMutation(interaction, client);
          return;
        }
      }

      if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith("verify_")) {
          await runObservedOperation(interaction, "modal", interaction.customId, () => handleVerif(interaction));
          maybeHandleSettingsMutation(interaction, client);
          return;
        }

        const handler = findHandler(modals, interaction.customId);
        if (handler) {
          if (handler.access) {
            const access = await checkAccess(interaction, handler.access);
            if (!access.allowed) {
              return await handleAccessDenied(
                interaction,
                "modal",
                interaction.customId,
                access.reason,
                resolveInteractionLanguage(interaction)
              );
            }
          }
          await runObservedOperation(
            interaction,
            "modal",
            interaction.customId,
            () => handler.execute(interaction, client)
          );
          maybeHandleSettingsMutation(interaction, client);
          return;
        }

        // Specific routing for dynamic command modals
        if (interaction.customId.startsWith("embed_")) {
          const embedCmd = client.commands.get("embed");
          if (embedCmd && typeof embedCmd.handleEmbedModal === "function") {
            await runObservedOperation(interaction, "modal", interaction.customId, () => embedCmd.handleEmbedModal(interaction));
            maybeHandleSettingsMutation(interaction, client);
            return;
          }
        }

        // Standard modal handlers
        for (const [, cmd] of client.commands) {
          if (cmd.modalHandler && (cmd.modalHandler.customId === interaction.customId || (cmd.modalHandler.isPrefix && interaction.customId.startsWith(cmd.modalHandler.customId)))) {
            await runObservedOperation(
              interaction,
              "modal",
              interaction.customId,
              () => cmd.modalHandler.execute(interaction, client)
            );
            maybeHandleSettingsMutation(interaction, client);
            return;
          }
        }
      }
    } catch (err) {
      logStructured("error", "interaction.root_error", { guildId: interaction.guildId || null, customId: interaction.customId || null, error: err?.message || String(err) });
      recordError("interaction.root");
      safeAuditLog(interaction, {
        kind: "interaction",
        action: interaction.commandName || interaction.customId || "unknown",
        status: "error",
        metadata: { error: err?.message || String(err), stage: "root" },
      });
      logStructured("error", "interaction.error", {
        guildId: interaction.guildId || null,
        userId: interaction.user?.id || null,
        type: interaction.type,
        commandName: interaction.commandName || null,
        customId: interaction.customId || null,
        error: err?.message || String(err),
      });
      const language = resolveInteractionLanguage(interaction);
      const userMessage = isDbUnavailableError(err)
        ? t(language, "interaction.db_unavailable")
        : t(language, "interaction.unexpected");
      const payload = { embeds: [E.errorEmbed(userMessage, null, language)], flags: 64 };
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch((err) => {
        logStructured("warn", "interaction.error.followUp_failed", { error: err?.message || String(err) });
      });
      else await interaction.reply(payload).catch((err) => {
        logStructured("warn", "interaction.error.reply_failed", { error: err?.message || String(err) });
      });
    } finally {
      if (interaction?.id) {
        activeInteractions.delete(interaction.id);
      }
    }
  },
};

module.exports.__test = {
  clearHandlers() {
    buttons.clear();
    selects.clear();
    modals.clear();
  },
  seedHandler(kind, customId, handler) {
    const target = kind === "button" ? buttons : kind === "select" ? selects : modals;
    target.set(customId, handler);
  },
  clearSettingsCache() {
    clearGuildSettingsCache("*");
  },
  getMusicInteractionModule() {
    return musicInteractionModule;
  },
  setMusicInteractionModule(module) {
    musicInteractionModule = module;
  },
};
