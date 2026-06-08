# 🚀 TON618 Production Deployment Guide

**Quick Navigation:**
- 🔒 [Security Checklist](#-security-checklist)
- 🛠️ [Setup Instructions](#️-setup-instructions)
- ✅ [Verification](#-verification)
- 📊 [Monitoring](#-monitoring)
- 🆘 [Troubleshooting](#-troubleshooting)

---

## 🔒 Security Checklist

### What Was Secured

```
✅ Lavalink Passwords (PRO & FREE nodes)
   Before: hardcoded in .yml files ❌
   After:  env vars only ✅

✅ Encryption Keys (256-bit AES)
   Before: optional ❌
   After:  required + validated on startup ✅

✅ API Keys (BOT_API_KEY, DASH_API_KEY)
   Before: not enforced ❌
   After:  required in production ✅

✅ npm Vulnerabilities
   Before: 9 vulnerabilities in ton618-web ❌
   After:  0 vulnerabilities ✅

✅ Deployment Script
   Before: minimal validation ❌
   After:  exhaustive checks ✅

✅ Lavalink Failover
   Before: manual ❌
   After:  automatic with recovery ✅
```

---

## 🛠️ Setup Instructions

### 1️⃣ Generate Production Keys (5 minutes)

**⚠️ DO THIS FIRST - CRITICAL**

```bash
cd ton618-bot

# Generate all required keys
npm run generate:keys

# Output will show:
# ENCRYPTION_KEY=a3efd161bff97a717d0a4918402c49ba385e02c61997849ef4698c58361ccfa0
# HASH_SALT=8c6b9455fd9ead52f9b582799d3cfcfe6573261a1aa83930
# BOT_API_KEY=cd468d56fd72bbe82caa519c29ea2a301bc95974b7652d52f203af5c5849c013
# DASH_API_KEY=93cfd20aa2dbcfd812369905f34beb5a19ca6c8e93b60df706f5f6be5000b762
# LAVALINK_PRO_PASSWORD=aBcD1234!@#$%^&*-_=+
# LAVALINK_FREE_PASSWORD=XyZ9876!@#$%^&*-_=+

# File created: .env.production-generated
# ⚠️  IMPORTANT: Backup this file in a secure location
```

**Save these securely:**
- LastPass
- 1Password
- HashiCorp Vault
- etc.

### 2️⃣ Setup Hosting Platform (10 minutes)

**Option A: Square Cloud**

1. Go to Square Cloud Dashboard
2. Settings → Environment Variables
3. Add all variables from `.env.production-generated`
4. Save and restart bot

**Option B: VPS**

```bash
# Create .env.production file
cat > /path/to/ton618-bot/.env.production << 'EOF'
# Copy all variables from .env.production-generated
ENCRYPTION_KEY=...
HASH_SALT=...
[etc]
EOF

# Secure file permissions
chmod 600 /path/to/ton618-bot/.env.production

# Add to .gitignore (if not already)
echo ".env.production" >> .gitignore
```

**Option C: Docker**

```bash
# Create docker secrets
docker secret create encryption_key /tmp/encryption_key.txt
docker secret create bot_api_key /tmp/bot_api_key.txt

# Reference in docker-compose.yml or docker run
docker run \
  --secret encryption_key \
  --secret bot_api_key \
  ton618-bot:latest
```

### 3️⃣ Verify Configuration (5 minutes)

```bash
# Run validation
npm run validate:production

# Expected output:
# ✅ PASS   .env.production.example exists
# ✅ PASS   .env is in .gitignore
# ✅ PASS   npm audit
# ✅ PASS   src/utils/envValidator.js exists
# ✅ PASS   src/web/server.js exists
# ✅ PASS   scripts/generate-production-keys.js exists
# ✅ PASS   scripts/deploy-production.js exists
# ✅ PASS   scripts/health-check.js exists
# 
# ALL CHECKS PASSED: Ready for production deployment
```

### 4️⃣ Deploy Code (5 minutes)

```bash
# Run deployment script
bash deploy.sh

# Expected output:
# ✅ Node.js 20+ detected
# ✅ npm 10+ detected
# ✅ All critical environment variables are set
# ✅ ENCRYPTION_KEY format is valid
# ✅ HASH_SALT length is valid
# ✅ Dependencies installed successfully
# ✅ npm audit check passed
# ✅ Production environment validation passed
# ✅ discord.js v14.26.4 is installed
# 
# ✅ Deploy script completed successfully!
```

### 5️⃣ Start Bot (1 minute)

```bash
# Start bot
npm start

# Wait for readiness (60-120 seconds):
# ✅ Connecting to Discord...
# ✅ Connected to MongoDB...
# ✅ Loading commands...
# ✅ Bot ready: TON618#5678
# ✅ Health endpoints active on :80/health
```

### 6️⃣ Sync Commands (2 minutes)

```bash
# Deploy slash commands to Discord
npm run deploy:compact

# Expected:
# ✅ Deployed 45 commands
# ✅ Sync completed
```

---

## ✅ Verification

### Health Checks

```bash
# Automated health check
npm run health:check

# Expected:
# ✅ Bot Health
# ✅ Bot Ready State
# ✅ ALL CHECKS PASSED

# Manual checks
curl http://localhost/health       # 200 OK
curl http://localhost/ready        # 200 OK
```

### Test in Discord

```
1. Open test server
2. Type "/" → see commands
3. Run a command (e.g., /help)
4. Verify bot responds
5. Check no errors in logs

npm run logs
```

### Music Test (if applicable)

```
1. Join a voice channel
2. Run /play <song>
3. Verify music plays
4. Check no Lavalink errors in logs
```

---

## 📊 Monitoring

### Real-Time Dashboard

```bash
# Watch logs
npm run logs

# Monitor memory
watch -n 5 'ps aux | grep node | grep -v grep'

# Monitor health
watch -n 30 'curl -s http://localhost/health | jq'
```

### Key Metrics to Watch

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Memory | < 300MB | 300-600MB | > 900MB |
| Response Time | < 100ms | 100-500ms | > 1s |
| Error Rate | < 1% | 1-5% | > 5% |
| Uptime | > 99.9% | 99-99.9% | < 99% |

### Alerts to Configure

Discord webhook for alerts:
```bash
ALERT_DISCORD_WEBHOOK=https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN
```

Bot will alert for:
- Memory pressure (> 80%)
- Database connection errors
- Lavalink failover events
- Critical errors

---

## 🆘 Troubleshooting

### Bot won't start

**Error**: "ENCRYPTION_KEY is not set"

```bash
# Solution 1: Generate keys
npm run generate:keys

# Solution 2: Check env vars are loaded
NODE_ENV=production npm run validate:production

# Solution 3: Check .env.production file
cat .env.production | grep ENCRYPTION_KEY
```

**Error**: "Database connection failed"

```bash
# Check MongoDB
mongosh "$MONGO_URI" --eval "db.adminCommand('ping')"

# Verify MONGO_URI in .env.production
cat .env.production | grep MONGO_URI

# Check network connectivity
telnet <host> <port>
```

### Music not playing

**Error**: "Lavalink node unavailable"

```bash
# Check Lavalink nodes
curl -H "Authorization: $LAVALINK_PRO_PASSWORD" http://localhost:2333/info

# Check failover service
npm run logs | grep -i lavalink

# Restart music service
npm run restart
```

### High memory usage

**Symptom**: Memory > 600MB

```bash
# Check current usage
ps aux | grep node

# Check for leaks in logs
npm run logs | grep -i "memory\|heap"

# Graceful restart
npm run restart
```

### Deployment failed

**Error**: "npm audit fix failed"

```bash
# Try again with force
cd ton618-bot
npm audit fix --force

# If still failing, check specific vulnerability
npm audit --production

# Fix manually if needed
npm update <package-name>
```

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **PRODUCTION_DEPLOY.md** | Step-by-step deployment guide |
| **PRODUCTION_TESTING_GUIDE.md** | Comprehensive testing procedures |
| **PRODUCTION_READY_SUMMARY.md** | Overview of all changes |
| **.env.production.example** | Template for environment variables |
| **scripts/generate-production-keys.js** | Key generation utility |
| **scripts/validate-production.js** | Pre-deploy validation |
| **scripts/health-check.js** | Post-deploy health verification |

---

## 🔐 Security Reminders

```
🚫 NEVER:
   - Commit .env.production to Git
   - Share encryption keys in chat
   - Use same keys across environments
   - Leave old keys in logs

✅ DO:
   - Store keys in password manager
   - Rotate keys every 90 days
   - Backup keys in secure location
   - Use strong, random keys
   - Add to .gitignore immediately
```

---

## 📞 Quick Reference

```bash
# Generate keys
npm run generate:keys

# Validate environment
npm run validate:production

# Deploy code
bash deploy.sh

# Start bot
npm start

# Deploy commands
npm run deploy:compact

# Check health
npm run health:check

# View logs
npm run logs

# Restart bot
npm run restart

# Stop bot
npm run stop
```

---

## ✅ Success Criteria

After deployment, verify:

- [ ] Bot is running without errors
- [ ] `/health` endpoint returns 200 OK
- [ ] Memory usage < 300MB
- [ ] Commands responding in Discord
- [ ] Music playing (if enabled)
- [ ] No security warnings in logs
- [ ] Monitoring/alerts working

---

## 📈 Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Startup Time | < 2 min | ___ |
| Memory Usage | 200-300 MB | ___ |
| Health Response | < 100ms | ___ |
| Command Response | < 500ms | ___ |
| Error Rate | < 1% | ___ |

---

## 🎯 Next Steps

1. ✅ Generate production keys
2. ✅ Configure hosting platform
3. ✅ Run validation
4. ✅ Deploy code
5. ✅ Start bot
6. ✅ Verify health
7. ✅ Monitor logs

---

## 📞 Support

For issues or questions:

1. Check [PRODUCTION_TESTING_GUIDE.md](PRODUCTION_TESTING_GUIDE.md)
2. Review [PRODUCTION_DEPLOY.md](PRODUCTION_DEPLOY.md)
3. Run `npm run validate:production`
4. Check logs: `npm run logs`

---

**Status**: ✅ Ready for Production  
**Last Updated**: 2026-06-07  
**Version**: 1.0.0

🚀 **You're ready to deploy!**
