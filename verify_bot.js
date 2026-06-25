"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { loadAndValidateCommands } = require("./src/utils/commandLoader");

const ROOT = __dirname;
const COMMANDS_DIR = path.join(ROOT, "src", "commands");
const EVENTS_DIR = path.join(ROOT, "src", "events");

function listRuntimeModules(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => path.join(dir, entry.name));
}

function main() {
  console.log("=== TON618 RUNTIME VERIFICATION ===");
  console.log(`Node: ${process.version}`);

  const { commands, validationErrors } = loadAndValidateCommands(COMMANDS_DIR);
  if (validationErrors.length) {
    for (const error of validationErrors) {
      console.error(`COMMAND ERROR: ${error}`);
    }
  } else {
    console.log(`Commands: ${commands.length} loaded and validated.`);
  }

  const eventErrors = [];
  for (const filePath of listRuntimeModules(EVENTS_DIR)) {
    try {
      delete require.cache[require.resolve(filePath)];
      const event = require(filePath);
      if (!event?.name || typeof event.execute !== "function") {
        eventErrors.push(`${path.relative(ROOT, filePath)} has an invalid event export.`);
      }
    } catch (error) {
      eventErrors.push(`${path.relative(ROOT, filePath)}: ${error?.message || String(error)}`);
    }
  }

  if (eventErrors.length) {
    for (const error of eventErrors) {
      console.error(`EVENT ERROR: ${error}`);
    }
  } else {
    console.log("Events: all runtime event modules loaded successfully.");
  }

  const locales = ["en", "es"];
  for (const language of locales) {
    const locale = require(`./src/locales/${language}`);
    if (!locale || typeof locale !== "object" || !Object.keys(locale).length) {
      console.error(`LOCALE ERROR: ${language} is empty or invalid.`);
      validationErrors.push(`Invalid ${language} locale`);
    } else {
      console.log(`Locale ${language}: ${Object.keys(locale).length} top-level entries loaded.`);
    }
  }

  const failed = validationErrors.length > 0 || eventErrors.length > 0;
  console.log(failed ? "RESULT: FAILED" : "RESULT: PASSED");
  process.exitCode = failed ? 1 : 0;
}

main();
