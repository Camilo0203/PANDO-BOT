"use strict";

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { createMusicErrorEmbed, COLORS } = require("../../music/utils/musicEmbeds");
const { t, normalizeLanguage } = require("../../music/i18n");
const logger = require("../../utils/structuredLogger");
const { ensureDeferred, safeRespond } = require("../../music/utils/interactionResponses");

const log = { info: (msg, meta) => logger.info("Music.STATUS", msg, meta || {}) };

const data = new SlashCommandBuilder()
  .setName("musicstatus")
  .setDescription("Estado de los nodos Lavalink [Solo Owner]");

module.exports = {
  data,
  meta: { scope: "developer", category: "music" },
  category: "music",
  ownerOnly: true,

  async execute(interaction) {
    const language = normalizeLanguage(interaction.locale || interaction.guildLocale);
    const guildId = interaction.guildId;
    const NODE_STATE_LABEL = {
      0: t(language, "music.state_disconnected"),
      1: t(language, "music.state_connecting"),
      2: t(language, "music.state_connected"),
      3: t(language, "music.state_reconnecting"),
    };

    if (!process.env.OWNER_ID || interaction.user.id !== process.env.OWNER_ID) {
      log.info("Unauthorized musicstatus access attempt", { userId: interaction.user.id, guildId });
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.musicstatus_owner_only"), language)], ephemeral: true });
    }

    if (!(await ensureDeferred(interaction, { ephemeral: true }))) return;

    const musicManager = interaction.client.musicManager;
    if (!musicManager) {
      log.info("musicManager not available", { guildId });
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_lavalink"), language)] });
    }

    let stats;
    try { stats = musicManager.getStats(); } catch (err) {
      log.error("Failed to get stats", { guildId, error: err.message });
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_generic"), language)] });
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.PLAYING)
      .setTitle(t(language, "music.musicstatus_title"))
      .setTimestamp()
      .addFields(
        { name: t(language, "music.musicstatus_active_players"), value: String(stats.activePlayers), inline: true },
        { name: "Idle Timers", value: String(stats.idleTimers), inline: true },
        { name: "Guild Locks", value: String(stats.guildLocks), inline: true }
      );

    for (const node of stats.nodes) {
      const s = node.stats;
      const health = node.health || {};
      embed.addFields({
        name: `${node.name} ${health.circuitState === "OPEN" ? "🔴 CB OPEN" : health.consecutiveFailures > 0 ? "🟡 DEGRADED" : "🟢 OK"}`,
        value: [
          `${t(language, "music.musicstatus_state")}: ${NODE_STATE_LABEL[node.state] ?? node.state}`,
          s ? [
            `${t(language, "music.musicstatus_players")}: ${s.playingPlayers}/${s.players}`,
            `${t(language, "music.musicstatus_cpu")}: ${s.cpu ? (s.cpu.lavalinkLoad * 100).toFixed(1) + "%" : "N/A"}`,
            `${t(language, "music.musicstatus_memory")}: ${s.memory ? Math.round(s.memory.used / 1024 / 1024) + " MB" : "N/A"}`,
            `Uptime: ${s.uptime ? Math.floor(s.uptime / 60000) + " min" : "N/A"}`,
          ].join("\n") : "N/A",
          health.consecutiveFailures ? `Consecutive failures: ${health.consecutiveFailures}` : "",
          health.lastFailureAt ? `Last failure: ${new Date(health.lastFailureAt).toISOString()}` : "",
        ].filter(Boolean).join("\n"),
        inline: false,
      });
    }

    log.info("musicstatus queried", { guildId, userId: interaction.user.id });
    return safeRespond(interaction, { embeds: [embed] });
  },
};
