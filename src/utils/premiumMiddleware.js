const { premiumService } = require('../services/premiumService');
const { EmbedBuilder } = require('discord.js');
const logger = require('./structuredLogger');
const { t, normalizeLanguage, resolveInteractionLanguage } = require('./i18n');
const { getProStoreUrl } = require('./proStore');

// Configuration from environment with safe fallback
const PRICING_URL = getProStoreUrl();
const INTERACTION_TIMEOUT_MS = 2900; // Discord's 3s limit with safety margin

/**
 * Safely respond to interaction regardless of its state
 * Handles replied, deferred, and timed-out interactions gracefully
 * @param {import('discord.js').CommandInteraction} interaction - Discord interaction
 * @param {Object} payload - Response payload
 * @returns {Promise<Message|void>}
 */
async function safeReply(interaction, payload) {
  // Validate interaction object
  if (!interaction || typeof interaction !== 'object') {
    logger.error('premiumMiddleware', 'Invalid interaction object provided to safeReply');
    return;
  }

  try {
    // Check if interaction is still valid (not timed out)
    const createdTimestamp = interaction.createdTimestamp || Date.now();
    const age = Date.now() - createdTimestamp;
    
    if (age > INTERACTION_TIMEOUT_MS && !interaction.deferred && !interaction.replied) {
      logger.warn('premiumMiddleware', 'Interaction likely expired', { ageMs: age, deferred: interaction.deferred, replied: interaction.replied });
    }

    // Determine the appropriate response method
    if (interaction.replied || interaction.deferred) {
      return await interaction.editReply(payload);
    }
    
    return await interaction.reply(payload);
  } catch (error) {
    // Log detailed error for debugging
    logger.error('premiumMiddleware', 'Error sending interaction response', {
      error: error.message,
      code: error.code,
      replied: interaction.replied,
      deferred: interaction.deferred,
    });
    
    // Try followUp as last resort (only if interaction had a prior response)
    try {
      if (interaction.replied || interaction.deferred) {
        return await interaction.followUp({ ...payload, ephemeral: true });
      }
      // reply() failed AND no initial response exists — interaction likely expired (>3s).
      // Commands that call requirePremium should defer the interaction first if they
      // have other async operations that might delay the response.
      logger.error('premiumMiddleware', 'Cannot recover: interaction expired with no initial response. Was the interaction deferred before calling premium checks?');
    } catch (followUpError) {
      logger.error('premiumMiddleware', 'All response methods failed', { error: followUpError.message });
      // Don't throw - let the command fail gracefully
    }
  }
}

/**
 * Require premium subscription for command execution
 * @param {import('discord.js').CommandInteraction} interaction - Discord interaction
 * @param {Object} options - Options for premium check
 * @param {string} [options.requiredTier] - Minimum tier required
 * @returns {Promise<boolean>} - True if premium check passed
 */
async function requirePremium(interaction, options = {}) {
  // Validate interaction
  if (!interaction || !interaction.guildId) {
    logger.warn('premiumMiddleware', 'requirePremium called without valid guild context');
    const language = normalizeLanguage(interaction?.locale || interaction?.guildLocale, 'en');
    await safeReply(interaction, {
      content: t(language, 'premium.middleware.server_only'),
      ephemeral: true,
    });
    return false;
  }

  const guildId = interaction.guildId;

  // Warn if interaction is not deferred and may be approaching Discord's 3s limit.
  // On cache miss, checkGuildPremium can take up to API_TIMEOUT_MS before responding.
  // Best practice: defer the interaction before calling requirePremium when other async
  // work precedes or follows this call.
  if (!interaction.deferred && !interaction.replied) {
    const age = Date.now() - (interaction.createdTimestamp || Date.now());
    if (age > 1000) {
      logger.warn('premiumMiddleware', 'Interaction is old and not deferred - risk of timeout', { ageMs: age, guildId, deferred: interaction.deferred, replied: interaction.replied });
    }
  }

  let premium;
  try {
    premium = await premiumService.checkGuildPremium(guildId);
  } catch (error) {
    const language = normalizeLanguage(interaction.locale || interaction.guildLocale, 'en');
    logger.error('premiumMiddleware', 'Error checking premium', { guildId, error: error?.message || String(error) });
    await safeReply(interaction, {
      content: t(language, 'premium.middleware.verify_error'),
      ephemeral: true,
    });
    return false;
  }

  if (!premium.has_premium) {
    const language = normalizeLanguage(interaction.locale || interaction.guildLocale, 'en');
    const embed = new EmbedBuilder()
      .setColor('#FF6B6B')
      .setTitle(t(language, 'premium.embed.title'))
      .setDescription(t(language, 'premium.embed.description'))
      .addFields({
        name: t(language, 'premium.embed.upgrade_name'),
        value: t(language, 'premium.embed.upgrade_value', { url: PRICING_URL }),
      })
      .setFooter({ text: t(language, 'premium.embed.footer') });

    await safeReply(interaction, {
      embeds: [embed],
      ephemeral: true,
    });
    
    return false;
  }

  // Validate tier requirement if specified
  if (options.requiredTier) {
    const tierHierarchy = {
      'pro_monthly': 1,
      'pro_yearly': 1,
      'lifetime': 2,
    };

    if (!(options.requiredTier in tierHierarchy)) {
      logger.error('premiumMiddleware', 'Invalid requiredTier specified', { requiredTier: options.requiredTier });
      return false;
    }

    const userTierLevel = tierHierarchy[premium.tier] || 0;
    const requiredTierLevel = tierHierarchy[options.requiredTier];

    if (userTierLevel < requiredTierLevel) {
      const language = normalizeLanguage(interaction.locale || interaction.guildLocale, 'en');
      const currentTierName = premiumService.getTierFeatures(premium.tier).name;
      const requiredTierName = premiumService.getTierFeatures(options.requiredTier).name;
      const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle(t(language, 'premium.tier.title'))
        .setDescription(
          t(language, 'premium.tier.description', { requiredTierName, currentTierName })
        )
        .addFields({
          name: t(language, 'premium.tier.upgrade_name'),
          value: t(language, 'premium.tier.upgrade_value', { url: PRICING_URL }),
        });

      await safeReply(interaction, {
        embeds: [embed],
        ephemeral: true,
      });
      
      return false;
    }
  }

  return true;
}

