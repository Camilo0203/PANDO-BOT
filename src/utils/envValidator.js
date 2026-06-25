"use strict";

/**
 * Environment Variable Validator
 * Validates all process.env variables with schemas and defaults
 */

const { parseBoolean, parsePort } = require("./envHelpers");

/**
 * @typedef {Object} EnvSchemaEntry
 * @property {boolean} required - Whether the variable is mandatory
 * @property {('string'|'number'|'boolean')} type - Expected type
 * @property {*} [default] - Default value if unset
 * @property {RegExp} [pattern] - Regex for string validation
 * @property {number} [min] - Minimum value for numbers
 * @property {number} [max] - Maximum value for numbers
 * @property {string[]} [enum] - Allowed string values
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the value passed validation
 * @property {string[]} errors - Human-readable error messages
 * @property {*|null} value - The parsed/coerced value
 */

/**
 * @type {Object.<string, EnvSchemaEntry>}
 */
const ENV_SCHEMA = {
  // Required
  DISCORD_TOKEN: { required: true, type: "string" },
  MONGO_URI: { required: true, type: "string" },
  OWNER_ID: { required: false, type: "string", pattern: /^\d{17,20}$/ },

  // Optional with defaults
  MONGO_DB: { required: false, type: "string", default: "ton618_bot" },
  NODE_ENV: { required: false, type: "string", default: "development" },
  LOG_LEVEL: { required: false, type: "string", default: "info", enum: ["error", "warn", "info", "debug"] },

  // Server/Port
  PORT: { required: false, type: "number", default: 80, min: 1, max: 65535 },
  SERVER_PORT: { required: false, type: "number", default: 8080, min: 1, max: 65535 },

  // MongoDB
  MONGO_MAX_POOL_SIZE: { required: false, type: "number", default: 10, min: 1, max: 100 },
  MONGO_SERVER_SELECTION_TIMEOUT_MS: { required: false, type: "number", default: 10000, min: 1000 },
  MONGO_CONNECT_TIMEOUT_MS: { required: false, type: "number", default: 15000, min: 1000 },
  MONGO_AUTO_INDEXES: { required: false, type: "boolean", default: false },

  // Discord Intents
  MESSAGE_CONTENT_ENABLED: { required: false, type: "boolean", default: true },
  GUILD_PRESENCES_ENABLED: { required: false, type: "boolean", default: true },

  // Feature Flags
  ENABLE_JSON_LOGS: { required: false, type: "boolean", default: false },
  ERROR_LOG_TO_FILE: { required: false, type: "boolean", default: true },

  // Timeouts
  SHUTDOWN_FORCE_TIMEOUT_MS: { required: false, type: "number", default: 30000, min: 1000 },
  SHUTDOWN_DRAIN_TIMEOUT_MS: { required: false, type: "number", default: 10000, min: 1000 },

  // Health
  HEALTH_STARTUP_GRACE_MS: { required: false, type: "number", default: 90000, min: 1000 },
  HEALTH_HEARTBEAT_MS: { required: false, type: "number", default: 60000, min: 1000 },
  HEALTH_EVALUATE_MS: { required: false, type: "number", default: 300000, min: 1000 },
  HEALTH_MONITOR_INTERVAL_MS: { required: false, type: "number", default: 30000, min: 5000 },
  HEALTH_CHECK_INTERVAL_MS: { required: false, type: "number", default: 30000, min: 5000 },

  // Rate Limiting
  USER_RATE_LIMIT_MAX_REQUESTS: { required: false, type: "number", default: 5, min: 1 },
  USER_RATE_LIMIT_WINDOW_MS: { required: false, type: "number", default: 60000, min: 1000 },

  // Dashboard Bridge
  DASHBOARD_BRIDGE_INTERVAL_MS: { required: false, type: "number", default: 60000, min: 5000 },
  DASHBOARD_HTTP_TIMEOUT_MS: { required: false, type: "number", default: 10000, min: 1000 },

  // Supabase (optional features)
  SUPABASE_URL: { required: false, type: "string" },
  SUPABASE_SERVICE_ROLE_KEY: { required: false, type: "string" },
  SUPABASE_ANON_KEY: { required: false, type: "string" },

  // Cryptography
  ENCRYPTION_KEY: { required: false, type: "string", pattern: /^[a-f0-9]{64}$/i },
  HASH_SALT: { required: false, type: "string", pattern: /^.{32,}$/ },

  // Premium/Billing (optional)
  TEBEX_STORE_URL: { required: false, type: "string", default: "https://store.ton618bot.xyz/" },
  PRO_UPGRADE_URL: { required: false, type: "string", default: "https://store.ton618bot.xyz/" },
  BOT_API_KEY: { required: false, type: "string" },

  // Web server
  DASH_API_KEY: { required: false, type: "string" },
  ALLOWED_ORIGINS: { required: false, type: "string" },
  BOT_GITHUB_URL: { required: false, type: "string" },
  BOT_INVITE_URL: { required: false, type: "string" },
  SUPPORT_SERVER_URL: { required: false, type: "string" },

  // Monitoring (optional)
  SENTRY_DSN: { required: false, type: "string" },
  LOGTAIL_SOURCE_TOKEN: { required: false, type: "string" },
  ALERT_DISCORD_WEBHOOK: { required: false, type: "string", pattern: /^https:\/\/discord\.com\/api\/webhooks\/\d+\/.+/ },
  SECURITY_ALERTS_WEBHOOK_URL: { required: false, type: "string", pattern: /^https:\/\/discord\.com\/api\/webhooks\/\d+\/.+/ },
  OPERATIONAL_ALERT_COOLDOWN_MS: { required: false, type: "number", default: 300000, min: 10000 },
  MEMORY_WARNING_THRESHOLD_MB: { required: false, type: "number", default: 0, min: 0 },
};

