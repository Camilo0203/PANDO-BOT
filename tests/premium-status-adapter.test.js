const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");

let currentPremium = {
  has_premium: false,
  tier: null,
  expires_at: null,
  lifetime: false,
  owner_user_id: null,
  _meta: {
    source: "default",
    stale: false,
    unavailable: false,
    errorCode: null,
  },
};

const mockPremiumService = {
  checkGuildPremium: async () => currentPremium,
};

const originalLoad = Module._load;
Module._load = function (request, parent) {
  if (request === "../services/premiumService") {
    return { premiumService: mockPremiumService };
  }

  return originalLoad(request, parent);
};

delete require.cache[require.resolve("../src/utils/premiumStatus")];
const {
  isPremiumStatusUnavailable,
  resolveGuildPremiumStatus,
} = require("../src/utils/premiumStatus");

test.after(() => {
  Module._load = originalLoad;
  delete require.cache[require.resolve("../src/utils/premiumStatus")];
});

test("resolveGuildPremiumStatus adapta premium activo al shape legacy esperado", async () => {
  currentPremium = {
    has_premium: true,
    tier: "pro_monthly",
    expires_at: "2027-01-15T00:00:00Z",
    lifetime: false,
    owner_user_id: "owner-123",
    plan_source: "tebex",
    _meta: {
      source: "api",
      stale: false,
      unavailable: false,
      errorCode: null,
    },
  };

  const status = await resolveGuildPremiumStatus("guild-pro");

  assert.equal(status.isPro, true);
  assert.equal(status.plan, "pro_monthly");
  assert.equal(status.tier, "pro_monthly");
  assert.equal(status.tierLabel, "PRO Monthly");
  assert.equal(status.planExpiresAt, "2027-01-15T00:00:00Z");
  assert.equal(status.ownerUserId, "owner-123");
  assert.equal(status.planSource, "tebex");
  assert.equal(status.error, null);
  assert.equal(status.daysUntil > 0, true);
});

test("resolveGuildPremiumStatus marca unavailable cuando premiumService no pudo verificar", async () => {
  currentPremium = {
    has_premium: false,
    tier: null,
    expires_at: null,
    lifetime: false,
    owner_user_id: null,
    _meta: {
      source: "api_error",
      stale: false,
      unavailable: true,
      errorCode: "premium_status_unavailable",
    },
  };

  const status = await resolveGuildPremiumStatus("guild-error");

  assert.equal(status.isPro, false);
  assert.equal(status.tierLabel, "FREE");
  assert.equal(status.error, "premium_status_unavailable");
  assert.equal(isPremiumStatusUnavailable(status), true);
});
