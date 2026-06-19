"use strict";

/**
 * TON618 Enterprise Brand Constants
 * Centralized branding, colors, and styling for consistent professional appearance
 */

const { EmbedBuilder } = require("discord.js");

// Brand Colors - Professional palette
const COLORS = {
  // Primary brand color
  PRIMARY: 0x0066CC,
  PRIMARY_HEX: "#0066CC",

  // Success states
  SUCCESS: 0x22C55E,
  SUCCESS_HEX: "#22C55E",

  // Warning states
  WARNING: 0xF59E0B,
  WARNING_HEX: "#F59E0B",

  // Error states
  ERROR: 0xEF4444,
  ERROR_HEX: "#EF4444",

  // Information states
  INFO: 0x3B82F6,
  INFO_HEX: "#3B82F6",

  // Neutral states
  NEUTRAL: 0x6B7280,
  NEUTRAL_HEX: "#6B7280",

  // Premium/Gold for PRO features
  PREMIUM: 0xF59E0B,
  PREMIUM_HEX: "#F59E0B",
};

// Brand Assets
const BRAND = {
  NAME: "TON618 Enterprise",
  SHORT_NAME: "TON618",
  TAGLINE: "Discord Management Suite",
  VERSION: "3.0 BETA",
  WEBSITE: "https://www.ton618bot.xyz",
  SUPPORT_URL: "https://discord.gg/ton618",

  // Default footer text
  FOOTER_TEXT: "TON618 Enterprise • Use /help for assistance",
  FOOTER_TEXT_ES: "TON618 Enterprise • Usa /help para ayuda",

  // Thumbnail/Icon URLs (can be replaced with actual CDN URLs)
  ICON_DEFAULT: null, // Will use bot's avatar
  ICON_SUCCESS: "✅",
  ICON_ERROR: "❌",
  ICON_WARNING: "⚠️",
  ICON_INFO: "ℹ️",
  ICON_LOADING: "⏳",
  ICON_PREMIUM: "⭐",
};

// Professional Icons (using Discord-compatible characters)
const ICONS = {
  success: "<:check:0>", // Will be replaced with actual emoji or kept as text
  error: "<:x:0>",
  warning: "<:warn:0>",
  info: "<:info:0>",
  loading: "<a:loading:0>",
  ticket: "🎫",
  giveaway: "🎉",
  moderation: "🛡️",
  stats: "📊",
  settings: "⚙️",
  premium: "⭐",
  bot: "🤖",
  user: "👤",
  guild: "🏰",
  channel: "#️⃣",
  role: "🏷️",
  clock: "🕐",
  calendar: "📅",
  link: "🔗",
  mail: "📧",
  star: "⭐",
  heart: "❤️",
  shield: "🛡️",
  zap: "⚡",
  lock: "🔒",
  unlock: "🔓",
  search: "🔍",
  edit: "✏️",
  trash: "🗑️",
  plus: "➕",
  minus: "➖",
  arrow_right: "➡️",
  arrow_left: "⬅️",
  arrow_up: "⬆️",
  arrow_down: "⬇️",
};

/**
 * Create a standardized error embed
 * @param {string} message - Error message
 * @param {Object} options - Options
 * @param {string} options.language - Language code (en/es)
 * @param {string} options.suggestion - Suggestion for the user
 * @param {string} options.code - Error code for support
 * @returns {EmbedBuilder}
 */
function createErrorEmbed(message, options = {}) {
  const { language = "en", suggestion, code } = options;

  const title = language === "es" ? "Error" : "Error";
  const footerText = language === "es" ? BRAND.FOOTER_TEXT_ES : BRAND.FOOTER_TEXT;

  const embed = new EmbedBuilder()
    .setTitle(`${ICONS.error} ${title}`)
    .setDescription(message)
    .setColor(COLORS.ERROR)
    .setTimestamp()
    .setFooter({ text: footerText });

  if (suggestion) {
    embed.addFields({
      name: language === "es" ? "💡 Sugerencia" : "💡 Suggestion",
      value: suggestion,
    });
  }

  if (code) {
    embed.addFields({
      name: language === "es" ? "Código de referencia" : "Reference Code",
      value: `\`${code}\``,
      inline: true,
    });
  }

  return embed;
}

