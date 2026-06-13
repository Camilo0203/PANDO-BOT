const test = require("node:test");
const assert = require("node:assert/strict");
const { Collection, PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");

const db = require("../src/utils/database");
const { clearGuildSettingsCache } = require("../src/utils/accessControl");
const helpCommand = require("../src/commands/public/utility/help");
const helpFactory = require("../src/utils/helpFactory");

const originalSettingsGet = db.settings.get;

function createPermissionBag(bits = []) {
  const allowed = new Set(bits.map((bit) => BigInt(bit)));
  const adminBit = BigInt(PermissionFlagsBits.Administrator);

  return {
    has: (requested) => {
      if (allowed.has(adminBit)) return true;
      if (requested === null || requested === undefined) return false;

      try {
        return allowed.has(BigInt(requested));
      } catch {
        return false;
      }
    },
  };
}

function createMember({ permissions = [], roles = [] } = {}) {
  const roleSet = new Set(roles);
  const permissionBag = createPermissionBag(permissions);

  return {
    permissions: permissionBag,
    roles: {
      cache: {
        has: (id) => roleSet.has(id),
      },
    },
  };
}

function createCommand({
  name,
  description,
  category = "utility",
  scope = "public",
  hidden = false,
  defaultMemberPermissions,
  build,
}) {
  let data = new SlashCommandBuilder().setName(name).setDescription(description);
  if (defaultMemberPermissions !== undefined) {
    data = data.setDefaultMemberPermissions(defaultMemberPermissions);
  }
  if (typeof build === "function") {
    data = build(data);
  }

  return {
    data,
    meta: { category, scope, hidden },
    execute: async () => {},
  };
}

function createHelpInteraction({
  commands,
  input = null,
  focused = "",
  locale = "es-ES",
  permissions = [],
  roles = [],
  userId = "u1",
} = {}) {
  const member = createMember({ permissions, roles });
  const calls = {
    reply: [],
    respond: [],
    editReply: [],
  };

  return {
    guildId: "g1",
    guild: { id: "g1", name: "GuildX" },
    locale,
    user: { id: userId },
    member,
    memberPermissions: member.permissions,
    client: { commands },
    options: {
      getString: (name) => (name === "command" || name === "comando" ? input : null),
      getFocused: () => focused,
    },
    reply: async (payload) => {
      calls.reply.push(payload);
    },
    respond: async (payload) => {
      calls.respond.push(payload);
    },
    fetchReply: async () => ({
      createMessageComponentCollector: () => ({
        on: () => {},
      }),
    }),
    editReply: async (payload) => {
      calls.editReply.push(payload);
    },
    __calls: calls,
  };
}

function collectEmbedText(payload) {
  return (payload.embeds || [])
    .map((embed) => {
      const data = embed.data || {};
      const fields = Array.isArray(data.fields)
        ? data.fields.map((field) => `${field.name}\n${field.value}`).join("\n")
        : "";
      return [data.title, data.description, fields].filter(Boolean).join("\n");
    })
    .join("\n");
}

function collectSelectMenuData(payload) {
  return payload.components?.[0]?.toJSON?.()?.components?.[0] || null;
}

function createLocalizedAlphaCommand() {
  return createCommand({
    name: "alpha",
    description: "Manage alpha workflows",
    category: "utility",
    build: (builder) =>
      builder
        .setDescriptionLocalizations({
          "es-ES": "Manage alpha workflows.",
          "es-419": "Manage alpha workflows.",
        })
        .addSubcommand((sub) =>
          sub
            .setName("open")
            .setDescription("Open an alpha case")
            .setDescriptionLocalizations({
              "es-ES": "Abre un caso alpha",
              "es-419": "Abre un caso alpha",
            })
            .addStringOption((option) =>
              option
                .setName("reason")
                .setDescription("Reason")
                .setDescriptionLocalizations({
                  "es-ES": "Motivo",
                  "es-419": "Motivo",
                })
                .setRequired(true)
            )
            .addStringOption((option) =>
              option
                .setName("priority")
                .setDescription("Priority")
                .setDescriptionLocalizations({
                  "es-ES": "Prioridad",
                  "es-419": "Prioridad",
                })
                .setRequired(false)
            )
        )
        .addSubcommandGroup((group) =>
          group
            .setName("review")
            .setDescription("Review tools")
            .setDescriptionLocalizations({
              "es-ES": "Herramientas de revision",
              "es-419": "Herramientas de revision",
            })
            .addSubcommand((sub) =>
              sub
                .setName("list")
                .setDescription("List active alpha cases")
                .setDescriptionLocalizations({
                  "es-ES": "Lista los casos alpha activos",
                  "es-419": "Lista los casos alpha activos",
                })
            )
        ),
  });
}

test.beforeEach(() => {
  clearGuildSettingsCache("*");
  db.settings.get = async () => ({
    bot_language: "es",
    simple_help_mode: true,
    admin_role: "role-admin",
    support_role: "role-support",
    disabled_commands: [],
  });
});

test.after(() => {
  db.settings.get = originalSettingsGet;
  clearGuildSettingsCache("*");
});

test("help home usa bot_language=es y localiza embed y menu", async () => {
  db.settings.get = async () => ({
    bot_language: "es",
    simple_help_mode: true,
    admin_role: null,
    support_role: null,
    disabled_commands: ["beta"],
  });

  const commands = new Collection();
  commands.set("alpha", createLocalizedAlphaCommand());
  commands.set(
    "beta",
    createCommand({
      name: "beta",
      description: "Beta ticket command",
      category: "tickets",
    })
  );

  const interaction = createHelpInteraction({ commands, input: null, locale: "en-US" });

  await helpCommand.execute(interaction);

  assert.equal(interaction.__calls.reply.length, 1);
  const payload = interaction.__calls.reply[0];
  // Locale: "Centro de Ayuda TON618"
  assert.equal(payload.embeds[0].data.title, "Centro de Ayuda TON618");

  const embedText = collectEmbedText(payload);
  const selectMenu = collectSelectMenuData(payload);

  // Locale: "Bienvenido al centro de ayuda de **{{guild}}**..."
  assert.match(embedText, /centro de ayuda de \*\*GuildX\*\*/);
  // Locale: "Resumen del Sistema"
  assert.match(embedText, /Resumen del Sistema/);
  // Locale: "Tu Acceso"
  assert.match(embedText, /Tu Acceso/);
  // Locale: categories.utility = "Utilidad", 1 comando, 2 usos
  assert.match(embedText, /\*\*Utilidad\*\*: 1 comando, 2 usos/);
  assert.doesNotMatch(embedText, /\*\*Tickets\*\*/);
  assert.doesNotMatch(embedText, /TON618 Help Center|System Overview|Your Access/);
  // Locale: select_placeholder = "Seleccionar una categoría"
  assert.equal(selectMenu.placeholder, "Seleccionar una categoría");
  assert.equal(selectMenu.options[0].label, "Inicio");
  assert.deepEqual(
    selectMenu.options.map((option) => option.label),
    ["Inicio", "Utilidad"]
  );
});

test("help home usa locale como fallback y muestra ingles real", async () => {
  db.settings.get = async () => ({
    bot_language: null,
    simple_help_mode: true,
    admin_role: null,
    support_role: null,
    disabled_commands: [],
  });

  const commands = new Collection();
  commands.set("alpha", createLocalizedAlphaCommand());

  const interaction = createHelpInteraction({
    commands,
    input: null,
    locale: "en-GB",
  });

  await helpCommand.execute(interaction);

  assert.equal(interaction.__calls.reply.length, 1);
  const payload = interaction.__calls.reply[0];
  assert.equal(payload.embeds[0].data.title, "TON618 Help Center");

  const embedText = collectEmbedText(payload);
  const selectMenu = collectSelectMenuData(payload);

  // Locale: "Welcome to the help center for **{{guild}}**..."
  assert.match(embedText, /Welcome to the help center for \*\*GuildX\*\*/);
  // Locale: "System Overview"
  assert.match(embedText, /System Overview/);
  // Locale: "Your Access"
  assert.match(embedText, /Your Access/);
  // Locale: categories.utility = "Utility", 1 command, 2 usages
  assert.match(embedText, /\*\*Utility\*\*: 1 command, 2 usages/);
  assert.doesNotMatch(embedText, /Centro de Ayuda TON618|Resumen del Sistema/);
  assert.equal(selectMenu.placeholder, "Select a category");
  assert.equal(selectMenu.options[0].label, "Home");
  assert.deepEqual(
    selectMenu.options.map((option) => option.label),
    ["Home", "Utility"]
  );
});

test("help directo de un comando usa espanol cuando bot_language es es", async () => {
  db.settings.get = async () => ({
    bot_language: "es",
    simple_help_mode: true,
    admin_role: null,
    support_role: null,
    disabled_commands: [],
  });

  const commands = new Collection();
  commands.set("alpha", createLocalizedAlphaCommand());

  const interaction = createHelpInteraction({
    commands,
    input: "alpha open",
    locale: "en-US",
  });

  await helpCommand.execute(interaction);

  assert.equal(interaction.__calls.reply.length, 1);
  const payload = interaction.__calls.reply[0];
  const embedText = collectEmbedText(payload);

  // Locale: help.embed.command_help = "Comando: /{{command}}"
  assert.equal(payload.embeds[0].data.title, "Comando: /alpha");
  // Locale: help.embed.command_desc = "**Resumen:** ... **Categoría:** {{category}} **Acceso:** `{{access}}`"
  assert.match(embedText, /Categoría.*Utilidad/);
  // Locale: focused_match = "Coincidencia: `{{usage}}`"
  assert.match(embedText, /Coincidencia.*`\/alpha open`/);
  // Locale: field_entries = "Usos"
  assert.match(embedText, /Usos/);
  // Contains alpha subcommand text
  assert.match(embedText, /alpha/);
  assert.doesNotMatch(embedText, /Category:/);
});

test("help directo de un comando usa ingles cuando bot_language es en", async () => {
  db.settings.get = async () => ({
    bot_language: "en",
    simple_help_mode: true,
    admin_role: null,
    support_role: null,
    disabled_commands: [],
  });

  const commands = new Collection();
  commands.set("alpha", createLocalizedAlphaCommand());

  const interaction = createHelpInteraction({
    commands,
    input: "alpha open",
    locale: "es-419",
  });

  await helpCommand.execute(interaction);

  assert.equal(interaction.__calls.reply.length, 1);
  const payload = interaction.__calls.reply[0];
  const embedText = collectEmbedText(payload);

  // Locale: help.embed.command_help = "Command: /{{command}}"
  assert.equal(payload.embeds[0].data.title, "Command: /alpha");
  // Locale: "**Summary:**... **Category:** Utility **Access:** `public`"
  assert.match(embedText, /Category.*Utility/);
  // Locale: focused_match = "Match: `{{usage}}`"
  assert.match(embedText, /Match.*`\/alpha open`/);
  // Locale: field_entries = "Usages"
  assert.match(embedText, /Usages/);
  assert.match(embedText, /alpha/);
  assert.doesNotMatch(embedText, /Categoría:/);
});

test("category help usa espanol real para una vista de categoria", () => {
  const commands = [createLocalizedAlphaCommand()];
  const catalog = helpFactory.__test.buildCommandCatalog(commands, "es");
  const embeds = helpFactory.__test.buildCategoryEmbeds("utility", catalog, "GuildX", "es");
  const embedText = collectEmbedText({ embeds });

  // Locale: category_title = "Comandos de {{category}}", categories.utility = "Utilidad"
  assert.match(embedText, /Comandos de Utilidad/);
  assert.match(embedText, /\/alpha \[/);
  assert.match(embedText, /`\/alpha open`/);
  assert.match(embedText, /`\/alpha review list`/);
  // Locale: visible_commands_label = "Comandos Interactivos"
  assert.match(embedText, /Comandos Interactivos: \*\*1\*\*/);
  // Locale: visible_entries_label = "Usos Únicos"
  assert.match(embedText, /Usos Únicos: \*\*2\*\*/);
  // Locale: overview_prefix + description
  assert.match(embedText, /Manage alpha workflows./);
  // Locale: required_label = "Requerido", optional_label = "Opcional"
  assert.match(embedText, /Requerido.*reason/);
  assert.match(embedText, /Opcional.*priority/);
  assert.doesNotMatch(embedText, /Overview:|Visible commands:|Key input:/);
});

test("help command registration expone localizaciones completas en ingles y espanol", () => {
  const data = helpCommand.data.toJSON();

  assert.equal(typeof data.description, "string");
  assert.equal(typeof data.description_localizations["en-US"], "string");
  assert.equal(typeof data.description_localizations["en-GB"], "string");
  assert.equal(typeof data.description_localizations["es-ES"], "string");
  assert.equal(typeof data.description_localizations["es-419"], "string");
  // Options should have localizations
  assert.equal(typeof data.options[0].description, "string");
  assert.equal(typeof data.options[0].description_localizations["es-ES"], "string");
  assert.equal(typeof data.options[0].description_localizations["es-419"], "string");
  assert.equal(typeof data.options[0].description_localizations["en-US"], "string");
  assert.equal(typeof data.options[0].description_localizations["en-GB"], "string");
});

test("help autocomplete only suggests commands the member can really see", async () => {
  db.settings.get = async () => ({
    bot_language: "en",
    simple_help_mode: false,
    admin_role: "role-admin",
    support_role: "role-support",
    disabled_commands: ["beta"],
  });

  const commands = new Collection();
  commands.set(
    "alpha",
    createCommand({
      name: "alpha",
      description: "Alpha utility command",
      category: "utility",
    })
  );
  commands.set(
    "beta",
    createCommand({
      name: "beta",
      description: "Disabled utility command",
      category: "utility",
    })
  );
  commands.set(
    "gamma",
    createCommand({
      name: "gamma",
      description: "Admin command",
      category: "config",
      scope: "admin",
      defaultMemberPermissions: PermissionFlagsBits.Administrator,
    })
  );
  commands.set(
    "staffops",
    createCommand({
      name: "staffops",
      description: "Staff command",
      category: "moderation",
      scope: "staff",
    })
  );
  commands.set(
    "hidden",
    createCommand({
      name: "hidden",
      description: "Hidden command",
      category: "utility",
      hidden: true,
    })
  );

  const interaction = createHelpInteraction({
    commands,
    focused: "",
    roles: ["role-support"],
    permissions: [],
  });

  await helpCommand.autocomplete(interaction);

  assert.equal(interaction.__calls.respond.length, 1);
  const choices = interaction.__calls.respond[0].map((choice) => choice.value);
  assert.deepEqual(choices, ["alpha"]);
});

test("help exposes inferred staff commands when the required permission is present", async () => {
  db.settings.get = async () => ({
    bot_language: "en",
    simple_help_mode: false,
    admin_role: "role-admin",
    support_role: "role-support",
    disabled_commands: [],
  });

  const commands = new Collection();
  commands.set(
    "staffops",
    createCommand({
      name: "staffops",
      description: "Staff command",
      category: "moderation",
      scope: "staff",
    })
  );

  const interaction = createHelpInteraction({
    commands,
    focused: "staff",
    roles: ["role-support"],
    permissions: [PermissionFlagsBits.ManageMessages],
  });

  await helpCommand.autocomplete(interaction);

  assert.equal(interaction.__calls.respond.length, 1);
  const choices = interaction.__calls.respond[0].map((choice) => choice.value);
  assert.deepEqual(choices, ["staffops"]);
});
