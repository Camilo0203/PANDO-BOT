"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const {
  createTebexApp,
  verifyTebexSignature,
  getPaymentPayload,
  extractPackages,
  extractDiscordIdentity,
  getProviderOrderId,
  getProviderSubscriptionId,
  getTierAndDuration,
  processGrantEvent,
  processRevokeEvent,
  GRANT_EVENTS,
  REVOKE_EVENTS,
} = require("../src/web/apps/tebex");

function signTebexBody(rawBody, secret) {
  const bodyHash = crypto.createHash("sha256").update(rawBody).digest("hex");
  return crypto.createHmac("sha256", secret).update(bodyHash).digest("hex");
}

async function withTebexServer(secret, callback) {
  const previousSecret = process.env.TEBEX_SECRET_KEY;
  process.env.TEBEX_SECRET_KEY = secret;

  const server = createTebexApp({ getClient: () => null }).listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (previousSecret === undefined) {
      delete process.env.TEBEX_SECRET_KEY;
    } else {
      process.env.TEBEX_SECRET_KEY = previousSecret;
    }
  }
}

test("validates the official Tebex SHA256 plus HMAC signature", () => {
  const secret = "test-secret";
  const rawBody = Buffer.from(JSON.stringify({ id: "evt-1", type: "payment.completed" }));
  const signature = signTebexBody(rawBody, secret);

  assert.equal(verifyTebexSignature(rawBody, signature, secret), true);
  assert.equal(verifyTebexSignature(rawBody, "0".repeat(64), secret), false);
});

test("accepts Tebex validation over HTTP with the untouched raw body", async () => {
  const secret = "test-http-secret";
  const rawBody = Buffer.from(JSON.stringify({
    id: "validation-id",
    type: "validation.webhook",
  }));

  await withTebexServer(secret, async (url) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature": signTebexBody(rawBody, secret),
      },
      body: rawBody,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: "validation-id" });
  });
});

test("rejects an invalid Tebex signature over HTTP", async () => {
  const rawBody = Buffer.from(JSON.stringify({
    id: "invalid-signature-id",
    type: "validation.webhook",
  }));

  await withTebexServer("test-http-secret", async (url) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature": "0".repeat(64),
      },
      body: rawBody,
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "invalid_signature" });
  });
});

test("rejects the legacy direct-body HMAC format", () => {
  const secret = "test-secret";
  const rawBody = Buffer.from('{"id":"evt-2"}');
  const legacySignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  assert.equal(verifyTebexSignature(rawBody, legacySignature, secret), false);
});

test("extracts Discord identity and products from payment.completed", () => {
  const body = {
    id: "evt-3",
    type: "payment.completed",
    subject: {
      transaction_id: "txn-1",
      recurring_payment_reference: "tbx-rec-1",
      customer: {
        username: {
          id: "123456789012345678",
          username: "buyer",
        },
      },
      products: [{ id: 7434172 }],
    },
  };

  assert.deepEqual(extractDiscordIdentity(body), {
    id: "123456789012345678",
    username: "buyer",
  });
  assert.equal(extractPackages(body).length, 1);
  assert.equal(getProviderOrderId(body), "txn-1");
  assert.equal(getProviderSubscriptionId(body), "tbx-rec-1");
});

test("uses last_payment data for recurring-payment webhooks", () => {
  const body = {
    id: "evt-4",
    type: "recurring-payment.renewed",
    subject: {
      reference: "tbx-rec-2",
      last_payment: {
        transaction_id: "txn-2",
        customer: {
          username: {
            id: "223456789012345678",
            username: "renewing-buyer",
          },
        },
        products: [{ id: 7434175 }],
      },
    },
  };

  assert.equal(getPaymentPayload(body), body.subject.last_payment);
  assert.equal(getProviderOrderId(body), "txn-2");
  assert.equal(getProviderSubscriptionId(body), "tbx-rec-2");
  assert.equal(extractPackages(body)[0].id, 7434175);
});

test("maps only configured PRO packages and exact lifecycle events", () => {
  assert.deepEqual(getTierAndDuration("7434172"), {
    tier: "pro_monthly",
    durationDays: 31,
  });
  assert.deepEqual(getTierAndDuration("7434175"), {
    tier: "pro_yearly",
    durationDays: 366,
  });
  assert.deepEqual(getTierAndDuration("7434185"), {
    tier: "lifetime",
    durationDays: null,
  });
  assert.equal(getTierAndDuration("donation"), null);

  assert.equal(GRANT_EVENTS.has("payment.completed"), true);
  assert.equal(GRANT_EVENTS.has("recurring-payment.renewed"), true);
  assert.equal(GRANT_EVENTS.has("recurring-payment.started"), false);
  assert.equal(REVOKE_EVENTS.has("payment.refunded"), true);
  assert.equal(REVOKE_EVENTS.has("payment.dispute.lost"), true);
  assert.equal(REVOKE_EVENTS.has("recurring-payment.ended"), true);
  assert.equal(REVOKE_EVENTS.has("payment.dispute.won"), false);
});

