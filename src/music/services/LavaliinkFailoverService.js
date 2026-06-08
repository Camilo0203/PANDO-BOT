"use strict";

/**
 * LavalinkFailoverService
 * Monitors PRO and FREE Lavalink nodes and handles automatic failover
 *
 * PRO Node (default 2333): High quality 320kbps
 * FREE Node (default 2334): Standard quality 128kbps
 *
 * Strategy: Auto-reconnect to fallback node if primary fails
 *
 * NOTE: nombre interno "Lavaliink" preservado por compatibilidad con PS2/leeme
 */

const EventEmitter = require("events");
const logger = require("../../../utils/structuredLogger");

const log = {
  info: (ctx, msg, meta) => logger.info("Music.FAILOVER", msg, { ...meta, component: ctx }),
  warn: (ctx, msg, meta) => logger.warn("Music.FAILOVER", msg, { ...meta, component: ctx }),
  error: (ctx, msg, meta) => logger.error("Music.FAILOVER", msg, { ...meta, component: ctx }),
  debug: (ctx, msg, meta) => logger.debug("Music.FAILOVER", msg, { ...meta, component: ctx }),
};

class LavalinkFailoverService extends EventEmitter {
  constructor(client, options = {}) {
    super();

    this.client = client;
    this.nodes = {
      PRO: {
        host: process.env.LAVALINK_PRO_HOST || "localhost",
        port: process.env.LAVALINK_PRO_PORT || 2333,
        password: process.env.LAVALINK_PRO_PASSWORD || "defaultpassword",
        region: "pro",
        tier: "PRO",
        quality: 320,
        status: "unknown",
        lastHealthCheck: null,
        healthScore: 100,
      },
      FREE: {
        host: process.env.LAVALINK_FREE_HOST || "localhost",
        port: process.env.LAVALINK_FREE_PORT || 2334,
        password: process.env.LAVALINK_FREE_PASSWORD || "defaultpassword",
        region: "free",
        tier: "FREE",
        quality: 128,
        status: "unknown",
        lastHealthCheck: null,
        healthScore: 100,
      },
    };

    this.config = {
      healthCheckInterval: options.healthCheckInterval || 30000,
      healthCheckTimeout: options.healthCheckTimeout || 5000,
      failureThreshold: options.failureThreshold || 3,
      recoveryRetries: options.recoveryRetries || 5,
      autoReconnect: options.autoReconnect !== false,
    };

    this.state = {
      activePrimary: "PRO",
      activeFallback: "FREE",
      failureCount: { PRO: 0, FREE: 0 },
      lastSwitch: null,
      isFailingOver: false,
    };

    this.healthCheckInterval = null;
  }

  async init() {
    log.info("FAILOVER", "Initializing Lavalink failover service", {
      primary: this.state.activePrimary,
      fallback: this.state.activeFallback,
    });

    await this.performHealthChecks();
    this.startHealthCheckTimer();

    this.emit("ready");
  }

  startHealthCheckTimer() {
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);

    this.healthCheckInterval = setInterval(
      () =>
        this.performHealthChecks().catch((err) =>
          log.error("FAILOVER", "Health check failed", { error: err.message })
        ),
      this.config.healthCheckInterval
    );

