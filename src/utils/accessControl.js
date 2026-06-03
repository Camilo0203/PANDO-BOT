const { PermissionFlagsBits } = require("discord.js");
const { settings } = require("./database");
const { normalizeLanguage, t } = require("./i18n");

const settingsCache = new Map();
const SETTINGS_CACHE_TTL_MS = 30 * 1000;
const SETTINGS_CACHE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const SETTINGS_CACHE_MAX_SIZE = 2000;

function getOwnerId(client) {
  return process.env.OWNER_ID || process.env.DISCORD_OWNER_ID || client?.application?.owner?.id || null;
}

function getFromCache(cache, key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(cache, key, value, ttlMs) {
  // Evict oldest entry if cache is at max capacity
  if (cache.size >= SETTINGS_CACHE_MAX_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
  return value;
}

function cleanupExpiredGuildSettingsCache() {
  const now = Date.now();
  for (const [key, entry] of settingsCache.entries()) {
    if (!entry || entry.expiresAt <= now) {
      settingsCache.delete(key);
    }
  }
}

async function getGuildSettings(guildId) {
  if (!guildId) return null;
  const cached = getFromCache(settingsCache, guildId);
  if (cached) return cached;
  const fresh = await settings.get(guildId);
  return setCache(settingsCache, guildId, fresh, SETTINGS_CACHE_TTL_MS);
}

function clearGuildSettingsCache(guildId) {
  if (!guildId || guildId === "*") {
    settingsCache.clear();
    return;
  }
  settingsCache.delete(guildId);
}

function hasAdminPrivileges(member, guildSettings) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (guildSettings?.admin_role && member.roles?.cache?.has(guildSettings.admin_role)) return true;
  return false;
}

function hasStaffPrivileges(member, guildSettings) {
  if (!member) return false;
  if (hasAdminPrivileges(member, guildSettings)) return true;
  if (guildSettings?.support_role && member.roles?.cache?.has(guildSettings.support_role)) return true;
  return false;
}

function resolveRequiredAccess(commandObj) {
  if (commandObj?.access) return commandObj.access;

  const scope = commandObj?.meta?.scope;
  if (scope === "developer") return "owner";
  if (scope === "admin") return "admin";
  if (scope === "staff") return "staff";
  return "public";
}

async function checkAccess(interaction, requiredAccess = "public", guildSettings = null) {
  if (!interaction?.user) return { allowed: false, reason: "missing_user" };

  if (requiredAccess === "public") return { allowed: true };

  const ownerId = getOwnerId(interaction.client);
  const isOwner = Boolean(ownerId && interaction.user.id === ownerId);
  if (isOwner) return { allowed: true };

  if (!interaction.guild || !interaction.member) {
    return { allowed: false, reason: "guild_only" };
  }

  if (requiredAccess === "owner") {
    return { allowed: false, reason: "owner_only" };
  }

  // Fast-path: privilegios nativos de Discord sin tocar DB
  if (interaction.member.permissions?.has(PermissionFlagsBits.Administrator)) {
    return { allowed: true };
  }

  const s = guildSettings || await getGuildSettings(interaction.guild.id);

  if (requiredAccess === "admin") {
    return hasAdminPrivileges(interaction.member, s)
      ? { allowed: true }
      : { allowed: false, reason: "admin_required" };
  }

  if (requiredAccess === "staff") {
    return hasStaffPrivileges(interaction.member, s)
      ? { allowed: true }
      : { allowed: false, reason: "staff_required" };
  }

  return { allowed: true };
}

function formatAccessDenied(reason, language = "en") {
  const lang = normalizeLanguage(language, "en");
  switch (reason) {
    case "owner_only":
      return t(lang, "access.owner_only");
    case "admin_required":
      return t(lang, "access.admin_required");
    case "staff_required":
      return t(lang, "access.staff_required");
    case "guild_only":
      return t(lang, "access.guild_only");
    default:
      return t(lang, "access.default");
  }
}

const cacheCleanupTimer = setInterval(() => {
  cleanupExpiredGuildSettingsCache();
}, SETTINGS_CACHE_CLEANUP_INTERVAL_MS);

if (typeof cacheCleanupTimer.unref === "function") {
  cacheCleanupTimer.unref();
}

module.exports = {
  getOwnerId,
  getGuildSettings,
  hasAdminPrivileges,
  hasStaffPrivileges,
  resolveRequiredAccess,
  checkAccess,
  formatAccessDenied,
  clearGuildSettingsCache,
  cleanupExpiredGuildSettingsCache,
};
