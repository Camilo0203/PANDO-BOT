/**
 * Premium Service - Manages premium status for guilds
 * 
 * Strategy: Fetch from Supabase backend with MongoDB cache (TTL 5min)
 * Fallback: Use stale cache if backend fails
 * 
 * @module services/premiumService
 * 
 * @typedef {Object} PremiumStatus
 * @property {boolean} has_premium - Whether guild has active premium
 * @property {string|null} tier - Premium tier: 'pro_monthly' | 'pro_yearly' | 'lifetime' | null
 * @property {string|null} expires_at - ISO timestamp when premium expires (null for lifetime)
 * @property {boolean} lifetime - Whether this is a lifetime subscription
 * @property {string} [owner_user_id] - Discord user ID of subscription owner
 */
const logger = require('../utils/structuredLogger');

const axios = require('axios');
const { getDB } = require('../utils/database');
const { CircuitBreaker, CircuitBreakerOpenError } = require('../utils/circuitBreaker');

// Configuration from environment with safe defaults
const SUPABASE_URL = process.env.SUPABASE_URL;
const BOT_API_KEY = process.env.BOT_API_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CACHE_TTL_MS = parseInt(process.env.PREMIUM_CACHE_TTL_MS, 10) || (5 * 60 * 1000); // 5 minutes
const STALE_CACHE_FALLBACK_MS = parseInt(process.env.PREMIUM_STALE_CACHE_MS, 10) || (60 * 60 * 1000); // 1 hour
const API_TIMEOUT_MS = parseInt(process.env.PREMIUM_API_TIMEOUT_MS, 10) || 8000; // 8 seconds
const API_MAX_RETRIES = parseInt(process.env.PREMIUM_API_MAX_RETRIES, 10) || 2;

// Circuit breaker para la API de billing
const billingBreaker = new CircuitBreaker('billing-api', {
  failureThreshold: parseInt(process.env.BILLING_CB_FAILURE_THRESHOLD, 10) || 5,
  timeoutMs: parseInt(process.env.BILLING_CB_TIMEOUT_MS, 10) || 30000,
  successThreshold: parseInt(process.env.BILLING_CB_SUCCESS_THRESHOLD, 10) || 2,
});