/**
 * Validate a single environment variable against its schema
 * @param {string} key - Variable name
 * @param {string|undefined} value - Raw value from process.env
 * @param {EnvSchemaEntry} schema - Validation rules
 * @returns {ValidationResult}
 */
function validateValue(key, value, schema) {
  const errors = [];

  // Required check
  if (schema.required && !value) {
    errors.push(`${key} is required but not set`);
    return { valid: false, errors, value: null };
  }

  // If not required and no value, use default
  if (!value && schema.default !== undefined) {
    return { valid: true, errors: [], value: schema.default };
  }

  if (!value) {
    return { valid: true, errors: [], value: null };
  }

  // Type validation
  let typedValue = value;

  if (schema.type === "number") {
    typedValue = Number(value);
    if (isNaN(typedValue)) {
      errors.push(`${key} must be a number, got "${value}"`);
    }
    if (schema.min !== undefined && typedValue < schema.min) {
      errors.push(`${key} must be at least ${schema.min}, got ${typedValue}`);
    }
    if (schema.max !== undefined && typedValue > schema.max) {
      errors.push(`${key} must be at most ${schema.max}, got ${typedValue}`);
    }
  }

  if (schema.type === "boolean") {
    typedValue = parseBoolean(value, schema.default);
  }

  if (schema.type === "string" && schema.pattern) {
    if (!schema.pattern.test(value)) {
      errors.push(`${key} format is invalid`);
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${key} must be one of: ${schema.enum.join(", ")}`);
  }

  return { valid: errors.length === 0, errors, value: typedValue };
}

/**
 * Validate all environment variables
 * @returns {{valid: boolean, errors: string[], warnings: string[], values: Object.<string, *>}}
 */
function validateAllEnv() {
  const errors = [];
  const warnings = [];
  const values = {};

  for (const [key, schema] of Object.entries(ENV_SCHEMA)) {
    const rawValue = process.env[key];
    const result = validateValue(key, rawValue, schema);

    if (result.errors.length > 0) {
      errors.push(...result.errors);
    }

    values[key] = result.value;
  }

  // Additional validation: warn about unknown env vars
  const knownKeys = Object.keys(ENV_SCHEMA);
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("npm_") || key.startsWith("NODE_")) continue;
    if (!knownKeys.includes(key)) {
      warnings.push(`Unknown environment variable: ${key}`);
    }
  }

  // Production security checks
  if (process.env.NODE_ENV === "production") {
    const mongoUri = process.env.MONGO_URI || "";
    if (mongoUri && !/(tls|ssl)=true/.test(mongoUri) && !mongoUri.includes("mongodb+srv://")) {
      warnings.push("MONGO_URI does not enforce TLS/SSL in production. Consider adding ?tls=true or using mongodb+srv://");
    }
    
    // CRITICAL: Encryption keys (must not be empty in production)
    const encryptionKeyPattern = /^[a-f0-9]{64}$/i;
    if (!process.env.ENCRYPTION_KEY) {
      errors.push("🔴 CRITICAL: ENCRYPTION_KEY is not set. This key is required for secure data storage. Generate with: node scripts/generate-production-keys.js");
    } else if (!encryptionKeyPattern.test(process.env.ENCRYPTION_KEY)) {
      errors.push("🔴 CRITICAL: ENCRYPTION_KEY format invalid. Must be 64 hexadecimal characters (256-bit). Generate with: node scripts/generate-production-keys.js");
    }
    
    if (!process.env.HASH_SALT) {
      errors.push("🔴 CRITICAL: HASH_SALT is not set. This salt is required for consistent hashing. Generate with: node scripts/generate-production-keys.js");
    } else if (process.env.HASH_SALT.length < 32) {
      errors.push("🔴 CRITICAL: HASH_SALT must be at least 32 characters long. Generate with: node scripts/generate-production-keys.js");
    }
    
    if (!process.env.DASH_API_KEY) {
      errors.push("🔴 CRITICAL: DASH_API_KEY is not set. Dashboard has NO authentication without this. Generate with: node scripts/generate-production-keys.js");
    } else if (process.env.DASH_API_KEY.length < 32) {
      errors.push("🔴 CRITICAL: DASH_API_KEY must be at least 32 characters. Generate with: node scripts/generate-production-keys.js");
    }
    
    if (!process.env.BOT_API_KEY) {
      errors.push("🔴 CRITICAL: BOT_API_KEY is not set. This key is required for Supabase communication. Generate with: node scripts/generate-production-keys.js");
    } else if (process.env.BOT_API_KEY.length < 32) {
      errors.push("🔴 CRITICAL: BOT_API_KEY must be at least 32 characters. Generate with: node scripts/generate-production-keys.js");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    values,
  };
}

/**
 * Get validated env value
 * @param {string} key - Environment variable name
 * @param {*} defaultValue - Fallback value
 * @returns {*}
 */
function getEnv(key, defaultValue = undefined) {
  const schema = ENV_SCHEMA[key];
  if (!schema) {
    return process.env[key] ?? defaultValue;
  }

  const rawValue = process.env[key];
  const result = validateValue(key, rawValue, schema);
  return result.value ?? defaultValue;
}

/**
 * Check if required env vars are set
 * Quick check for startup
 */
function quickValidate() {
  const required = ["DISCORD_TOKEN", "MONGO_URI"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    return { valid: false, missing };
  }

  return { valid: true, missing: [] };
}

/**
 * Validate production environment - strict checks
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
function validateProductionEnv() {
  const result = validateAllEnv();
  
  if (!result.valid) {
    console.error('\n❌ PRODUCTION VALIDATION FAILED:');
    result.errors.forEach(err => console.error(`  ${err}`));
    console.error('\nℹ️  Generate production keys with: node scripts/generate-production-keys.js\n');
  }
  
  if (result.warnings.length > 0) {
    console.warn('\n⚠️  PRODUCTION WARNINGS:');
    result.warnings.forEach(warn => console.warn(`  ${warn}`));
    console.warn();
  }
  
  return result;
}

module.exports = {
  validateAllEnv,
  validateProductionEnv,
  getEnv,
  quickValidate,
  ENV_SCHEMA,
};
