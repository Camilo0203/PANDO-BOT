"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_PRO_STORE_URL,
  getProStoreHostname,
  getProStoreUrl,
} = require("../src/utils/proStore");

test("uses the canonical Tebex store when no override exists", () => {
  assert.equal(getProStoreUrl({}), DEFAULT_PRO_STORE_URL);
  assert.equal(getProStoreHostname(DEFAULT_PRO_STORE_URL), "store.ton618bot.xyz");
});

test("prefers the dedicated Tebex store override", () => {
  assert.equal(
    getProStoreUrl({
      TEBEX_STORE_URL: "https://custom-store.example.com/",
      PRO_UPGRADE_URL: "https://legacy.example.com/",
    }),
    "https://custom-store.example.com/"
  );
});

test("rejects Discord invite links as purchase destinations", () => {
  assert.equal(
    getProStoreUrl({ PRO_UPGRADE_URL: "https://discord.gg/ton618" }),
    DEFAULT_PRO_STORE_URL
  );
});

test("keeps a valid custom HTTPS commercial URL", () => {
  assert.equal(
    getProStoreUrl({ PRO_UPGRADE_URL: "https://billing.example.com/pro" }),
    "https://billing.example.com/pro"
  );
});
