"use strict";

const { resolveGuildTier } = require("../../music/premiumResolver");
const { TIER_LIMITS, TIMEOUTS } = require("../../music/config/lavalinkConfig");
const {
  createMusicErrorEmbed,
  createMusicSuccessEmbed,
  createMusicWarningEmbed,
  createNowPlayingEmbed,
  createQueueEmbed,
  proOnlyEmbed,
} = require("../../music/utils/musicEmbeds");
const {
  MUSIC_CONTROL_IDS,
  createPlayerControls,
  createQueuePaginationControls,
  isMusicControlId,
} = require("../../music/utils/musicComponents");
const {
  QUEUE_ACTIONS,
  QUEUE_CUSTOM_ID_PREFIX,
  createQueueSessionId,
  getQueuePagination,
  getQueueTrackCount,
  isQueueSessionCurrent,
  parseQueueCustomId,
} = require("../../music/utils/musicQueuePagination");
const {
  CONTROL_ERROR_CODES,
  MusicControlError,
  MusicControlService,
} = require("../../music/services/MusicControlService");
const { t, normalizeLanguage } = require("../../music/i18n");
const logger = require("../../../utils/structuredLogger");

const log = {
  warn: (msg, meta) => logger.warn("Music.COMPHANDLER", msg, meta || {}),
  error: (msg, meta) => logger.error("Music.COMPHANDLER", msg, meta || {}),
};

const UPGRADE_URL = process.env.PRO_UPGRADE_URL || "https://ton618.app/pricing";
const controlLocks = new Map();
const ALLOWED_GUILD_IDS = new Set(
  (process.env.MUSIC_ALLOWED_GUILD_ID || process.env.MUSIC_ALLOWED_GUILD_IDS || "")
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean)
);

function isMusicComponent(interaction) {
  return Boolean(
    typeof interaction.customId === "string" &&
    interaction.customId.startsWith("music:") &&
    (interaction?.isButton?.() || interaction?.isStringSelectMenu?.())
  );
}

async function acknowledgeButton(interaction) {
  if (interaction.deferred || interaction.replied) return false;
  try {
    if (interaction.isStringSelectMenu?.()) await interaction.deferReply();
    else await interaction.deferUpdate();
    return true;
  } catch (error) {
    log.warn("Failed to acknowledge music control", { customId: interaction.customId, error: error?.message });
    return false;
  }
}

async function followUpEphemeral(interaction, embed, components = []) {
  try { await interaction.followUp({ embeds: [embed], components, flags: 64 }); }
  catch (error) { log.warn("Failed to send music control follow-up", { customId: interaction.customId, error: error?.message }); }
}

async function editControlMessage(interaction, payload) {
  try { await interaction.editReply(payload); return true; }
  catch (error) { log.warn("Failed to update music control message", { customId: interaction.customId, error: error?.message }); return false; }
}

async function resolveTierSafely(guildId) {
  let timeout = null;
  try {
    return await Promise.race([
      resolveGuildTier(guildId),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("tier_timeout")), Math.max(500, Number(TIMEOUTS.tierResolve) || 3000)); }),
    ]);
  } catch { return "free"; } finally { if (timeout) clearTimeout(timeout); }
}

function controlErrorMessage(code, language) {
  switch (code) {
    case CONTROL_ERROR_CODES.USER_NOT_IN_VOICE: return t(language, "music.control_voice_required");
    case CONTROL_ERROR_CODES.BOT_DISCONNECTED: return t(language, "music.control_bot_disconnected");
    case CONTROL_ERROR_CODES.DIFFERENT_VOICE_CHANNEL: return t(language, "music.control_same_voice_required");
    case CONTROL_ERROR_CODES.QUEUE_EMPTY: return t(language, "music.control_queue_empty");
    default: return t(language, "music.nowplaying_nothing");
  }
}

async function withGuildControlLock(guildId, task) {
  if (controlLocks.has(guildId)) return false;
  controlLocks.set(guildId, true);
  try { await task(); return true; } finally { controlLocks.delete(guildId); }
}

