"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { resolveGuildTier } = require("../../../music/premiumResolver");
const { createNowPlayingEmbed, createMusicErrorEmbed } = require("../../../music/utils/musicEmbeds");
const { t, normalizeLanguage } = require("../../../music/i18n");
const logger = require("../../../utils/structuredLogger");
const { ensureDeferred, safeRespond } = require("../../../music/utils/interactionResponses");
const { createPlayerControls } = require("../../../music/utils/musicComponents");

const log = { error: (msg, meta) => logger.error("Music.NOWPLAYING", msg, meta || {}) };

const data = new SlashCommandBuilder()
  .setName("nowplaying")
  .setDescription("Muestra la pista que se está reproduciendo ahora mismo");

module.exports = {
  data,
  meta: { scope: "public", category: "music" },
  category: "music",

  async execute(interaction) {
    if (!(await ensureDeferred(interaction))) return;
    const language = normalizeLanguage(interaction.locale || interaction.guildLocale);
    const musicManager = interaction.client.musicManager;
    if (!musicManager) {
      log.error("musicManager not available", { guildId: interaction.guildId });
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_lavalink"), language)] });
    }
    const player = musicManager.kazagumo.players.get(interaction.guildId);
    if (!player || (!player.playing && !player.paused)) {
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.nowplaying_nothing"), language)] });
    }
    const current = player.queue.current;
    if (!current) {
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.nowplaying_no_track"), language)] });
    }
    const tier = await resolveGuildTier(interaction.guildId);
    return safeRespond(interaction, {
      embeds: [createNowPlayingEmbed(current, player, tier, language)],
      components: createPlayerControls(player, tier, language),
    });
  },
};
