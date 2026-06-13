"use strict";

/**
 * musicInteractionHandler
 * Router central de comandos slash de música con rate limiting propio.
 * Carga comandos desde src/commands/public/music/ (los mismos que el
 * commandLoader del bot, pero con su propio rate limiter para no chocar
 * con el rate limiter global del bot).
 */

const fs = require("fs");
const path = require("path");
const { Collection } = require("discord.js");
const logger = require("../../utils/structuredLogger");

const log = {
  info: (msg, meta) => logger.info("Music.INTHANDLER", msg, meta || {}),
  error: (msg, meta) => logger.error("Music.INTHANDLER", msg, meta || {}),
  warn: (msg, meta) => logger.warn("Music.INTHANDLER", msg, meta || {}),
};

const commands = new Collection();
const userCooldowns = new Map();
const guildCooldowns = new Map();
const COOLDOWN_MS = parseInt(process.env.COMMAND_COOLDOWN_MS || "1500", 10);
const GUILD_COOLDOWN_MS = parseInt(process.env.GUILD_COMMAND_COOLDOWN_MS || "800", 10);
const ALLOWED_GUILD_IDS = new Set(
  (process.env.MUSIC_ALLOWED_GUILD_ID || process.env.MUSIC_ALLOWED_GUILD_IDS || "")
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean)
);

const COMMANDS_PATH = path.join(__dirname, "..", "..", "commands", "public", "music");

function loadCommands() {
  if (!fs.existsSync(COMMANDS_PATH)) {
    log.error("Music commands directory not found", { path: COMMANDS_PATH });
    return;
  }
  const files = fs.readdirSync(COMMANDS_PATH).filter((f) => f.endsWith(".js"));
  for (const file of files) {
    try {
      const cmd = require(path.join(COMMANDS_PATH, file));
      if (cmd?.data?.name) commands.set(cmd.data.name, cmd);
    } catch (err) {
      log.error("Failed to load music command", { file, error: err.message });
    }
  }
  log.info("Music commands loaded", { count: commands.size });
}

loadCommands();

function isOnCooldown(map, key, durationMs) {
  const last = map.get(key);
  if (!last) return false;
  return Date.now() - last < durationMs;
}

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (err) {
    log.warn("Failed to reply to interaction", { command: interaction.commandName, error: err.message });
  }
}

async function musicInteractionHandler(interaction) {
  if (!interaction.isChatInputCommand()) return false;
  const command = commands.get(interaction.commandName);
  if (!command) return false;
  if (command.category !== "music") return false;

  if (ALLOWED_GUILD_IDS.size > 0 && !ALLOWED_GUILD_IDS.has(interaction.guildId)) {
    log.warn("Music command blocked outside allowed guild", { command: interaction.commandName, guildId: interaction.guildId, userId: interaction.user.id });
    return safeReply(interaction, { content: "Music commands are only enabled in the support server.", ephemeral: true });
  }

  const userKey = `${interaction.user.id}:${interaction.commandName}`;
  const guildKey = `${interaction.guildId}:${interaction.commandName}`;

  if (isOnCooldown(userCooldowns, userKey, COOLDOWN_MS)) {
    const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - userCooldowns.get(userKey))) / 1000);
    return safeReply(interaction, { content: `⏳ Please wait ${remaining}s before using this command again.`, ephemeral: true });
  }
  if (isOnCooldown(guildCooldowns, guildKey, GUILD_COOLDOWN_MS)) {
    return safeReply(interaction, { content: "⏳ This server is processing a music command. Please wait a moment.", ephemeral: true });
  }

  userCooldowns.set(userKey, Date.now());
  guildCooldowns.set(guildKey, Date.now());

  if (userCooldowns.size > 500) {
    const now = Date.now();
    for (const [k, v] of userCooldowns) if (now - v > COOLDOWN_MS * 5) userCooldowns.delete(k);
  }

  const startTime = Date.now();
  const context = {
    command: interaction.commandName,
    userId: interaction.user.id,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
  };
  try {
    await command.execute(interaction);
    log.info("Command executed", { ...context, durationMs: Date.now() - startTime });
  } catch (error) {
    log.error("Command execution failed", { ...context, error: error?.message || String(error), stack: error?.stack, durationMs: Date.now() - startTime });
    const payload = { content: "❌ An error occurred while executing the music command. Please try again later.", ephemeral: true };
    await safeReply(interaction, payload);
  }
}

module.exports = { musicInteractionHandler, commands };