/**
 * Require specific premium feature access
 * @param {import('discord.js').CommandInteraction} interaction - Discord interaction
 * @param {string} featureName - Feature name to check
 * @returns {Promise<boolean>} - True if feature access granted
 */
async function requireFeature(interaction, featureName) {
  // Validate inputs
  if (!interaction || !interaction.guildId) {
    logger.warn('premiumMiddleware', 'requireFeature called without valid guild context');
    const language = normalizeLanguage(interaction?.locale || interaction?.guildLocale, 'en');
    await safeReply(interaction, {
      content: t(language, 'premium.middleware.server_only'),
      ephemeral: true,
    });
    return false;
  }

  if (!featureName || typeof featureName !== 'string') {
    logger.error('premiumMiddleware', 'Invalid featureName provided to requireFeature', { featureName: String(featureName) });
    return false;
  }

  const guildId = interaction.guildId;

  let hasAccess;
  try {
    hasAccess = await premiumService.checkFeatureAccess(guildId, featureName);
  } catch (error) {
    const language = normalizeLanguage(interaction.locale || interaction.guildLocale, 'en');
    logger.error('premiumMiddleware', 'Error checking feature access', { guildId, error: error?.message || String(error) });
    await safeReply(interaction, {
      content: t(language, 'premium.middleware.verify_error'),
      ephemeral: true,
    });
    return false;
  }

  if (!hasAccess) {
    const language = normalizeLanguage(interaction.locale || interaction.guildLocale, 'en');
    const embed = new EmbedBuilder()
      .setColor('#FF6B6B')
      .setTitle(t(language, 'premium.feature.title'))
      .setDescription(
        t(language, 'premium.feature.description', { featureName })
      )
      .addFields({
        name: t(language, 'premium.feature.upgrade_name'),
        value: t(language, 'premium.feature.upgrade_value', { url: PRICING_URL }),
      });

    await safeReply(interaction, {
      embeds: [embed],
      ephemeral: true,
    });
    
    return false;
  }

  return true;
}

/**
 * Create embed displaying premium status
 * @param {string} guildId - Guild ID
 * @param {import('../services/premiumService').PremiumStatus} premium - Premium status object
 * @returns {EmbedBuilder} - Discord embed
 */