    log.debug("FAILOVER", "Health check timer started", { interval: this.config.healthCheckInterval });
  }

  stop() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    log.info("FAILOVER", "Lavalink failover service stopped");
  }

  async performHealthChecks() {
    const checks = Object.entries(this.nodes).map(([nodeKey, nodeConfig]) =>
      this.checkNodeHealth(nodeKey, nodeConfig).catch((err) => {
        log.error("FAILOVER", `Health check failed for ${nodeKey}`, { error: err.message });
        return { node: nodeKey, healthy: false, error: err.message };
      })
    );

    const results = await Promise.all(checks);

    for (const result of results) {
      if (result.healthy) {
        this.nodes[result.node].status = "healthy";
        this.nodes[result.node].healthScore = 100;
        this.state.failureCount[result.node] = 0;
      } else {
        this.nodes[result.node].status = "unhealthy";
        this.nodes[result.node].healthScore = Math.max(0, this.nodes[result.node].healthScore - 20);
        this.state.failureCount[result.node]++;
      }

      this.nodes[result.node].lastHealthCheck = new Date();
    }

    this.checkFailoverConditions();
  }

  async checkNodeHealth(nodeKey, nodeConfig) {
    return new Promise((resolve, reject) => {
      const url = `http://${nodeConfig.host}:${nodeConfig.port}/info`;

      const options = {
        timeout: this.config.healthCheckTimeout,
        headers: {
          Authorization: nodeConfig.password,
        },
      };

      const http = require("http");
      const request = http.get(url, options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            const healthy = res.statusCode === 200 && json.version;

            log.debug("FAILOVER", `Health check ${nodeKey}`, {
              statusCode: res.statusCode,
              version: json.version,
              healthy,
            });

            resolve({
              node: nodeKey,
              healthy,
              version: json.version,
              stats: json.stats,
            });
          } catch (err) {
            reject(new Error(`Invalid response from ${nodeKey}: ${err.message}`));
          }
        });
      });

      request.on("error", (err) => {
        log.warn("FAILOVER", `Health check connection failed for ${nodeKey}`, { error: err.message });
        reject(err);
      });

      request.on("timeout", () => {
        request.destroy();
        reject(new Error(`Health check timeout for ${nodeKey}`));
      });
    });
  }

  checkFailoverConditions() {
    const primary = this.state.activePrimary;
    const fallback = this.state.activeFallback;
    const primaryNode = this.nodes[primary];

    if (this.state.failureCount[primary] >= this.config.failureThreshold) {
      log.warn("FAILOVER", `Primary node ${primary} exceeded failure threshold`, {
        failureCount: this.state.failureCount[primary],
        threshold: this.config.failureThreshold,
      });

      this.initiateFailover(primary, fallback);
    }

    if (
      this.nodes[primary].status === "unhealthy" &&
      this.nodes[fallback].status === "unhealthy"
    ) {
      log.error("FAILOVER", "CRITICAL: Both Lavalink nodes are unhealthy!", {
        primary: { status: this.nodes[primary].status, failures: this.state.failureCount[primary] },
        fallback: { status: this.nodes[fallback].status, failures: this.state.failureCount[fallback] },
      });

      this.emit("criticalFailure", { primary, fallback });
    }
  }

  async initiateFailover(fromNode, toNode) {
    if (this.state.isFailingOver) {
      log.warn("FAILOVER", "Failover already in progress, skipping");
      return;
    }

    this.state.isFailingOver = true;

    log.warn("FAILOVER", `Initiating failover: ${fromNode} -> ${toNode}`, {
      primaryHealth: this.nodes[fromNode].status,
      fallbackHealth: this.nodes[toNode].status,
      time: new Date().toISOString(),
    });

    try {
      this.state.activePrimary = toNode;
      this.state.activeFallback = fromNode;
      this.state.lastSwitch = new Date();
      this.state.failureCount[fromNode] = 0;

      log.info("FAILOVER", `Failover completed: ${toNode} is now primary`, {
        time: new Date().toISOString(),
        failoverTime: this.state.lastSwitch,
      });

      this.emit("failover", {
        from: fromNode,
        to: toNode,
        timestamp: this.state.lastSwitch,
      });

      if (this.config.autoReconnect) {
        this.attemptNodeRecovery(fromNode).catch((err) =>
          log.error("FAILOVER", `Recovery attempt failed for ${fromNode}`, { error: err.message })
        );
      }
    } finally {
      this.state.isFailingOver = false;
    }
  }

  async attemptNodeRecovery(nodeKey) {
    log.info("FAILOVER", `Attempting to recover ${nodeKey}`, { attempts: this.config.recoveryRetries });

    for (let attempt = 1; attempt <= this.config.recoveryRetries; attempt++) {
      const delayMs = Math.pow(2, attempt - 1) * 5000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      try {
        const result = await this.checkNodeHealth(nodeKey, this.nodes[nodeKey]);
        if (result.healthy) {
          log.info("FAILOVER", `${nodeKey} recovered after ${attempt} attempts`, {
            totalTime: delayMs * attempt,
          });

          this.state.failureCount[nodeKey] = 0;
          this.nodes[nodeKey].healthScore = 100;

          this.emit("nodeRecovered", { node: nodeKey });
          return;
        }
      } catch (err) {
        log.debug("FAILOVER", `Recovery attempt ${attempt}/${this.config.recoveryRetries} failed for ${nodeKey}`, {
          error: err.message,
        });
      }
    }

    log.error("FAILOVER", `Failed to recover ${nodeKey} after ${this.config.recoveryRetries} attempts`, {
      node: nodeKey,
    });

    this.emit("recoveryFailed", { node: nodeKey });
  }

  getActivePrimary() {
    return this.nodes[this.state.activePrimary];
  }

  getActiveFallback() {
    return this.nodes[this.state.activeFallback];
  }

  getNodeByTier(tier) {
    for (const [key, node] of Object.entries(this.nodes)) {
      if (node.tier === tier) return node;
    }
    return null;
  }

  getStatus() {
    return {
      activePrimary: this.state.activePrimary,
      activeFallback: this.state.activeFallback,
      lastSwitch: this.state.lastSwitch,
      isFailingOver: this.state.isFailingOver,
      nodes: Object.fromEntries(
        Object.entries(this.nodes).map(([key, node]) => [
          key,
          {
            status: node.status,
            healthScore: node.healthScore,
            failures: this.state.failureCount[key],
            lastHealthCheck: node.lastHealthCheck,
          },
        ])
      ),
    };
  }
}

module.exports = { LavalinkFailoverService };
