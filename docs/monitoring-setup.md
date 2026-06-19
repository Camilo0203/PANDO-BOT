# TON618 Monitoring & Alerting Setup

## Overview

This document describes how to set up comprehensive monitoring and alerting for TON618 bot in production.

## Required Monitoring

### 1. Application Performance Monitoring (APM)

**Recommended: Sentry**

```bash
npm install @sentry/node
```

**Configuration:**

```javascript
// Add to index.js at the top
const Sentry = require("@sentry/node");

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "production",
    release: require("./src/utils/buildInfo").getBuildInfo().fingerprint,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Filter out sensitive data
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });
}
```

**Add to .env.production:**
```
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

**Benefits:**
- Real-time error tracking
- Performance monitoring
- Release tracking
- User impact analysis

### 2. Uptime Monitoring

**Recommended: UptimeRobot (Free tier available)**

**Setup:**
1. Create account at https://uptimerobot.com
2. Add HTTP(s) monitor
3. URL: the public endpoint configured in `BOT_HEALTHCHECK_URL`
4. Interval: 5 minutes
5. Alert contacts: Email, SMS, Discord webhook

**Expected Response:**
```json
{
  "status": "ok",
  "mongoConnected": true,
  "discordReady": true,
  "uptimeSec": 12345
}
```

**Alert Conditions:**
- Status code != 200
- Response time > 5 seconds
- `status` != "ok"
- `mongoConnected` != true
- `discordReady` != true

### 3. Log Aggregation

**Recommended: Better Stack (formerly Logtail)**

```bash
npm install @logtail/node
```

**Configuration:**

```javascript
// src/utils/observability.js
const { Logtail } = require("@logtail/node");

let logtail = null;
if (process.env.LOGTAIL_SOURCE_TOKEN) {
  logtail = new Logtail(process.env.LOGTAIL_SOURCE_TOKEN);
}

function logStructured(level, event, payload = {}) {
  const line = {
    ts: nowIso(),
    level,
    event,
    ...payload,
  };
  
  // Send to Logtail
  if (logtail) {
    logtail[level](event, payload);
  }
  
  // Console output
  const out = JSON.stringify(line);
  if (level === "error") {
    console.error(out);
  } else if (level === "warn") {
    console.warn(out);
  } else if (process.env.ENABLE_JSON_LOGS === "true") {
    console.log(out);
  }
}
```

**Add to .env.production:**
```
LOGTAIL_SOURCE_TOKEN=your_logtail_token
ENABLE_JSON_LOGS=true
```

### 4. Discord Alerts

**Setup webhook for critical alerts:**

```javascript
// src/utils/alerting.js
const https = require("https");

