"use strict";

const { createSearchResultEmbed } = require("../../music/utils/musicEmbeds");
const {
  createSearchSelectMenu,
  createSearchPaginationButtons,
  SEARCH_ACTIONS,
} = require("../../music/utils/musicComponents");
const logger = require("../../../utils/structuredLogger");

const log = { debug: (msg, meta) => logger.debug("Music.SEARCHHANDLER", msg, meta || {}), error: (msg, meta) => logger.error("Music.SEARCHHANDLER", msg, meta || {}) };

const activeSessions = new Map();

function addSessionTimeout(userId, timeoutMs = 300000) {
  if (activeSessions.has(userId)) {
    const t = activeSessions.get(userId);
    if (t) clearTimeout(t);
  }
  const timeoutId = setTimeout(() => activeSessions.delete(userId), timeoutMs);
  activeSessions.set(userId, timeoutId);
}

async function handleSearchSelect(interaction, { searchCache, musicManager, language = "en" }) {
  try {
    const userId = interaction.user.id;
    const [trackIndex] = interaction.values;
    const index = parseInt(trackIndex, 10);
    const track = searchCache.getTrackByIndex(userId, index);
    if (!track) {
      return interaction.reply({ embeds: [{ color: 0xff0000, description: language === "es" ? "❌ Canción no encontrada" : "❌ Song not found" }], ephemeral: true });
    }
    await interaction.deferReply();
    let player = musicManager.kazagumo?.players?.get(interaction.guild.id);
    if (!player) {
      const member = interaction.guild.members.cache.get(interaction.user.id);
      player = await musicManager.getOrCreatePlayer({
        guildId: interaction.guild.id,
        voiceChannelId: member?.voice?.channelId,
        textChannelId: interaction.channel.id,
        shardId: interaction.guild.shardId,
        tier: "free",
      });
    }
    const enqueueResult = musicManager.enqueue(player, track);
    if (!enqueueResult.ok) {
      return interaction.editReply({ embeds: [{ color: 0xff0000, description: `❌ ${enqueueResult.reason}` }] });
    }
    track.requester = interaction.user;
    if (!player.playing && !player.paused) {
      await player.play();
    }
    await interaction.editReply({
      embeds: [{ color: 0x57f287, title: language === "es" ? "✅ Añadido a la cola" : "✅ Added to Queue", description: `**${track.title}**\n👤 ${track.author || "Unknown"}`, footer: { text: language === "es" ? `Posición en la cola: ${player.queue.size}` : `Queue position: ${player.queue.size}` } }],
      components: [],
    });
    addSessionTimeout(userId);
  } catch (error) {
    log.error("Error handling search select", { error: error.message, stack: error.stack });
  }
}

async function handleSearchPagination(interaction, { searchCache, language = "en" }) {
  try {
    const userId = interaction.user.id;
    const [, action, pageStr] = interaction.customId.split(":").slice(2);
    const newPage = action === SEARCH_ACTIONS.CLOSE ? null : parseInt(pageStr, 10);
    await interaction.deferUpdate();
    if (action === SEARCH_ACTIONS.CLOSE) {
      searchCache.clearSession(userId);
      return interaction.editReply({ content: language === "es" ? "Búsqueda cerrada" : "Search closed", embeds: [], components: [] });
    }
    const pagination = searchCache.getPaginatedResults(userId, newPage);
    if (!pagination) return interaction.editReply({ embeds: [{ color: 0xffaa00, description: language === "es" ? "❌ Página no válida" : "❌ Invalid page" }] });
    searchCache.setCurrentPage(userId, newPage);
    const tracks = searchCache.getSessionTracks(userId);
    const query = `${pagination.totalTracks} ${language === "es" ? "resultados" : "results"}`;
    const embed = createSearchResultEmbed(pagination.tracks, query, { language, pageNum: newPage, totalPages: pagination.totalPages, totalTracks: pagination.totalTracks });
    const components = [createSearchSelectMenu(pagination.tracks, userId, { language })];
    if (pagination.totalPages > 1) components.push(createSearchPaginationButtons(userId, pagination, { language }));
    await interaction.editReply({ embeds: [embed], components });
    addSessionTimeout(userId);
  } catch (error) {
    log.error("Error handling search pagination", { error: error.message });
  }
}

async function handleSearchInteraction(interaction, context) {
  const customId = interaction.customId;
  try {
    if (customId.includes("music:search:select:")) return handleSearchSelect(interaction, context);
    if (customId.includes("music:search:pagination:")) return handleSearchPagination(interaction, context);
  } catch (error) {
    log.error("Error routing search interaction", { error: error.message });
  }
}

function isSearchInteraction(customId) {
  return customId && customId.startsWith("music:search:");
}

function cleanupAllSessions() {
  for (const timeout of activeSessions.values()) if (timeout) clearTimeout(timeout);
  activeSessions.clear();
}

module.exports = { handleSearchInteraction, isSearchInteraction, handleSearchSelect, handleSearchPagination, cleanupAllSessions };
