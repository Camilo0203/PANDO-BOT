"use strict";

const helmet = require("helmet");
const cors = require("cors");

/**
 * Allowed origins for CORS.
 * Add any new frontend domain here or via the ALLOWED_ORIGINS env variable
 * (comma-separated list).
 */
const BASE_ORIGINS = [
  "https://ton618bot.xyz",
  "https://www.ton618bot.xyz",
  "https://ton618.app",
  "https://www.ton618.app",
  "https://ton618-web.squareweb.app",
  "https://ton618.squareweb.app",
  "https://dash.ton618bot.xyz",
  "https://status.ton618bot.xyz",
  "https://ton618-status.squareweb.app",
  // Tebex store frontend
  "https://store.ton618bot.xyz",
  // Tebex origins for webhook validation
  "https://tebex.io",
  "https://www.tebex.io",
  "https://checkout.tebex.io",
  "https://creator.tebex.io",
];

function buildAllowedOrigins() {
  const fromEnv = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const devOrigins =
    process.env.NODE_ENV !== "production"
      ? ["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"]
      : [];

  return [...new Set([...BASE_ORIGINS, ...fromEnv, ...devOrigins])];
}

/**
 * CORS middleware — only allows whitelisted origins.
 * Webhook routes that receive external requests (Tebex) should NOT use this.
 */
function createCorsMiddleware() {
  const allowedOrigins = buildAllowedOrigins();

  return cors({
    origin(requestOrigin, callback) {
      // Allow server-to-server calls and health probes (no Origin header)
      if (!requestOrigin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(requestOrigin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin '${requestOrigin}' not allowed`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Api-Key", "X-Tebex-Signature"],
    credentials: true,
    maxAge: 86400,
  });
}

/**
 * Helmet middleware — sets secure HTTP headers.
 * CSP permite inline scripts/styles para el dashboard interno.
 * Para la landing pública se heredan estas mismas directivas (aceptable).
 */
function createHelmetMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
        fontSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://cdn.discordapp.com", "https://cdn.tebex.io"],
        connectSrc: ["'self'", "https://headless.tebex.io", "https://checkout.tebex.io", "https://ton618bot.xyz", "https://*.ton618bot.xyz"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
}

module.exports = { createCorsMiddleware, createHelmetMiddleware, buildAllowedOrigins };
