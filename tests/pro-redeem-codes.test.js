"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const codeDocuments = new Map();
const redemptionDocuments = [];

function matchesCodeQuery(document, query) {
  if (document.code !== query.code) return false;
  if (query.redeemed !== undefined && document.redeemed !== query.redeemed) return false;
  if (query.revoked?.$ne === true && document.revoked === true) return false;
  if (Array.isArray(query.$or)) {
    const now = new Date();
    const expirationMatches = query.$or.some((entry) => {
      if (entry.expires_at === null) return document.expires_at === null;
      if (entry.expires_at?.$exists === false) return document.expires_at === undefined;
      if (entry.expires_at?.$gt) {
        return document.expires_at && new Date(document.expires_at) > now;
      }
      return false;
    });
    if (!expirationMatches) return false;
  }
  return true;
}

const fakeDb = {
  collection(name) {
    if (name === "pro_redeem_codes") {
      return {
        async insertOne(document) {
          codeDocuments.set(document.code, { ...document });
          return { insertedId: document.code };
        },
        async findOne(query) {
          return codeDocuments.get(query.code) || null;
        },
        async findOneAndUpdate(query, update) {
          const current = codeDocuments.get(query.code);
          if (!current || !matchesCodeQuery(current, query)) return null;
          const before = { ...current };
          codeDocuments.set(query.code, { ...current, ...update.$set });
          return before;
        },
      };
    }

    if (name === "pro_redemptions") {
      return {
        async insertOne(document) {
          redemptionDocuments.push({ ...document });
          return { insertedId: redemptionDocuments.length };
        },
      };
    }

    throw new Error(`Unexpected collection ${name}`);
  },
};

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === "./core" && parent?.filename?.endsWith("proRedeemCodes.js")) {
    return { getDB: () => fakeDb };
  }
  return originalLoad(request, parent, isMain);
};

delete require.cache[require.resolve("../src/utils/database/proRedeemCodes")];
const {
  createCode,
  validateCode,
  redeemCode,
} = require("../src/utils/database/proRedeemCodes");

test.after(() => {
  Module._load = originalLoad;
  delete require.cache[require.resolve("../src/utils/database/proRedeemCodes")];
});

test("stores Tebex purchase metadata and copies it into the redemption", async () => {
  await createCode({
    code: "ABCD-EFGH-IJKL",
    plan: "pro",
    duration_days: 31,
    tier: "pro_monthly",
    provider: "tebex",
    provider_order_id: "txn-100",
    provider_subscription_id: "tbx-rec-100",
    purchaser_user_id: "123456789012345678",
    source: "tebex_purchase",
  });

  const result = await redeemCode(
    "ABCD-EFGH-IJKL",
    "123456789012345678",
    "223456789012345678"
  );

  assert.equal(result.success, true);
  assert.equal(result.redemption.provider, "tebex");
  assert.equal(result.redemption.provider_order_id, "txn-100");
  assert.equal(result.redemption.provider_subscription_id, "tbx-rec-100");
  assert.equal(result.redemption.tier, "pro_monthly");
});

test("rejects a code revoked by a refund", async () => {
  await createCode({
    code: "WXYZ-2345-6789",
    plan: "pro",
    duration_days: null,
    provider: "tebex",
    provider_order_id: "txn-refunded",
  });
  codeDocuments.get("WXYZ-2345-6789").revoked = true;

  const validation = await validateCode("WXYZ-2345-6789");
  const redemption = await redeemCode(
    "WXYZ-2345-6789",
    "123456789012345678",
    "223456789012345678"
  );

  assert.equal(validation.valid, false);
  assert.equal(validation.reason, "revoked");
  assert.equal(redemption.success, false);
  assert.equal(redemption.error, "revoked");
});
