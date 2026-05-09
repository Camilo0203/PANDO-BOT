"use strict";

const express = require("express");
const path = require("path");
const { createCorsMiddleware } = require("../middleware/security");

/**
 * Dashboard App (dash.ton618bot.xyz)
 * Professional Express dashboard for TON618 Bot.
 * Serves a rich HTML SPA with real-time data, glassmorphism UI,
 * and JSON API endpoints for guilds, stats, and health.
 *
 * Static assets are served from src/web/public/dashboard.
 *
 * To secure this in production, add an API-key or OAuth2 middleware
 * before the routes below (e.g., via a reverse-proxy or Cloudflare Access).
 */
function createDashboardApp({ healthState, buildInfo, getClient }) {
  const app = express();
  app.use(createCorsMiddleware());
  app.use(express.json());

  // ── Static assets (CSS, JS, images) ──
  const publicDir = path.join(__dirname, "..", "public", "dashboard");
  app.use(express.static(publicDir, { maxAge: "1h" }));

  // ── API-key auth middleware ──
  // REQUIRED in production. Set DASH_API_KEY in your environment.
  const DASH_API_KEY = process.env.DASH_API_KEY || null;
  if (!DASH_API_KEY && process.env.NODE_ENV === "production") {
    throw new Error("[Dashboard] DASH_API_KEY is required in production. Set it in your environment variables.");
  }
  if (DASH_API_KEY) {
    app.use((req, res, next) => {
      const provided = req.headers["x-api-key"] || req.query.apiKey;
      if (provided !== DASH_API_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      next();
    });
  }

  // ── Helper: buildHealthPayload ──
  let buildHealthPayload;
  try {
    ({ buildHealthPayload } = require("../../utils/runtimeHealth"));
  } catch {
    buildHealthPayload = null;
  }

  // ── Dashboard HTML SPA ──
  app.get("/", (req, res) => {
    const client = typeof getClient === "function" ? getClient() : null;
    const guildCount = client?.guilds?.cache?.size ?? 0;
    const ping = client?.ws?.ping ?? "N/A";
    const version = buildInfo?.version || "3.0.0";
    const commit = buildInfo?.shortCommit || "dev";
    const tag = buildInfo?.deployTag || "local";

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TON618 Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div class="bg-orb"></div>
  <div class="noise"></div>

  <div class="layout">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="logo">T6</div>
        <div>
          <div class="title">TON618</div>
          <div class="subtitle">Bot Dashboard</div>
        </div>
      </div>

      <nav class="sidebar-nav">
        <a href="#overview" id="nav-overview" class="nav-item active">
          <span class="icon">⊞</span> Overview
        </a>
        <a href="#guilds" id="nav-guilds" class="nav-item">
          <span class="icon">☰</span> Servers
        </a>
        <a href="#memory" id="nav-memory" class="nav-item">
          <span class="icon">◈</span> Memory
        </a>
        <a href="#health" id="nav-health" class="nav-item">
          <span class="icon">♥</span> Health
        </a>
      </nav>

      <div class="sidebar-footer">
        <span id="build-label">v${version} · ${commit}</span>
      </div>
    </aside>

    <!-- Mobile Header -->
    <div class="mobile-header">
      <div style="display:flex;align-items:center;gap:0.6rem;">
        <div class="logo-sm">T6</div>
        <div style="font-weight:700;font-size:0.92rem;">TON618</div>
      </div>
      <span id="status-badge" class="badge badge-online"><span class="badge-dot"></span> ONLINE</span>
    </div>

    <!-- Main Content -->
    <main class="main">
      <!-- Page Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Real-time bot telemetry & guild overview</p>
        </div>
        <div class="header-actions">
          <span id="status-badge" class="badge badge-online"><span class="badge-dot"></span> ONLINE</span>
          <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.78rem;color:var(--text-muted);cursor:pointer;">
            <input type="checkbox" id="auto-refresh" checked style="accent-color:var(--accent-primary);">
            Auto
          </label>
          <button id="btn-refresh" class="btn btn-ghost">↻ Refresh</button>
        </div>
      </div>

      <!-- KPI Grid -->
      <section id="section-overview">
        <div class="kpi-grid">
          <div class="kpi-card fade-in stagger-1">
            <div class="kpi-icon blue">⊞</div>
            <div class="kpi-label">Servers</div>
            <div class="kpi-value skeleton" id="kpi-guilds" style="min-height:1.5rem">—</div>
            <div class="kpi-change positive">Active guilds</div>
          </div>
          <div class="kpi-card fade-in stagger-2">
            <div class="kpi-icon cyan">◎</div>
            <div class="kpi-label">Gateway Ping</div>
            <div class="kpi-value skeleton" id="kpi-ping" style="min-height:1.5rem">—</div>
            <div class="kpi-change">Discord WebSocket</div>
          </div>
          <div class="kpi-card fade-in stagger-3">
            <div class="kpi-icon green">⧗</div>
            <div class="kpi-label">Uptime</div>
            <div class="kpi-value skeleton" id="kpi-uptime" style="min-height:1.5rem">—</div>
            <div class="kpi-change">Since boot</div>
          </div>
          <div class="kpi-card fade-in stagger-4">
            <div class="kpi-icon amber">◈</div>
            <div class="kpi-label">Memory</div>
            <div class="kpi-value skeleton" id="kpi-memory" style="min-height:1.5rem">—</div>
            <div class="kpi-change">RSS usage</div>
          </div>
        </div>
      </section>

      <!-- Servers Section -->
      <section id="section-guilds" style="display:none;">
        <div class="section-card">
          <div class="section-header">
            <div class="section-title">Servers</div>
            <div style="font-size:0.78rem;color:var(--text-muted);" id="guilds-count">0 servers</div>
          </div>
          <div class="section-body" style="overflow-x:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Members</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody id="guilds-tbody">
                <tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">⟳</div><p>Loading servers…</p></div></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Memory Section -->
      <section id="section-memory" style="display:none;">
        <div class="section-card">
          <div class="section-header">
            <div class="section-title">Memory Usage</div>
          </div>
          <div class="section-body">
            <div class="mem-row">
              <div class="mem-label">RSS</div>
              <div class="mem-bar-wrap">
                <div class="mem-bar"><div class="mem-bar-inner" id="mem-rss-bar" style="width:0%"></div></div>
              </div>
              <div class="mem-val" id="mem-rss-val">—</div>
            </div>
            <div class="mem-row">
              <div class="mem-label">Heap Used</div>
              <div class="mem-bar-wrap">
                <div class="mem-bar"><div class="mem-bar-inner" id="mem-heap-bar" style="width:0%"></div></div>
              </div>
              <div class="mem-val" id="mem-heap-val">—</div>
            </div>
            <div class="mem-row">
              <div class="mem-label">Heap Total</div>
              <div class="mem-bar-wrap">
                <div class="mem-bar"><div class="mem-bar-inner" id="mem-heap-total-bar" style="width:0%"></div></div>
              </div>
              <div class="mem-val" id="mem-heap-total-val">—</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Health Section -->
      <section id="section-health" style="display:none;">
        <div class="section-card">
          <div class="section-header">
            <div class="section-title">Health Status</div>
          </div>
          <div class="section-body">
            <p style="color:var(--text-muted);font-size:0.82rem;margin-bottom:1rem;">
              View raw health data at <a href="/api/health" style="color:var(--accent-secondary);text-decoration:none;">/api/health</a>
            </p>
            <div class="kpi-grid" style="margin-top:0.5rem;">
              <div class="kpi-card">
                <div class="kpi-label">Version</div>
                <div class="kpi-value" style="font-size:1.2rem">${version}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">Commit</div>
                <div class="kpi-value" style="font-size:1.2rem">${commit}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">Environment</div>
                <div class="kpi-value" style="font-size:1.2rem">${tag}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">Node.js</div>
                <div class="kpi-value" style="font-size:1.2rem">${process.version}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Footer -->
      <div style="margin-top:auto;padding-top:2rem;font-size:0.72rem;color:var(--text-ghost);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
        <span>TON618 Bot Dashboard · <span id="build-footer">v${version} · ${commit}</span></span>
        <span><a href="/api/stats" style="color:var(--text-ghost);text-decoration:none;">API</a> · <a href="/api/guilds" style="color:var(--text-ghost);text-decoration:none;">Guilds</a></span>
      </div>
    </main>
  </div>

  <script src="/app.js"></script>
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

  app.get("/api/health", (req, res) => {
    const client = typeof getClient === "function" ? getClient() : null;
    if (typeof buildHealthPayload === "function") {
      const payload = buildHealthPayload({ healthState, buildInfo, client });
      const mem = process.memoryUsage();
      payload.memory = {
        rssMB: Math.round(mem.rss / 1024 / 1024),
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        externalMB: Math.round((mem.external || 0) / 1024 / 1024),
      };
      return res.status(payload.status === "ok" ? 200 : 503).json(payload);
    }
    res.json({
      status: "ok",
      uptimeSec: Math.floor(process.uptime()),
      version: buildInfo?.version || "3.0.0",
      shortCommit: buildInfo?.shortCommit || "dev",
      deployTag: buildInfo?.deployTag || "local",
      memory: {
        rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    });
  });

  // 404
  app.use((req, res) => {
    res.status(404).json({ error: "Not Found", path: req.originalUrl, domain: "dash.ton618bot.xyz" });
  });

  return app;
}

module.exports = { createDashboardApp };
