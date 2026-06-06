process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const { Collection } = require("discord.js");

const db = require("../src/utils/database");
const interactionEvent = require("../src/events/interactionCreate");

const originalSettingsGet = db.settings.get;

function makeMember({ admin = false, roles = [] } = {}) {
  const roleSet = new Set(roles);
  return {
    permissions: { has: () => admin },
    roles: { cache: { has: (id) => roleSet.has(id) } },
  };
}

function createBaseInteraction({
  commandName = "ping",
  guildId = "g1",
  member = makeMember(),
  userId = "u1",
  kind = "command",
  customId = "x",
  locale = "es-ES",
} = {}) {
  const calls = {
    reply: [],
    followUp: [],
    update: [],
    deferUpdate: 0,
  };

  return {
    guildId,
    guild: { id: guildId },
    member,
    memberPermissions: { has: () => false },
    user: { id: userId, username: "user" },
    locale,
    commandName,
    customId,
    type: 2,
    replied: false,
    deferred: false,

    isChatInputCommand: () => kind === "command",
    isAutocomplete: () => kind === "autocomplete",
    isButton: () => kind === "button",
    isStringSelectMenu: () => kind === "select",
    isModalSubmit: () => kind === "modal",

    reply: async (payload) => { calls.reply.push(payload); },
    followUp: async (payload) => { calls.followUp.push(payload); },
    update: async (payload) => { calls.update.push(payload); },
    deferUpdate: async function () {
      calls.deferUpdate++;
      this.deferred = true;
    },
    __calls: calls,
  };
}

function createClientWithCommand(commandName, cmd) {
  const commands = new Collection();
  commands.set(commandName, cmd);
  return { commands };
}

test.beforeEach(() => {
  db.settings.get = async () => ({
    rate_limit_enabled: false,
    rate_limit_bypass_admin: true,
    rate_limit_max_actions: 999,
    rate_limit_window_seconds: 1,
    admin_role: "role-admin",
    support_role: "role-support",
    disabled_commands: [],
  });
  interactionEvent.__test.clearHandlers();
  interactionEvent.__test.clearSettingsCache();
  interactionEvent.__test.seedHandler("button", "__dummy__", { customId: "__dummy__", execute: async () => {} });
});

test.after(() => {
  db.settings.get = originalSettingsGet;
});

test("router ejecuta comando publico", async () => {
  let executed = false;
  const cmd = {
    data: { name: "ping" },
    meta: { scope: "public" },
    execute: async () => { executed = true; },
  };
  const client = createClientWithCommand("ping", cmd);
  const interaction = createBaseInteraction({ kind: "command", commandName: "ping" });

  await interactionEvent.execute(interaction, client);

  assert.equal(executed, true);
  assert.equal(interaction.__calls.reply.length, 0);
});

test("router deniega comando admin a usuario sin permisos", async () => {
  let executed = false;
  const cmd = {
    data: { name: "setup" },
    meta: { scope: "admin" },
    execute: async () => { executed = true; },
  };
  const client = createClientWithCommand("setup", cmd);
  const interaction = createBaseInteraction({
    kind: "command",
    commandName: "setup",
    member: makeMember({ admin: false, roles: [] }),
  });

  await interactionEvent.execute(interaction, client);

  assert.equal(executed, false);
  assert.equal(interaction.__calls.reply.length, 1);
});

test("router ejecuta button handler con access staff para support_role", async () => {
  let handled = false;
  interactionEvent.__test.seedHandler("button", "staff_action", {
    customId: "staff_action",
    access: "staff",
    execute: async () => { handled = true; },
  });

  const interaction = createBaseInteraction({
    kind: "button",
    customId: "staff_action",
    member: makeMember({ admin: false, roles: ["role-support"] }),
  });
  const client = { commands: new Collection() };

  await interactionEvent.execute(interaction, client);

  assert.equal(handled, true);
  assert.equal(interaction.__calls.reply.length, 0);
});

test("router deniega button handler con access staff sin rol", async () => {
  let handled = false;
  interactionEvent.__test.seedHandler("button", "staff_only", {
    customId: "staff_only",
    access: "staff",
    execute: async () => { handled = true; },
  });

  const interaction = createBaseInteraction({
    kind: "button",
    customId: "staff_only",
    member: makeMember({ admin: false, roles: [] }),
  });
  const client = { commands: new Collection() };

  await interactionEvent.execute(interaction, client);

  assert.equal(handled, false);
  assert.equal(interaction.__calls.reply.length, 1);
});

