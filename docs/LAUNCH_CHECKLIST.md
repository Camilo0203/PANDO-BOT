# TON618 V1 Launch Checklist

Complete pre-launch validation checklist for bot-first deployment.

## Pre-Launch Validation

### Code & Dependencies

- [ ] All dependencies installed: `npm ci`
- [ ] No security vulnerabilities: `npm audit`
- [ ] Tests pass: `npm test`
- [ ] Environment validation passes: `npm run env:check:prod`
- [ ] Build fingerprint generated: `npm run build:fingerprint`
- [ ] No syntax errors in core files
- [ ] All imports resolve correctly

### Core Features Testing

**Ticket System:**
- [ ] `/ticket open` creates ticket successfully
- [ ] Ticket panel button creates ticket
- [ ] Category selection works
- [ ] Form validation works
- [ ] Ticket channel created with correct permissions
- [ ] Welcome message appears
- [ ] Control panel appears with buttons
- [ ] `/ticket claim` works
- [ ] `/ticket close` works with reason
- [ ] `/ticket reopen` works
- [ ] `/ticket assign` works
- [ ] `/ticket priority` changes priority
- [ ] `/ticket add` adds user to ticket
- [ ] `/ticket remove` removes user
- [ ] `/ticket rename` renames channel
- [ ] `/ticket move` moves to different category
- [ ] `/ticket transcript` generates transcript
- [ ] `/ticket brief` shows Case Brief
- [ ] `/ticket info` shows full info with Case Brief
- [ ] `/ticket history` shows user history
- [ ] `/ticket note add` creates internal note
- [ ] `/ticket note list` shows all notes
- [ ] Ticket rating system works on close

**Case Brief Feature (NEW):**
- [ ] Case Brief appears in `/ticket brief`
- [ ] Case Brief appears in `/ticket info`
- [ ] Risk assessment is accurate
- [ ] Next action recommendations are relevant
- [ ] Operational context is complete
- [ ] Recommendations update based on ticket state
- [ ] Risk level colors are correct

**Playbooks:**
- [ ] `/ticket playbook list` shows playbooks
- [ ] Playbook recommendations appear for tickets
- [ ] `/ticket playbook confirm` marks recommendation
- [ ] `/ticket playbook dismiss` dismisses recommendation
- [ ] `/ticket playbook apply-macro` works
- [ ] `/ticket playbook enable` enables playbook
- [ ] `/ticket playbook disable` disables playbook

**SLA System:**
- [ ] `/setup tickets sla` configures SLA
- [ ] SLA alerts trigger correctly
- [ ] Escalation works when configured
- [ ] `/stats sla` shows accurate metrics
- [ ] SLA rules by priority work
- [ ] SLA rules by category work
- [ ] First response time tracked correctly

**Staff Operations:**
- [ ] `/staff away-on` sets away status
- [ ] `/staff away-off` removes away status
- [ ] `/staff my-tickets` shows staff tickets
- [ ] `/staff warn-add` creates warning
- [ ] `/staff warn-check` shows warnings
- [ ] `/staff warn-remove` removes warning
- [ ] Auto-assignment respects away status

**Statistics:**
- [ ] `/stats server` shows server stats
- [ ] `/stats sla` shows SLA metrics
- [ ] `/stats staff` shows staff stats
- [ ] `/stats leaderboard` shows rankings
- [ ] `/stats ratings` shows rating leaderboard
- [ ] All metrics calculate correctly

**Setup Commands:**
- [ ] `/setup general` configures basic settings
- [ ] `/setup tickets panel` creates ticket panel
- [ ] `/setup tickets sla` configures SLA
- [ ] `/setup tickets auto-assignment` works
- [ ] `/setup tickets incidente` enables incident mode
- [ ] `/setup comandos` manages command toggles
- [ ] All setup options save correctly

**Verification System:**
- [ ] `/verify setup` configures verification
- [ ] `/verify panel` creates verification panel
- [ ] Button verification works
- [ ] Code verification works (if enabled)
- [ ] Question verification works (if enabled)
- [ ] `/verify force` manually verifies a user
- [ ] `/verify stats` shows verification stats
- [ ] Anti-raid detection works (if enabled)

**Config Center:**
- [ ] `/config center` opens config center
- [ ] Config backup creation works
- [ ] Config backup list shows backups
- [ ] Config rollback works
- [ ] Versioning is accurate

**Audit System:**
- [ ] `/audit` shows audit logs
- [ ] Ticket events are logged
- [ ] Staff actions are logged
- [ ] Config changes are logged
- [ ] Filters work correctly

**Debug Commands (Owner only):**
- [ ] `/debug status` shows bot status
- [ ] `/debug health` shows health metrics
- [ ] `/debug memory` shows memory usage
- [ ] `/debug cache` shows cache stats
- [ ] `/debug guilds` lists guilds
- [ ] Build fingerprint is visible

