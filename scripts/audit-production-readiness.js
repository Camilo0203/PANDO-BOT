"use strict";

const fs = require("node:fs");
const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const { MESSAGES, t } = require("../src/utils/i18n");
const { loadAndValidateCommands } = require("../src/utils/commandLoader");

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
const ALLOWED_HELP_PSEUDO_TARGETS = new Set(["staffops"]);

const CRITICAL_RUNTIME_KEYS = [
  "common.labels.onboarding_status",
  "common.labels.last_updated",
  "interaction.unexpected",
  "premium.guild_only",
  "premium.owner_only",
  "premium.error_fetching",
  "premium.error_generic",
  "premium.status_title",
  "premium.pro_active",
  "premium.free_plan",
  "premium.plan_label",
  "premium.status_label",
  "premium.time_remaining",
  "premium.started_at",
  "premium.expires_at",
  "premium.source_label",
  "premium.supporter_status",
  "premium.supporter_active",
  "premium.active",
  "premium.upgrade_label",
  "premium.upgrade_cta",
  "premium.slash.description",
  "premium.slash.status",
  "stats.no_sla_threshold",
  "stats.not_configured",
  "stats.period_all",
  "stats.period_month",
  "stats.period_week",
  "stats.ratings_title",
  "stats.ratings_empty",
  "stats.fallback_user",
  "stats.fallback_staff",
  "stats.staff_no_data_title",
  "stats.staff_no_data_description",
  "support_server.restricted",
];

function sortStrings(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function diffList(actual, expected) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return {
    missing: expected.filter((item) => !actualSet.has(item)),
    unexpected: actual.filter((item) => !expectedSet.has(item)),
  };
}

function validateCriticalRuntimeKeys() {
  const issues = [];

  for (const key of CRITICAL_RUNTIME_KEYS) {
    const en = t("en", key);
    const es = t("es", key);
    if (en === key) issues.push(`missing en locale key: ${key}`);
    if (es === key) issues.push(`missing es locale key: ${key}`);
  }

  return issues;
}

function walkSlashOptions(option, pathTokens, issues) {
  const currentPath = [...pathTokens, option.name].join(" > ");

  if (option.type !== 1 && option.type !== 2) {
    if (!option.description_localizations?.["es-ES"]) {
      issues.push(`missing es slash localization: ${currentPath}`);
    }
  }

  for (const child of option.options || []) {
    walkSlashOptions(child, [...pathTokens, option.name], issues);
  }
}

function validateSlashLocalizations(commands) {
  const issues = [];

  for (const command of commands) {
    const json = command.data.toJSON();
    if (!json.description_localizations?.["es-ES"]) {
      issues.push(`missing es command description: /${json.name}`);
    }

    for (const option of json.options || []) {
      walkSlashOptions(option, [json.name], issues);
    }
  }

  return issues;
}

function validateHelpKeys(srcDir, allCommandNames) {
  const issues = [];
  const localeFiles = [
    path.join(srcDir, "locales", "en.js"),
    path.join(srcDir, "locales", "es.js"),
  ];

  const overviewPattern = /"help\.embed\.overviews\.([^"]+)"/g;
  const usagePattern = /"help\.embed\.usages\.([^"]+)"/g;

  for (const file of localeFiles) {
    const source = fs.readFileSync(file, "utf8");

    for (const match of source.matchAll(overviewPattern)) {
      const commandName = match[1];
      if (!allCommandNames.has(commandName) && !ALLOWED_HELP_PSEUDO_TARGETS.has(commandName)) {
        issues.push(`help overview points to missing command '${commandName}' in ${path.basename(file)}`);
      }
    }

    for (const match of source.matchAll(usagePattern)) {
      const usageKey = match[1];
      const commandName = usageKey.split("_")[0];
      if (!allCommandNames.has(commandName) && !ALLOWED_HELP_PSEUDO_TARGETS.has(commandName)) {
        issues.push(`help usage points to missing command '${usageKey}' in ${path.basename(file)}`);
      }
    }
  }

  return issues;
}

function flattenLocaleKeys(source, prefix = "", keys = new Set()) {
  if (!source || typeof source !== "object") {
    return keys;
  }

  for (const [key, value] of Object.entries(source)) {
    const next = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string") {
      keys.add(next);
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      flattenLocaleKeys(value, next, keys);
      continue;
    }
  }

  return keys;
}

function collectStaticLocaleKeys(srcDir) {
  const keys = new Set();
  const localeCallPattern = /\b(?:t|helpText|setupT|configT)\(\s*[^,]+,\s*["'`]([a-z0-9_.-]+)["'`]/gi;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "locales" || entry.name === "node_modules") continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (!entry.isFile() || !fullPath.endsWith(".js")) continue;

      const source = fs.readFileSync(fullPath, "utf8");
      for (const match of source.matchAll(localeCallPattern)) {
        const key = match[1];
        if (!key || !key.includes(".")) continue;
        keys.add(key);
      }
    }
  }

  walk(srcDir);
  return keys;
}

function buildLegacyLocaleReport(srcDir) {
  const referencedKeys = collectStaticLocaleKeys(srcDir);
  const enKeys = flattenLocaleKeys(MESSAGES.en);
  const esKeys = flattenLocaleKeys(MESSAGES.es);

  const orphanEn = sortStrings([...enKeys].filter((key) => !referencedKeys.has(key)));
  const orphanEs = sortStrings([...esKeys].filter((key) => !referencedKeys.has(key)));

  return {
    referencedKeyCount: referencedKeys.size,
    orphanEnCount: orphanEn.length,
    orphanEsCount: orphanEs.length,
    orphanEnSample: orphanEn.slice(0, 40),
    orphanEsSample: orphanEs.slice(0, 40),
  };
}

function main() {
  const commandsBaseDir = path.resolve(__dirname, "..", "src", "commands");
  const srcDir = path.resolve(__dirname, "..", "src");
  const { commands, validationErrors } = loadAndValidateCommands(commandsBaseDir);
  const issues = [...validationErrors];

  for (const command of commands) {
    if (typeof command.execute !== "function") {
      issues.push(`missing execute() for /${command?.data?.name || "unknown"}`);
    }
  }

  const publicCommands = sortStrings(
    commands.filter((command) => !command.meta?.privateOnly).map((command) => command.data.name)
  );
  const privateCommands = sortStrings(
    commands.filter((command) => command.meta?.privateOnly).map((command) => command.data.name)
  );

  const publicDiff = diffList(publicCommands, sortStrings(EXPECTED_PUBLIC_COMMANDS));
  const privateDiff = diffList(privateCommands, sortStrings(EXPECTED_PRIVATE_COMMANDS));

  issues.push(...publicDiff.missing.map((name) => `expected public command missing: ${name}`));
  issues.push(...publicDiff.unexpected.map((name) => `unexpected public command detected: ${name}`));
  issues.push(...privateDiff.missing.map((name) => `expected private command missing: ${name}`));
  issues.push(...privateDiff.unexpected.map((name) => `unexpected private command detected: ${name}`));

  issues.push(...validateSlashLocalizations(commands));
  issues.push(...validateCriticalRuntimeKeys());
  issues.push(...validateHelpKeys(srcDir, new Set(commands.map((command) => command.data.name))));

  const legacyLocaleReport = buildLegacyLocaleReport(srcDir);

  const summary = {
    publicCommands,
    privateCommands,
    issues,
    legacyLocaleReport,
  };

  if (issues.length) {
    console.error(JSON.stringify(summary, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(summary, null, 2));
}

main();