test("router bloquea comando deshabilitado por settings", async () => {
  db.settings.get = async () => ({
    rate_limit_enabled: false,
    rate_limit_bypass_admin: true,
    rate_limit_max_actions: 999,
    rate_limit_window_seconds: 1,
    admin_role: "role-admin",
    support_role: "role-support",
    disabled_commands: ["ping"],
  });

  let executed = false;
  const cmd = {
    data: { name: "ping" },
    meta: { scope: "public" },
    execute: async () => { executed = true; },
  };
  const client = createClientWithCommand("ping", cmd);
  const interaction = createBaseInteraction({ kind: "command", commandName: "ping" });

  await interactionEvent.execute(interaction, client);

  assert.equal(executed, false);
  assert.equal(interaction.__calls.reply.length, 1);
});

test("router responde en ingles cuando locale es en-US para comando deshabilitado", async () => {
  db.settings.get = async () => ({
    rate_limit_enabled: false,
    rate_limit_bypass_admin: true,
    rate_limit_max_actions: 999,
    rate_limit_window_seconds: 1,
    admin_role: "role-admin",
    support_role: "role-support",
    disabled_commands: ["ping"],
    bot_language: "en",
  });

  const cmd = {
    data: { name: "ping" },
    meta: { scope: "public" },
    execute: async () => {},
  };
  const client = createClientWithCommand("ping", cmd);
  const interaction = createBaseInteraction({
    kind: "command",
    commandName: "ping",
    locale: "en-US",
  });

  await interactionEvent.execute(interaction, client);

  assert.equal(interaction.__calls.reply.length, 1);
  const payload = interaction.__calls.reply[0];
  const embedText = payload.embeds?.[0]?.data?.description || "";
  assert.match(embedText, /disabled/i);
});

test("router responde mensaje controlado cuando la DB no esta disponible", async () => {
  const dbDownError = new Error("db down");
  dbDownError.code = "DB_UNAVAILABLE";

  const cmd = {
    data: { name: "setup" },
    meta: { scope: "admin" },
    execute: async () => {
      throw dbDownError;
    },
  };

  const client = createClientWithCommand("setup", cmd);
  const interaction = createBaseInteraction({
    kind: "command",
    commandName: "setup",
    member: makeMember({ admin: true, roles: [] }),
  });
  interaction.memberPermissions = { has: () => true };

  await interactionEvent.execute(interaction, client);

  assert.equal(interaction.__calls.reply.length, 1);
  const payload = interaction.__calls.reply[0];
  const embedText = payload.embeds?.[0]?.data?.description || "";
  assert.match(embedText, /Base de datos temporalmente no disponible/i);
});

test("router delega botones music y retorna sin ejecutar handlers locales", async () => {
  const musicModule = require("ton618-music/src/handlers/musicInteractionHandler");
  const originalHandler = musicModule.musicInteractionHandler;
  let delegated = 0;
  let localHandled = false;

  musicModule.musicInteractionHandler = async (interaction) => {
    delegated++;
    assert.equal(interaction.customId, "music:control:pause");
  };
  interactionEvent.__test.seedHandler("button", "music:control:pause", {
    customId: "music:control:pause",
    execute: async () => {
      localHandled = true;
    },
  });

  try {
    const interaction = createBaseInteraction({
      kind: "button",
      customId: "music:control:pause",
    });
    const client = { commands: new Collection(), musicManager: {} };

    await interactionEvent.execute(interaction, client);

    assert.equal(delegated, 1);
    assert.equal(localHandled, false);
    assert.equal(interaction.__calls.reply.length, 0);
  } finally {
    musicModule.musicInteractionHandler = originalHandler;
  }
});

test("router confirma el boton y responde ephemeral si la precarga music falla", async () => {
  const originalModule = interactionEvent.__test.getMusicInteractionModule();
  interactionEvent.__test.setMusicInteractionModule(null);

  try {
    const interaction = createBaseInteraction({
      kind: "button",
      customId: "music:control:pause",
    });
    const client = { commands: new Collection(), musicManager: {} };

    await interactionEvent.execute(interaction, client);

    assert.equal(interaction.__calls.deferUpdate, 1);
    assert.equal(interaction.__calls.followUp.length, 1);
    assert.equal(interaction.__calls.followUp[0].flags, 64);
    assert.equal(interaction.__calls.reply.length, 0);
  } finally {
    interactionEvent.__test.setMusicInteractionModule(originalModule);
  }
});