class PremiumService {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      this.db = getDB();
      await this.ensurePremiumCacheCollection();
      this.initialized = true;
      logger.info('premium.service', 'Premium service initialized');
    } catch (error) {
      logger.error('premium.service', 'Error initializing premium service', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async ensurePremiumCacheCollection() {
    const collections = await this.db.listCollections().toArray();
    const exists = collections.some(col => col.name === 'premium_cache');
    
    if (!exists) {
      await this.db.createCollection('premium_cache');
    }

    // Ensure all required indexes exist (idempotent — safe to run on every startup)
    const col = this.db.collection('premium_cache');
    await col.createIndex({ ttl_expires_at: 1 }, { expireAfterSeconds: 0, background: true });
    await col.createIndex({ guild_id: 1 }, { background: true });
    // app_cache_expires_at is the application-level 5-min freshness field (distinct from MongoDB TTL)
    await col.createIndex({ app_cache_expires_at: 1 }, { background: true });
  }

  /**
   * Check guild premium status with cache-first strategy
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<PremiumStatus>}
   */
  async checkGuildPremium(guildId) {
    if (!this.initialized) {
      logger.warn('premiumService', 'Premium service not initialized, initializing now');
      await this.initialize();
    }

    if (!guildId || typeof guildId !== 'string') {
      logger.error('premiumService', 'Invalid guildId provided to checkGuildPremium', { guildId: String(guildId) });
      return this.getDefaultPremiumStatus({
        source: 'invalid_input',
        unavailable: true,
        errorCode: 'invalid_guild_id',
      });
    }

    try {
      const cached = await this.getCachedPremium(guildId);
      if (cached) {
        return cached;
      }

      const fresh = await this.fetchPremiumFromAPI(guildId);
      if (!fresh?._meta?.unavailable) {
        await this.cachePremiumStatus(guildId, fresh);
      } else {
        logger.warn('premiumService', 'Skipping premium cache write due to unavailable status', { guildId });
      }
      
      return fresh;
    } catch (error) {
      logger.error('premiumService', 'Critical error in checkGuildPremium', { guildId, error: error?.message || String(error) });
      return this.getDefaultPremiumStatus({
        source: 'check_error',
        unavailable: true,
        errorCode: 'premium_status_unavailable',
      });
    }
  }

  async cachePremiumStatus(guildId, premiumData) {
    try {
      if (!this.db) {
        logger.warn('premium.cache', 'Database not available, skipping cache write');
        return;
      }

      const now = new Date();
      const appCacheExpiresAt = new Date(now.getTime() + CACHE_TTL_MS);
      const ttlExpiresAt = new Date(now.getTime() + STALE_CACHE_FALLBACK_MS);

      await this.db.collection('premium_cache').updateOne(
        { guild_id: guildId },
        {
          $set: {
            guild_id: guildId,
            has_premium: premiumData.has_premium,
            tier: premiumData.tier,
            expires_at: premiumData.expires_at,
            lifetime: premiumData.lifetime,
            owner_user_id: premiumData.owner_user_id,
            app_cache_expires_at: appCacheExpiresAt,
            ttl_expires_at: ttlExpiresAt,
            cached_at: now,
          },
        },
        { upsert: true }
      );

      logger.debug('premium.cache', `Premium status cached for guild ${guildId}`);
    } catch (error) {
      logger.warn('premium.cache', 'Error writing premium cache (non-critical)', { error: error?.message || String(error) });
    }
  }

  async getCachedPremium(guildId) {
    try {
      if (!this.db) {
        logger.warn('premium.cache', 'Database not available for cache read');
        return null;
      }

      // Query by app-level freshness field (5-min TTL), NOT the MongoDB deletion TTL
      const cached = await this.db.collection('premium_cache').findOne({
        guild_id: guildId,
        app_cache_expires_at: { $gt: new Date() }
      });

      if (cached) {
        logger.debug('premium.cache', `Premium cache hit for guild ${guildId}`);
        // Validate expiration for non-lifetime subscriptions
        if (cached.expires_at && !cached.lifetime) {
          const expiresDate = new Date(cached.expires_at);
          if (expiresDate <= new Date()) {
            logger.debug('premium.cache', `Cached premium expired for guild ${guildId}, fetching fresh data`);
            return null; // Force fresh fetch from backend
          }
        }

        return this._normalizePremiumData({
          has_premium: cached.has_premium,
          tier: cached.tier,
          expires_at: cached.expires_at,
          lifetime: cached.lifetime,
          owner_user_id: cached.owner_user_id,
          _meta: {
            source: 'cache',
            stale: false,
            unavailable: false,
          },
        });
      }

      return null;
    } catch (error) {
      logger.warn('premium.cache', 'Error reading premium cache (non-critical)', { error: error.message });
      return null;
    }
  }

async fetchPremiumFromAPI(guildId) {
    if (!SUPABASE_URL || !BOT_API_KEY) {
      logger.warn('premium.config', 'SUPABASE_URL or BOT_API_KEY not configured. Premium features disabled.');
      return this.getDefaultPremiumStatus({
        source: 'config_missing',
        unavailable: true,
        errorCode: 'premium_service_not_configured',
      });
    }

    const apiCall = async () => {
      let lastError = null;
      
      for (let attempt = 1; attempt <= API_MAX_RETRIES; attempt++) {
        try {
          const url = `${SUPABASE_URL}/functions/v1/billing-guild-status/${guildId}`;
          
          if (attempt === 1) {
            logger.debug('premium.api', `Fetching premium status for guild ${guildId} from backend`);
          } else {
            logger.debug('premium.api', `Retry ${attempt}/${API_MAX_RETRIES} for guild ${guildId}`);
          }
          
          const response = await axios.get(url, {
            headers: {
              'X-Bot-Api-Key': BOT_API_KEY,
              ...(SUPABASE_ANON_KEY ? { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } : {}),
            },
            timeout: API_TIMEOUT_MS,
            validateStatus: (status) => status === 200,
          });

          if (!response.data || typeof response.data !== 'object') {
            throw new Error('Invalid API response: missing data object');
          }

          return this._normalizePremiumData({
            has_premium: response.data.has_premium,
            tier: response.data.tier || response.data.plan_key,
            expires_at: response.data.expires_at || response.data.ends_at,
            lifetime: response.data.lifetime,
            owner_user_id: response.data.owner_user_id,
            _meta: {
              source: 'api',
              stale: false,
              unavailable: false,
            },
          });
        } catch (error) {
          lastError = error;
          
          const httpStatus = error.response?.status || null;
          const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
          const isNetworkError = error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED';
          const isServerError = httpStatus !== null && httpStatus >= 500;
          const shouldRetry = (isTimeout || isNetworkError || isServerError) && attempt < API_MAX_RETRIES;
          
          if (shouldRetry) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            logger.warn('premium.api', `API error (${error.message}), retrying in ${delay}ms`, { httpStatus, errorCode: error.code || null });
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          logger.warn('premium.api', `API request failed (not retrying)`, { attempt, httpStatus, errorCode: error.code || null, guildId });
          throw error;
        }
      }
      
      throw lastError;
    };

    try {
      const premiumData = await billingBreaker.execute(apiCall, { guildId });
      
      logger.info('premium.api', `Premium status fetched for guild ${guildId}`, {
        has_premium: premiumData.has_premium,
        tier: premiumData.tier,
        lifetime: premiumData.lifetime,
      });
      
      return premiumData;
    } catch (err) {
      if (err instanceof CircuitBreakerOpenError) {
        logger.warn('premium.circuit_breaker', err.message);
      }
      logger.error('premium.api', `All API attempts failed for guild ${guildId}`, {
        error: err?.message,
        httpStatus: err?.response?.status || null,
        errorCode: err?.code || null,
      });
    }
    
    const staleCache = await this.getStaleCacheFallback(guildId);
    if (staleCache) {
      logger.warn('premium.fallback', `Using stale cache for guild ${guildId} (API unavailable)`);
      return staleCache;
    }

    logger.warn('premium.fallback', `No fallback available for guild ${guildId}, using default status`);
    return this.getDefaultPremiumStatus({
      source: 'api_error',
      unavailable: true,
      errorCode: 'premium_status_unavailable',
    });
  }

  getDefaultPremiumStatus(meta = {}) {
    return {
      has_premium: false,
      tier: null,
      expires_at: null,
      lifetime: false,
      owner_user_id: null,
      _meta: {
        source: meta.source || 'default',
        stale: Boolean(meta.stale),
        unavailable: Boolean(meta.unavailable),
        errorCode: meta.errorCode || null,
      },
    };
  }

  async getStaleCacheFallback(guildId) {
    try {
      if (!this.db) {
        return null;
      }

      // ttl_expires_at is now set to STALE_CACHE_FALLBACK_MS (1hr), so documents
      // still present in MongoDB are within the stale fallback window.
      const staleCache = await this.db.collection('premium_cache').findOne({
        guild_id: guildId,
        ttl_expires_at: { $gt: new Date() }
      });

      if (staleCache) {
        if (staleCache.expires_at && !staleCache.lifetime) {
          const expiresDate = new Date(staleCache.expires_at);
          if (!Number.isNaN(expiresDate.getTime()) && expiresDate <= new Date()) {
            logger.warn('premiumService', 'Stale premium cache is expired, ignoring fallback', { guildId });
            return null;
          }
        }

        return this._normalizePremiumData({
          has_premium: staleCache.has_premium,
          tier: staleCache.tier,
          expires_at: staleCache.expires_at,
          lifetime: staleCache.lifetime,
          owner_user_id: staleCache.owner_user_id,
          _meta: {
            source: 'cache_stale',
            stale: true,
            unavailable: false,
          },
        });
      }

      return null;
    } catch (error) {
      logger.warn('premiumService', 'Error reading stale cache (non-critical)', { error: error?.message || String(error) });
      return null;
    }
  }

  async invalidateCache(guildId) {
    try {
      if (!this.db) {
        logger.warn('premiumService', 'Database not available, skipping cache invalidation');
        return;
      }

      if (!guildId || typeof guildId !== 'string') {
        logger.error('premiumService', 'Invalid guildId provided to invalidateCache', { guildId: String(guildId) });
        return;
      }

      await this.db.collection('premium_cache').deleteOne({ guild_id: guildId });
      logger.debug('premiumService', 'Invalidated premium cache', { guildId });
    } catch (error) {
      logger.warn('premiumService', 'Error invalidating premium cache (non-critical)', { error: error?.message || String(error) });
    }
  }

  async getPremiumTier(guildId) {
    const premium = await this.checkGuildPremium(guildId);
    return premium.tier;
  }

  async hasPremium(guildId) {
    const premium = await this.checkGuildPremium(guildId);
    return premium.has_premium;
  }

  async getPremiumGuilds() {
    try {
      // Only return guilds with fresh (non-stale) premium status
      const premiumGuilds = await this.db.collection('premium_cache')
        .find({
          has_premium: true,
          app_cache_expires_at: { $gt: new Date() }
        })
        .toArray();

      return premiumGuilds.map(g => g.guild_id);
    } catch (error) {
      logger.error('premiumService', 'Error fetching premium guilds', { error: error?.message || String(error) });
      return [];
    }
  }

  getTierFeatures(tier) {
    const features = {
      pro_monthly: {
        name: 'Pro Monthly',
        max_custom_commands: 50,
        max_auto_roles: 20,
        max_welcome_messages: 10,
        advanced_moderation: true,
        custom_embeds: true,
        priority_support: true,
        analytics: true,
      },
      pro_yearly: {
        name: 'Pro Yearly',
        max_custom_commands: 50,
        max_auto_roles: 20,
        max_welcome_messages: 10,
        advanced_moderation: true,
        custom_embeds: true,
        priority_support: true,
        analytics: true,
      },
      lifetime: {
        name: 'Lifetime',
        max_custom_commands: 100,
        max_auto_roles: 50,
        max_welcome_messages: 20,
        advanced_moderation: true,
        custom_embeds: true,
        priority_support: true,
        analytics: true,
        exclusive_features: true,
      },
    };

    return features[tier] || {
      name: 'Free',
      max_custom_commands: 5,
      max_auto_roles: 3,
      max_welcome_messages: 1,
      advanced_moderation: false,
      custom_embeds: false,
      priority_support: false,
      analytics: false,
    };
  }

  async checkFeatureAccess(guildId, feature) {
    if (!feature || typeof feature !== 'string') {
      logger.error('premiumService', 'Invalid feature name provided to checkFeatureAccess', { feature: String(feature) });
      return false;
    }

    const premium = await this.checkGuildPremium(guildId);
    
    if (!premium.has_premium) {
      return false;
    }

    const tierFeatures = this.getTierFeatures(premium.tier);
    
    if (!(feature in tierFeatures)) {
      logger.warn('premiumService', 'Unknown feature requested', { feature });
      return false;
    }

    const val = tierFeatures[feature];
    // Boolean true → access granted; positive number → has capacity; false/0/null → denied
    return val === true || (typeof val === 'number' && val > 0);
  }

  /**
   * Normalize and validate premium data shape
   * @private
   * @param {Object} data - Raw premium data
   * @returns {PremiumStatus}
   */
  _normalizePremiumData(data) {
    const VALID_TIERS = ['pro_monthly', 'pro_yearly', 'lifetime'];
    const tier = data?.tier || null;

    if (tier && !VALID_TIERS.includes(tier)) {
      logger.warn('premiumService', 'Unknown premium tier received', { tier, expectedTiers: VALID_TIERS.join(', ') });
    }

    return {
      has_premium: Boolean(data?.has_premium),
      tier,
      expires_at: data?.expires_at || null,
      lifetime: Boolean(data?.lifetime),
      owner_user_id: data?.owner_user_id || null,
      _meta: {
        source: data?._meta?.source || 'normalized',
        stale: Boolean(data?._meta?.stale),
        unavailable: Boolean(data?._meta?.unavailable),
        errorCode: data?._meta?.errorCode || null,
      },
    };
  }
}

const premiumService = new PremiumService();

module.exports = {
  premiumService,
  PremiumService,
};
