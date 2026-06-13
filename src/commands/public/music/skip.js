"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { resolveGuildTier } = require("../../../music/premiumResolver");
const {
  createMusicErrorEmbed,
  createMusicSuccessEmbed,
  createMusicWarningEmbed,
} = require("../../../music/utils/musicEmbeds");
const { t, normalizeLanguage } = require("../../../music/i18n");
const logger = require("../../../utils/structuredLogger");
const { ensureDeferred, safeRespond } = require("../../../music/utils/interactionResponses");
const { MusicControlService } = require("../../../music/services/MusicControlService");
const { getProStoreUrl } = require("../../../utils/proStore");

const log = {
  info: (msg, meta) => logger.info("Music.SKIP", msg, meta || {}),
  error: (msg, meta) => logger.error("Music.SKIP", msg, meta || {}),
};

const data = new SlashCommandBuilder()
  .setName("skip")
  .setDescription("Salta la canción actual")
  .setDescriptionLocalizations({
    "en-US": "Skip the current song",
    "en-GB": "Skip the current song",
    "es-ES": "Salta la canción actual",
    "es-419": "Salta la canción actual",
  })
  .addIntegerOption((opt) =>
    opt.setName("cantidad").setDescription("Cuántas pistas saltar (PRO: hasta 10)").setDescriptionLocalizations({
      "en-US": "How many tracks to skip (PRO: up to 10)",
      "en-GB": "How many tracks to skip (PRO: up to 10)",
      "es-ES": "Cuántas pistas saltar (PRO: hasta 10)",
      "es-419": "Cuántas pistas saltar (PRO: hasta 10)",
    }).setMinValue(1).setMaxValue(10).setRequired(false)
  );

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
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.skip_voice_required"), language)] });
    }

    const musicManager = interaction.client.musicManager;
    if (!musicManager) {
      log.error("musicManager not available", { guildId });
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_lavalink"), language)] });
    }

    const player = musicManager.kazagumo.players.get(guildId);
    if (!player || (!player.playing && !player.paused)) {
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.skip_nothing_playing"), language)] });
    }

    let tier;
    try { tier = await resolveGuildTier(guildId); } catch (err) { tier = "free"; }

    let amount = interaction.options.getInteger("cantidad") ?? 1;
    if (amount > 1 && tier === "free") {
      return safeRespond(interaction, {
        embeds: [createMusicWarningEmbed(t(language, "music.skip_pro_only", { url: getProStoreUrl() }), tier, language)],
      });
    }

    const skipped = player.queue.current;
    const controlService = new MusicControlService(musicManager);
    try {
      for (let i = 0; i < amount && player.queue.size > 0; i++) {
        controlService.skipCurrent(player);
      }
    } catch (err) {
      log.error("Skip failed", { guildId, amount, error: err.message });
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_generic"), language)] });
    }

    log.info("Track(s) skipped", { guildId, userId: interaction.user.id, amount, skipped: skipped?.title });
    if (amount === 1 && skipped) {
      return safeRespond(interaction, {
        embeds: [createMusicSuccessEmbed(t(language, "music.skip_single"), t(language, "music.skip_single_desc", { title: skipped.title }), { language })],
      });
    }
    return safeRespond(interaction, {
      embeds: [createMusicSuccessEmbed(t(language, "music.skip_multiple"), t(language, "music.skip_multiple_desc", { amount }), { language })],
    });
  },
};
