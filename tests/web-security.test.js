"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createDashboardApp, verifyApiKey } = require("../src/web/apps/dashboard");
const { isValidSentryDsn } = require("../src/utils/env");

test("dashboard API key comparison validates the complete secret", () => {
  const commonPrefix = "a".repeat(64);
  assert.equal(verifyApiKey(`${commonPrefix}left`, `${commonPrefix}right`), false);
  assert.equal(verifyApiKey(`${commonPrefix}same`, `${commonPrefix}same`), true);
  assert.equal(verifyApiKey("", "secret"), false);
});

test("Sentry DSN validation accepts standard and regional ingest hosts", () => {
  assert.equal(
    isValidSentryDsn("https://abcdef123456@o123456.ingest.sentry.io/987654"),
    true
  );
  assert.equal(
    isValidSentryDsn("https://abcdef123456@o123456.ingest.us.sentry.io/987654"),
    true
  );
  assert.equal(isValidSentryDsn("https://example.com/project"), false);
  assert.equal(isValidSentryDsn("not-a-url"), false);
});

test("dashboard serves its shell publicly and protects API routes", async (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousApiKey = process.env.DASH_API_KEY;
  process.env.NODE_ENV = "production";
  process.env.DASH_API_KEY = "dashboard-secret-for-test";

  const app = createDashboardApp({
    healthState: {},
    buildInfo: { version: "test", shortCommit: "test", deployTag: "test" },
    getClient: () => ({
      guilds: { cache: { size: 0, map: () => [] } },
      users: { cache: { size: 0 } },
      ws: { ping: 0 },
    }),
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousApiKey === undefined) delete process.env.DASH_API_KEY;
    else process.env.DASH_API_KEY = previousApiKey;
  });

  const { port } = server.address();
  const shellResponse = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(shellResponse.status, 200);
  assert.match(await shellResponse.text(), /TON618 Dashboard/);

  const unauthorizedResponse = await fetch(`http://127.0.0.1:${port}/api/stats`);
  assert.equal(unauthorizedResponse.status, 401);
  await unauthorizedResponse.text();

  const authorizedResponse = await fetch(`http://127.0.0.1:${port}/api/stats`, {
    headers: { "X-Api-Key": "dashboard-secret-for-test" },
  });
  assert.equal(authorizedResponse.status, 200);
  await authorizedResponse.text();
});