test("rejects a non-Discord Tebex username ID", () => {
  const body = {
    subject: {
      customer: {
        username: {
          id: "minecraft-player",
          username: "buyer",
        },
      },
      products: [{ id: 7434172 }],
    },
  };

  assert.deepEqual(extractDiscordIdentity(body), {
    id: null,
    username: "buyer",
  });
});

test("creates and delivers one idempotent purchase code per package", async () => {
  const created = [];
  const marked = [];
  const delivered = [];
  const body = {
    id: "evt-purchase",
    type: "payment.completed",
    subject: {
      transaction_id: "txn-purchase",
      customer: {
        username: {
          id: "123456789012345678",
          username: "buyer",
        },
      },
      products: [{ id: 7434172 }],
    },
  };

  await processGrantEvent({
    body,
    eventType: body.type,
    eventId: body.id,
    client: {},
    services: {
      claimEvent: async () => true,
      markEvent: async (...args) => marked.push(args),
      findAvailableCodeByProviderEffect: async () => null,
      findRedemptionByProvider: async () => null,
      generateCode: () => "ABCD-EFGH-IJKL",
      createCode: async (record) => {
        created.push(record);
        return record;
      },
      sendDirectMessage: async (_client, userId) => {
        delivered.push(userId);
        return true;
      },
    },
  });

  assert.equal(created.length, 1);
  assert.equal(created[0].provider, "tebex");
  assert.equal(created[0].provider_order_id, "txn-purchase");
  assert.equal(created[0].provider_effect_id, "txn-purchase:7434172:0");
  assert.equal(created[0].provider_package_id, "7434172");
  assert.deepEqual(delivered, ["123456789012345678"]);
  assert.deepEqual(marked.at(-1), ["tebex:grant:txn-purchase", "processed"]);
});

test("does not extend PRO twice when a retried renewal already redeemed its code", async () => {
  let redemptionCalls = 0;
  let deliveryCalls = 0;
  let createCalls = 0;
  const body = {
    id: "evt-renewal-retry",
    type: "recurring-payment.renewed",
    subject: {
      reference: "tbx-rec-retry",
      last_payment: {
        transaction_id: "txn-renewal-retry",
        products: [{ id: 7434172 }],
      },
    },
  };

  await processGrantEvent({
    body,
    eventType: body.type,
    eventId: body.id,
    client: {},
    services: {
      claimEvent: async () => true,
      markEvent: async () => {},
      findRedemptionByProvider: async () => ({
        redeemed_by: "123456789012345678",
        redeemed_guild_id: "223456789012345678",
      }),
      findAvailableCodeByProviderEffect: async () => ({
        code: "ABCD-EFGH-IJKL",
        redeemed: true,
      }),
      createCode: async () => {
        createCalls += 1;
      },
      processRedemption: async () => {
        redemptionCalls += 1;
        return { success: true };
      },
      sendDirectMessage: async () => {
        deliveryCalls += 1;
        return true;
      },
    },
  });

  assert.equal(createCalls, 0);
  assert.equal(redemptionCalls, 0);
  assert.equal(deliveryCalls, 0);
});

test("renews an already activated guild through the normal redemption service", async () => {
  const redemptions = [];
  const body = {
    id: "evt-renewal",
    type: "recurring-payment.renewed",
    subject: {
      reference: "tbx-rec-200",
      last_payment: {
        transaction_id: "txn-renewal",
        products: [{ id: 7434175 }],
      },
    },
  };

  await processGrantEvent({
    body,
    eventType: body.type,
    eventId: body.id,
    client: {},
    services: {
      claimEvent: async () => true,
      markEvent: async () => {},
      findRedemptionByProvider: async () => ({
        redeemed_by: "123456789012345678",
        redeemed_guild_id: "223456789012345678",
      }),
      findAvailableCodeByProviderEffect: async () => null,
      generateCode: () => "WXYZ-2345-6789",
      createCode: async (record) => record,
      processRedemption: async (...args) => {
        redemptions.push(args);
        return { success: true };
      },
      sendDirectMessage: async () => true,
    },
  });

  assert.equal(redemptions.length, 1);
  assert.deepEqual(redemptions[0].slice(0, 3), [
    "WXYZ-2345-6789",
    "123456789012345678",
    "223456789012345678",
  ]);
});

