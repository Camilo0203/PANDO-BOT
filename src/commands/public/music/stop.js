"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { createMusicErrorEmbed, createMusicSuccessEmbed } = require("../../../music/utils/musicEmbeds");
const { t, normalizeLanguage } = require("../../../music/i18n");
const logger = require("../../../utils/structuredLogger");
const { ensureDeferred, safeRespond } = require("../../../music/utils/interactionResponses");
const { MusicControlService } = require("../../../music/services/MusicControlService");

const log = {
  info: (msg, meta) => logger.info("Music.STOP", msg, meta || {}),
  error: (msg, meta) => logger.error("Music.STOP", msg, meta || {}),
};

const data = new SlashCommandBuilder()
  .setName("stop")
  .setDescription("Detiene la reproducción, limpia la cola y desconecta el bot")
  .setDescriptionLocalizations({
    "en-US": "Stop playback, clear the queue, and disconnect the bot",
    "en-GB": "Stop playback, clear the queue, and disconnect the bot",
    "es-ES": "Detiene la reproducción, limpia la cola y desconecta el bot",
    "es-419": "Detiene la reproducción, limpia la cola y desconecta el bot",
  });

module.exports = {
  data,
  meta: { scope: "public", category: "music" },
  category: "music",

  async execute(interaction) {
    if (!(await ensureDeferred(interaction))) return;

    const language = normalizeLanguage(interaction.locale || interaction.guildLocale);
    const guildId = interaction.guildId;
    const voiceChannel = interaction.guild?.members?.cache?.get(interaction.user.id)?.voice?.channel;
    if (!voiceChannel) {
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.stop_voice_required"), language)] });
    }

    const musicManager = interaction.client.musicManager;
    if (!musicManager) {
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_lavalink"), language)] });
    }

    const player = musicManager.kazagumo.players.get(guildId);
    if (!player) {
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.stop_nothing_playing"), language)] });
    }

    try {
      const controlService = new MusicControlService(musicManager);
      await controlService.stop(guildId);
      log.info("Playback stopped by user", { guildId, userId: interaction.user.id });
    } catch (err) {
      log.error("Failed to destroy player", { guildId, error: err.message });
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_generic"), language)] });
    }

    return safeRespond(interaction, {
      embeds: [createMusicSuccessEmbed(t(language, "music.stop_stopped"), t(language, "music.stop_stopped_desc"), { language })],
    });
  },
};
