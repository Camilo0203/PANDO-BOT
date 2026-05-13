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

    // ── Security headers (applies to all routes except webhook) ──
    mainApp.use(createHelmetMiddleware());
    mainApp.use(createCorsMiddleware());

    // Sub-applications
    const landingApp = createLandingApp({ healthState, buildInfo, getClient });
    const healthApp = createHealthApp({ healthState, buildInfo, getClient });
    const dashboardApp = createDashboardApp({ healthState, buildInfo, getClient });
    const tebexApp = createTebexApp({ getClient });
    mainApp.use("/webhook-tebex", tebexApp);

    // ── Tebex checkout proxy (server-side basket creation to avoid CORS) ──
    const TEBEX_STORE_TOKEN = process.env.TEBEX_PUBLIC_TOKEN || "12ws8-71d9005ff427c9afbed0f6b9cd3c31b2b6869f2b";
    const TEBEX_HEADLESS   = "https://headless.tebex.io/api";

    mainApp.get("/api/checkout", async (req, res) => {
      res.set("Access-Control-Allow-Origin", "https://store.ton618bot.xyz");
      res.set("Access-Control-Allow-Methods", "GET, OPTIONS");

      const pkgId = parseInt(req.query.pkg, 10);
      if (!pkgId) return res.status(400).json({ error: "missing pkg" });

      try {
        const origin = "https://store.ton618bot.xyz";

        // 1) Create basket
        const basketRes = await fetch(`${TEBEX_HEADLESS}/accounts/${TEBEX_STORE_TOKEN}/baskets`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ complete_url: origin + "/#premium", cancel_url: origin + "/#premium" }),
        });
        const basketData = await basketRes.json();
        const ident = basketData?.data?.ident;
        if (!ident) return res.status(502).json({ error: "basket_creation_failed" });

        // 2) Add package
        const addRes = await fetch(`${TEBEX_HEADLESS}/baskets/${ident}/packages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ package_id: pkgId, quantity: 1 }),
        });
        if (!addRes.ok) {
          logger.warn("tebex-proxy", `Package add failed: ${addRes.status} for pkg ${pkgId}`);
          return res.status(502).json({ error: "package_add_failed", status: addRes.status });
        }

        return res.json({ ident });
      } catch (err) {
        logger.error("tebex-proxy", "Checkout proxy error", { error: err?.message });
        return res.status(500).json({ error: "internal" });
      }
    });

    mainApp.options("/api/checkout", (req, res) => {
      res.set("Access-Control-Allow-Origin", "https://store.ton618bot.xyz");
      res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.sendStatus(204);
    });

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
