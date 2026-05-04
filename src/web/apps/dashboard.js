"use strict";

const express = require("express");

/**
 * Dashboard App (dash.ton618bot.xyz)
 * Mini Express application for the bot control panel.
 * Exposes guild stats and a basic HTML dashboard.
 *
 * To secure this in production, add an API-key or OAuth2 middleware
 * before the routes below (e.g., via a reverse-proxy or Cloudflare Access).
 */
function createDashboardApp({ getClient }) {
  const app = express();
  app.use(express.json());

  // ── Simple API-key auth middleware (optional, controlled by env) ──
  const DASH_API_KEY = process.env.DASH_API_KEY || null;
  if (DASH_API_KEY) {
    app.use((req, res, next) => {
      const provided = req.headers["x-api-key"] || req.query.apiKey;
      if (provided !== DASH_API_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      next();
    });
  }

  // ── Dashboard HTML ──
  app.get("/", (req, res) => {
    const client = typeof getClient === "function" ? getClient() : null;
    const guildCount = client?.guilds?.cache?.size ?? 0;
    const ping = client?.ws?.ping ?? "N/A";

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TON618 Dashboard</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: #0b0d14; color: #e6e8ef; }
    .container { max-width: 960px; margin: 0 auto; padding: 2rem; }
    h1 { margin: 0 0 1rem; font-size: 1.75rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
    .card { background: #11131f; border: 1px solid #1f2233; border-radius: .75rem; padding: 1rem; }
    .card h3 { margin: 0 0 .5rem; font-size: .9rem; color: #8b949e; text-transform: uppercase; letter-spacing: .04em; }
    .card .value { font-size: 1.5rem; font-weight: 700; color: #fff; }
    .nav { display: flex; gap: .5rem; margin-bottom: 1.25rem; }
    .nav a { color: #58a6ff; text-decoration: none; font-size: .9rem; }
    .muted { color: #6e7681; font-size: .85rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>TON618 Dashboard</h1>
    <div class="nav">
      <a href="/">Overview</a>
      <a href="/api/stats">Stats JSON</a>
      <a href="/api/guilds">Guilds JSON</a>
    </div>
    <div class="grid">
      <div class="card"><h3>Guilds</h3><div class="value">${guildCount}</div></div>
      <div class="card"><h3>Gateway Ping</h3><div class="value">${ping} ms</div></div>
      <div class="card"><h3>Uptime</h3><div class="value">${Math.floor(process.uptime() / 60)} min</div></div>
      <div class="card"><h3>Node</h3><div class="value">${process.version}</div></div>
    </div>
    <p class="muted">This is a starter dashboard. Extend it by adding more routes and connecting to your database.</p>
  </div>
</body>
</html>`);
  });

  // ── API routes ──
  app.get("/api/stats", (req, res) => {
    const client = typeof getClient === "function" ? getClient() : null;
    res.json({
      guilds: client?.guilds?.cache?.size ?? 0,
      users: client?.users?.cache?.size ?? 0,
      ping: client?.ws?.ping ?? null,
      uptimeSec: Math.floor(process.uptime()),
      nodeVersion: process.version,
    });
  });

  app.get("/api/guilds", (req, res) => {
    const client = typeof getClient === "function" ? getClient() : null;
    if (!client) return res.json({ guilds: [] });

    const guilds = client.guilds.cache.map((g) => ({
      id: g.id,
      name: g.name,
      memberCount: g.memberCount,
      ownerId: g.ownerId,
      joinedAt: g.joinedAt?.toISOString() || null,
    }));
    res.json({ guilds });
  });

  // 404
  app.use((req, res) => {
    res.status(404).json({ error: "Not Found", path: req.originalUrl, domain: "dash.ton618bot.xyz" });
  });

  return app;
}

module.exports = { createDashboardApp };