async function sendDiscordAlert(severity, title, description, fields = []) {
  const webhookUrl = process.env.ALERT_DISCORD_WEBHOOK;
  if (!webhookUrl) return;

  const colors = {
    critical: 0xED4245,
    warning: 0xFEE75C,
    info: 0x5865F2,
  };

  const payload = {
    embeds: [{
      title: `${severity === "critical" ? "🚨" : "⚠️"} ${title}`,
      description,
      color: colors[severity] || colors.info,
      fields,
      timestamp: new Date().toISOString(),
      footer: { text: "TON618 Production Alert" },
    }],
  };

  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }, (res) => {
      resolve(res.statusCode === 204);
    });

    req.on("error", reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

module.exports = { sendDiscordAlert };
```

**Add to .env.production:**
```
ALERT_DISCORD_WEBHOOK=https://discord.com/api/webhooks/YOUR_WEBHOOK
```

### 5. Database Monitoring

**MongoDB Atlas Built-in Monitoring:**

1. Enable Performance Advisor
2. Set up alerts:
   - Connections > 80%
   - CPU > 75%
   - Memory > 80%
   - Disk space < 20%
   - Slow queries > 100ms

**Custom Monitoring:**

```javascript
// src/utils/database/monitoring.js
const { getDB } = require("./core");
const { logStructured } = require("../observability");

async function checkDatabaseHealth() {
  try {
    const db = getDB();
    const start = Date.now();
    
    // Ping test
    await db.admin().ping();
    const pingMs = Date.now() - start;
    
    // Connection pool stats
    const stats = await db.admin().serverStatus();
    const connections = stats.connections;
    
    logStructured("info", "db.health_check", {
      pingMs,
      currentConnections: connections.current,
      availableConnections: connections.available,
      totalCreated: connections.totalCreated,
    });
    
    // Alert if connections are high
    if (connections.current > connections.available * 0.8) {
      logStructured("warn", "db.connections_high", {
        current: connections.current,
        available: connections.available,
        percentage: Math.round((connections.current / connections.available) * 100),
      });
    }
    
    return { healthy: true, pingMs };
  } catch (error) {
    logStructured("error", "db.health_check_failed", {
      error: error?.message || String(error),
    });
    return { healthy: false, error: error.message };
  }
}

module.exports = { checkDatabaseHealth };
```

## Metrics to Monitor

### Critical Metrics (Alert immediately)

1. **Bot Uptime**
   - Target: 99.9%
   - Alert: < 99%

2. **Health Endpoint**
   - Target: < 1s response time
   - Alert: > 5s or 503 status

3. **MongoDB Connection**
   - Target: Always connected
   - Alert: Connection lost

4. **Discord API Latency**
   - Target: < 200ms
   - Alert: > 500ms

5. **Error Rate**
   - Target: < 1%
   - Alert: > 5%

6. **Memory Usage**
   - Target: < 500MB
   - Alert: > 800MB

### Important Metrics (Review daily)

1. **Command Success Rate**
   - Target: > 95%
   - Review: < 90%

2. **Ticket Response Time (SLA)**
   - Target: < 1 hour
   - Review: > 2 hours average

3. **Cron Job Success Rate**
   - Target: 100%
   - Review: Any failures

4. **Dashboard Sync Status**
   - Target: < 5 min lag
   - Review: > 15 min lag

5. **Database Query Performance**
   - Target: < 100ms average
   - Review: > 500ms average

### Nice-to-Have Metrics (Review weekly)

1. Tickets created per day
2. Most used commands
3. Guild growth rate
4. Staff response time trends
5. User satisfaction ratings

## Alert Channels

### Critical Alerts (Immediate)
- Discord webhook to ops channel
- SMS to on-call engineer
- PagerDuty/OpsGenie

### Warning Alerts (15 min delay)
- Discord webhook
- Email

### Info Alerts (Daily digest)
- Email summary
- Slack/Discord daily report

## Dashboard Setup

**Recommended: Grafana + Prometheus**

Alternative: Use MongoDB Charts for basic visualization

**Key Dashboards:**

1. **System Health**
   - Uptime
   - Memory usage
   - CPU usage
   - Response times

2. **Business Metrics**
   - Active tickets
   - Tickets per hour
   - SLA compliance
   - Staff utilization

3. **Error Tracking**
   - Error rate over time
   - Top errors
   - Affected users

## Alert Runbook

### High Memory Usage Alert

**Trigger:** Heap usage > 800MB

**Actions:**
1. Check `/health` endpoint for current memory
2. Review recent deployments
3. Check for memory leaks in logs
4. Restart bot if > 1GB
5. Investigate root cause

### Database Connection Lost

**Trigger:** `mongoConnected: false`

**Actions:**
1. Check MongoDB Atlas status
2. Verify network connectivity
3. Check IP whitelist
4. Review connection pool settings
5. Restart bot
6. Escalate if not resolved in 5 min

### High Error Rate

**Trigger:** Error rate > 5%

**Actions:**
1. Check Sentry for error details
2. Identify affected commands
3. Check Discord API status
4. Review recent code changes
5. Rollback if necessary

### Slow Response Times

**Trigger:** Health endpoint > 5s

**Actions:**
1. Check server CPU/memory
2. Review database slow queries
3. Check Discord API latency
4. Identify bottleneck
5. Scale resources if needed

## Environment Variables

Add to `.env.production`:

```bash
# Monitoring & Alerting
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
LOGTAIL_SOURCE_TOKEN=your_logtail_token
ALERT_DISCORD_WEBHOOK=https://discord.com/api/webhooks/YOUR_WEBHOOK

# Enable structured logging
ENABLE_JSON_LOGS=true

# Health monitoring
HEALTH_HEARTBEAT_MS=60000
HEALTH_EVALUATE_MS=300000
HEALTH_ALERT_COOLDOWN_MS=900000
HEALTH_PING_WARN_MS=300
HEALTH_ERROR_RATE_WARN_PCT=25

# Metrics
METRICS_REPORT_INTERVAL_MS=300000
ERROR_ALERT_THRESHOLD=5
ERROR_ALERT_COOLDOWN_MS=300000
```

## Testing Alerts

Before going live, test all alert channels:

```bash
# Test health endpoint
curl "$BOT_HEALTHCHECK_URL"

# Test Discord webhook
node -e "require('./src/utils/alerting').sendDiscordAlert('info', 'Test Alert', 'Testing monitoring setup')"

# Trigger test error in Sentry
node -e "require('@sentry/node').captureMessage('Test error from production setup')"

# Check logs in Logtail
# Visit your Logtail dashboard
```

## Monthly Review Checklist

- [ ] Review alert thresholds (too noisy? too quiet?)
- [ ] Check for false positives
- [ ] Verify all alert channels working
- [ ] Review incident response times
- [ ] Update runbooks based on incidents
- [ ] Check monitoring costs
- [ ] Review metric trends
- [ ] Update alert contacts

## Cost Optimization

**Free Tier Options:**
- Sentry: 5,000 events/month
- UptimeRobot: 50 monitors
- Better Stack: 1GB logs/month
- MongoDB Atlas: Built-in monitoring

**Estimated Monthly Cost (Paid):**
- Sentry Pro: $26/month
- Better Stack: $10/month
- UptimeRobot: $7/month
- **Total: ~$43/month**

## Next Steps

1. Set up Sentry account and add DSN to .env
2. Configure UptimeRobot monitors
3. Set up Discord webhook for alerts
4. Enable MongoDB Atlas alerts
5. Test all alert channels
6. Document on-call rotation
7. Create incident response playbook