function createPremiumEmbed(guildId, premium, language = 'en') {
  // Validate inputs
  if (!premium || typeof premium !== 'object') {
    logger.error('premiumMiddleware', 'Invalid premium object provided to createPremiumEmbed');
    premium = { has_premium: false, tier: null, expires_at: null, lifetime: false };
  }

  const lang = normalizeLanguage(language, 'en');

  const embed = new EmbedBuilder()
    .setColor(premium.has_premium ? '#4CAF50' : '#9E9E9E')
    .setTitle(premium.has_premium ? t(lang, 'premium.status.active') : t(lang, 'premium.status.free'));

  if (premium.has_premium) {
    const tierFeatures = premiumService.getTierFeatures(premium.tier);

    // Safe date handling for expires_at with expiration check
    let expirationText = t(lang, 'premium.status.status_lifetime');
    if (premium.expires_at && !premium.lifetime) {
      try {
        const expiresDate = new Date(premium.expires_at);
        if (!isNaN(expiresDate.getTime())) {
          const now = new Date();
          if (expiresDate <= now) {
            // Premium expired (cache may be stale)
            expirationText = t(lang, 'premium.status.expired');
          } else {
            const timestamp = Math.floor(expiresDate.getTime() / 1000);
            expirationText = t(lang, 'premium.status.expires', { timestamp });
          }
        } else {
          logger.warn('premiumMiddleware', 'Invalid expires_at date', { guildId, expiresAt: premium.expires_at });
          expirationText = t(lang, 'premium.status.active_status');
        }
      } catch (error) {
        logger.error('premiumMiddleware', 'Error parsing expires_at', { error: error?.message || String(error) });
        expirationText = t(lang, 'premium.status.active_status');
      }
    }

    embed.setDescription(
      t(lang, 'premium.status.current_plan', { plan: tierFeatures.name }) + '\n' + expirationText
    );

    embed.addFields(
      {
        name: t(lang, 'premium.status.features'),
        value: [
          t(lang, 'premium.status.limit_custom_commands', { limit: tierFeatures.max_custom_commands }),
          t(lang, 'premium.status.limit_auto_roles', { limit: tierFeatures.max_auto_roles }),
          t(lang, 'premium.status.limit_welcome_messages', { limit: tierFeatures.max_welcome_messages }),
          tierFeatures.advanced_moderation ? t(lang, 'premium.status.yes_advanced_moderation') : t(lang, 'premium.status.no_advanced_moderation'),
          tierFeatures.custom_embeds ? t(lang, 'premium.status.yes_custom_embeds') : t(lang, 'premium.status.no_custom_embeds'),
          tierFeatures.priority_support ? t(lang, 'premium.status.yes_priority_support') : t(lang, 'premium.status.no_priority_support'),
          tierFeatures.analytics ? t(lang, 'premium.status.yes_analytics') : t(lang, 'premium.status.no_analytics'),
          tierFeatures.exclusive_features ? t(lang, 'premium.status.yes_exclusive_features') : t(lang, 'premium.status.no_exclusive_features'),
        ].filter(Boolean).join('\n'),
        inline: false,
      }
    );
  } else {
    embed.setDescription(t(lang, 'premium.status.free_description'));

    embed.addFields(
      {
        name: t(lang, 'premium.status.free_limits'),
        value: [
          t(lang, 'premium.status.limit_custom_commands', { limit: 5 }),
          t(lang, 'premium.status.limit_auto_roles', { limit: 3 }),
          t(lang, 'premium.status.limit_welcome_messages', { limit: 1 }),
          t(lang, 'premium.status.no_advanced_moderation'),
          t(lang, 'premium.status.no_custom_embeds'),
          t(lang, 'premium.status.no_priority_support'),
          t(lang, 'premium.status.no_analytics'),
        ].join('\n'),
        inline: false,
      },
      {
        name: t(lang, 'premium.status.field_free_upgrade'),
        value: t(lang, 'premium.status.field_free_upgrade_value', { url: PRICING_URL }),
        inline: false,
      }
    );
  }

  return embed;
}

/**
 * Check if guild is within limits for a specific feature
 * @param {string} guildId - Guild ID
 * @param {string} limitType - Type of limit to check
 * @param {number} currentCount - Current usage count
 * @returns {Promise<Object>} - Limit check result
 */
async function checkLimit(guildId, limitType, currentCount) {
  // Validate inputs
  if (!guildId || typeof guildId !== 'string') {
    logger.error('premiumMiddleware', 'Invalid guildId provided to checkLimit', { guildId: String(guildId) });
    return { allowed: false, limit: 0, current: currentCount, remaining: 0 };
  }

  if (typeof currentCount !== 'number' || currentCount < 0) {
    logger.error('premiumMiddleware', 'Invalid currentCount provided to checkLimit', { currentCount: String(currentCount) });
    currentCount = 0;
  }

  let premium;
  try {
    premium = await premiumService.checkGuildPremium(guildId);
  } catch (error) {
    logger.error('premiumMiddleware', 'Error checking premium for limit check', { guildId, error: error?.message || String(error) });
    // Fail safe: fall back to free tier limits (graceful degradation)
    // Note: checkGuildPremium handles its own errors internally, so this catch is
    // a last-resort safety net that should rarely trigger in practice.
    premium = premiumService.getDefaultPremiumStatus();
  }

  const tierFeatures = premiumService.getTierFeatures(premium.tier);
  
  const limits = {
    custom_commands: tierFeatures.max_custom_commands,
    auto_roles: tierFeatures.max_auto_roles,
    welcome_messages: tierFeatures.max_welcome_messages,
  };

  const limit = limits[limitType];
  
  if (limit === undefined) {
    logger.error('premiumMiddleware', 'Unknown limit type requested', { limitType: String(limitType) });
    // Fail safe: deny access for unknown limit types
    return { allowed: false, limit: 0, current: currentCount, remaining: 0 };
  }

  return {
    allowed: currentCount < limit,
    limit,
    current: currentCount,
    remaining: Math.max(0, limit - currentCount),
  };
}

module.exports = {
  requirePremium,
  requireFeature,
  createPremiumEmbed,
  checkLimit,
  safeReply,
};
