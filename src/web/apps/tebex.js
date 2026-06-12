"use strict";

const express = require("express");
const crypto = require("crypto");
const { EmbedBuilder } = require("discord.js");
const { getDB } = require("../../utils/database");
const {
  generateCode,
  processRedemption,
  revokeTebexEntitlement,
} = require("../../utils/proCodeService");
const {
  createCode,
  findRedemptionByProvider,
  revokeProviderCodes,
} = require("../../utils/database/proRedeemCodes");
const logger = require("../../utils/structuredLogger");

const WEBHOOK_EVENTS_COLLECTION = "webhook_events";
const GRANT_EVENTS = new Set(["payment.completed", "recurring-payment.renewed"]);
const REVOKE_EVENTS = new Set([
  "payment.refunded",
  "payment.dispute.lost",
  "recurring-payment.ended",
]);
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

const DEFAULT_PACKAGE_TIER_MAP = Object.freeze({
  "7434172": "pro_monthly",
  "7434175": "pro_yearly",
  "7434185": "lifetime",
});

function getPackageTierMap() {
  const raw = String(process.env.TEBEX_PACKAGE_TIER_MAP || "").trim();
  if (!raw) return { ...DEFAULT_PACKAGE_TIER_MAP };

  try {
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PACKAGE_TIER_MAP,
      ...Object.fromEntries(
        Object.entries(parsed).filter(([, tier]) =>
          ["pro_monthly", "pro_yearly", "lifetime"].includes(tier)
        )
      ),
    };
  } catch (error) {
    logger.warn("tebex", "Invalid TEBEX_PACKAGE_TIER_MAP; using defaults", {
      error: error?.message || String(error),
    });
    return { ...DEFAULT_PACKAGE_TIER_MAP };
  }
}

function verifyTebexSignature(rawBody, signature, secret) {
  if (!secret || !signature || !Buffer.isBuffer(rawBody)) return false;

  const bodyHash = crypto.createHash("sha256").update(rawBody).digest("hex");
  const expected = crypto.createHmac("sha256", secret).update(bodyHash).digest("hex");
  const provided = String(signature).trim().toLowerCase();

  if (!/^[a-f0-9]{64}$/.test(provided)) return false;
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(provided, "hex")
  );
}

function getSubject(body) {
  return body?.subject || body?.payload || body || {};
}

function getPaymentPayload(body) {
  const subject = getSubject(body);
  return subject?.last_payment || subject?.initial_payment || subject;
}

function extractPackages(body) {
  const payment = getPaymentPayload(body);
  return payment?.products || payment?.packages || payment?.items || [];
}

function extractGuildId(body) {
  const subject = getSubject(body);
  const payment = getPaymentPayload(body);
  const custom = subject?.custom || subject?.variables || payment?.custom || payment?.variables || {};
  return custom?.guild_id
    ? String(custom.guild_id)
    : custom?.server_id
      ? String(custom.server_id)
      : body?.guild_id
        ? String(body.guild_id)
        : null;
}

function extractPackageVariable(packages, names) {
  for (const pkg of packages) {
    const variables = pkg?.variables || pkg?.custom_fields || [];
    if (!Array.isArray(variables)) continue;

    const match = variables.find((entry) => {
      const key = String(entry?.identifier || entry?.name || "").toLowerCase();
      return names.includes(key);
    });
    const value = match?.option || match?.value;
    if (value) return String(value);
  }
  return null;
}

function extractDiscordIdentity(body, packages = extractPackages(body)) {
  const payment = getPaymentPayload(body);
  const subject = getSubject(body);
  const customer = payment?.customer || subject?.customer || {};
  const player = payment?.player || subject?.player || {};
  const username = customer?.username || player?.username || {};

  const id = username?.id
    || customer?.discord_id
    || customer?.uuid
    || customer?.id
    || player?.discord_id
    || player?.uuid
    || player?.id
    || extractPackageVariable(packages, ["discord_id", "discord_user_id"]);

  const displayName = username?.username
    || (typeof customer?.username === "string" ? customer.username : null)
    || (typeof player?.username === "string" ? player.username : null)
    || null;

  return {
    id: id ? String(id) : null,
    username: displayName ? String(displayName) : null,
  };
}

