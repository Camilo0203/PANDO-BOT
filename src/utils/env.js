const { parsePort, resolveRuntimePort } = require("./envHelpers");

function toInt(value, fallback = null) {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

function parseOptionalBoolean(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function resolveValidationMode(env = process.env, options = {}) {
  const requestedMode = String(
    options.mode
    || env.TON618_ENV_VALIDATION_MODE
    || env.NODE_ENV
    || ""
  ).trim().toLowerCase();

  if (["prod", "production"].includes(requestedMode)) {
    return "production";
  }

  return "default";
}

function validateEnv(env = process.env, options = {}) {
  const errors = [];
  const warnings = [];
  const mode = resolveValidationMode(env, options);
  const strictProduction = mode === "production";

  const token = env.DISCORD_TOKEN;
  if (!token || token.trim().length === 0) {
    errors.push("DISCORD_TOKEN is missing.");
  } else if (token.trim().length < 59) {
    // Discord bot tokens are typically 70+ chars (base64 id . timestamp . hmac).
    // A length below 59 almost certainly means a placeholder or truncated value.
    errors.push("DISCORD_TOKEN looks too short (minimum 59 chars). Check for accidental truncation.");
  }

  const mongoUri = env.MONGO_URI;
  if (!mongoUri || !/^mongodb(\+srv)?:\/\//i.test(mongoUri.trim())) {
    errors.push("MONGO_URI is missing or invalid (must start with mongodb:// or mongodb+srv://).");
  }

  const mongoDb = env.MONGO_DB;
  if (!mongoDb || !mongoDb.trim()) {
    warnings.push("MONGO_DB is not set. Using default 'ton618_bot'.");
  }

  const ownerId = env.OWNER_ID || env.DISCORD_OWNER_ID;
  if (!ownerId) {
    if (strictProduction) {
      errors.push("OWNER_ID is required in production for privileged and operator-only flows.");
    } else {
      warnings.push("OWNER_ID is not set. Developer-only commands may not behave as expected.");
    }
  } else if (!/^\d{17,20}$/.test(ownerId.trim())) {
    if (strictProduction) {
      errors.push("OWNER_ID format looks invalid. Expected a Discord snowflake.");
    } else {
      warnings.push("OWNER_ID format looks invalid. Expected a Discord snowflake.");
    }
  }

  for (const key of ["PORT", "SERVER_PORT"]) {
    if (env[key] === undefined) continue;
    const parsed = parsePort(env[key], null);
    if (parsed === null) {
      errors.push(`${key} must be an integer between 1 and 65535.`);
    }
  }

  const messageContentEnabled = parseOptionalBoolean(env.MESSAGE_CONTENT_ENABLED);
  if (env.MESSAGE_CONTENT_ENABLED !== undefined && messageContentEnabled === undefined) {
    errors.push("MESSAGE_CONTENT_ENABLED must be a boolean-like value (true/false, 1/0, yes/no, on/off).");
  }

  const guildPresencesEnabled = parseOptionalBoolean(env.GUILD_PRESENCES_ENABLED);
  if (env.GUILD_PRESENCES_ENABLED !== undefined && guildPresencesEnabled === undefined) {
    errors.push("GUILD_PRESENCES_ENABLED must be a boolean-like value (true/false, 1/0, yes/no, on/off).");
  }

  const errorLogToFile = parseOptionalBoolean(env.ERROR_LOG_TO_FILE);
  if (env.ERROR_LOG_TO_FILE !== undefined && errorLogToFile === undefined) {
    errors.push("ERROR_LOG_TO_FILE must be a boolean-like value (true/false, 1/0, yes/no, on/off).");
  }
  // Square Cloud has an ephemeral filesystem — file logs are lost on every restart.
  if (strictProduction && errorLogToFile === true) {
    warnings.push("ERROR_LOG_TO_FILE=true on Square Cloud writes to ephemeral storage (lost on restart). Set to false and use stdout logging instead.");
  }

  const botApiKey = env.BOT_API_KEY;
  if (strictProduction) {
    if (!botApiKey || !botApiKey.trim()) {
      errors.push("BOT_API_KEY is required in production. The premium service uses it to authenticate against the Supabase billing-guild-status function.");
    } else if (botApiKey.trim().length < 32) {
      errors.push("BOT_API_KEY must be at least 32 characters in production (use a 64-char hex string for security).");
    }
  } else if (!botApiKey || !botApiKey.trim()) {
    warnings.push("BOT_API_KEY is not set. Premium features will be disabled.");
  }

  const proUpgradeUrl = env.PRO_UPGRADE_URL;
  if (strictProduction && (!proUpgradeUrl || !proUpgradeUrl.trim())) {
    warnings.push("PRO_UPGRADE_URL is not set. Premium upgrade embeds will show no link.");
  }

  // Square Cloud health check requires PORT=80
  if (strictProduction) {
    const prodPort = resolveRuntimePort(env, { defaultPort: 80 });
    if (prodPort !== null && prodPort !== 80) {
      warnings.push("Square Cloud requires PORT=80 for health checks. Current: " + prodPort);
    }
    if (env.PORT === undefined && parsePort(env.SERVER_PORT, null) !== null) {
      warnings.push("SERVER_PORT is ignored for production startup when PORT is absent. Square Cloud should provide PORT=80.");
    }
  }

  // MongoDB auto-indexes: without this, indexes won't be created on first deploy
  if (strictProduction && !env.MONGO_AUTO_INDEXES) {
    warnings.push("MONGO_AUTO_INDEXES is not set. Run 'npm run db:indexes' once after first deploy, or set MONGO_AUTO_INDEXES=true.");
  }

  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (supabaseUrl && !supabaseKey) {
    warnings.push("SUPABASE_URL is set but no Supabase key was found. Bot stats sync will stay disabled.");
  }
  if (!supabaseUrl && supabaseKey) {
    warnings.push("A Supabase key is set but SUPABASE_URL is missing. Bot stats sync will stay disabled.");
  }
  if (supabaseUrl && supabaseKey && !env.SUPABASE_SERVICE_ROLE_KEY) {
    if (strictProduction) {
      errors.push("SUPABASE_SERVICE_ROLE_KEY is required in production whenever Supabase integration is configured.");
    } else {
      warnings.push("SUPABASE_SERVICE_ROLE_KEY is missing. Bot stats reads may work, but writes can fail while RLS is enabled.");
    }
  }

  const dashboardBridgeIntervalMs = toInt(
    env.DASHBOARD_BRIDGE_INTERVAL_MS || env.SUPABASE_DASHBOARD_SYNC_INTERVAL_MS,
    null
  );
  if (dashboardBridgeIntervalMs !== null && (dashboardBridgeIntervalMs < 30000 || dashboardBridgeIntervalMs > 300000)) {
    warnings.push("DASHBOARD_BRIDGE_INTERVAL_MS outside recommended range (30000-300000). Beta billing expects 60000ms.");
  }
  if (supabaseUrl && supabaseKey && dashboardBridgeIntervalMs !== null && dashboardBridgeIntervalMs > 60000) {
    warnings.push("DASHBOARD_BRIDGE_INTERVAL_MS above 60000ms. Paid beta plan projection may feel delayed.");
  }

  // Hash salt validation (HMAC-SHA256 salt should be random and stable)
  const hashSalt = env.HASH_SALT;
  if (hashSalt) {
    if (hashSalt.trim().length < 32) {
      if (strictProduction) {
        errors.push("HASH_SALT must be at least 32 characters for secure HMAC-SHA256 operations.");
      } else {
        warnings.push("HASH_SALT is shorter than 32 characters. Use a longer random string for security.");
      }
    }
  } else if (strictProduction) {
    errors.push("HASH_SALT is required in production. Without it, HMAC hashes will be ephemeral and not stable across restarts.");
  } else {
    warnings.push("HASH_SALT is not set. HMAC hashes will use an ephemeral per-process salt — not stable across restarts.");
  }

  // Encryption key validation (AES-256 requires 32 bytes = 64 hex chars)
  const encryptionKey = env.ENCRYPTION_KEY;
  if (encryptionKey) {
    if (encryptionKey.trim().length < 64) {
      if (strictProduction) {
        errors.push("ENCRYPTION_KEY must be at least 64 hex characters (32 bytes) for AES-256. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
      } else {
        warnings.push("ENCRYPTION_KEY is shorter than 64 characters. AES-256 requires a 32-byte key (64 hex chars). Sensitive field encryption may be weak.");
      }
    }
  } else if (strictProduction) {
    warnings.push("ENCRYPTION_KEY is not set. Sensitive fields in MongoDB will not be encrypted at rest. Set it to a 64-char hex string.");
  }

  // Sentry validation for production error tracking
  if (strictProduction && !env.SENTRY_DSN) {
    warnings.push("SENTRY_DSN is recommended in production for error tracking and observability.");
  }
  if (env.SENTRY_DSN && !/^https:\/\/[a-f0-9]+@[a-f0-9]+\.ingest\.sentry\.io\/\d+$/i.test(env.SENTRY_DSN)) {
    warnings.push("SENTRY_DSN format looks invalid. Expected format: https://<key>@<org>.ingest.sentry.io/<project>");
  }

  // Alert webhook validation
  if (env.ALERT_DISCORD_WEBHOOK && !/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/i.test(env.ALERT_DISCORD_WEBHOOK)) {
    warnings.push("ALERT_DISCORD_WEBHOOK format looks invalid. Expected: https://discord.com/api/webhooks/<id>/<token>");
  }

  // Numeric range validations for rate limiting and caching
  const userRateLimitMax = toInt(env.USER_RATE_LIMIT_MAX_REQUESTS, null);
  if (userRateLimitMax !== null && (userRateLimitMax < 1 || userRateLimitMax > 1000)) {
    errors.push("USER_RATE_LIMIT_MAX_REQUESTS must be between 1 and 1000.");
  }

  const userRateLimitWindow = toInt(env.USER_RATE_LIMIT_WINDOW_SECONDS, null);
  if (userRateLimitWindow !== null && (userRateLimitWindow < 1 || userRateLimitWindow > 3600)) {
    errors.push("USER_RATE_LIMIT_WINDOW_SECONDS must be between 1 and 3600.");
  }

  const settingsCacheTtl = toInt(env.SETTINGS_CACHE_TTL_SECONDS, null);
  if (settingsCacheTtl !== null && (settingsCacheTtl < 5 || settingsCacheTtl > 300)) {
    warnings.push("SETTINGS_CACHE_TTL_SECONDS outside recommended range (5-300). Using default: 30s.");
  }

  const healthCheckInterval = toInt(env.HEALTH_CHECK_INTERVAL_MS, null);
  if (healthCheckInterval !== null && (healthCheckInterval < 5000 || healthCheckInterval > 60000)) {
    warnings.push("HEALTH_CHECK_INTERVAL_MS outside recommended range (5000-60000).");
  }

  // Bot intent validations
  const requiredIntents = ["Guilds", "GuildMembers", "GuildMessages", "DirectMessages"];
  const missingIntents = requiredIntents.filter(intent => {
    const envKey = `DISCORD_INTENT_${intent.toUpperCase()}`;
    const val = parseOptionalBoolean(env[envKey]);
    return val === false; // explicitly disabled
  });
  if (missingIntents.length > 0) {
    errors.push(`Required Discord intents disabled: ${missingIntents.join(", ")}. Bot may not function correctly.`);
  }

  // MongoDB pool size validation
  const mongoMaxPoolSize = toInt(env.MONGO_MAX_POOL_SIZE, null);
  if (mongoMaxPoolSize !== null && (mongoMaxPoolSize < 1 || mongoMaxPoolSize > 100)) {
    errors.push("MONGO_MAX_POOL_SIZE must be between 1 and 100.");
  }

  // Shard validation
  if (env.DISCORD_SHARD_COUNT) {
    const shardCount = toInt(env.DISCORD_SHARD_COUNT, null);
    if (shardCount !== null && (shardCount < 1 || shardCount > 100)) {
      errors.push("DISCORD_SHARD_COUNT must be between 1 and 100.");
    }
    if (env.DISCORD_SHARD_ID !== undefined) {
      const shardId = toInt(env.DISCORD_SHARD_ID, null);
      if (shardId !== null && shardCount !== null && (shardId < 0 || shardId >= shardCount)) {
        errors.push("DISCORD_SHARD_ID must be between 0 and DISCORD_SHARD_COUNT-1.");
      }
    }
  }

  // Distributed locks configuration (enterprise feature)
  if (env.INSTANCE_ID && !/^[a-zA-Z0-9_-]{1,50}$/.test(env.INSTANCE_ID)) {
    warnings.push("INSTANCE_ID format looks invalid. Use alphanumeric, hyphens and underscores only (max 50 chars).");
  }

  const lockTimeoutMs = toInt(env.LOCK_TIMEOUT_MS, null);
  if (lockTimeoutMs !== null && (lockTimeoutMs < 5000 || lockTimeoutMs > 300000)) {
    warnings.push("LOCK_TIMEOUT_MS outside recommended range (5000-300000). Using default: 30000.");
  }

  const lockHeartbeatMs = toInt(env.LOCK_HEARTBEAT_MS, null);
  if (lockHeartbeatMs !== null && (lockHeartbeatMs < 1000 || lockHeartbeatMs > 60000)) {
    warnings.push("LOCK_HEARTBEAT_MS outside recommended range (1000-60000). Using default: 10000.");
  }

  const maxLockDurationMs = toInt(env.MAX_LOCK_DURATION_MS, null);
  if (maxLockDurationMs !== null && (maxLockDurationMs < 10000 || maxLockDurationMs > 600000)) {
    warnings.push("MAX_LOCK_DURATION_MS outside recommended range (10000-600000). Using default: 60000.");
  }

  // Shutdown manager configuration
  const shutdownDrainTimeoutMs = toInt(env.SHUTDOWN_DRAIN_TIMEOUT_MS, null);
  if (shutdownDrainTimeoutMs !== null && (shutdownDrainTimeoutMs < 1000 || shutdownDrainTimeoutMs > 120000)) {
    warnings.push("SHUTDOWN_DRAIN_TIMEOUT_MS outside recommended range (1000-120000). Using default: 10000.");
  }

  const shutdownForceTimeoutMs = toInt(env.SHUTDOWN_FORCE_TIMEOUT_MS, null);
  if (shutdownForceTimeoutMs !== null && (shutdownForceTimeoutMs < 5000 || shutdownForceTimeoutMs > 300000)) {
    warnings.push("SHUTDOWN_FORCE_TIMEOUT_MS outside recommended range (5000-300000). Using default: 30000.");
  }

  // Memory thresholds configuration
  const memoryWarningThreshold = toInt(env.MEMORY_WARNING_THRESHOLD, null);
  if (memoryWarningThreshold !== null && (memoryWarningThreshold < 50 || memoryWarningThreshold > 95)) {
    warnings.push("MEMORY_WARNING_THRESHOLD outside recommended range (50-95). Using default: 70.");
  }

  const memoryCriticalThreshold = toInt(env.MEMORY_CRITICAL_THRESHOLD, null);
  if (memoryCriticalThreshold !== null && (memoryCriticalThreshold < 70 || memoryCriticalThreshold > 99)) {
    warnings.push("MEMORY_CRITICAL_THRESHOLD outside recommended range (70-99). Using default: 85.");
  }

  return { errors, warnings };
}

module.exports = {
  resolveValidationMode,
  validateEnv,
};
