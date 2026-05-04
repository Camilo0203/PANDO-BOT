"use strict";

const express = require("express");
const path = require("path");

/**
 * Landing App (ton618bot.xyz)
 * Serves the public landing page and basic bot info.
 * Also hosts /health and /ready so Square Cloud probes on the root domain keep working.
 */
function createLandingApp({ healthState, buildInfo, getClient }) {
  const app = express();

  // Parse JSON bodies for API endpoints
  app.use(express.json());

  const { buildHealthPayload } = require("../../utils/runtimeHealth");

  // ── Square Cloud health probes ──
  app.get("/health", (req, res) => {
    const client = typeof getClient === "function" ? getClient() : null;
    const payload = buildHealthPayload({ healthState, buildInfo, client });
    const httpStatus = payload.status === "ok" ? 200 : 503;
    res.status(httpStatus).json(payload);
  });

  app.get("/ready", (req, res) => {
    const client = typeof getClient === "function" ? getClient() : null;
    const payload = buildHealthPayload({ healthState, buildInfo, client });
    const httpStatus = payload.status === "ok" ? 200 : 503;
    res.status(httpStatus).json({ status: payload.status, uptimeSec: payload.uptimeSec });
  });

  // ── Public API ──
  app.get("/api/info", (req, res) => {
    const client = typeof getClient === "function" ? getClient() : null;
    res.json({
      name: "TON618 Bot",
      version: buildInfo?.version || "3.0.0",
      commit: buildInfo?.shortCommit || "unknown",
      deployTag: buildInfo?.deployTag || null,
      guilds: client?.guilds?.cache?.size ?? 0,
      inviteUrl: process.env.BOT_INVITE_URL || null,
      supportServer: process.env.SUPPORT_SERVER_URL || null,
    });
  });

  // ── Static landing page (fallback HTML if no public folder exists) ──
  app.get("/landing", (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TON618 Bot</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: #0b0d14; color: #e6e8ef; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { max-width: 640px; padding: 2rem; border-radius: 1rem; background: #11131f; border: 1px solid #1f2233; box-shadow: 0 10px 30px rgba(0,0,0,.35); }
    h1 { margin: 0 0 .5rem; font-size: 2rem; letter-spacing: -.02em; }
    p { margin: .5rem 0; line-height: 1.6; color: #a6abbf; }
    .badge { display: inline-block; padding: .25rem .6rem; border-radius: 999px; background: #1a3c2b; color: #7ee787; font-size: .8rem; font-weight: 600; }
    .row { display: flex; gap: .5rem; flex-wrap: wrap; margin-top: 1rem; }
    a.btn { text-decoration: none; padding: .5rem .9rem; border-radius: .5rem; background: #1f6feb; color: #fff; font-weight: 500; }
    a.btn.secondary { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; }
    .meta { margin-top: 1.25rem; font-size: .85rem; color: #6e7681; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Online</div>
    <h1>TON618 Bot</h1>
    <p>Enterprise-grade Discord management suite. Tickets, moderation, verification, music, and live playbooks — all in one place.</p>
    <div class="row">
      <a class="btn" href="${process.env.BOT_INVITE_URL || '#'}">Add to Server</a>
      <a class="btn secondary" href="${process.env.SUPPORT_SERVER_URL || '#'}">Support Server</a>
      <a class="btn secondary" href="https://github.com/Camilo0203/ton618-bot">GitHub</a>
    </div>
    <div class="meta">
      Version ${buildInfo?.version || "3.0.0"} &middot; Build ${buildInfo?.shortCommit || "unknown"} &middot; ${buildInfo?.deployTag || "dev"}
    </div>
  </div>
</body>
</html>`);
  });

  // Redirect root to /landing for browsers (health probes still hit /health)
  app.get("/", (req, res) => {
    const accept = req.headers.accept || "";
    if (accept.includes("text/html")) {
      return res.redirect("/landing");
    }
    // JSON fallback for probes without Accept: text/html
    const client = typeof getClient === "function" ? getClient() : null;
    const payload = buildHealthPayload({ healthState, buildInfo, client });
    const httpStatus = payload.status === "ok" ? 200 : 503;
    res.status(httpStatus).json(payload);
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: "Not Found", path: req.originalUrl, domain: "ton618bot.xyz" });
  });

  return app;
}

module.exports = { createLandingApp };
