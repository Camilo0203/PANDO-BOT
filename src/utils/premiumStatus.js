"use strict";

const { premiumService } = require("../services/premiumService");
const logger = require("./structuredLogger");
const { getProStoreUrl } = require("./proStore");

const PREMIUM_TIER_LABELS = {
  pro_monthly: "PRO Monthly",
  pro_yearly: "PRO Yearly",
  lifetime: "Lifetime",
};

function getDaysUntilExpiration(expiresAt) {
  if (!expiresAt) return null;

  const expiresDate = new Date(expiresAt);
  if (Number.isNaN(expiresDate.getTime())) {
    return null;
  }

  const diffMs = expiresDate.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function getTierLabel(tier, lifetime = false) {
  if (lifetime) return PREMIUM_TIER_LABELS.lifetime;
  return PREMIUM_TIER_LABELS[tier] || "PRO";
}

function isPremiumStatusUnavailable(status) {
  return Boolean(status?.meta?.unavailable || status?.error);
}

async function resolveGuildPremiumStatus(guildId) {
  try {
    const premium = await premiumService.checkGuildPremium(guildId);
    const isPremium = Boolean(premium?.has_premium);
    const errorCode = premium?._meta?.unavailable ? premium._meta.errorCode || "premium_status_unavailable" : null;

    if (errorCode) {
      logger.warn("premiumStatus", "Premium status unavailable", { guildId, errorCode });
    }

    return {
      plan: isPremium ? (premium.tier || "pro") : "free",
      tier: premium?.tier || null,
      tierLabel: isPremium ? getTierLabel(premium?.tier, premium?.lifetime) : "FREE",
      isPro: isPremium,
      isPremium: isPremium,
      isLifetime: Boolean(premium?.lifetime),
      planSource: premium?.plan_source || null,
      planStartedAt: null,
      planExpiresAt: premium?.expires_at || null,
      expiresAt: premium?.expires_at || null,
      daysUntil: getDaysUntilExpiration(premium?.expires_at),
      supporterActive: false,
      supporterExpiresAt: null,
      ownerUserId: premium?.owner_user_id || null,
      upgradeUrl: getProStoreUrl(),
      error: errorCode,
      meta: premium?._meta || {
        source: "unknown",
        stale: false,
        unavailable: false,
        errorCode: null,
      },
    };
  } catch (error) {
    logger.error("premiumStatus", "Unexpected error resolving guild", { guildId, error: error?.message || String(error) });

    return {
      plan: "free",
      tier: null,
      tierLabel: "FREE",
      isPro: false,
      isPremium: false,
      isLifetime: false,
      planSource: "free",
      planStartedAt: null,
      planExpiresAt: null,
      expiresAt: null,
      daysUntil: null,
      supporterActive: false,
      supporterExpiresAt: null,
      ownerUserId: null,
      upgradeUrl: getProStoreUrl(),
      error: "premium_status_unavailable",
      meta: {
        source: "resolver_error",
        stale: false,
        unavailable: true,
        errorCode: "premium_status_unavailable",
      },
    };
  }
}

module.exports = {
  getDaysUntilExpiration,
  getTierLabel,
  isPremiumStatusUnavailable,
  resolveGuildPremiumStatus,
};
