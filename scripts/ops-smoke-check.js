"use strict";

require("dotenv").config({ path: [".env.local", ".env"], quiet: true });
const { resolveRuntimePort } = require("../src/utils/envHelpers");

function getPositionalArg(argv = process.argv) {
  return argv.slice(2).find((arg) => !arg.startsWith("--")) || null;
}

function hasFlag(flag, argv = process.argv) {
  return argv.includes(flag);
}

function resolveHealthUrl(argv = process.argv, env = process.env) {
  const explicit = getPositionalArg(argv) || env.BOT_HEALTHCHECK_URL;
  if (explicit) return explicit;

  const port = resolveRuntimePort(env, { defaultPort: 8080 });
  return `http://127.0.0.1:${port}/health`;
}

function shouldAllowDegraded(argv = process.argv, env = process.env) {
  return hasFlag("--allow-degraded", argv) || env.BOT_HEALTHCHECK_ALLOW_DEGRADED === "true";
}

function validateHealthPayload(payload, options = {}) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Health payload is not a valid JSON object.");
  }

  if (!payload.fingerprint) {
    throw new Error("Health payload did not include fingerprint.");
  }

  const allowedStatuses = options.allowDegraded ? ["ok", "degraded"] : ["ok"];
  if (!allowedStatuses.includes(payload.status)) {
    throw new Error(`Unexpected health status: ${payload.status}`);
  }

  if (payload.shuttingDown === true) {
    throw new Error("Health payload indicates the bot is shutting down.");
  }

  if (payload.mongoConnected !== true) {
    throw new Error("Health payload indicates MongoDB is not connected.");
  }

  if (payload.discordReady !== true) {
    throw new Error("Health payload indicates Discord is not ready.");
  }
}

async function fetchHealthPayload(url, options = {}) {
  const response = await (options.fetchImpl || fetch)(url, {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return response.json();
}

async function main(options = {}) {
  const argv = options.argv || process.argv;
  const env = options.env || process.env;
  const url = resolveHealthUrl(argv, env);
  const allowDegraded = shouldAllowDegraded(argv, env);
  const payload = await fetchHealthPayload(url, {
    fetchImpl: options.fetchImpl,
  });

  validateHealthPayload(payload, { allowDegraded });
  console.log(`TON618 health ok: ${payload.status} | fingerprint=${payload.fingerprint}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Smoke check failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  resolveHealthUrl,
  shouldAllowDegraded,
  validateHealthPayload,
  fetchHealthPayload,
  main,
};
