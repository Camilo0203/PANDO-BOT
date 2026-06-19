"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const {
  mapEffectiveEntitlementRow,
} = require("../src/services/premiumService");

test("maps a yearly effective entitlement to the normal PRO contract", () => {
  const result = mapEffectiveEntitlementRow({
    effective_plan: "pro",
    plan_source: "stripe",
    billing_interval: "year",
    plan_expires_at: "2027-01-01T00:00:00.000Z",
  });

  assert.equal(result.has_premium, true);
  assert.equal(result.tier, "pro_yearly");
  assert.equal(result.expires_at, "2027-01-01T00:00:00.000Z");
  assert.equal(result.lifetime, false);
  assert.equal(result.plan_source, "stripe");
});

test("maps a lifetime Tebex entitlement without inventing an expiration", () => {
  const result = mapEffectiveEntitlementRow({
    effective_plan: "pro",
    plan_source: "tebex",
    billing_interval: null,
    plan_expires_at: null,
  });

  assert.equal(result.has_premium, true);
  assert.equal(result.tier, "lifetime");
  assert.equal(result.expires_at, null);
  assert.equal(result.lifetime, true);
  assert.equal(result.plan_source, "tebex");
});

test("maps missing or free rows to a safe FREE status", () => {
  for (const row of [null, { effective_plan: "free", plan_source: "free" }]) {
    const result = mapEffectiveEntitlementRow(row);
    assert.equal(result.has_premium, false);
    assert.equal(result.tier, null);
    assert.equal(result.lifetime, false);
  }
});

test("premium service prefers the effective view when service role is configured", async () => {
  const previous = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    BOT_API_KEY: process.env.BOT_API_KEY,
  };
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  process.env.BOT_API_KEY = "bot-api-test";

  const calls = [];
  const mockAxios = {
    get: async (url) => {
      calls.push(url);
      return {
        data: [{
          effective_plan: "pro",
          plan_source: "tebex",
          billing_interval: "month",
          plan_expires_at: "2026-07-14T00:00:00.000Z",
        }],
      };
    },
  };

  const servicePath = require.resolve("../src/services/premiumService");
  const originalLoad = Module._load;
  delete require.cache[servicePath];
  Module._load = function load(request, parent, isMain) {
    if (request === "axios") return mockAxios;
    return originalLoad(request, parent, isMain);
  };

  try {
    const { PremiumService: FreshPremiumService } = require(servicePath);
    const service = new FreshPremiumService();
    service.db = {
      collection: () => ({
        findOne: async () => null,
        updateOne: async () => ({ modifiedCount: 1 }),
      }),
    };
    service.initialized = true;

    const result = await service.fetchPremiumFromAPI("123456789012345678");

    assert.equal(calls.length, 1);
    assert.match(calls[0], /rest\/v1\/guild_effective_entitlements$/);
    assert.equal(result.has_premium, true);
    assert.equal(result.tier, "pro_monthly");
    assert.equal(result.plan_source, "tebex");
  } finally {
    Module._load = originalLoad;
    delete require.cache[servicePath];
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
