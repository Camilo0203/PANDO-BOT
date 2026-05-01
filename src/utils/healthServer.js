"use strict";

const http = require("http");
const { buildHealthPayload } = require("./runtimeHealth");
const logger = require("./structuredLogger");

// Startup grace period: Square Cloud may probe /health before Discord is ready.
// During this window we return HTTP 200 with status:"booting" so the platform
// does not restart the process prematurely.
const STARTUP_GRACE_PERIOD_MS = Number(process.env.HEALTH_STARTUP_GRACE_MS) || 90_000;

const HEALTH_RATE_LIMIT_WINDOW_MS = 60_000;
const HEALTH_RATE_LIMIT_MAX_REQUESTS = 30;
const healthRequestCounts = new Map();

function isHealthRateLimited(ip) {
  const now = Date.now();
  const record = healthRequestCounts.get(ip);
  if (!record) {
    healthRequestCounts.set(ip, { count: 1, start: now });
    return false;
  }
  if (now - record.start > HEALTH_RATE_LIMIT_WINDOW_MS) {
    healthRequestCounts.set(ip, { count: 1, start: now });
    return false;
  }
  record.count += 1;
  return record.count > HEALTH_RATE_LIMIT_MAX_REQUESTS;
}

let _server = null;
let _startedAt = null;

function _isInGracePeriod() {
  if (!_startedAt) return false;
  return Date.now() - _startedAt < STARTUP_GRACE_PERIOD_MS;
}

function startHealthServer({ healthState, buildInfo, getClient, port }) {
  if (_server) {
    return Promise.resolve(_server);
  }

  _startedAt = Date.now();
  const listenPort = parseInt(port, 10) || 80;

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = req.url?.split("?")[0];
      const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";

      if (isHealthRateLimited(clientIp)) {
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Too Many Requests" }));
        return;
      }

      // /health and / — Square Cloud primary health check
      if (url === "/health" || url === "/") {
        const client = typeof getClient === "function" ? getClient() : null;
        const payload = buildHealthPayload({ healthState, buildInfo, client });

        // During grace period: always 200 so Square Cloud doesn't kill us before Discord connects
        const booting = payload.status !== "ok" && _isInGracePeriod();
        const httpStatus = (payload.status === "ok" || booting) ? 200 : 503;
        const body = { ...payload, booting };

        res.writeHead(httpStatus, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
        return;
      }

      // /ready — strict liveness check (503 until fully healthy); used by CI smoke tests
      if (url === "/ready") {
        const client = typeof getClient === "function" ? getClient() : null;
        const payload = buildHealthPayload({ healthState, buildInfo, client });
        const httpStatus = payload.status === "ok" ? 200 : 503;
        res.writeHead(httpStatus, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: payload.status, uptimeSec: payload.uptimeSec }));
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    const handleRuntimeError = (err) => {
      logger.error('healthServer', 'Error on port', { port: listenPort, error: err?.message || String(err) });
    };

    const handleStartupError = (err) => {
      _startedAt = null;
      logger.error('healthServer', 'Error on port', { port: listenPort, error: err?.message || String(err) });
      reject(err);
    };

    server.once("error", handleStartupError);
    server.listen(listenPort, "0.0.0.0", () => {
      server.off("error", handleStartupError);
      server.on("error", handleRuntimeError);
      healthState.ghostPort = listenPort;
      logger.info('healthServer', `Listening on 0.0.0.0:${listenPort}`, { gracePeriodSec: STARTUP_GRACE_PERIOD_MS / 1000 });

      _server = {
        stop: () =>
          new Promise((stopResolve) => {
            if (!server.listening) return stopResolve();
            server.close(() => stopResolve());
          }),
      };

      resolve(_server);
    });
  });
}

function stopHealthServer() {
  if (!_server) return Promise.resolve();
  const p = _server.stop();
  _server = null;
  _startedAt = null;
  return p;
}

module.exports = { startHealthServer, stopHealthServer };
