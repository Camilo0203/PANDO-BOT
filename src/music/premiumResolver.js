"use strict";

/**
 * premiumResolver (migrado a ton618-bot)
 *
 * Wrapper sobre @ton618/shared que pasa opciones desde el env del bot.
 * Los comandos de música lo importan en lugar de usar el shared directamente,
 * para que el resto del código no dependa de variables de entorno sueltas.
 *
 * Si el resolver del shared no tiene datasource (mongo/supabase),
 * siempre devolvera "free" — esto es intencional.
 */

const { resolveGuildTier: _resolveGuildTier } = require("@ton618/shared").default || require("@ton618/shared");

const RESOLVER_OPTIONS = {
  mongoUri: process.env.MONGO_URI,
  dbName: process.env.MONGO_DB || "ton618_bot",
  supabaseUrl: process.env.SUPABASE_URL,
  botApiKey: process.env.BOT_API_KEY,
  logger: {
    info: (msg, meta) => require("../utils/structuredLogger").info("Music.PREMIUM", msg, meta || {}),
    warn: (msg, meta) => require("../utils/structuredLogger").warn("Music.PREMIUM", msg, meta || {}),
    error: (msg, meta) => require("../utils/structuredLogger").error("Music.PREMIUM", msg, meta || {}),
  },
};

async function resolveGuildTier(guildId) {
  return _resolveGuildTier(guildId, RESOLVER_OPTIONS);
}

module.exports = { resolveGuildTier };
