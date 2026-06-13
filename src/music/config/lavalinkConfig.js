"use strict";

/**
 * Configuración de nodos Lavalink por tier
 *
 * PRO   -> nodo de alta calidad (bitrate 320kbps, búfer mayor)
 * FREE  -> nodo de calidad estándar (bitrate 128kbps)
 *
 * Si solo tienes un nodo físico, puedes apuntar ambos al mismo host/puerto
 * y diferenciar la calidad vía los filtros de audio aplicados en MusicPlayer.
 */

const TIER_LIMITS = {
  free: {
    maxQueue: 10,
    maxVolume: 80,
    maxDurationSeconds: 300,
    bitrate: 128000,
    lavalinkNode: "free",
    filters: false,
    spotifyEnabled: false,
    playlistEnabled: false,
  },
  pro: {
    maxQueue: 200,
    maxVolume: 100,
    maxDurationSeconds: 21600,
    bitrate: 320000,
    lavalinkNode: "pro",
    filters: true,
    spotifyEnabled: true,
    playlistEnabled: true,
  },
};

function getTierLimitsFromEnv() {
  const readEnv = (key, fallback) => {
    const val = process.env[key];
    return val !== undefined ? parseInt(val, 10) : parseInt(fallback, 10);
  };
  return {
    free: {
      ...TIER_LIMITS.free,
      maxQueue: readEnv("MUSIC_FREE_MAX_QUEUE", "10"),
      maxVolume: readEnv("MUSIC_FREE_MAX_VOLUME", "80"),
      maxDurationSeconds: readEnv("MUSIC_FREE_MAX_DURATION_SECONDS", "300"),
    },
    pro: {
      ...TIER_LIMITS.pro,
      maxQueue: readEnv("MUSIC_PRO_MAX_QUEUE", "200"),
      maxVolume: readEnv("MUSIC_PRO_MAX_VOLUME", "100"),
      maxDurationSeconds: readEnv("MUSIC_PRO_MAX_DURATION_SECONDS", "21600"),
    },
  };
}

function requireEnv(key) {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function getNode(prefix) {
  const password = process.env[`LAVALINK_${prefix}_PASSWORD`];
  if (!password) {
    throw new Error(
      `LAVALINK_${prefix}_PASSWORD is required. ` +
      `Never use the default Lavalink password in production. ` +
      `Generate a strong password and set it in your .env file.`
    );
  }
  const rawHost = process.env[`LAVALINK_${prefix}_HOST`] || "localhost";
  const defaultPort = 2333;
  const port = process.env[`LAVALINK_${prefix}_PORT`] || defaultPort;
  const host = rawHost.includes(":") ? `[${rawHost}]` : rawHost;
  return {
    name: prefix.toLowerCase(),
    url: `${host}:${port}`,
    auth: password,
    secure: (process.env[`LAVALINK_${prefix}_SECURE`] || "false") === "true",
  };
}

function getLavalinkNodes() {
  const primary = getNode("PRO");
  return {
    PRO: primary,
    FREE: primary,
  };
}

const LIVE_TIER_LIMITS = getTierLimitsFromEnv();

const CIRCUIT_BREAKER = {
  threshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || "5", 10),
  resetMs: parseInt(process.env.CIRCUIT_BREAKER_RESET_MS || "60000", 10),
};

const TIMEOUTS = {
  playerIdle: parseInt(process.env.PLAYER_IDLE_TIMEOUT_MS || "180000", 10),
  trackMaxRetries: parseInt(process.env.TRACK_MAX_RETRIES || "3", 10),
  tierResolve: parseInt(process.env.TIER_RESOLVE_TIMEOUT_MS || "3000", 10),
};

module.exports = {
  getLavalinkNodes,
  TIER_LIMITS: LIVE_TIER_LIMITS,
  CIRCUIT_BREAKER,
  TIMEOUTS,
  getTierLimitsFromEnv,
};
