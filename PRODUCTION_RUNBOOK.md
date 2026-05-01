# TON618 Production Runbook

## Quick Reference
| Command | Action |
|---------|--------|
| `npm start` | Start bot |
| `npm run dev` | Development mode |
| `npm test` | Run tests |
| `npm run env:check` | Validate env vars |
| `npm run deploy:compact` | Deploy commands |

---

## Health Checks

### Bot Status
```
/debug status      → Shows bot health
/health         → HTTP health endpoint
/debug ping       → Discord gateway latency
```

### Database
```
MongoDB: Check connection in /health
Stats: db.stats() in mongo shell
```

---

## Common Issues

### Bot Not Responding
1. Check `/health` - is bot online?
2. Check gateway connection: `/debug status`
3. Check memory: `/debug status` → memory section
4. Restart if needed: `pm2 restart ton618`

### Premium Not Working
1. Check config: `SUPABASE_URL`, `BOT_API_KEY`
2. Check billing: `/debug entitlements status`
3. Check logs for `premium` errors

### Ticket Creation Failing
1. Check bot permissions in category
2. Check rate limits: userRL, guildRL limits
3. Check MongoDB connection

---

## Rate Limiting

| Limit | Threshold |
|-------|-----------|
| User | 5 req/min |
| Guild | 100 req/min |
| Global | 1000 req/min |

### Bypass for Staff
- Admins can bypass user rate limit
- Set `rate_limit_bypass_admin: true` in settings

---

## Emergency Procedures

### Complete Outage
```bash
# 1. Check process
pm2 status

# 2. Check logs
pm2 logs ton618 --lines 50

# 3. Restart
pm2 restart ton618
```

### Database Issues
```bash
# 1. Check MongoDB
curl http://localhost:3000/health

# 2. If down, check connection
mongosh "your-mongo-uri"

# 3. Restart bot
pm2 restart ton618
```

### Discord API Issues
```bash
# Check gateway status
/debug status

# If Issues, check:
# 1. Bot invited with correct scopes
# 2. Bot has required intents
# 3. No outages at status.discord.com
```

---

## Configuration

### Required Env Vars
```
DISCORD_TOKEN=           # Bot token
MONGO_URI=              # MongoDB connection (tls=true in production)
OWNER_ID=              # Your Discord ID
ENCRYPTION_KEY=          # 64 hex chars AES-256 key (required in production)
HASH_SALT=             # >=32 chars HMAC salt (required in production)
```

### Optional Env Vars
```
USER_RATE_LIMIT_MAX_REQUESTS=5
GUILD_RATE_LIMIT_MAX_REQUESTS=100
GLOBAL_RATE_LIMIT_MAX_REQUESTS=1000
PREMIUM_CACHE_TTL_MS=300000
SUPABASE_MAX_RETRIES=3
SUPABASE_RETRY_DELAY_MS=1000
ERROR_LOG_MAX_SIZE_BYTES=10485760
```

---

## Monitoring

### Logs Location
- PM2: `pm2 logs ton618`
- Sentry: Check sentry.io for errors
- Discord: Check configured alerts channel

### Metrics
- `/debug status` → All metrics
- Health endpoint: `GET /health`

---

## Rollback

### Quick Rollback
```bash
# Previous version
git checkout HEAD~1
npm start
```

### Command Cleanup
```bash
npm run cleanup:commands
git checkout main
npm run deploy:compact
```

### Deploy Updated Commands (after security changes)
```bash
# Deploy main bot commands (includes new confirm_code options)
npm run deploy:compact

# Deploy music commands
npm run deploy:music
```

---

## Ecosystem Deploy

### Web (ton618-web)
```bash
cd ../ton618-web
npm ci
npm run build
# Deploy to Netlify / Vercel / Static host
```

### Music (ton618-music)
```bash
cd ../ton618-music
npm ci
node deploy-commands.js
npm start
```

### Lavalink Nodes
```bash
cd ../Nodo\ Lavalink
# Start PRO node (port 2333)
java -jar Lavalink.jar --spring.config.location=./lavalink/application.yml
# Start FREE node (port 2334)
java -jar Lavalink.jar --spring.config.location=./lavalink/application-free.yml
```

---

## Support

- Issues: GitHub Issues
- Discord: Your support server
- Email: support@ton618.app
- Security: security@ton618.app

---

**Last Updated**: 2026-04-30
**Version**: 3.0.0