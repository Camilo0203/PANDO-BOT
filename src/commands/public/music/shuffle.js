"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { resolveGuildTier } = require("../../../music/premiumResolver");
const {
  createMusicErrorEmbed,
  createMusicSuccessEmbed,
  proOnlyEmbed,
} = require("../../../music/utils/musicEmbeds");
const { t, normalizeLanguage } = require("../../../music/i18n");
const { ensureDeferred, safeRespond } = require("../../../music/utils/interactionResponses");
const logger = require("../../../utils/structuredLogger");
const { MusicControlService } = require("../../../music/services/MusicControlService");
const { getProStoreUrl } = require("../../../utils/proStore");

const log = { error: (msg, meta) => logger.error("Music.SHUFFLE", msg, meta || {}) };
const UPGRADE_URL = getProStoreUrl();

const data = new SlashCommandBuilder()
  .setName("shuffle")
  .setDescription("Mezcla aleatoriamente la cola [Solo PRO]")
  .setDescriptionLocalizations({
    "en-US": "Shuffle the queue [PRO Only]",
    "en-GB": "Shuffle the queue [PRO Only]",
    "es-ES": "Mezcla aleatoriamente la cola [Solo PRO]",
    "es-419": "Mezcla aleatoriamente la cola [Solo PRO]",
  });

module.exports = {
  data,
  meta: { scope: "public", category: "music" },
  category: "music",

  async execute(interaction) {
    if (!(await ensureDeferred(interaction))) return;
    const language = normalizeLanguage(interaction.locale || interaction.guildLocale);
    const tier = await resolveGuildTier(interaction.guildId);
    if (tier !== "pro") {
      return safeRespond(interaction, { embeds: [proOnlyEmbed(t(language, "music.shuffle_pro_only"), UPGRADE_URL, language)] });
    }
    const musicManager = interaction.client.musicManager;
    if (!musicManager) {
      log.error("musicManager not available", { guildId: interaction.guildId });
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_lavalink"), language)] });
    }
    const player = musicManager.kazagumo.players.get(interaction.guildId);
    if (!player || player.queue.size === 0) {
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.shuffle_empty"), language)] });
    }
    const controlService = new MusicControlService(musicManager);
    controlService.shuffleQueue(player);
    return safeRespond(interaction, {
      embeds: [createMusicSuccessEmbed(t(language, "music.shuffle_done"), t(language, "music.shuffle_done_desc", { count: player.queue.size }), { tier, language })],
    });
  },
};
