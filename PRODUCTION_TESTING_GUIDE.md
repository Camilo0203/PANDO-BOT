# TON618 Production Testing Guide

**Date**: 2026-06-07  
**Version**: 1.0.0  
**Status**: Pre-Production Validation

---

## 📋 Pre-Deployment Checklist

### 1. Environment Validation

```bash
# Run validation script
node scripts/validate-production.js

# Generate encryption keys (if not already done)
node scripts/generate-production-keys.js

# Copy keys to .env.production (NEVER commit to Git!)
cp .env.production-generated .env.production
```

### 2. Dependency Security

```bash
# Check for vulnerabilities
npm audit

# Fix known issues
npm audit fix

# Verify all dependencies installed correctly
npm ci --production=false
```

### 3. Build Verification

```bash
# Build artifacts (if applicable)
npm run build

# Verify TypeScript types are generated
ls -la dist/types/

# Check file sizes (should be < 5MB for bot, < 10MB for web)
du -sh dist/
```

---

## 🧪 Local Testing (Before Cloud Deploy)

### Test 1: Startup Validation

**Goal**: Verify bot starts and connects to Discord

```bash
# Set NODE_ENV to production for strict validation
NODE_ENV=production npm start

# Expected output within 60 seconds:
# ✅ Discord client ready: YourBot#1234
# ✅ MongoDB connected
# ✅ Health endpoints active on :80/health
# ✅ Web server listening on :8080

# Verify health endpoint
curl http://localhost:80/health

# Expected response:
# {
#   "status": "healthy",
#   "uptime": 12345,
#   "memoryUsage": {...}
# }
```

### Test 2: Lavalink Nodes Health

**Goal**: Verify both Lavalink nodes are responding

```bash
# Check PRO node (2333)
curl -H "Authorization: <LAVALINK_PRO_PASSWORD>" http://localhost:2333/info

# Check FREE node (2334)
curl -H "Authorization: <LAVALINK_FREE_PASSWORD>" http://localhost:2334/info

# Both should return:
# {
#   "version": "4.x.x",
#   "buildLine": "...",
#   "git": {...},
#   "jvm": "..."
# }
```

### Test 3: Encryption Keys Validation

**Goal**: Verify encryption keys are properly formatted

```bash
# Test in Node REPL
node -e "
const env = require('dotenv').config({ path: '.env.production' });
const {ENCRYPTION_KEY, HASH_SALT, BOT_API_KEY, DASH_API_KEY} = env.parsed;

// Verify ENCRYPTION_KEY format (64 hex chars)
console.log('ENCRYPTION_KEY valid:', /^[a-f0-9]{64}$/i.test(ENCRYPTION_KEY));

// Verify HASH_SALT length (min 32)
console.log('HASH_SALT length:', HASH_SALT.length, '(must be >= 32)');

// Verify API keys
console.log('BOT_API_KEY length:', BOT_API_KEY.length, '(must be >= 32)');
console.log('DASH_API_KEY length:', DASH_API_KEY.length, '(must be >= 32)');
"
```

### Test 4: Database Connection

**Goal**: Verify MongoDB is accessible and schema is valid

```bash
# Connect to MongoDB directly
mongosh "$MONGO_URI" --eval "
  db.adminCommand('ping')
  db.getCollectionNames()
"

# From bot startup logs, verify:
# ✅ "MongoDB connected" message
# ✅ Collections created: guilds, users, tickets, etc.
# ✅ Indexes created successfully
# ✅ No connection pool warnings
```

### Test 5: API Endpoints

**Goal**: Verify critical API endpoints are accessible

```bash
# Health check endpoint
curl -v http://localhost:80/health

# Ready check endpoint
curl -v http://localhost:80/ready

# Dashboard auth test (should require DASH_API_KEY)
curl -v http://localhost:8080/api/dashboard/guilds \
  -H "X-API-Key: wrong_key"
# Expected: 401 Unauthorized

# Correct key
curl -v http://localhost:8080/api/dashboard/guilds \
  -H "X-API-Key: $DASH_API_KEY"
# Expected: 200 OK with guild list
```

### Test 6: Command Deployment

**Goal**: Verify slash commands are synced to Discord

```bash
# Run command deployment
npm run deploy:compact

# Expected output:
# ✅ Deploying X commands
# ✅ Commands synced to guild YourGuildID
# ✅ Deployment completed

# Verify in Discord:
# - Type "/" in your test server
# - See list of available commands
# - Try one command (e.g., /help)
```

### Test 7: Music Module (if enabled)

**Goal**: Verify music service is operational

```bash
# In Discord, run:
/play rickroll

# Expected:
# ✅ Bot joins voice channel
# ✅ Song starts playing
# ✅ No errors in logs

# Check Lavalink logs for proper node selection
tail -f lavalink/logs/spring.log | grep -i "track.*load\|node"
```

### Test 8: Error Handling

**Goal**: Verify error handling doesn't crash bot

```bash
# Test invalid command
/command-that-doesnt-exist

# Test with invalid parameters
/play

# Check logs for proper error logging
grep "ERROR\|WARN" logs/*.log

# Verify bot is still responsive after errors
curl http://localhost:80/health
# Should still return 200 OK
```

---

## 🔄 Failover Testing (Critical for Production)

### Test 9: Lavalink Primary Node Failover

**Goal**: Verify automatic failover from PRO to FREE node

