"use strict";

/**
 * @typedef {('error'|'warn'|'info'|'debug')} LogLevel
 */

/**
 * @typedef {Object} StructuredLogEntry
 * @property {string} timestamp - ISO timestamp
 * @property {LogLevel} level - Log severity
 * @property {string} context - Component/area identifier
 * @property {string} message - Human-readable message
 * @property {Object.<string, *>} meta - Arbitrary structured metadata
 */

/**
 * Structured Logger
 * Log levels: error, warn, info, debug
 * Usage: logger.error('ctx', 'message', {meta}) or logStructured('level', 'ctx', {message, meta})
 */

const chalk = require("../../chalk-compat");
const { parseBoolean } = require("./envHelpers");

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const COLORS = {
  error: "red",
  warn: "yellow",
  info: "cyan",
  debug: "gray",
};

function getMinLogLevel() {
  const envLevel = String(process.env.LOG_LEVEL || "").toLowerCase();
  if (LOG_LEVELS[envLevel] !== undefined) {
    return LOG_LEVELS[envLevel];
  }
  // Default: error/warn in production, info in development
  return process.env.NODE_ENV === "production" ? LOG_LEVELS.warn : LOG_LEVELS.info;
}

function shouldLog(level) {
  return LOG_LEVELS[level] <= getMinLogLevel();
}

function formatTimestamp() {
  return new Date().toISOString();
}

function createStructuredLog(level, context, message, meta = {}) {
  return {
    timestamp: formatTimestamp(),
    level,
    context,
    message,
    ...meta,
    env: process.env.NODE_ENV || "development",
  };
}

/**
 * Remove sensitive fields from metadata in production
 * @param {Object.<string, *>|*} meta - Raw metadata object
 * @returns {Object.<string, *>|*}
 */
function sanitizeMetaForProduction(meta) {
  if (process.env.NODE_ENV !== 'production') return meta;
  if (!meta || typeof meta !== 'object') return meta;

  const sensitiveKeys = ['token', 'password', 'secret', 'authorization', 'credential', 'apikey', 'api_key'];
  const sanitized = {};

  for (const [key, value] of Object.entries(meta)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMetaForProduction(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Write a structured log entry
 * @param {LogLevel} level - Severity
 * @param {string} context - Component context
 * @param {string} message - Message text
 * @param {Object.<string, *>} [meta={}] - Structured metadata
 */
function log(level, context, message, meta = {}) {
  if (!shouldLog(level)) {
    return;
  }

  // Sanitizar metadata en producción
  const sanitizedMeta = process.env.NODE_ENV === 'production'
    ? sanitizeMetaForProduction(meta)
    : meta;

  const structured = createStructuredLog(level, context, message, sanitizedMeta);

  // In production with JSON logs enabled, output JSON
  const jsonLogsEnabled = parseBoolean(process.env.ENABLE_JSON_LOGS, false);
  if (process.env.NODE_ENV === "production" && jsonLogsEnabled) {
    console.log(JSON.stringify(structured));
    return;
  }

  // Development/pretty mode
  const colorFn = chalk[COLORS[level]] || ((x) => x);
  const prefix = `[${structured.timestamp}] [${level.toUpperCase()}] [${context}]`;

  if (level === "error") {
    console.error(colorFn(prefix), message);
    // Solo mostrar stack/errors en desarrollo
    if (process.env.NODE_ENV !== 'production' && (sanitizedMeta.error || sanitizedMeta.stack)) {
      console.error(colorFn("  →"), sanitizedMeta.error || sanitizedMeta.stack);
    }
  } else if (level === "warn") {
    console.warn(colorFn(prefix), message);
  } else {
    console.log(colorFn(prefix), message);
  }

  // Log additional metadata in debug mode (solo desarrollo)
  if (level === "debug" && process.env.NODE_ENV !== 'production' && Object.keys(sanitizedMeta).length > 0) {
    console.log(colorFn("  →"), sanitizedMeta);
  }
}

// Convenience methods
const logger = {
  error: (context, message, meta) => log("error", context, message, meta),
  warn: (context, message, meta) => log("warn", context, message, meta),
  info: (context, message, meta) => log("info", context, message, meta),
  debug: (context, message, meta) => log("debug", context, message, meta),

  // Legacy compatibility with logStructured
  structured: (level, context, meta = {}) => {
    log(level, context, meta.message || "", meta);
  },

  // Startup logging helper
  startup: (stage, message, type = "info") => {
    const colorFn = chalk[type] || chalk.blue;
    if (shouldLog("info")) {
      console.log(colorFn(`[startup:${stage}] ${message}`));
    }
  },
};

/**
 * Standalone structured log helper
 * @param {LogLevel} level - Severity
 * @param {string} context - Component context
 * @param {Object.<string, *>} [meta={}] - Structured metadata; message field becomes the primary text
 */
function logStructured(level, context, meta = {}) {
  log(level, context, meta.message || "", meta);
}

module.exports = logger;
module.exports.logStructured = logStructured;
