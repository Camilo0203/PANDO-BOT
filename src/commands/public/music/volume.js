"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { resolveGuildTier } = require("../../../music/premiumResolver");
const { TIER_LIMITS } = require("../../../music/config/lavalinkConfig");
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

const log = { error: (msg, meta) => logger.error("Music.VOLUME", msg, meta || {}) };

const data = new SlashCommandBuilder()
  .setName("volume")
  .setDescription("Ajusta el volumen de reproducción")
  .setDescriptionLocalizations({
    "en-US": "Adjust playback volume",
    "en-GB": "Adjust playback volume",
    "es-ES": "Ajusta el volumen de reproducción",
    "es-419": "Ajusta el volumen de reproducción",
  })
  .addIntegerOption((opt) => opt.setName("nivel").setDescription("Nivel de volumen (FREE: 1-80, PRO: 1-100)").setDescriptionLocalizations({
    "en-US": "Volume level (FREE: 1-80, PRO: 1-100)",
    "en-GB": "Volume level (FREE: 1-80, PRO: 1-100)",
    "es-ES": "Nivel de volumen (FREE: 1-80, PRO: 1-100)",
    "es-419": "Nivel de volumen (FREE: 1-80, PRO: 1-100)",
  }).setMinValue(1).setMaxValue(100).setRequired(true));

module.exports = {
  data,
  meta: { scope: "public", category: "music" },
  category: "music",

  async execute(interaction) {
    if (!(await ensureDeferred(interaction))) return;
    const language = normalizeLanguage(interaction.locale || interaction.guildLocale);
    const voiceChannel = interaction.guild?.members?.cache?.get(interaction.user.id)?.voice?.channel;
    if (!voiceChannel) {
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.volume_voice_required"), language)] });
    }
    const musicManager = interaction.client.musicManager;
    if (!musicManager) {
      log.error("musicManager not available", { guildId: interaction.guildId });
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_lavalink"), language)] });
    }
    const player = musicManager.kazagumo.players.get(interaction.guildId);
    if (!player) {
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.volume_no_player"), language)] });
    }
    const tier = await resolveGuildTier(interaction.guildId);
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
    const requested = interaction.options.getInteger("nivel");
    const UPGRADE_URL = getProStoreUrl();

    if (requested > limits.maxVolume) {
      const msg = tier === "free"
        ? t(language, "music.volume_free_max", { max: limits.maxVolume, url: UPGRADE_URL })
        : t(language, "music.volume_pro_max", { max: limits.maxVolume });
      return safeRespond(interaction, { embeds: [createMusicWarningEmbed(msg, tier, language)] });
    }

    const controlService = new MusicControlService(musicManager);
    await controlService.setVolume(player, requested);
    return safeRespond(interaction, {
      embeds: [createMusicSuccessEmbed(t(language, "music.volume_set"), t(language, "music.volume_set_desc", { volume: requested }), { tier, language })],
    });
  },
};
