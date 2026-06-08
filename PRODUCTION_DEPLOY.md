# TON618 Production Deployment Guide

**Target Environments**: Square Cloud, VPS, Docker  
**Last Updated**: 2026-06-07  

---

## 🚀 Quick Start (5 minutes)

```bash
# 1. Generate production keys
node scripts/generate-production-keys.js

# 2. Copy .env.production-generated to your hosting platform secrets
# (DO NOT commit to Git!)

# 3. Deploy code
bash deploy.sh

# 4. Verify health
node scripts/health-check.js

# 5. Monitor logs
npm run logs
```

---

## 📋 Pre-Deployment (30 minutes)

### Step 1: Validate Environment

```bash
# Verify production environment is ready
NODE_ENV=production node scripts/validate-production.js

# Expected output: ✅ ALL CHECKS PASSED
```

**If validation fails**, review errors and:
- Generate missing keys: `node scripts/generate-production-keys.js`
- Fix environment variables in hosting platform
- Re-run validation

### Step 2: Generate Secure Keys

```bash
# Generate cryptographic keys
node scripts/generate-production-keys.js

# Output will show:
# - ENCRYPTION_KEY (256-bit hex)
# - HASH_SALT (minimum 32 chars)
# - BOT_API_KEY (shared with Supabase)
# - DASH_API_KEY (dashboard auth)
# - LAVALINK_PRO_PASSWORD
# - LAVALINK_FREE_PASSWORD

# Important: These are ONE-TIME generation
# Save backup in secure location: LastPass, 1Password, etc.
```

### Step 3: Verify Dependencies

```bash
# Update npm
npm install -g npm@latest

# Audit for security vulnerabilities
npm audit --production

# Review any HIGH severity issues
npm audit --production --json | jq '.vulnerabilities[] | select(.severity=="high")'

# Fix if possible
npm audit fix --force
```

### Step 4: Configure Hosting Platform

**Square Cloud**:
```
PORT=80
NODE_ENV=production
DISCORD_TOKEN=<your-token>
MONGO_URI=<your-uri>
[+ all keys from step 2]
```

**VPS**:
```bash
# Create .env.production file (never commit to git)
cat > .env.production << 'EOF'
[Paste all environment variables]
EOF

# Restrict permissions
chmod 600 .env.production
```

**Docker**:
```bash
# Create secrets file
docker secret create bot_encryption_key /path/to/encryption_key
docker secret create bot_api_key /path/to/bot_api_key

# Run with --secret flags
docker run --secret bot_encryption_key --secret bot_api_key ...
```

---

## 🔧 Deployment Execution (15 minutes)

### Step 1: Run Deployment Script

```bash
# Deploy with automatic validation
bash deploy.sh

# Expected output:
# ✅ Node.js 20+ detected
# ✅ npm 10+ detected
# ✅ All critical environment variables are set
# ✅ ENCRYPTION_KEY format is valid (256-bit hex)
# ✅ HASH_SALT length is valid (48 chars)
# ✅ All critical environment variables are set
# ✅ Dependencies installed successfully
# ✅ npm audit check passed
# ✅ Production environment validation passed
# ✅ discord.js v14.26.4 is installed
# 
# ✅ Deploy script completed successfully!
#
# Next steps:
#   1. Start the bot with:        npm start
#   2. Sync slash commands:       npm run deploy:compact
#   3. Monitor health:            curl http://localhost/health
#   4. Check logs:                npm run logs
```

### Step 2: Start Bot

```bash
# Start bot (foreground - for testing)
npm start

# Or in background with PM2:
pm2 start ecosystem.config.js
pm2 logs ton618-bot

# Bot should reach "ready" state within 2 minutes
# Watch for: "✅ Discord client ready"
```

### Step 3: Sync Commands

```bash
# Deploy slash commands to Discord
npm run deploy:compact

# Expected output:
# ✅ Deployed 45 commands to guild
# ✅ Sync completed successfully
```

---

## ✅ Post-Deployment Validation (10 minutes)

### Health Checks

```bash
# Run automated health check
npm run health:check

# Expected output:
# ✅ Bot Health
#    Status: 200
#    Uptime: 123456 ms
#    Memory: 245 MB
#
# ✅ Bot Ready State
#    Status: 200
#
# ✅ ALL CHECKS PASSED
```

### Manual Verification

```bash
# 1. Health endpoint
curl http://localhost:80/health
# Expected: 200 OK

# 2. Ready endpoint
curl http://localhost:80/ready
# Expected: 200 OK

# 3. Check logs for errors
npm run logs | grep -i "error\|critical"
# Expected: Only expected warnings, no errors

# 4. Test in Discord
# - Type "/" in test server
# - Select a command
# - Verify response

# 5. Check memory usage
ps aux | grep node
# Expected: 200-300 MB

# 6. Verify Lavalink nodes
curl -H "Authorization: $LAVALINK_PRO_PASSWORD" \
  http://localhost:2333/info
# Expected: 200 OK with version info
```

---

## 🔄 Monitoring (Ongoing)

### Real-time Monitoring

