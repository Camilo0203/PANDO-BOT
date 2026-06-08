"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { resolveGuildTier } = require("../../../music/premiumResolver");
const { TIER_LIMITS } = require("../../../music/config/lavalinkConfig");
const { createMusicErrorEmbed } = require("../../../music/utils/musicEmbeds");
const { createSearchResultEmbed } = require("../../../music/utils/musicEmbeds");
const {
  createSearchSelectMenu,
  createSearchPaginationButtons,
} = require("../../../music/utils/musicComponents");
const { t, normalizeLanguage } = require("../../../music/i18n");
const logger = require("../../../utils/structuredLogger");
const { ensureDeferred, safeRespond } = require("../../../music/utils/interactionResponses");

const log = {
  info: (msg, meta) => logger.info("Music.SEARCH", msg, meta || {}),
  error: (msg, meta) => logger.error("Music.SEARCH", msg, meta || {}),
};

const data = new SlashCommandBuilder()
  .setName("search")
  .setDescription("Busca canciones sin reproducirlas")
  .addStringOption((opt) => opt.setName("query").setDescription("Nombre de la canción o artista").setRequired(true))
  .addStringOption((opt) =>
    opt.setName("source").setDescription("Fuente de búsqueda (youtube | spotify)").setRequired(false).addChoices(
      { name: "YouTube", value: "youtube" },
      { name: "Spotify", value: "spotify" }
    )
  );

module.exports = {
  data,
  meta: { scope: "public", category: "music" },
  category: "music",

  async execute(interaction) {
    if (!(await ensureDeferred(interaction))) return;

    const language = normalizeLanguage(interaction.locale || interaction.guildLocale);
    const query = interaction.options.getString("query");
    const source = interaction.options.getString("source") || "youtube";

    const musicManager = interaction.client.musicManager;
    const searchCache = interaction.client.searchCache;

    if (!musicManager || !searchCache) {
      log.error("musicManager or searchCache not available", { guildId: interaction.guildId });
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_lavalink"), language)] });
    }

    if (source === "spotify") {
      const tier = await resolveGuildTier(interaction.guildId);
      if (tier !== "pro") {
        return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.spotify_pro_only"), language)] });
      }
    }

    let results = searchCache.getCache(query, source);
    let fromCache = false;
    if (!results) {
      try {
        const tier = await resolveGuildTier(interaction.guildId);
        const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
        results = await musicManager.search(query, tier);
        if (limits.maxDurationSeconds) {
          results.tracks = results.tracks.filter(
            (t) => !t.length || t.length / 1000 <= limits.maxDurationSeconds
          );
        }
        searchCache.setCache(query, results, source);
      } catch (error) {
        log.error("Search error", { query, source, error: error.message });
        return safeRespond(interaction, {
          embeds: [createMusicErrorEmbed(t(language, "music.error_search"), language)],
        });
      }
    } else {
      fromCache = true;
    }

    if (!results?.tracks?.length) {
      return safeRespond(interaction, {
        embeds: [createMusicErrorEmbed(t(language, "music.error_no_results", { query }), language)],
      });
    }

    searchCache.setSessionTracks(interaction.user.id, results.tracks);
    const pagination = searchCache.getPaginatedResults(interaction.user.id, 0);

    const embed = createSearchResultEmbed(pagination.tracks, query, {
      language,
      pageNum: pagination.pageNum,
      totalPages: pagination.totalPages,
      totalTracks: pagination.totalTracks,
      source,
      fromCache,
    });

    const components = [createSearchSelectMenu(pagination.tracks, interaction.user.id, { language })];
    if (pagination.totalPages > 1) {
      components.push(createSearchPaginationButtons(interaction.user.id, pagination, { language }));
    }

    log.info("Search executed", { userId: interaction.user.id, guildId: interaction.guildId, query, results: results.tracks.length, fromCache });
    return safeRespond(interaction, { embeds: [embed], components });
  },
};
