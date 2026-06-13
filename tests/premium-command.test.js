const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");
const { t } = require("../src/utils/i18n");

let currentStatus = {
  plan: "free",
  tier: null,
  tierLabel: "FREE",
  isPro: false,
  isPremium: false,
  isLifetime: false,
  planSource: null,
  planStartedAt: null,
  planExpiresAt: null,
  expiresAt: null,
  daysUntil: null,
  supporterActive: false,
  supporterExpiresAt: null,
  ownerUserId: null,
  upgradeUrl: "https://store.ton618bot.xyz/",
  error: null,
  meta: {
    source: "default",
    stale: false,
    unavailable: false,
    errorCode: null,
  },
};

const mockPremiumStatus = {
  resolveGuildPremiumStatus: async () => currentStatus,
  isPremiumStatusUnavailable: (status) => Boolean(status?.error || status?.meta?.unavailable),
};
let redemptionResult = {
  success: true,
  activation: {
    planExpiresAt: null,
    isExtension: false,
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent) {
  if (request === "../../../utils/premiumStatus") {
    return mockPremiumStatus;
  }
  if (request === "../../../utils/proCodeService") {
    return {
      processRedemption: async () => redemptionResult,
    };
  }

  return originalLoad(request, parent);
};

delete require.cache[require.resolve("../src/commands/public/utility/premium")];
const premiumCommand = require("../src/commands/public/utility/premium");

test.after(() => {
  Module._load = originalLoad;
  delete require.cache[require.resolve("../src/commands/public/utility/premium")];
});

function makeInteraction({
  guildId = "guild-123",
  ownerId = "owner-1",
  userId = "owner-1",
  preferredLocale = "en-US",
  subcommand = "status",
} = {}) {
  const calls = [];

  const interaction = {
    guildId,
    guild: { ownerId, preferredLocale, name: "Test Guild" },
    user: { id: userId },
    client: {},
    locale: preferredLocale,
    options: {
      getSubcommand: () => subcommand,
      getString: () => "ABCD-EFGH-IJKL",
    },
    deferred: false,
    replied: false,
    reply: async (payload) => {
      calls.push({ type: "reply", payload });
      interaction.replied = true;
      return payload;
    },
    deferReply: async (payload) => {
      calls.push({ type: "deferReply", payload });
      interaction.deferred = true;
      return payload;
    },
    editReply: async (payload) => {
      calls.push({ type: "editReply", payload });
      interaction.replied = true;
      return payload;
    },
    _getCalls: () => calls,
  };

  return interaction;
}

test("/premium status muestra tier y expiracion para guild con premium", async () => {
  currentStatus = {
    ...currentStatus,
    plan: "pro_monthly",
    tier: "pro_monthly",
    tierLabel: "PRO Monthly",
    isPro: true,
    isPremium: true,
    planExpiresAt: "2027-01-15T00:00:00Z",
    expiresAt: "2027-01-15T00:00:00Z",
    daysUntil: 6,
    error: null,
    meta: {
      source: "api",
      stale: false,
      unavailable: false,
      errorCode: null,
    },
  };

  const interaction = makeInteraction();
  await premiumCommand.execute(interaction);

  const editReply = interaction._getCalls().find((call) => call.type === "editReply");
  assert.ok(editReply, "expected editReply to be called");
  assert.ok(Array.isArray(editReply.payload.embeds));

  const fields = editReply.payload.embeds[0].data.fields;
  assert.ok(fields.some((field) => field.value === "PRO Monthly"));
  assert.ok(fields.some((field) => field.name === t("en", "premium.expires_at")));
});

test("/premium status muestra FREE y link de upgrade para guild sin premium", async () => {
  currentStatus = {
    ...currentStatus,
    plan: "free",
    tier: null,
    tierLabel: "FREE",
    isPro: false,
    isPremium: false,
    planExpiresAt: null,
    expiresAt: null,
    daysUntil: null,
    upgradeUrl: "https://store.ton618bot.xyz/",
    error: null,
    meta: {
      source: "api",
      stale: false,
      unavailable: false,
      errorCode: null,
    },
  };

  const interaction = makeInteraction();
  await premiumCommand.execute(interaction);

  const editReply = interaction._getCalls().find((call) => call.type === "editReply");
  const fields = editReply.payload.embeds[0].data.fields;

  assert.ok(fields.some((field) => field.value === "FREE"));
  assert.ok(fields.some((field) => String(field.value).includes("https://store.ton618bot.xyz/")));
});

test("/premium status responde error claro cuando la verificacion premium no esta disponible", async () => {
  currentStatus = {
    ...currentStatus,
    plan: "free",
    tier: null,
    tierLabel: "FREE",
    isPro: false,
    isPremium: false,
    planExpiresAt: null,
    expiresAt: null,
    daysUntil: null,
    error: "premium_status_unavailable",
    meta: {
      source: "api_error",
      stale: false,
      unavailable: true,
      errorCode: "premium_status_unavailable",
    },
  };

  const interaction = makeInteraction();
  await premiumCommand.execute(interaction);

  const editReply = interaction._getCalls().find((call) => call.type === "editReply");

  assert.equal(editReply.payload.content, t("en", "premium.error_fetching"));
  assert.equal(editReply.payload.embeds, undefined);
});

test("/premium activate localiza permisos y exito en espanol", async () => {
  const denied = makeInteraction({
    subcommand: "activate",
    preferredLocale: "es-ES",
    userId: "member-1",
  });
  await premiumCommand.execute(denied);

  const deniedReply = denied._getCalls().find((call) => call.type === "reply");
  assert.equal(
    deniedReply.payload.embeds[0].data.title,
    t("es", "premium.activate.permission_title")
  );

  redemptionResult = {
    success: true,
    activation: {
      planExpiresAt: null,
      isExtension: false,
    },
  };
  const success = makeInteraction({
    subcommand: "activate",
    preferredLocale: "es-ES",
  });
  await premiumCommand.execute(success);

  const successReply = success._getCalls().find((call) => call.type === "editReply");
  assert.equal(
    successReply.payload.embeds[0].data.title,
    t("es", "premium.activate.success_title")
  );
  assert.match(successReply.payload.embeds[0].data.description, /ahora tiene PRO/);
});

test("/premium activate no expone errores tecnicos", async () => {
  redemptionResult = {
    success: false,
    error: "unexpected_internal_detail",
  };
  const interaction = makeInteraction({ subcommand: "activate" });
  await premiumCommand.execute(interaction);

  const editReply = interaction._getCalls().find((call) => call.type === "editReply");
  assert.equal(
    editReply.payload.embeds[0].data.description,
    t("en", "premium.activate.activation_failed")
  );
  assert.equal(editReply.payload.embeds[0].data.description.includes("unexpected_internal_detail"), false);
});