### Disabled Commands Validation

**These should NOT appear (V1 bot-first):**
- [ ] `/ping` is disabled
- [ ] `/embed` is disabled
- [ ] `/perfil` is disabled
- [ ] `/poll` is disabled
- [ ] `/suggest` is disabled
- [ ] Bienvenida setup is disabled
- [ ] Despedida setup is disabled
- [ ] Confesiones setup is disabled
- [ ] Sugerencias setup is disabled

### Database Operations

- [ ] MongoDB connection is stable
- [ ] Tickets collection works
- [ ] Settings collection works
- [ ] Ticket events collection works
- [ ] Staff stats collection works
- [ ] Indexes are created: `npm run db:indexes`
- [ ] No data corruption on operations
- [ ] Concurrent operations handle correctly

### Performance & Stability

- [ ] Bot starts successfully
- [ ] Bot reconnects after disconnect
- [ ] Memory usage is stable (< 512MB)
- [ ] No memory leaks over 1 hour
- [ ] Response time < 2 seconds
- [ ] Health endpoint returns 200: `/health`
- [ ] Graceful shutdown works (Ctrl+C)

### Error Handling

- [ ] Invalid commands show helpful errors
- [ ] Missing permissions show clear messages
- [ ] Database errors are caught and logged
- [ ] Discord API errors are handled
- [ ] Rate limits are respected
- [ ] Error logs are created (if enabled)

## Deployment Validation

### Environment Configuration

- [ ] `.env` file exists with all required values
- [ ] `DISCORD_TOKEN` is valid
- [ ] `MONGO_URI` connects successfully
- [ ] `MONGO_DB` is set
- [ ] `OWNER_ID` is correct
- [ ] `COMMANDS_DISABLED_FILES` is set for V1
- [ ] Optional vars are configured as needed

### Discord Application Setup

- [ ] Bot token is valid and not exposed
- [ ] All three privileged intents are enabled:
  - [ ] PRESENCE INTENT
  - [ ] SERVER MEMBERS INTENT
  - [ ] MESSAGE CONTENT INTENT
- [ ] Bot permissions are correct in invite URL
- [ ] Bot is invited to test server
- [ ] Bot appears online in Discord

### Slash Commands Deployment

- [ ] Commands deployed: `npm run deploy:compact`
- [ ] Commands appear in Discord (wait 1-2 min)
- [ ] All expected commands are visible
- [ ] Disabled commands are NOT visible
- [ ] Command descriptions are clear
- [ ] Autocomplete works where expected
- [ ] `/debug entitlements status` works for the bot owner

### Hosting Platform

**VPS / PM2:**
- [ ] `ton618-lavalink`, `ton618-bot`, `ton618-web` and `ton618-status` are online
- [ ] Music commands and controls load directly from `ton618-bot`
- [ ] Environment variables are set
- [ ] Bot starts successfully
- [ ] Logs are accessible
- [ ] Auto-restart is configured
- [ ] Health check is configured
- [ ] Resource limits are appropriate

### MongoDB Setup

- [ ] MongoDB Atlas cluster is created (or local MongoDB)
- [ ] Database user has correct permissions
- [ ] IP whitelist allows connections
- [ ] Connection string is correct
- [ ] Database is created
- [ ] Collections are initialized

### Health Monitoring

- [ ] Health endpoint accessible: `http://your-host:8080/health`
- [ ] Health check returns `"status": "ok"`
- [ ] UptimeRobot or similar is configured (optional)
- [ ] Alert notifications are set up (optional)

## Documentation Validation

### Core Documentation

- [ ] README.md is clear and accurate
- [ ] QUICKSTART.md is complete
- [ ] DEPLOYMENT.md covers all hosting options
- [ ] DISCORD_APP_SETUP.md is step-by-step
- [ ] All links in docs work
- [ ] Screenshots are up-to-date (if any)
- [ ] Code examples are correct

### Configuration Files

- [ ] `.env.example` has all variables documented
- [ ] `.env.production.example` is production-ready
- [ ] `config.js` has clear comments
- [ ] `squarecloud.config` is correct
- [ ] `ecosystem.config.js` is correct for PM2

### Marketing Materials

- [ ] MARKETING_KIT.md is complete
- [ ] DISCORD_SERVER_BLUEPRINT.md is detailed
- [ ] DISTRIBUTION_STRATEGY.md is actionable
- [ ] All copy is proofread
- [ ] Links are correct

## Security Validation

- [ ] No tokens or secrets in git
- [ ] `.env` is in `.gitignore`
- [ ] No hardcoded credentials
- [ ] Owner-only commands are protected
- [ ] Staff-only commands check permissions
- [ ] Rate limiting is in place
- [ ] Input validation on all commands
- [ ] SQL injection prevention (N/A for MongoDB)
- [ ] No XSS vulnerabilities in embeds

