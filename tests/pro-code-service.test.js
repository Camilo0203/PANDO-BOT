"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildTebexRevocationFilter,
  shouldRevokeCurrentTebexPlan,
} = require("../src/utils/proCodeService");

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
