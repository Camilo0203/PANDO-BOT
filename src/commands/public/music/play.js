"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { resolveGuildTier } = require("../../../music/premiumResolver");
const { TIER_LIMITS } = require("../../../music/config/lavalinkConfig");
const {
  createNowPlayingEmbed,
  addedToQueueEmbed,
  playlistAddedEmbed,
  createMusicErrorEmbed,
  createMusicWarningEmbed,
  proOnlyEmbed,
} = require("../../../music/utils/musicEmbeds");
const { t, normalizeLanguage } = require("../../../music/i18n");
const logger = require("../../../utils/structuredLogger");
const { ensureDeferred, safeRespond } = require("../../../music/utils/interactionResponses");
const { createPlayerControls } = require("../../../music/utils/musicComponents");
const { getProStoreUrl } = require("../../../utils/proStore");

const log = {
  info: (msg, meta) => logger.info("Music.PLAY", msg, meta || {}),
  warn: (msg, meta) => logger.warn("Music.PLAY", msg, meta || {}),
  error: (msg, meta) => logger.error("Music.PLAY", msg, meta || {}),
};

const UPGRADE_URL = getProStoreUrl();
const FORCED_TIER = ["free", "pro"].includes(process.env.MUSIC_FORCE_TIER) ? process.env.MUSIC_FORCE_TIER : null;

const data = new SlashCommandBuilder()
  .setName("play")
  .setDescription("Reproduce una canción o playlist en tu canal de voz")
  .setDescriptionLocalizations({
    "en-US": "Play a song or playlist in your voice channel",
    "en-GB": "Play a song or playlist in your voice channel",
    "es-ES": "Reproduce una canción o playlist en tu canal de voz",
    "es-419": "Reproduce una canción o playlist en tu canal de voz",
  })
  .addStringOption((opt) =>
    opt.setName("query").setDescription("Nombre de la canción, URL de YouTube o Spotify (PRO)").setDescriptionLocalizations({
      "en-US": "Song name, YouTube URL, or Spotify URL (PRO)",
      "en-GB": "Song name, YouTube URL, or Spotify URL (PRO)",
      "es-ES": "Nombre de la canción, URL de YouTube o Spotify (PRO)",
      "es-419": "Nombre de la canción, URL de YouTube o Spotify (PRO)",
    }).setRequired(true)
  );

module.exports = {
  data,
  meta: { scope: "public", category: "music" },
  category: "music",

  async execute(interaction) {
    if (!(await ensureDeferred(interaction))) return;

    const language = normalizeLanguage(interaction.locale || interaction.guildLocale);
    const member = interaction.guild?.members?.cache?.get(interaction.user.id);
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_voice_required"), language)] });
    }

    const botMember = interaction.guild.members.me;
    const perms = voiceChannel.permissionsFor(botMember);
    if (!perms?.has("Connect") || !perms?.has("Speak")) {
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_bot_permissions"), language)] });
    }

    const query = interaction.options.getString("query");
    const guildId = interaction.guildId;

    let tier = FORCED_TIER;
    if (!tier) {
      try {
        tier = await Promise.race([
          resolveGuildTier(guildId),
          new Promise((_, reject) => setTimeout(() => reject(new Error("tier_timeout")), 3000)),
        ]);
      } catch (err) {
        log.warn("Tier resolution timeout, defaulting to free", { guildId, error: err.message });
        tier = "free";
      }
    }
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

    const isSpotifyPlaylist =
      (query.includes("open.spotify.com/playlist") || query.includes("open.spotify.com/album")) &&
      !limits.spotifyEnabled;
    if (isSpotifyPlaylist) {
      return safeRespond(interaction, { embeds: [proOnlyEmbed(t(language, "music.spotify_pro_only"), UPGRADE_URL, language)] });
    }

    const musicManager = interaction.client.musicManager;
    if (!musicManager) {
      log.error("musicManager not available - client not ready", { guildId });
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_lavalink"), language)] });
    }

    let player;
    try {
      player = await musicManager.getOrCreatePlayer({
        guildId,
        voiceChannelId: voiceChannel.id,
        textChannelId: interaction.channelId,
        shardId: interaction.guild.shardId,
        tier,
      });
    } catch (err) {
      log.error("Failed to create player", { guildId, error: err.message });
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_lavalink"), language)] });
    }

    let result;
    try {
      result = await musicManager.search(query, tier);
    } catch (err) {
      const msg = err?.message?.toLowerCase() || "";
      log.error("Search failed", { guildId, query: query.slice(0, 60), error: err.message });
      let userMsg = t(language, "music.error_search");
      if (msg.includes("403") || msg.includes("bot") || msg.includes("sign in")) {
        userMsg = t(language, "music.error_youtube_blocked");
      } else if (msg.includes("timeout") || msg.includes("network")) {
        userMsg = t(language, "music.error_search_timeout");
      }
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(userMsg, language)] });
    }

    if (!result?.tracks?.length) {
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_no_results", { query }), language)] });
    }

    if (result.type?.toLowerCase?.() === "playlist" && !limits.playlistEnabled) {
      return safeRespond(interaction, { embeds: [proOnlyEmbed(t(language, "music.playlist_pro_only"), UPGRADE_URL, language)] });
    }

    if (result.type?.toLowerCase?.() === "playlist") {
      let added = 0;
      for (const track of result.tracks) {
        track.requester = interaction.user;
        const enqueueResult = musicManager.enqueue(player, track);
        if (!enqueueResult.ok) break;
        added++;
      }
      log.info("Playlist enqueued", { guildId, added, total: result.tracks.length });
      if (!player.playing && !player.paused) {
        try { await player.play(); } catch (err) {
          log.error("Failed to start playlist playback", { guildId, error: err.message });
          return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_play"), language)] });
        }
      }
      return safeRespond(interaction, { embeds: [playlistAddedEmbed(result.playlistName || "Playlist", added, tier, language)] });
    }

    const track = result.tracks[0];
    track.requester = interaction.user;
    const enqueueResult = musicManager.enqueue(player, track);

    if (!enqueueResult.ok) {
      if (enqueueResult.reason?.startsWith("queue_full")) {
        const max = limits.maxQueue;
        const msg = tier === "free"
          ? t(language, "music.error_queue_full_free", { max, url: UPGRADE_URL })
          : t(language, "music.error_queue_full_pro", { max });
        return safeRespond(interaction, { embeds: [createMusicWarningEmbed(msg, tier, language)] });
      }
      if (enqueueResult.reason?.startsWith("too_long")) {
        const maxMin = Math.floor(limits.maxDurationSeconds / 60);
        const msg = tier === "free"
          ? t(language, "music.error_too_long_free", { maxMin, url: UPGRADE_URL })
          : t(language, "music.error_too_long_pro", { maxMin });
        return safeRespond(interaction, { embeds: [createMusicWarningEmbed(msg, tier, language)] });
      }
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_add_track"), language)] });
    }

    if (!player.playing && !player.paused) {
      try { await player.play(); } catch (err) {
        log.error("Failed to start track playback", { guildId, error: err.message });
        return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_play"), language)] });
      }
      log.info("Now playing", { guildId, track: track.title });
      return safeRespond(interaction, {
        embeds: [createNowPlayingEmbed(track, player, tier, language)],
        components: createPlayerControls(player, tier, language),
      });
    }

    const position = player.queue.size;
    log.info("Track added to queue", { guildId, track: track.title, position });
    return safeRespond(interaction, { embeds: [addedToQueueEmbed(track, position, tier, language)] });
  },
};
