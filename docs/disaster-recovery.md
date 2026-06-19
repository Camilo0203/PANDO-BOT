# TON618 Disaster Recovery Plan

## Emergency Contacts

- **Bot Owner**: [Configure OWNER_ID in .env]
- **MongoDB Admin**: [Add contact]
- **Hosting Provider**: [Add contact]
- **Supabase Support**: support@supabase.io

## Critical Scenarios

### 1. Bot Completely Down

**Detection:**
- `/health` endpoint returns 503 or times out
- Discord bot shows offline
- No heartbeat in MongoDB `botHealth` collection

**Recovery Steps:**
1. Check host status (server, container, PM2 process)
2. Review recent logs: `tail -f data/logs/errors_*.jsonl`
3. Verify environment variables are loaded
4. Check MongoDB connection: `npm run smoke:health`
5. Restart bot: `npm start` or `pm2 restart ton618-bot`
6. Verify fingerprint matches expected: `curl "$BOT_HEALTHCHECK_URL"`

**Rollback Trigger:**
- If bot doesn't start after 3 restart attempts
- If errors persist after 10 minutes

### 2. MongoDB Connection Lost

**Detection:**
- Health endpoint shows `mongoConnected: false`
- Errors in logs: "MongoDB connection failed"

**Recovery Steps:**
1. Verify MongoDB Atlas/cluster is online
2. Check network connectivity to MongoDB
3. Verify `MONGO_URI` credentials are valid
4. Check MongoDB Atlas IP whitelist
5. Restart bot to reconnect
6. If persistent, restore from backup

**Rollback Trigger:**
- Cannot connect after 5 minutes
- Data corruption detected

### 3. Data Corruption

**Detection:**
- Tickets not loading
- Settings reset to defaults
- Audit logs missing

**Recovery Steps:**
1. **STOP THE BOT IMMEDIATELY**
2. Identify corrupted collections
3. Restore from latest backup:
   ```bash
   mongorestore --uri="MONGO_URI" --nsInclude="ton618.*" /path/to/backup
   ```
4. Verify data integrity
5. Restart bot
6. Run smoke tests

**Prevention:**
- Daily automated backups
- Backup retention: 30 days
- Test restore monthly

### 4. Dashboard Bridge Failure

**Detection:**
- Mutations stuck in pending state
- Guild sync status shows errors
- Inbox not updating

**Recovery Steps:**
1. Check Supabase status: https://status.supabase.com
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is valid
3. Check `guild_sync_status` table for errors
4. Review `mutation_queue` for failed operations
5. Manually retry failed mutations
6. Restart dashboard sync: restart bot or wait for next cycle

**Rollback Trigger:**
- Supabase credentials compromised
- Data sync causing corruption

### 5. Slash Commands Not Working

**Detection:**
- Commands don't appear in Discord
- Commands return "Unknown interaction"

**Recovery Steps:**
1. Verify bot has `applications.commands` scope
2. Check Discord API status: https://discordstatus.com
3. Re-deploy commands:
   ```bash
   npm run deploy:safe:compact
   ```
4. If global commands, wait up to 1 hour for propagation
5. Check bot permissions in guild

**Rollback Trigger:**
- Commands still broken after 2 hours
- Need to restore previous command definitions

### 6. Memory Leak

**Detection:**
- `/health` shows increasing `heapUsedMB`
- Process crashes with "Out of memory"
- Slow response times

**Recovery Steps:**
1. Restart bot immediately
2. Review recent code changes
3. Check for unclosed connections
4. Monitor memory over 24 hours
5. If persistent, rollback to previous version

**Prevention:**
- Monitor memory usage via `/health`
- Set up alerts for >500MB heap usage
- Regular restarts (weekly) in production

### 7. Rate Limit Exceeded (Discord API)

**Detection:**
- Errors: "429 Too Many Requests"
- Bot becomes unresponsive
- Commands timeout

**Recovery Steps:**
1. Identify source of excessive requests
2. Implement backoff in affected code
3. Review cron job frequencies
4. Check for infinite loops
5. Temporarily disable non-critical features

**Prevention:**
- Respect Discord rate limits
- Implement exponential backoff
- Cache frequently accessed data

## Backup Strategy

### What to Backup

