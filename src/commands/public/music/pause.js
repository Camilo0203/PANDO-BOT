"use strict";

const { SlashCommandBuilder } = require("discord.js");
const {
  COLORS,
  createMusicErrorEmbed,
  createMusicSuccessEmbed,
} = require("../../../music/utils/musicEmbeds");
const { t, normalizeLanguage } = require("../../../music/i18n");
const logger = require("../../../utils/structuredLogger");
const { ensureDeferred, safeRespond } = require("../../../music/utils/interactionResponses");
const { MusicControlService } = require("../../../music/services/MusicControlService");

const log = { error: (msg, meta) => logger.error("Music.PAUSE", msg, meta || {}) };

const data = new SlashCommandBuilder()
  .setName("pause")
  .setDescription("Pausa o reanuda la reproducción")
  .setDescriptionLocalizations({
    "en-US": "Pause or resume playback",
    "en-GB": "Pause or resume playback",
    "es-ES": "Pausa o reanuda la reproducción",
    "es-419": "Pausa o reanuda la reproducción",
  });

module.exports = {
  data,
  meta: { scope: "public", category: "music" },
  category: "music",

  async execute(interaction) {
    if (!(await ensureDeferred(interaction))) return;
    const language = normalizeLanguage(interaction.locale || interaction.guildLocale);
    const voiceChannel = interaction.guild?.members?.cache?.get(interaction.user.id)?.voice?.channel;
    if (!voiceChannel) {
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.pause_voice_required"), language)] });
    }
    const musicManager = interaction.client.musicManager;
    if (!musicManager) {
      log.error("musicManager not available", { guildId: interaction.guildId });
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_lavalink"), language)] });
    }
    const player = musicManager.kazagumo.players.get(interaction.guildId);
    if (!player) {
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.pause_no_player"), language)] });
    }

    const controlService = new MusicControlService(musicManager);
    if (player.paused) {
      controlService.togglePause(player);
      return safeRespond(interaction, {
        embeds: [createMusicSuccessEmbed(
          t(language, "music.pause_resumed"),
          t(language, "music.pause_resumed_desc"),
          { color: COLORS.PLAYING, language }
        )],
      });
    }
    controlService.togglePause(player);
    return safeRespond(interaction, {
      embeds: [createMusicSuccessEmbed(
        t(language, "music.pause_paused"),
        t(language, "music.pause_paused_desc"),
        { color: COLORS.PAUSED, language }
      )],
    });
  },
};
