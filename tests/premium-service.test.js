const test = require("node:test");
const assert = require("node:assert/strict");

// Import PremiumService class directly
const { PremiumService } = require('../src/services/premiumService');

test("premiumService.getCachedPremium devuelve lifetime correctamente", async () => {
  const cachedData = {
    guild_id: 'guild-123',
    has_premium: true,
    tier: 'lifetime',
    expires_at: null,
    lifetime: true,
    ttl_expires_at: new Date(Date.now() + 300000),
  };

  const testDb = {
    collection: () => ({
      findOne: async (query) => {
        if (query.guild_id === 'guild-123') return cachedData;
        return null;
      },
    }),
  };

  const service = new PremiumService();
  service.db = testDb;
  service.initialized = true;

  const result = await service.getCachedPremium('guild-123');

  assert.equal(result.has_premium, true);
  assert.equal(result.tier, 'lifetime');
  assert.equal(result.lifetime, true);
  assert.equal(result.expires_at, null);
});

test("premiumService.getCachedPremium devuelve lifetime=false cuando no está en cache", async () => {
  const cachedData = {
    guild_id: 'guild-456',
    has_premium: true,
    tier: 'pro_monthly',
    expires_at: '2026-12-31T23:59:59Z',
    ttl_expires_at: new Date(Date.now() + 300000),
  };

  const testDb = {
    collection: () => ({
      findOne: async (query) => {
        if (query.guild_id === 'guild-456') return cachedData;
        return null;
      },
    }),
  };

  const service = new PremiumService();
  service.db = testDb;
  service.initialized = true;

  const result = await service.getCachedPremium('guild-456');

  assert.equal(result.has_premium, true);
  assert.equal(result.tier, 'pro_monthly');
  assert.equal(result.lifetime, false);
});

test("premiumService.invalidateCache no usa this.cache inexistente", async () => {
  let deleteOneCalled = false;
  const testDb = {
    collection: () => ({
      deleteOne: async (query) => {
        deleteOneCalled = true;
        assert.equal(query.guild_id, 'guild-789');
        return { deletedCount: 1 };
      },
    }),
  };

  const service = new PremiumService();
  service.db = testDb;
  service.initialized = true;

  await service.invalidateCache('guild-789');

  assert.equal(deleteOneCalled, true);
});

test("premiumService.fetchPremiumFromAPI devuelve default cuando faltan env vars", async () => {
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalBotApiKey = process.env.BOT_API_KEY;

  delete process.env.SUPABASE_URL;
  delete process.env.BOT_API_KEY;

  const mockDb = {
    collection: () => ({
      findOne: async () => null,
    }),
  };

  const service = new PremiumService();
  service.db = mockDb;
  service.initialized = true;

  const result = await service.fetchPremiumFromAPI('guild-no-env');

  assert.equal(result.has_premium, false);
  assert.equal(result.tier, null);
  assert.equal(result.expires_at, null);
  assert.equal(result.lifetime, false);

  if (originalSupabaseUrl) process.env.SUPABASE_URL = originalSupabaseUrl;
  if (originalBotApiKey) process.env.BOT_API_KEY = originalBotApiKey;
});

test("premiumService.getStaleCacheFallback devuelve datos cuando existe cache reciente", async () => {
  const staleData = {
    guild_id: 'guild-stale',
    has_premium: true,
    tier: 'pro_yearly',
    expires_at: '2026-06-30T23:59:59Z',
    lifetime: false,
    cached_at: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
  };

  const testDb = {
    collection: () => ({
      findOne: async (query) => {
        // New code queries by ttl_expires_at (not cached_at)
        if (query.guild_id === 'guild-stale' && query.ttl_expires_at) {
          return staleData;
        }
        return null;
      },
    }),
  };

  const service = new PremiumService();
  service.db = testDb;
  service.initialized = true;

  const result = await service.getStaleCacheFallback('guild-stale');

  assert.equal(result.has_premium, true);
  assert.equal(result.tier, 'pro_yearly');
  assert.equal(result.lifetime, false);
});

test("premiumService.getDefaultPremiumStatus devuelve estructura correcta", () => {
  const service = new PremiumService();

  const result = service.getDefaultPremiumStatus();

  assert.equal(result.has_premium, false);
  assert.equal(result.tier, null);
  assert.equal(result.expires_at, null);
  assert.equal(result.lifetime, false);
  assert.equal(result.owner_user_id, null);
});

test("premiumService.cachePremiumStatus guarda lifetime correctamente", async () => {
  let savedData = null;

  const testDb = {
    collection: () => ({
      updateOne: async (filter, update, options) => {
        savedData = update.$set;
        return { modifiedCount: 1 };
      },
    }),
  };

  const service = new PremiumService();
  service.db = testDb;
  service.initialized = true;

  const premiumData = {
    has_premium: true,
    tier: 'lifetime',
    expires_at: null,
    lifetime: true,
    plan_source: 'tebex',
  };

  await service.cachePremiumStatus('guild-cache-test', premiumData);

  assert.equal(savedData.guild_id, 'guild-cache-test');
  assert.equal(savedData.has_premium, true);
  assert.equal(savedData.tier, 'lifetime');
  assert.equal(savedData.lifetime, true);
  assert.equal(savedData.expires_at, null);
  assert.equal(savedData.plan_source, 'tebex');
  // Verify the two-field TTL split (key fix for stale cache bug)
  assert.ok(savedData.app_cache_expires_at instanceof Date, 'app_cache_expires_at should be a Date');
  assert.ok(savedData.ttl_expires_at instanceof Date, 'ttl_expires_at should be a Date');
  assert.ok(savedData.app_cache_expires_at > new Date(), 'app_cache_expires_at should be in the future');
  // app_cache_expires_at (5min) must be strictly earlier than ttl_expires_at (1hr)
  assert.ok(savedData.app_cache_expires_at < savedData.ttl_expires_at, 'stale TTL must outlive fresh TTL');
});

test("premiumService.getTierFeatures devuelve features correctos por tier", () => {
  const service = new PremiumService();

  const lifetimeFeatures = service.getTierFeatures('lifetime');
  assert.equal(lifetimeFeatures.name, 'Lifetime');
  assert.equal(lifetimeFeatures.max_custom_commands, 100);
  assert.equal(lifetimeFeatures.exclusive_features, true);

  const proFeatures = service.getTierFeatures('pro_monthly');
  assert.equal(proFeatures.name, 'Pro Monthly');
  assert.equal(proFeatures.max_custom_commands, 50);

  const freeFeatures = service.getTierFeatures(null);
  assert.equal(freeFeatures.name, 'Free');
  assert.equal(freeFeatures.max_custom_commands, 5);
  assert.equal(freeFeatures.advanced_moderation, false);
});