function getProviderOrderId(body) {
  const payment = getPaymentPayload(body);
  return payment?.transaction_id
    ? String(payment.transaction_id)
    : payment?.id
      ? String(payment.id)
      : null;
}

function getProviderSubscriptionId(body) {
  const subject = getSubject(body);
  const payment = getPaymentPayload(body);
  const reference = subject?.reference
    || subject?.recurring_payment_reference
    || payment?.recurring_payment_reference
    || payment?.recurring_payment?.reference;
  return reference ? String(reference) : null;
}

function getTierAndDuration(packageId, packageTierMap = DEFAULT_PACKAGE_TIER_MAP) {
  const tier = packageTierMap[String(packageId)];
  if (!tier) return null;
  if (tier === "lifetime") return { tier, durationDays: null };
  if (tier === "pro_monthly") return { tier, durationDays: 31 };
  if (tier === "pro_yearly") return { tier, durationDays: 366 };
  return null;
}

function buildPurchaseEmbed({ code, tier, renewal = false }) {
  const plan = tier === "lifetime"
    ? "Lifetime / De por vida"
    : tier === "pro_yearly"
      ? "Yearly / Anual"
      : "Monthly / Mensual";

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(renewal ? "TON618 PRO renewed / PRO renovado" : "Purchase confirmed / Compra confirmada")
    .setDescription(
      renewal
        ? "Your PRO access was extended automatically.\nTu acceso PRO se extendi\u00f3 autom\u00e1ticamente."
        : [
            "Your activation code is ready:",
            "Tu c\u00f3digo de activaci\u00f3n est\u00e1 listo:",
            "",
            `**Code / C\u00f3digo:** \`${code}\``,
            "",
            "Run `/premium activate` in the Discord server you own.",
            "Usa `/premium activate` en el servidor de Discord que administras.",
          ].join("\n")
    )
    .addFields({ name: "Plan", value: plan, inline: true })
    .setFooter({ text: "TON618 PRO" })
    .setTimestamp();
}

function buildRevocationEmbed() {
  return new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle("PRO deactivated / PRO desactivado")
    .setDescription(
      "The related payment or subscription was refunded, disputed, or ended. PRO access was removed.\n"
      + "El pago o la suscripci\u00f3n fue reembolsado, disputado o finaliz\u00f3. El acceso PRO fue retirado."
    )
    .setFooter({ text: "TON618 PRO" })
    .setTimestamp();
}

async function sendDirectMessage(client, userId, embed) {
  if (!client || !userId) return false;
  try {
    const user = await client.users.fetch(userId);
    await user.send({ embeds: [embed] });
    return true;
  } catch (error) {
    logger.warn("tebex", "Could not send purchase DM", {
      userId,
      error: error?.message || String(error),
    });
    return false;
  }
}

async function claimEvent(eventId, eventType) {
  const db = getDB();
  if (!db) throw new Error("MongoDB is unavailable");

  const now = new Date();
  const staleBefore = new Date(now.getTime() - PROCESSING_TIMEOUT_MS);

  try {
    const result = await db.collection(WEBHOOK_EVENTS_COLLECTION).findOneAndUpdate(
      {
        payment_id: eventId,
        $or: [
          { status: { $exists: false } },
          { status: "failed" },
          { status: "processing", updated_at: { $lt: staleBefore } },
        ],
      },
      {
        $setOnInsert: {
          payment_id: eventId,
          event_type: eventType,
          created_at: now,
        },
        $set: {
          status: "processing",
          updated_at: now,
          last_error: null,
        },
      },
      { upsert: true, returnDocument: "after" }
    );
    return Boolean(result);
  } catch (error) {
    if (error?.code === 11000) return false;
    throw error;
  }
}