**Critical (Daily):**
- MongoDB `ton618` database (all collections)
- Guild settings
- Ticket data
- Audit logs

**Important (Weekly):**
- Config backups (already versioned in DB)
- Error logs
- Metrics history

**Optional (Monthly):**
- Full system snapshot
- Environment configuration (encrypted)

### Backup Locations

1. **Primary**: MongoDB Atlas automated backups
2. **Secondary**: External backup service (AWS S3, Google Cloud Storage)
3. **Tertiary**: Local encrypted backups (for critical data only)

### Backup Verification

**Monthly Test:**
1. Restore backup to staging environment
2. Verify all collections present
3. Check data integrity
4. Test critical flows (ticket creation, commands)
5. Document any issues

### Recovery Time Objectives (RTO)

- **Critical outage**: 15 minutes
- **Data corruption**: 1 hour
- **Full disaster recovery**: 4 hours

### Recovery Point Objectives (RPO)

- **Ticket data**: 1 hour (max data loss)
- **Settings**: 24 hours
- **Audit logs**: 24 hours

## Rollback Procedures

### Code Rollback

1. Identify last known good version:
   ```bash
   git log --oneline
   ```
2. Checkout previous version:
   ```bash
   git checkout <commit-hash>
   ```
3. Deploy commands:
   ```bash
   npm ci
   npm run deploy:safe:compact
   ```
4. Restart bot
5. Verify fingerprint

### Database Rollback

1. **STOP THE BOT**
2. Backup current state (even if corrupted)
3. Restore from backup:
   ```bash
   mongorestore --drop --uri="MONGO_URI" /path/to/backup
   ```
4. Verify restoration
5. Restart bot
6. Run smoke tests

### Configuration Rollback

Use built-in config backup system:
1. `/config center` > `System` > `View backups`
2. Select backup to restore
3. Confirm restoration
4. Verify settings applied

## Post-Incident Review

After any incident:

1. **Document what happened**
   - Timeline of events
   - Root cause
   - Impact assessment

2. **Document what worked**
   - Successful recovery steps
   - Helpful monitoring/alerts

3. **Document what didn't work**
   - Failed recovery attempts
   - Missing tools/documentation

4. **Action items**
   - Preventive measures
   - Documentation updates
   - Monitoring improvements

5. **Update this runbook** with lessons learned

## Monitoring Checklist

**Daily:**
- [ ] Check `/health` endpoint
- [ ] Review error logs
- [ ] Check guild sync status
- [ ] Verify backup completion

**Weekly:**
- [ ] Review SLA metrics
- [ ] Check memory trends
- [ ] Review failed mutations
- [ ] Test backup restore (staging)

**Monthly:**
- [ ] Full disaster recovery drill
- [ ] Review and update contacts
- [ ] Audit access controls
- [ ] Review and rotate credentials

## Emergency Commands

```bash
# Check bot health
curl "$BOT_HEALTHCHECK_URL" | jq

# View recent errors
tail -100 data/logs/errors_$(date +%Y-%m-%d).jsonl

# Restart bot (PM2)
pm2 restart ton618-bot

# Restart bot (systemd)
sudo systemctl restart ton618-bot

# Check MongoDB connection
mongosh "MONGO_URI" --eval "db.adminCommand('ping')"

# Deploy commands with rollback
npm run deploy:safe:compact

# Run smoke tests
npm run smoke:health "$BOT_HEALTHCHECK_URL"

# View build fingerprint
npm run build:fingerprint
```

## Escalation Path

1. **Level 1**: Bot owner attempts recovery (15 min)
2. **Level 2**: Contact hosting provider (30 min)
3. **Level 3**: Contact MongoDB/Supabase support (1 hour)
4. **Level 4**: Full team incident response (2 hours)

## Communication Template

**Incident Notification:**
```
🚨 TON618 Bot Incident

Status: [Investigating/Identified/Monitoring/Resolved]
Severity: [Critical/High/Medium/Low]
Impact: [Description]
Started: [Timestamp]
ETA: [Estimated resolution time]

Current Actions:
- [Action 1]
- [Action 2]

Updates: [Where to check for updates]
```

## Important Notes

- **Never** restore production backups to staging without review
- **Never** mix staging and production credentials
- **Always** verify backups before deleting old ones
- **Always** test in staging before production
- **Document** every incident and recovery
