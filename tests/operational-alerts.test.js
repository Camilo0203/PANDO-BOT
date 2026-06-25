"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildDiscordPayload,
  resetOperationalAlertState,
  alertOnStateChange,
} = require("../src/utils/operationalAlerts");
const { normalizeEvent } = require("../src/utils/securityAuditLog");

test("operational alert payload redacts sensitive details", () => {
  const payload = buildDiscordPayload({
    type: "security.test",
    severity: "critical",
    title: "Security test",
    message: "Something happened",
    details: {
      token: "super-secret-token",
      password: "super-secret-password",
      guildId: "123",
    },
  });

  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes("super-secret-token"), false);
  assert.equal(serialized.includes("super-secret-password"), false);
  assert.equal(serialized.includes("[REDACTED]"), true);
  assert.equal(serialized.includes("123"), true);
});

test("security audit normalization redacts nested metadata", () => {
  const event = normalizeEvent({
    source: "test",
    action: "security.test",
    severity: "critical",
    metadata: {
      nested: {
        api_key: "secret-api-key",
        safe: "visible",
      },
    },
  });

  assert.equal(event.metadata.nested.api_key, "[REDACTED]");
  assert.equal(event.metadata.nested.safe, "visible");
  assert.equal(event.severity, "critical");
});

test("alertOnStateChange only alerts on transitions", async () => {
  resetOperationalAlertState();

  const initialOk = await alertOnStateChange("test:service", true, {
    type: "service.down",
    severity: "critical",
    title: "Service down",
  });
  assert.equal(initialOk.skipped, "initial-ok");

  const wentDown = await alertOnStateChange("test:service", false, {
    type: "service.down",
    severity: "critical",
    title: "Service down",
  });
  assert.equal(wentDown.skipped, false);

  const stillDown = await alertOnStateChange("test:service", false, {
    type: "service.down",
    severity: "critical",
    title: "Service down",
  });
  assert.equal(stillDown.skipped, "unchanged");

  const recovered = await alertOnStateChange("test:service", true, {
    type: "service.down",
    severity: "critical",
    title: "Service down",
  });
  assert.equal(recovered.skipped, false);
});
