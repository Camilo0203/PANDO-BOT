const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveHealthUrl,
  shouldAllowDegraded,
  validateHealthPayload,
} = require("../scripts/ops-smoke-check");

test("resolveHealthUrl prioriza argumento posicional", () => {
  const url = resolveHealthUrl(
    ["node", "ops-smoke-check.js", "https://health.example.com/health"],
    {}
  );

  assert.equal(url, "https://health.example.com/health");
});

test("shouldAllowDegraded soporta flag explicito", () => {
  assert.equal(
    shouldAllowDegraded(["node", "ops-smoke-check.js", "--allow-degraded"], {}),
    true
  );
});

test("validateHealthPayload exige status ok por defecto", () => {
  assert.throws(
    () => validateHealthPayload({
      status: "degraded",
      fingerprint: "v3.0.0|abc123",
      mongoConnected: true,
      discordReady: true,
      shuttingDown: false,
    }),
    /Unexpected health status/
  );
});

test("validateHealthPayload falla si Mongo o Discord no estan listos", () => {
  assert.throws(
    () => validateHealthPayload({
      status: "ok",
      fingerprint: "v3.0.0|abc123",
      mongoConnected: false,
      discordReady: true,
      shuttingDown: false,
    }),
    /MongoDB is not connected/
  );

  assert.throws(
    () => validateHealthPayload({
      status: "ok",
      fingerprint: "v3.0.0|abc123",
      mongoConnected: true,
      discordReady: false,
      shuttingDown: false,
    }),
    /Discord is not ready/
  );
});
