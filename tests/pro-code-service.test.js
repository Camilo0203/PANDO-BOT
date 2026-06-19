"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildPremiumCacheWindow,
  buildTebexRevocationFilter,
  shouldRevokeCurrentTebexPlan,
} = require("../src/utils/proCodeService");

test("activation cache uses the standard fresh and stale windows", () => {
  const now = new Date("2026-06-14T00:00:00.000Z");
  const window = buildPremiumCacheWindow(now, {});

  assert.equal(
    window.appCacheExpiresAt.toISOString(),
    "2026-06-14T00:05:00.000Z"
  );
  assert.equal(
    window.ttlExpiresAt.toISOString(),
    "2026-06-14T01:00:00.000Z"
  );
});

test("activation cache keeps stale fallback at least as long as fresh TTL", () => {
  const now = new Date("2026-06-14T00:00:00.000Z");
  const window = buildPremiumCacheWindow(now, {
    PREMIUM_CACHE_TTL_MS: "600000",
    PREMIUM_STALE_CACHE_MS: "300000",
  });

  assert.equal(
    window.appCacheExpiresAt.toISOString(),
    "2026-06-14T00:10:00.000Z"
  );
  assert.equal(
    window.ttlExpiresAt.toISOString(),
    "2026-06-14T00:10:00.000Z"
  );
});

test("refunds target the exact Tebex order", () => {
  assert.equal(
    buildTebexRevocationFilter(
      {
        provider_order_id: "txn-100",
        provider_subscription_id: "tbx-rec-100",
      },
      "tebex:payment.refunded"
    ),
    "provider_order_id=eq.txn-100"
  );
});

test("subscription endings target the recurring reference", () => {
  assert.equal(
    buildTebexRevocationFilter(
      {
        provider_order_id: "txn-100",
        provider_subscription_id: "tbx-rec-100",
      },
      "tebex:recurring-payment.ended"
    ),
    "provider_subscription_id=eq.tbx-rec-100"
  );
});

test("unscoped revocations are rejected", () => {
  assert.equal(buildTebexRevocationFilter({}, "tebex:payment.refunded"), null);
});

test("the activation created by the refunded code can be revoked", () => {
  assert.equal(
    shouldRevokeCurrentTebexPlan(
      "redeem:ABCD-EFGH-IJKL",
      { code: "ABCD-EFGH-IJKL" },
      false
    ),
    true
  );
});

test("an older purchase cannot remove a newer or manual plan", () => {
  assert.equal(
    shouldRevokeCurrentTebexPlan(
      "redeem:NEWC-ODE2-3456",
      { code: "OLDC-ODE1-2345" },
      false
    ),
    false
  );
  assert.equal(
    shouldRevokeCurrentTebexPlan(
      "owner_debug",
      { code: "OLDC-ODE1-2345" },
      true
    ),
    false
  );
});

test("a matching Supabase Tebex projection can be revoked", () => {
  assert.equal(
    shouldRevokeCurrentTebexPlan(
      "supabase_tebex",
      { code: "ABCD-EFGH-IJKL" },
      true
    ),
    true
  );
});