test("keeps the idempotent code available for retry when purchase DM delivery fails", async () => {
  const created = [];
  const marked = [];
  const body = {
    id: "evt-dm-failure",
    type: "payment.completed",
    subject: {
      transaction_id: "txn-dm-failure",
      customer: {
        username: {
          id: "123456789012345678",
          username: "buyer",
        },
      },
      products: [{ id: 7434172 }],
    },
  };

  await assert.rejects(
    processGrantEvent({
      body,
      eventType: body.type,
      eventId: body.id,
      client: {},
      services: {
        claimEvent: async () => true,
        markEvent: async (...args) => marked.push(args),
        findAvailableCodeByProviderEffect: async () => null,
        findRedemptionByProvider: async () => null,
        generateCode: () => "FAIL-2345-6789",
        createCode: async (record) => {
          created.push(record);
          return record;
        },
        sendDirectMessage: async () => false,
      },
    }),
    /Could not deliver/
  );

  assert.equal(created.length, 1);
  assert.equal(created[0].provider_effect_id, "txn-dm-failure:7434172:0");
  assert.equal(marked.at(-1)[1], "failed");
});

test("reuses the pending code on a delivery retry instead of creating a duplicate", async () => {
  let createCalls = 0;
  const delivered = [];
  const body = {
    id: "evt-dm-retry",
    type: "payment.completed",
    subject: {
      transaction_id: "txn-dm-retry",
      customer: {
        username: {
          id: "123456789012345678",
          username: "buyer",
        },
      },
      products: [{ id: 7434172 }],
    },
  };

  await processGrantEvent({
    body,
    eventType: body.type,
    eventId: body.id,
    client: {},
    services: {
      claimEvent: async () => true,
      markEvent: async () => {},
      findAvailableCodeByProviderEffect: async () => ({
        code: "RETR-Y234-5678",
        redeemed: false,
      }),
      findRedemptionByProvider: async () => null,
      createCode: async () => {
        createCalls += 1;
      },
      sendDirectMessage: async (_client, userId) => {
        delivered.push(userId);
        return true;
      },
    },
  });

  assert.equal(createCalls, 0);
  assert.deepEqual(delivered, ["123456789012345678"]);
});

test("refund revokes pending codes and the redeemed guild entitlement", async () => {
  const calls = [];
  const body = {
    id: "evt-refund",
    type: "payment.refunded",
    subject: {
      transaction_id: "txn-refund",
      customer: {
        username: {
          id: "123456789012345678",
          username: "buyer",
        },
      },
      products: [{ id: 7434172 }],
    },
  };

  await processRevokeEvent({
    body,
    eventType: body.type,
    client: {},
    services: {
      findRedemptionByProvider: async () => ({
        code: "REFU-NDED-CODE",
        redeemed_by: "123456789012345678",
        redeemed_guild_id: "223456789012345678",
      }),
      revokeProviderCodes: async (lookup) => calls.push(["codes", lookup]),
      revokeTebexEntitlement: async (guildId, reason, redemption) => {
        calls.push(["entitlement", guildId, reason, redemption.code]);
      },
      sendDirectMessage: async (_client, userId) => {
        calls.push(["dm", userId]);
        return true;
      },
    },
  });

  assert.equal(calls[0][0], "codes");
  assert.deepEqual(calls[1], [
    "entitlement",
    "223456789012345678",
    "tebex:payment.refunded",
    "REFU-NDED-CODE",
  ]);
  assert.deepEqual(calls[2], ["dm", "123456789012345678"]);
  assert.equal(calls[0][1].orderId, "txn-refund");
  assert.equal(calls[0][1].subscriptionId, null);
});

test("recurring-payment.ended revokes by subscription reference", async () => {
  const lookups = [];
  const body = {
    id: "evt-ended",
    type: "recurring-payment.ended",
    subject: {
      reference: "tbx-rec-ended",
      last_payment: {
        transaction_id: "txn-last",
        products: [{ id: 7434172 }],
      },
    },
  };

  await processRevokeEvent({
    body,
    eventType: body.type,
    client: {},
    services: {
      findRedemptionByProvider: async (lookup) => {
        lookups.push(["find", lookup]);
        return {
          code: "ENDD-2345-6789",
          redeemed_by: "123456789012345678",
          redeemed_guild_id: "223456789012345678",
          provider_subscription_id: "tbx-rec-ended",
        };
      },
      revokeProviderCodes: async (lookup) => lookups.push(["codes", lookup]),
      revokeTebexEntitlement: async () => ({ success: true }),
      sendDirectMessage: async () => true,
    },
  });

  assert.equal(lookups[0][1].subscriptionId, "tbx-rec-ended");
  assert.equal(lookups[0][1].orderId, null);
  assert.equal(lookups[1][1].subscriptionId, "tbx-rec-ended");
});
