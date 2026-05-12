"use strict";

const express = require("express");
const vhost = require("vhost");
const logger = require("../utils/structuredLogger");
const { createCorsMiddleware, createHelmetMiddleware } = require("./middleware/security");

const { createLandingApp } = require("./apps/landing");
const { createHealthApp } = require("./apps/health");
const { createDashboardApp } = require("./apps/dashboard");
const { createTebexApp } = require("./apps/tebex");

// ── Globals ──
let _server = null;
let _startedAt = null;

/**
 * Build the main Express server with virtual-host routing.
 *
 * Routes:
 *   ton618bot.xyz      -> Landing page + Square Cloud probes
 *   health.ton618bot.xyz -> Detailed health API
 *   dash.ton618bot.xyz   -> Dashboard mini-app
 *
 * Square Cloud compatibility:
 *   - Uses process.env.PORT || 80
 *   - Global fallback /health and /ready before vhost (in case the Host header is missing)
 *   - Grace period preserved so early probes get 200 while booting
 */
function startWebServer({ healthState, buildInfo, getClient, port }) {
  if (_server) {
    return Promise.resolve(_server);
  }

  _startedAt = Date.now();
  const listenPort = parseInt(port, 10) || 80;

  return new Promise((resolve, reject) => {
    const mainApp = express();

    // ── Security headers (applies to all routes) ──
    mainApp.use(createHelmetMiddleware());
    mainApp.use(createCorsMiddleware());

    // Sub-applications
    const landingApp = createLandingApp({ healthState, buildInfo, getClient });
    const healthApp = createHealthApp({ healthState, buildInfo, getClient });
    const dashboardApp = createDashboardApp({ healthState, buildInfo, getClient });
    const tebexApp = createTebexApp({ getClient });

    // ── Global routes (before vhost - webhooks need no specific Host header) ──
    // Tebex validation probe: must respond 200 before vhost can redirect to landingApp
    mainApp.get("/webhook-tebex", (req, res) => {
      res.status(200).json({ status: "ok", message: "TON618 Tebex webhook endpoint ready" });
    });
    mainApp.use("/webhook-tebex", tebexApp);

    // ── Virtual host routing ──
    // These patterns match the Host header (case-insensitive).
    // Requests with a matching Host are handled by the sub-app.
    // If no Host matches, the request falls through to the global fallback below.
    mainApp.use(vhost("ton618bot.xyz", landingApp));
    mainApp.use(vhost("*.ton618bot.xyz", (req, res, next) => {
      // Delegate wildcard subdomains to the specific apps
      const host = req.headers.host || "";
      if (host.startsWith("health.")) {
        return healthApp(req, res, next);
      }
      if (host.startsWith("dash.")) {
        return dashboardApp(req, res, next);
      }
      next();
    }));
    // Also match "www.ton618bot.xyz" for landing
    mainApp.use(vhost("www.ton618bot.xyz", landingApp));

    // ── Global fallback: /health and /ready ──
    // Square Cloud (and some proxies) may hit the IP directly without a Host header.
    // These routes only run when no vhost matched (e.g. bare IP or unknown Host).
    const { buildHealthPayload } = require("../utils/runtimeHealth");

    const STARTUP_GRACE_MS = Number(process.env.HEALTH_STARTUP_GRACE_MS) || 90_000;
    function isInGracePeriod() {
      return Date.now() - _startedAt < STARTUP_GRACE_MS;
    }

    mainApp.get(["/health", "/"], (req, res) => {
      const client = typeof getClient === "function" ? getClient() : null;
      const payload = buildHealthPayload({ healthState, buildInfo, client });
      const booting = payload.status !== "ok" && isInGracePeriod();
      const httpStatus = (payload.status === "ok" || booting) ? 200 : 503;
      res.status(httpStatus).json({ ...payload, booting });
    });

    mainApp.get("/ready", (req, res) => {
      const client = typeof getClient === "function" ? getClient() : null;
      const payload = buildHealthPayload({ healthState, buildInfo, client });
      const httpStatus = payload.status === "ok" ? 200 : 503;
      res.status(httpStatus).json({ status: payload.status, uptimeSec: payload.uptimeSec });
    });

    // If no vhost matched and no fallback route hit, default to landing app
    mainApp.use((req, res, next) => {
      landingApp(req, res, next);
    });

    // ── Global error handler ──
    mainApp.use((err, req, res, _next) => {
      logger.error("webServer", "Unhandled error", {
        path: req.originalUrl,
        method: req.method,
        error: err?.message || String(err),
      });
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal Server Error", requestId: req.id });
      }
    });

    const server = mainApp.listen(listenPort, "0.0.0.0", () => {
      healthState.ghostPort = listenPort;
      logger.info("webServer", `Listening on 0.0.0.0:${listenPort}`, {
        landing: "ton618bot.xyz",
        health: "health.ton618bot.xyz",
        dashboard: "dash.ton618bot.xyz",
      });

      _server = {
        stop: () =>
          new Promise((stopResolve) => {
            if (!server.listening) return stopResolve();
            server.close(() => stopResolve());
          }),
      };

      resolve(_server);
    });

    server.once("error", (err) => {
      _startedAt = null;
      logger.error("webServer", "Failed to start", { port: listenPort, error: err?.message || String(err) });
      reject(err);
    });
  });
}

function stopWebServer() {
  if (!_server) return Promise.resolve();
  const p = _server.stop();
  _server = null;
  _startedAt = null;
  return p;
}

module.exports = { startWebServer, stopWebServer };
