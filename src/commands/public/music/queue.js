"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { resolveGuildTier } = require("../../../music/premiumResolver");
const { createQueueEmbed, createMusicErrorEmbed } = require("../../../music/utils/musicEmbeds");
const { createQueuePaginationControls } = require("../../../music/utils/musicComponents");
const {
  createQueueSessionId,
  getQueuePagination,
  getQueueTrackCount,
} = require("../../../music/utils/musicQueuePagination");
const { t, normalizeLanguage } = require("../../../music/i18n");
const logger = require("../../../utils/structuredLogger");
const { ensureDeferred, safeRespond } = require("../../../music/utils/interactionResponses");

const log = { error: (msg, meta) => logger.error("Music.QUEUE", msg, meta || {}) };

const data = new SlashCommandBuilder()
  .setName("queue")
  .setDescription("Muestra la cola de reproducción")
  .addIntegerOption((opt) => opt.setName("pagina").setDescription("Número de página").setMinValue(1).setRequired(false));

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
    if (!player) {
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.queue_no_player"), language)] });
    }

    const tier = await resolveGuildTier(interaction.guildId);
    const requestedPage = interaction.options.getInteger("pagina") ?? 1;
    const pagination = getQueuePagination(getQueueTrackCount(player.queue), requestedPage);
    const sessionId = createQueueSessionId(player);

    return safeRespond(interaction, {
      embeds: [createQueueEmbed(player, tier, pagination.page, language)],
      components: createQueuePaginationControls({
        ownerId: interaction.user.id,
        sessionId,
        page: pagination.page,
        totalItems: pagination.totalItems,
        language,
      }),
    });
  },
};