```bash
# 1. Verify PRO node is primary
node -e "
  const {LavaliinkFailoverService} = require('./src/services/LavaliinkFailoverService');
  // Check: activePrimary should be 'PRO'
"

# 2. Simulate PRO node failure (stop Lavalink on port 2333)
kill -9 <lavalink-pro-pid>

# 3. Wait for health check (30 seconds)
sleep 30

# 4. Verify failover happened
tail -f logs/bot.log | grep -i "failover\|primary\|FREE"

# Expected in logs:
# ERROR: LAVALINK FAILOVER TRIGGERED: from=PRO to=FREE

# 5. Test music still works
/play <song>
# Should play from FREE node (128kbps)

# 6. Restart PRO node and verify recovery
# Lavalink should recover PRO node after ~5 retries with exponential backoff
sleep 300

tail -f logs/bot.log | grep -i "recovered"
# Expected: "Lavalink node recovered: node=PRO"
```

### Test 10: Database Connection Failure

**Goal**: Verify bot handles MongoDB disconnection

```bash
# 1. Stop MongoDB
mongod --shutdown

# 2. Verify bot logs connection error
grep "MongoDB connection" logs/bot.log

# 3. Bot should:
# - Log the error (no crash)
# - Attempt reconnection
# - Show "unhealthy" in /health endpoint

# 4. Check health endpoint
curl http://localhost:80/health
# Expected: 503 Service Unavailable (or degraded status)

# 5. Restart MongoDB and verify reconnection
mongod --dbpath /data/db

# 6. Verify bot recovers
grep "MongoDB reconnected" logs/bot.log
# Expected within 10 seconds
```

### Test 11: Memory Pressure

**Goal**: Verify memory monitoring and alerting

```bash
# Check current memory usage
ps aux | grep "node.*index.js"
# Note initial memory

# Monitor memory growth over 10 minutes
watch -n 5 "ps aux | grep 'node.*index.js' | grep -v grep"

# Expected:
# - Initial: ~150-200 MB
# - After 10min: ~200-300 MB (no significant leak)
# - Stable (not continuously growing)

# Check for memory alerts in logs
grep "MEMORY_PRESSURE\|MAX_MEMORY" logs/bot.log

# If memory > 900MB (PM2 threshold):
# - Bot should log warning
# - After 30s, bot should gracefully restart
```

### Test 12: Graceful Shutdown

**Goal**: Verify bot stops cleanly without losing data

```bash
# 1. Note active voice players
# 2. Send SIGTERM to bot
kill -TERM <bot-pid>

# 3. Bot should:
# - Stop accepting new interactions (< 100ms)
# - Disconnect all players (< 10s)
# - Close Discord connection (< 5s)
# - Exit cleanly within 30s

# 4. Verify no data loss
# - Check guild state in MongoDB
# - Verify player stats are saved
# - Check no orphaned voice connections

# 5. Restart and verify recovery
npm start

# Expected:
# - All previous guilds/settings restored
# - No "stale connection" errors
```

---

## 📊 Performance Baseline

Record these metrics before going to production:

```bash
# Bot startup time
time npm start

# Expected: < 2 minutes to ready

# Memory usage
ps aux | grep node

# Expected: 150-250 MB baseline

# CPU usage (idle)
top -b -n 1 | grep node

# Expected: < 2% when idle

# MongoDB query response time
time mongosh "$MONGO_URI" --eval "db.guilds.find().limit(1)"

# Expected: < 100ms

# Discord API response time
curl -w "Time: %{time_total}s\n" https://discord.com/api/v10/gateway

# Expected: < 200ms
```

---

## 🚨 Troubleshooting

### Bot won't start

```bash
# 1. Check error output
NODE_ENV=production npm start 2>&1 | head -50

# 2. Verify environment variables
node scripts/generate-production-keys.js

# 3. Check Docker/container logs (if applicable)
docker logs <container-id>

# 4. Verify MongoDB is running
mongosh --eval "db.adminCommand('ping')"
```

### Music not playing

```bash
# 1. Verify Lavalink nodes are running
curl -H "Authorization: $LAVALINK_PRO_PASSWORD" http://localhost:2333/info

# 2. Check Lavalink logs
tail -f lavalink/logs/spring.log

# 3. Verify failover service initialized
grep "failover" logs/bot.log

# 4. Test direct Lavalink connection
lavalink/scripts/test-connection.sh
```

### High memory usage

```bash
# 1. Check for memory leaks
node --inspect index.js

# 2. Use Chrome DevTools to profile heap
chrome://inspect

# 3. Check for unbounded arrays/caches
grep -n "push\|unshift\|concat" src/**/*.js

# 4. Verify no circular references
grep -n "circular\|ref" logs/bot.log
```

---

## ✅ Production Readiness Checklist

- [ ] All environment variables validated
- [ ] Encryption keys generated and stored securely
- [ ] MongoDB connection tested (SSL/TLS enabled)
- [ ] Lavalink nodes responding to health checks
- [ ] Failover tested and working
- [ ] Startup time < 2 minutes
- [ ] Memory usage stable at < 300MB
- [ ] All slash commands deployed
- [ ] Error handling tested
- [ ] Graceful shutdown verified
- [ ] Monitoring/alerting configured (Sentry, Discord webhook)
- [ ] Backups configured (MongoDB Atlas)
- [ ] Runbook created and reviewed
- [ ] Team trained on recovery procedures

---

## 📞 Support Contacts

- **Database Issues**: MongoDB Atlas support
- **Discord Issues**: Discord Developer Portal
- **Lavalink Issues**: Lavalink GitHub issues
- **Deployment Issues**: Your hosting provider

---

**Status**: Ready for deployment after all tests pass ✅