async function markEvent(eventId, status, error = null) {
  const db = getDB();
  if (!db) return;
  await db.collection(WEBHOOK_EVENTS_COLLECTION).updateOne(
    { payment_id: eventId },
    {
      $set: {
        status,
        updated_at: new Date(),
        processed_at: status === "processed" ? new Date() : null,
        last_error: error ? String(error).slice(0, 300) : null,
      },
    }
  );
}

async function processGrantEvent({ body, eventType, eventId, client, packageTierMap }) {
  const packages = extractPackages(body);
  const identity = extractDiscordIdentity(body, packages);
  const providerOrderId = getProviderOrderId(body) || eventId;
  const providerSubscriptionId = getProviderSubscriptionId(body);
  const paymentSequence = String(getPaymentPayload(body)?.payment_sequence || "").toLowerCase();
  const effectId = `tebex:grant:${providerOrderId}`;
  const effectClaimed = await claimEvent(effectId, eventType);
  if (!effectClaimed) {
    logger.info("tebex", "Duplicate purchase effect ignored", { eventType, providerOrderId });
    return;
  }

  const renewalSignal = eventType === "recurring-payment.renewed"
    || (providerSubscriptionId && paymentSequence === "recurring");
  let previousRedemption = null;

  if (renewalSignal && providerSubscriptionId) {
    previousRedemption = await findRedemptionByProvider({
      provider: "tebex",
      subscriptionId: providerSubscriptionId,
    });
  }
  const isRenewal = Boolean(renewalSignal && previousRedemption);

  try {
    if (!identity.id && !previousRedemption?.redeemed_by) {
      throw new Error("Tebex payment has no Discord user ID");
    }

    let processedPackages = 0;

    for (const pkg of packages) {
      const packageId = String(pkg?.id || pkg?.package_id || "");
      const tierInfo = getTierAndDuration(packageId, packageTierMap);
      if (!tierInfo) {
        logger.info("tebex", "Ignoring package without a PRO tier mapping", { packageId, eventId });
        continue;
      }

      const code = generateCode(12);
      await createCode({
        code,
        plan: "pro",
        tier: tierInfo.tier,
        duration_days: tierInfo.durationDays,
        created_by: "tebex_webhook",
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        notes: `Tebex ${tierInfo.tier} event=${eventId}`,
        source: isRenewal ? "tebex_renewal" : "tebex_purchase",
        provider: "tebex",
        provider_order_id: providerOrderId,
        provider_subscription_id: providerSubscriptionId,
        purchaser_user_id: identity.id || previousRedemption?.redeemed_by || null,
      });

      if (isRenewal) {
        const result = await processRedemption(
          code,
          previousRedemption.redeemed_by,
          previousRedemption.redeemed_guild_id,
          client
        );
        if (!result.success) {
          throw new Error(`Automatic renewal activation failed: ${result.error}`);
        }
        await sendDirectMessage(
          client,
          previousRedemption.redeemed_by,
          buildPurchaseEmbed({ code, tier: tierInfo.tier, renewal: true })
        );
      } else {
        const sent = await sendDirectMessage(
          client,
          identity.id,
          buildPurchaseEmbed({ code, tier: tierInfo.tier, renewal: false })
        );
        if (!sent) {
          await revokeProviderCodes({
            provider: "tebex",
            orderId: providerOrderId,
            reason: "delivery_failed",
          });
          throw new Error("Could not deliver the Tebex activation code by Discord DM");
        }
      }

      processedPackages += 1;
    }

    if (processedPackages === 0) {
      logger.info("tebex", "Webhook contained no mapped PRO packages", { eventType, eventId });
    }

    await markEvent(effectId, "processed");
  } catch (error) {
    await markEvent(effectId, "failed", error?.message || String(error)).catch(() => {});
    throw error;
  }
}