```bash
# Watch logs live
npm run logs -- --follow

# Monitor memory
watch -n 5 "ps aux | grep node | grep -v grep"

# Monitor health endpoint
watch -n 30 "curl -s http://localhost/health | jq '.'"
```

### Automated Alerts

Configure Discord webhook for alerts:
```bash
# Set in .env.production
ALERT_DISCORD_WEBHOOK=https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN

# Bot will send alerts for:
# - Memory pressure (> 80% of max)
# - MongoDB connection errors
# - Lavalink failover events
# - Critical errors
```

### Key Metrics to Monitor

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Memory | < 300MB | 300-600MB | > 900MB |
| CPU | < 5% | 5-20% | > 20% |
| Response Time | < 100ms | 100-500ms | > 1s |
| Error Rate | < 1% | 1-5% | > 5% |
| Uptime | > 99.9% | 99-99.9% | < 99% |

---

## 🚨 Troubleshooting

### Bot won't start

```bash
# 1. Check environment validation
NODE_ENV=production node scripts/validate-production.js

# 2. Review error in logs
npm start 2>&1 | head -100

# 3. Verify MongoDB connection
mongosh "$MONGO_URI" --eval "db.adminCommand('ping')"

# 4. Regenerate keys if corrupted
node scripts/generate-production-keys.js
```

### Music not working

```bash
# 1. Check Lavalink nodes
curl -H "Authorization: $LAVALINK_PRO_PASSWORD" \
  http://localhost:2333/info

# 2. Check failover status
npm run logs | grep -i "lavalink\|failover"

# 3. Restart music service
npm run restart:music
```

### Memory leak

```bash
# 1. Check current usage
ps aux | grep node

# 2. Enable heap snapshots
node --inspect index.js

# 3. Use Chrome DevTools (chrome://inspect) to analyze

# 4. Check for common causes:
grep -r "cache\|Map\|Set" src/ | grep -v "node_modules"

# 5. Restart bot gracefully
npm run restart
```

### Failover not working

```bash
# 1. Verify failover service initialized
npm run logs | grep -i "failover.*initialized"

# 2. Check both Lavalink nodes responding
for port in 2333 2334; do
  curl -H "Authorization: $LAVALINK_PRO_PASSWORD" \
    http://localhost:$port/info || echo "Node $port failed"
done

# 3. Force health check
kill -USR1 <bot-pid>

# 4. Check failover status
npm run logs | grep -i "health\|failover"
```

---

## 📊 Rollback Procedure (If Issues)

```bash
# 1. Identify previous working version
git log --oneline | head -10

# 2. Stop current bot
npm run stop
# or: pm2 stop ton618-bot

# 3. Checkout previous version
git checkout <commit-hash>

# 4. Keep current .env.production (don't reset)
# Verify it's in .gitignore

# 5. Run deployment
npm ci --production=false
bash deploy.sh

# 6. Start bot
npm start

# 7. Verify health
curl http://localhost/health
```

---

## 📝 Maintenance Tasks

### Weekly
- [ ] Check memory trends
- [ ] Review error logs
- [ ] Verify Lavalink nodes health
- [ ] Check MongoDB connection pool

### Monthly
- [ ] Update dependencies: `npm update`
- [ ] Run full audit: `npm audit`
- [ ] Backup MongoDB: `mongodump`
- [ ] Review and rotate keys (optional)

### Quarterly
- [ ] Performance testing
- [ ] Disaster recovery drill
- [ ] Security audit
- [ ] Capacity planning

---

## 🔐 Security Reminders

1. **Never commit** `.env.production` to Git
2. **Add to .gitignore**: `.env.production`, `.env.production-generated`
3. **Backup keys** in secure location (password manager)
4. **Rotate keys** every 90 days
5. **Monitor access** to hosting secrets dashboard
6. **Use HTTPS** for all API communication
7. **Enable 2FA** on hosting platform accounts

---

## 📞 Quick Reference

```bash
# Generate keys
node scripts/generate-production-keys.js

# Validate environment
NODE_ENV=production node scripts/validate-production.js

# Deploy
bash deploy.sh

# Start bot
npm start

# Check health
npm run health:check

# View logs
npm run logs

# Restart bot
npm restart

# Stop bot
npm stop

# Run tests
npm test
```

---

## ✅ Deployment Checklist

**Before Deploy**:
- [ ] All environment variables validated
- [ ] Encryption keys generated
- [ ] npm audit passed
- [ ] MongoDB accessible
- [ ] Lavalink nodes responding
- [ ] Team notified

**During Deploy**:
- [ ] Run deploy.sh without errors
- [ ] Bot reaches "ready" state
- [ ] Commands synced successfully
- [ ] Health endpoints responding

**After Deploy**:
- [ ] Health checks passing
- [ ] No errors in logs (first 5 minutes)
- [ ] Bot responding to commands in Discord
- [ ] Memory usage normal (< 300MB)
- [ ] Monitoring/alerts configured

---

**Status**: ✅ Ready for production deployment

*For detailed testing procedures, see [PRODUCTION_TESTING_GUIDE.md](PRODUCTION_TESTING_GUIDE.md)*