async function runControl(interaction, language) {
  if (!isMusicControlId(interaction.customId)) {
    await followUpEphemeral(interaction, createMusicWarningEmbed(t(language, "music.control_unknown"), null, language));
    return;
  }
  if (ALLOWED_GUILD_IDS.size > 0 && !ALLOWED_GUILD_IDS.has(interaction.guildId)) {
    await followUpEphemeral(interaction, createMusicErrorEmbed(t(language, "music.control_unavailable_guild"), language));
    return;
  }
  const musicManager = interaction.client?.musicManager;
  if (!musicManager) {
    await followUpEphemeral(interaction, createMusicErrorEmbed(t(language, "music.error_lavalink"), language));
    return;
  }
  const service = new MusicControlService(musicManager);
  const player = service.getPlayer(interaction.guildId);
  const requireQueue = interaction.customId === MUSIC_CONTROL_IDS.SHUFFLE;
  try { service.validateController(interaction, player, { requireQueue }); }
  catch (error) {
    if (error instanceof MusicControlError) {
      await followUpEphemeral(interaction, createMusicErrorEmbed(controlErrorMessage(error.code, language), language));
      return;
    }
    throw error;
  }
  const tier = await resolveTierSafely(interaction.guildId);
  switch (interaction.customId) {
    case MUSIC_CONTROL_IDS.PAUSE:
      service.togglePause(player);
      await editControlMessage(interaction, { embeds: [createNowPlayingEmbed(player.queue.current, player, tier, language)], components: createPlayerControls(player, tier, language) });
      break;
    case MUSIC_CONTROL_IDS.SKIP: {
      const skipped = service.skipCurrent(player);
      const hasNext = player.queue.size > 0 || player.loop === "track" || player.loop === "queue";
      await editControlMessage(interaction, { embeds: [createMusicSuccessEmbed(t(language, "music.skip_single"), t(language, "music.skip_single_desc", { title: skipped?.title || t(language, "music.unknown") }), { language })], components: createPlayerControls(player, tier, language, { disabled: !hasNext }) });
      break;
    }
    case MUSIC_CONTROL_IDS.STOP:
      await service.stop(interaction.guildId);
      await editControlMessage(interaction, { embeds: [createMusicSuccessEmbed(t(language, "music.stop_stopped"), t(language, "music.stop_stopped_desc"), { language })], components: createPlayerControls(null, tier, language, { disabled: true }) });
      break;
    case MUSIC_CONTROL_IDS.LOOP:
      service.toggleLoop(player, tier);
      await editControlMessage(interaction, { embeds: [createNowPlayingEmbed(player.queue.current, player, tier, language)], components: createPlayerControls(player, tier, language) });
      break;
    case MUSIC_CONTROL_IDS.SHUFFLE:
      if (tier !== "pro") { await followUpEphemeral(interaction, proOnlyEmbed(t(language, "music.shuffle_pro_only"), UPGRADE_URL, language)); return; }
      service.shuffleQueue(player);
      await editControlMessage(interaction, { embeds: [createNowPlayingEmbed(player.queue.current, player, tier, language)], components: createPlayerControls(player, tier, language) });
      await followUpEphemeral(interaction, createMusicSuccessEmbed(t(language, "music.shuffle_done"), t(language, "music.shuffle_done_desc", { count: player.queue.size }), { tier, language }));
      break;
    case MUSIC_CONTROL_IDS.QUEUE: {
      const pagination = getQueuePagination(getQueueTrackCount(player.queue), 1);
      const sessionId = createQueueSessionId(player);
      await followUpEphemeral(interaction, createQueueEmbed(player, tier, pagination.page, language), createQueuePaginationControls({ ownerId: interaction.user.id, sessionId, page: pagination.page, totalItems: pagination.totalItems, language }));
      break;
    }
    case MUSIC_CONTROL_IDS.VOLUME: {
      const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
      await followUpEphemeral(interaction, createMusicWarningEmbed(t(language, "music.control_volume_hint", { max: limits.maxVolume }), tier, language));
      break;
    }
  }
}

async function runQueuePagination(interaction, language) {
  const parsed = parseQueueCustomId(interaction.customId);
  if (!parsed) { await followUpEphemeral(interaction, createMusicWarningEmbed(t(language, "music.control_unknown"), null, language)); return; }
  if (ALLOWED_GUILD_IDS.size > 0 && !ALLOWED_GUILD_IDS.has(interaction.guildId)) {
    await followUpEphemeral(interaction, createMusicErrorEmbed(t(language, "music.control_unavailable_guild"), language));
    return;
  }
  const musicManager = interaction.client?.musicManager;
  if (!musicManager) { await followUpEphemeral(interaction, createMusicErrorEmbed(t(language, "music.error_lavalink"), language)); return; }
  const service = new MusicControlService(musicManager);
  const player = service.getPlayer(interaction.guildId);
  try { service.validateQueueController(interaction, player, parsed.ownerId); }
  catch (error) {
    if (error instanceof MusicControlError) { await followUpEphemeral(interaction, createMusicErrorEmbed(t(language, "music.queue_not_authorized"), language)); return; }
    throw error;
  }
  if (parsed.action === QUEUE_ACTIONS.CLOSE) { await editControlMessage(interaction, { components: [] }); return; }
  if (!player || !isQueueSessionCurrent(player, parsed.sessionId)) {
    await editControlMessage(interaction, { embeds: [createMusicWarningEmbed(t(language, "music.queue_session_expired"), null, language)], components: [] });
    return;
  }
  const tier = await resolveTierSafely(interaction.guildId);
  const pagination = getQueuePagination(getQueueTrackCount(player.queue), parsed.page);
  await editControlMessage(interaction, { embeds: [createQueueEmbed(player, tier, pagination.page, language)], components: createQueuePaginationControls({ ownerId: parsed.ownerId, sessionId: parsed.sessionId, page: pagination.page, totalItems: pagination.totalItems, language }) });
}

async function musicComponentHandler(interaction) {
  if (!isMusicComponent(interaction)) return false;
  if (!(await acknowledgeButton(interaction))) return true;
  const language = normalizeLanguage(interaction.locale || interaction.guildLocale, "en");
  try {
    if (interaction.customId.startsWith(`${QUEUE_CUSTOM_ID_PREFIX}:`)) {
      await runQueuePagination(interaction, language);
    } else {
      await runControl(interaction, language);
    }
  } catch (error) {
    log.error("Music control failed", { customId: interaction.customId, error: error?.message || String(error), stack: error?.stack });
    await followUpEphemeral(interaction, createMusicErrorEmbed(t(language, "music.error_generic"), language));
  }
  return true;
}

module.exports = { isMusicComponent, musicComponentHandler };