async function processRevokeEvent({ body, eventType, client }) {
  const packages = extractPackages(body);
  const identity = extractDiscordIdentity(body, packages);
  const providerOrderId = getProviderOrderId(body);
  const providerSubscriptionId = getProviderSubscriptionId(body);
  const lookup = {
    provider: "tebex",
    orderId: providerOrderId,
    subscriptionId: providerSubscriptionId,
  };
  const redemption = await findRedemptionByProvider(lookup);

  await revokeProviderCodes({
    ...lookup,
    reason: eventType,
  });

  if (redemption?.redeemed_guild_id) {
    await revokeTebexEntitlement(redemption.redeemed_guild_id, `tebex:${eventType}`);
  } else {
    logger.warn("tebex", "No redeemed guild found for revocation event", {
      eventType,
      providerOrderId,
      providerSubscriptionId,
    });
  }

  await sendDirectMessage(
    client,
    redemption?.redeemed_by || identity.id,
    buildRevocationEmbed()
  );
}

function createTebexApp({ getClient }) {
  const app = express();
  const secret = process.env.TEBEX_SECRET_KEY;
  const packageTierMap = getPackageTierMap();

  app.use(express.raw({ type: "*/*", limit: "1mb" }));

  app.post("/", async (req, res) => {
    if (!secret) {
      logger.error("tebex", "TEBEX_SECRET_KEY is not configured");
      return res.status(503).json({ error: "webhook_unavailable" });
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
    let body;
    try {
      body = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "invalid_json" });
    }

    const eventType = String(body?.type || body?.event || "unknown");
    const eventId = String(body?.id || "");

    if (eventType === "validation.webhook") {
      return res.status(200).json({ id: body?.id });
    }

    const signature = req.headers["x-signature"] || req.headers["x-tebex-signature"] || "";
    if (!verifyTebexSignature(rawBody, signature, secret)) {
      logger.warn("tebex", "Rejected webhook with invalid signature", { eventType, eventId });
      return res.status(401).json({ error: "invalid_signature" });
    }

    if (!eventId) {
      logger.error("tebex", "Rejected webhook without an event ID", { eventType });
      return res.status(400).json({ error: "missing_event_id" });
    }

    if (!GRANT_EVENTS.has(eventType) && !REVOKE_EVENTS.has(eventType)) {
      return res.status(200).json({ id: eventId, processed: false });
    }

    let claimed = false;
    try {
      claimed = await claimEvent(eventId, eventType);
      if (!claimed) {
        return res.status(200).json({ id: eventId, duplicate: true });
      }

      const client = getClient ? getClient() : null;
      if (GRANT_EVENTS.has(eventType)) {
        await processGrantEvent({ body, eventType, eventId, client, packageTierMap });
      } else {
        await processRevokeEvent({ body, eventType, client });
      }

      await markEvent(eventId, "processed");
      logger.info("tebex", "Webhook processed", { eventType, eventId });
      return res.status(200).json({ id: eventId, processed: true });
    } catch (error) {
      if (claimed) {
        await markEvent(eventId, "failed", error?.message || String(error)).catch(() => {});
      }
      logger.error("tebex", "Webhook processing failed", {
        eventType,
        eventId,
        error: error?.message || String(error),
      });
      return res.status(500).json({ error: "processing_failed" });
    }
  });

  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      configured: Boolean(secret),
      packageTierMap: Object.keys(packageTierMap),
    });
  });

  return app;
}

module.exports = {
  createTebexApp,
  verifyTebexSignature,
  getPaymentPayload,
  extractPackages,
  extractGuildId,
  extractDiscordIdentity,
  getProviderOrderId,
  getProviderSubscriptionId,
  getTierAndDuration,
  GRANT_EVENTS,
  REVOKE_EVENTS,
};