/**
 * Create a standardized success embed
 * @param {string} message - Success message
 * @param {Object} options - Options
 * @param {string} options.language - Language code (en/es)
 * @param {string} options.title - Custom title
 * @returns {EmbedBuilder}
 */
function createSuccessEmbed(message, options = {}) {
  const { language = "en", title } = options;
  const footerText = language === "es" ? BRAND.FOOTER_TEXT_ES : BRAND.FOOTER_TEXT;

  const embedTitle = title || (language === "es" ? "Éxito" : "Success");

  return new EmbedBuilder()
    .setTitle(`${ICONS.success} ${embedTitle}`)
    .setDescription(message)
    .setColor(COLORS.SUCCESS)
    .setTimestamp()
    .setFooter({ text: footerText });
}

/**
 * Create a standardized info embed
 * @param {string} message - Info message
 * @param {Object} options - Options
 * @param {string} options.language - Language code (en/es)
 * @param {string} options.title - Custom title
 * @returns {EmbedBuilder}
 */
function createInfoEmbed(message, options = {}) {
  const { language = "en", title } = options;
  const footerText = language === "es" ? BRAND.FOOTER_TEXT_ES : BRAND.FOOTER_TEXT;

  const embedTitle = title || (language === "es" ? "Información" : "Information");

  return new EmbedBuilder()
    .setTitle(`${ICONS.info} ${embedTitle}`)
    .setDescription(message)
    .setColor(COLORS.INFO)
    .setTimestamp()
    .setFooter({ text: footerText });
}

/**
 * Create a standardized warning embed
 * @param {string} message - Warning message
 * @param {Object} options - Options
 * @param {string} options.language - Language code (en/es)
 * @param {string} options.title - Custom title
 * @returns {EmbedBuilder}
 */
function createWarningEmbed(message, options = {}) {
  const { language = "en", title } = options;
  const footerText = language === "es" ? BRAND.FOOTER_TEXT_ES : BRAND.FOOTER_TEXT;

  const embedTitle = title || (language === "es" ? "Advertencia" : "Warning");

  return new EmbedBuilder()
    .setTitle(`${ICONS.warning} ${embedTitle}`)
    .setDescription(message)
    .setColor(COLORS.WARNING)
    .setTimestamp()
    .setFooter({ text: footerText });
}

/**
 * Create a loading/processing embed
 * @param {string} message - Loading message
 * @param {Object} options - Options
 * @param {string} options.language - Language code (en/es)
 * @returns {EmbedBuilder}
 */
function createLoadingEmbed(message, options = {}) {
  const { language = "en" } = options;
  const footerText = language === "es" ? BRAND.FOOTER_TEXT_ES : BRAND.FOOTER_TEXT;

  const title = language === "es" ? "Procesando" : "Processing";

  return new EmbedBuilder()
    .setTitle(`${ICONS.loading} ${title}...`)
    .setDescription(message)
    .setColor(COLORS.NEUTRAL)
    .setFooter({ text: footerText });
}

/**
 * Create a premium/PRO feature embed
 * @param {string} message - Premium message
 * @param {Object} options - Options
 * @param {string} options.language - Language code (en/es)
 * @returns {EmbedBuilder}
 */
function createPremiumEmbed(message, options = {}) {
  const { language = "en" } = options;
  const footerText = language === "es" ? BRAND.FOOTER_TEXT_ES : BRAND.FOOTER_TEXT;

  const title = language === "es" ? "Función PRO" : "PRO Feature";

  return new EmbedBuilder()
    .setTitle(`${ICONS.premium} ${title}`)
    .setDescription(message)
    .setColor(COLORS.PREMIUM)
    .setTimestamp()
    .setFooter({ text: footerText });
}

/**
 * Add standard footer to any embed
 * @param {EmbedBuilder} embed - Embed to modify
 * @param {string} language - Language code (en/es)
 * @returns {EmbedBuilder}
 */
function addStandardFooter(embed, language = "en") {
  const footerText = language === "es" ? BRAND.FOOTER_TEXT_ES : BRAND.FOOTER_TEXT;
  return embed.setFooter({ text: footerText, iconURL: BRAND.ICON_DEFAULT });
}

module.exports = {
  COLORS,
  BRAND,
  ICONS,
  createErrorEmbed,
  createSuccessEmbed,
  createInfoEmbed,
  createWarningEmbed,
  createLoadingEmbed,
  createPremiumEmbed,
  addStandardFooter,
};