## GitHub Repository

- [ ] README is comprehensive
- [ ] LICENSE file exists (MIT)
- [ ] .gitignore is complete
- [ ] No sensitive files committed
- [ ] Repository description is clear
- [ ] Topics/tags are added
- [ ] GitHub Discussions enabled (optional)
- [ ] Issues template created (optional)
- [ ] Contributing guide exists (optional)

## Support Server Setup

- [ ] Discord server created
- [ ] Channels created per blueprint
- [ ] Roles configured
- [ ] Permissions set correctly
- [ ] TON618 bot invited and configured
- [ ] Ticket panel created
- [ ] Verification system set up
- [ ] Welcome message posted
- [ ] Rules posted
- [ ] Documentation links pinned
- [ ] Initial staff invited

## Marketing Preparation

- [ ] Bot listing sites submissions ready
- [ ] Reddit posts drafted
- [ ] Twitter/X account created
- [ ] Launch announcement ready
- [ ] Demo server is public
- [ ] Screenshots prepared
- [ ] Video demo recorded (optional)
- [ ] Press kit ready (optional)

## Final Pre-Launch

### 24 Hours Before Launch

- [ ] Final code review
- [ ] All tests passing
- [ ] Production deployment tested
- [ ] Rollback plan ready
- [ ] Support server ready
- [ ] Marketing materials finalized
- [ ] Team briefed (if applicable)

### Launch Day Morning

- [ ] Bot is online and healthy
- [ ] All systems operational
- [ ] Support team ready
- [ ] Monitoring active
- [ ] Social media scheduled
- [ ] Reddit posts ready
- [ ] Free and Pro positioning are reflected in docs and command UX

### Launch Execution

- [ ] Post on r/discordapp
- [ ] Post on r/discord_bots
- [ ] Tweet launch announcement
- [ ] Submit to bot listing sites
- [ ] Share in Discord communities
- [ ] Monitor all channels
- [ ] Respond to feedback

### Post-Launch (First 24h)

- [ ] Monitor error logs
- [ ] Respond to all questions
- [ ] Fix critical bugs immediately
- [ ] Gather user feedback
- [ ] Thank early adopters
- [ ] Post follow-up updates

## Success Criteria

**Minimum Viable Launch:**
- ✅ Bot is stable and online
- ✅ Core ticket system works
- ✅ Case Brief feature works
- ✅ SLA tracking works
- ✅ Documentation is complete
- ✅ Support server is active

**Successful Launch:**
- ✅ 10+ servers using TON618 in week 1
- ✅ 50+ GitHub stars in week 1
- ✅ 100+ support server members in week 1
- ✅ No critical bugs reported
- ✅ Positive community feedback

## Rollback Plan

**If critical issues occur:**

1. **Identify severity:**
   - Critical: Bot crashes, data loss, security issue
   - High: Major feature broken, poor UX
   - Medium: Minor bugs, cosmetic issues

2. **For critical issues:**
   - Stop new deployments
   - Revert to last stable version
   - Notify users in support server
   - Fix issue in development
   - Test thoroughly
   - Redeploy when stable

3. **For high/medium issues:**
   - Log issue in GitHub
   - Prioritize fix
   - Deploy patch within 24-48h
   - Notify affected users

## Post-Launch Checklist

**Week 1:**
- [ ] Daily monitoring of logs and errors
- [ ] Respond to all support requests
- [ ] Fix critical bugs
- [ ] Gather user feedback
- [ ] Post daily updates

**Week 2:**
- [ ] Analyze usage metrics
- [ ] Prioritize feature requests
- [ ] Plan first update
- [ ] Engage with community
- [ ] Create first case study

**Month 1:**
- [ ] Release first update
- [ ] Publish changelog
- [ ] Update roadmap
- [ ] Community survey
- [ ] Celebrate milestones

## Emergency Contacts

**If you need help:**
- MongoDB issues: MongoDB Atlas support
- Discord API issues: Discord Developer Support
- Hosting issues: Platform-specific support
- Community questions: Support server

## Notes

- This checklist is comprehensive - not everything is required for launch
- Focus on "Minimum Viable Launch" criteria first
- Perfect is the enemy of good - launch and iterate
- Community feedback is more valuable than perfect code
- Be ready to fix issues quickly post-launch

## Final Validation

Before you click "launch":

- [ ] I have tested all core features
- [ ] Documentation is accurate
- [ ] Bot is stable in production
- [ ] I can handle support requests
- [ ] I'm ready to iterate based on feedback
- [ ] I have a rollback plan
- [ ] I'm excited to share this with the world

**If all core items are checked, you're ready to launch! 🚀**
