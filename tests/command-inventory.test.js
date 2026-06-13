const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { loadAndValidateCommands } = require("../src/utils/commandLoader");
const { autoLocalizeCommandData } = require("../src/utils/autoLocalizeOptions");
const { t } = require("../src/utils/i18n");

const EXPECTED_PUBLIC_COMMANDS = [
  "analytics",
  "audit",
  "autorole",
  "config",
  "embed",
  "filter",
  "giveaway",
  "health",
  "help",
  "level",
  "loop",
  "mod",
  "modlogs",
  "nowplaying",
  "pause",
  "play",
  "poll",
  "premium",
  "pro",
  "proadmin",
  "profile",
  "queue",
  "quickstart",
  "search",
  "serverstats",
  "setup",
  "shuffle",
  "skip",
  "staff",
  "stats",
  "stop",
  "suggest",
  "ticket",
  "verify",
  "volume",
  "warn",
];

const EXPECTED_PRIVATE_COMMANDS = [
  "debug",
  "musicstatus",
  "ping",
  "resetall",
  "resetguild",
  "security",
  "send-tutorial",
];
const ALLOWED_HELP_PSEUDO_TARGETS = new Set(["alpha", "staffops"]);

function sortStrings(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function collectHelpLocaleTargets(language) {
  const names = new Set();
  const usages = new Set();

  for (const [key, value] of Object.entries(require(`../src/locales/${language}.js`))) {
    if (typeof value !== "string") continue;

    if (key.startsWith("help.embed.overviews.")) {
      names.add(key.slice("help.embed.overviews.".length));
    }

    if (key.startsWith("help.embed.usages.")) {
      usages.add(key.slice("help.embed.usages.".length));
    }
  }

  return { names, usages };
}

test("command inventory keeps expected public/private scope and executable handlers", () => {
  const commandsBaseDir = path.resolve(__dirname, "..", "src", "commands");
  const { commands, validationErrors } = loadAndValidateCommands(commandsBaseDir);

  assert.deepEqual(validationErrors, []);
  assert.ok(commands.length >= EXPECTED_PUBLIC_COMMANDS.length + EXPECTED_PRIVATE_COMMANDS.length);

  for (const command of commands) {
    assert.equal(typeof command.execute, "function", `/${command.data.name} is missing execute()`);
  }

  const publicCommands = sortStrings(
    commands.filter((command) => !command.meta?.privateOnly).map((command) => command.data.name)
  );
  const privateCommands = sortStrings(
    commands.filter((command) => command.meta?.privateOnly).map((command) => command.data.name)
  );

  assert.deepEqual(publicCommands, sortStrings(EXPECTED_PUBLIC_COMMANDS));
  assert.deepEqual(privateCommands, sortStrings(EXPECTED_PRIVATE_COMMANDS));
});

test("help locale catalog only references real commands or known subcommand entries", () => {
  const commandsBaseDir = path.resolve(__dirname, "..", "src", "commands");
  const { commands } = loadAndValidateCommands(commandsBaseDir);
  const commandNames = new Set(commands.map((command) => command.data.name));

  for (const language of ["en", "es"]) {
    const { names, usages } = collectHelpLocaleTargets(language);

    for (const name of names) {
      assert.ok(
        commandNames.has(name) || ALLOWED_HELP_PSEUDO_TARGETS.has(name),
        `Unknown help overview target '${name}' in ${language}.js`
      );
    }

    for (const usage of usages) {
      const baseName = usage.split("_")[0];
      assert.ok(
        commandNames.has(baseName) || ALLOWED_HELP_PSEUDO_TARGETS.has(baseName),
        `Unknown help usage target '${usage}' in ${language}.js`
      );
    }
  }
});

test("critical readiness locale keys resolve in both english and spanish", () => {
  const keys = [
    "interaction.unexpected",
    "premium.slash.description",
    "premium.slash.status",
    "setup.automod.status_title",
    "config.category.list_title",
    "center.actions.panel_published",
    "tickets.panel.published_title",
    "staff.only_staff",
    "leveling.rank.title",
    "events.messageDelete.title",
    "daily_sla_report.title",
    "transcript.title",
    "case_brief.title",
    "health_monitor.ping_high_title",
  ];

  for (const key of keys) {
    assert.notEqual(t("en", key), key, `Missing EN locale key: ${key}`);
    assert.notEqual(t("es", key), key, `Missing ES locale key: ${key}`);
  }
});

test("all slash commands expose EN/ES localizations after normalization", () => {
  const commandsBaseDir = path.resolve(__dirname, "..", "src", "commands");
  const { commands, validationErrors } = loadAndValidateCommands(commandsBaseDir);
  assert.deepEqual(validationErrors, []);

  function assertLocalizedNode(node, label) {
    if (!node || typeof node !== "object") return;
    if (typeof node.description === "string" && node.description.trim()) {
      assert.equal(typeof node.description_localizations?.["en-US"], "string", `${label} missing en-US`);
      assert.equal(typeof node.description_localizations?.["en-GB"], "string", `${label} missing en-GB`);
      assert.equal(typeof node.description_localizations?.["es-ES"], "string", `${label} missing es-ES`);
      assert.equal(typeof node.description_localizations?.["es-419"], "string", `${label} missing es-419`);
    }

    if (Array.isArray(node.choices)) {
      for (const choice of node.choices) {
        assert.equal(typeof choice.name_localizations?.["en-US"], "string", `${label} choice missing en-US`);
        assert.equal(typeof choice.name_localizations?.["en-GB"], "string", `${label} choice missing en-GB`);
        assert.equal(typeof choice.name_localizations?.["es-ES"], "string", `${label} choice missing es-ES`);
        assert.equal(typeof choice.name_localizations?.["es-419"], "string", `${label} choice missing es-419`);
      }
    }

    if (Array.isArray(node.options)) {
      for (const option of node.options) {
        assertLocalizedNode(option, `${label}.${option.name || "option"}`);
      }
    }
  }

  for (const command of commands) {
    const json = autoLocalizeCommandData(command.data);
    assert.ok(json, `/${command?.data?.name || "unknown"} has invalid command data`);
    assertLocalizedNode(json, `/${json.name}`);
  }
});

test("slash names stay canonical in english", () => {
  const commandsBaseDir = path.resolve(__dirname, "..", "src", "commands");
  const { commands, validationErrors } = loadAndValidateCommands(commandsBaseDir);
  assert.deepEqual(validationErrors, []);

  const LEGACY_SPANISH_NAMES = new Set([
    "bienvenida",
    "despedida",
    "comandos",
    "canal",
    "mensaje",
    "titulo",
    "activar",
    "estado",
    "rol",
    "mostrar",
    "texto",
    "perfil",
    "cumpleanos",
  ]);

  const COMMAND_NAME_PATTERN = /^[a-z0-9_-]{1,32}$/;

  function assertCanonicalName(name, pathLabel) {
    assert.equal(typeof name, "string", `${pathLabel} must have a string name`);
    assert.ok(COMMAND_NAME_PATTERN.test(name), `${pathLabel} has invalid slash-safe name '${name}'`);
    assert.equal(
      LEGACY_SPANISH_NAMES.has(name),
      false,
      `${pathLabel} uses legacy spanish alias '${name}' instead of canonical english name`
    );
  }

  function walkOptions(options, labelPrefix) {
    if (!Array.isArray(options)) return;
    for (const option of options) {
      const optionLabel = `${labelPrefix}.${option.name || "option"}`;
      assertCanonicalName(option.name, optionLabel);
      walkOptions(option.options, optionLabel);
    }
  }

  for (const command of commands) {
    const json = autoLocalizeCommandData(command.data);
    assert.ok(json, `/${command?.data?.name || "unknown"} has invalid command data`);
    assertCanonicalName(json.name, `/${json.name}`);
    walkOptions(json.options, `/${json.name}`);
  }
});
