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
    const axios        = require("axios");
    const rateLimit    = require("express-rate-limit");
    const TEBEX_STORE_TOKEN = process.env.TEBEX_PUBLIC_TOKEN;
    const TEBEX_HEADLESS   = "https://headless.tebex.io/api";
    const TEBEX_AXIOS  = axios.create({ baseURL: TEBEX_HEADLESS, timeout: 10000, headers: { "Content-Type": "application/json", "Accept": "application/json" } });
    // Whitelist de package IDs válidos — cualquier otro ID se rechaza con 400
    const TEBEX_ALLOWED_PKG_IDS = new Set(
      (process.env.TEBEX_ALLOWED_PKG_IDS || "7434172,7434175,7434185")
        .split(",").map(s => parseInt(s.trim(), 10)).filter(Boolean)
    );

    const checkoutLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Too many checkout requests, please try again later." },
    });

    mainApp.get("/api/checkout", checkoutLimiter, async (req, res) => {
      res.set("Access-Control-Allow-Origin", "https://store.ton618bot.xyz");
      res.set("Access-Control-Allow-Methods", "GET, OPTIONS");

      if (!TEBEX_STORE_TOKEN) {
        logger.error("tebex-proxy", "TEBEX_PUBLIC_TOKEN not configured");
        return res.status(503).json({ error: "checkout_unavailable" });
      }

      const pkgId = parseInt(req.query.pkg, 10);
      if (!pkgId || !TEBEX_ALLOWED_PKG_IDS.has(pkgId)) {
        return res.status(400).json({ error: "invalid pkg" });
      }

      try {
        const origin = "https://store.ton618bot.xyz";

        // 1) Create basket
        const { data: basketData } = await TEBEX_AXIOS.post(`/accounts/${TEBEX_STORE_TOKEN}/baskets`, {
          complete_url: origin + "/#premium",
          cancel_url:   origin + "/#premium",
        });
        const ident = basketData?.data?.ident;
        if (!ident) return res.status(502).json({ error: "basket_creation_failed" });

        // 2) Add package
        await TEBEX_AXIOS.post(`/accounts/${TEBEX_STORE_TOKEN}/baskets/${ident}/packages`, { package_id: pkgId, quantity: 1 });

        return res.json({ ident });
      } catch (err) {
        const status = err?.response?.status;
        const msg    = err?.response?.data || err?.message;
        logger.warn("tebex-proxy", `Checkout proxy error pkg=${pkgId}`, { status, error: String(msg).slice(0, 200) });
        return res.status(502).json({ error: "tebex_error", status, detail: String(msg).slice(0, 100) });
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
