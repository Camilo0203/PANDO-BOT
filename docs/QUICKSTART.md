# TON618 Quick Start Guide

Get your bilingual TON618 setup running in 5 minutes.

## Prerequisites

- Node.js 20+
- MongoDB instance (local or cloud like MongoDB Atlas free tier)
- Discord Bot Token

## Step 1: Create Discord Application

1. Go to https://discord.com/developers/applications
2. Click **New Application**
3. Name it `TON618` (or your preferred name)
4. Go to **Bot** section
5. Click **Reset Token** and copy your bot token (save it securely)
6. Enable these **Privileged Gateway Intents**:
   - ✅ SERVER MEMBERS INTENT
   - ✅ MESSAGE CONTENT INTENT
   - ✅ PRESENCE INTENT (optional, for auto-assignment features)
7. Go to **OAuth2 > URL Generator**
8. Select scopes: `bot`, `applications.commands`
9. Select bot permissions:
   - âœ… Manage Server
   - ✅ Manage Roles
   - ✅ Manage Channels
   - ✅ View Channels
   - ✅ Send Messages
   - ✅ Manage Messages
   - ✅ Embed Links
   - ✅ Attach Files
   - ✅ Read Message History
   - ✅ Add Reactions
   - ✅ Use Slash Commands
10. Copy the generated URL and invite the bot to your server

## Step 2: Setup MongoDB

**Option A: MongoDB Atlas (Free)**
1. Go to https://www.mongodb.com/cloud/atlas/register
2. Create free cluster
3. Create database user
4. Whitelist IP: `0.0.0.0/0` (allow from anywhere)
5. Get connection string (looks like `mongodb+srv://user:pass@cluster.mongodb.net/`)

**Option B: Local MongoDB**
1. Install MongoDB locally
2. Start MongoDB service
3. Connection string: `mongodb://localhost:27017`

## Step 3: Configure Environment

1. Clone/download the repository
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and set these **required** values:
   ```env
    DISCORD_TOKEN=your_bot_token_here
    MONGO_URI=your_mongodb_connection_string
    MONGO_DB=ton618
    OWNER_ID=your_discord_user_id
   ```
4. If you are going to run with `NODE_ENV=production` on the VPS, also set:
   ```env
   BOT_API_KEY=generate_a_32_byte_hex_secret
   ```

**How to get your Discord User ID:**
- Enable Developer Mode in Discord (Settings > Advanced > Developer Mode)
- Right-click your username and select "Copy ID"

## Step 4: Install and Deploy

```bash
# Install dependencies
npm ci

# Deploy slash commands to Discord
npm run deploy:compact

# Validate your current local env (.env.local + .env)
npm run env:check

# Validate production rules before shipping
npm run env:check:prod

# Start the bot
npm start
```

You should see:
```
✅ MongoDB conectado correctamente
Bot conectado como TON618#1234
```

## Step 5: Initial Server Setup

In your Discord server, run these commands:

### 1. Choose the server language
When TON618 joins a server it posts a language onboarding prompt. Pick `English` or `Español` there.

If you need to review or change it later, run:
```
/setup language
/setup language value:es
```

### 2. Prepare the baseline with `/setup`
Before publishing member-facing flows, configure the server baseline:
```
/setup general info
```

Then set the staff roles, logs, transcripts, limits, or dashboard pieces your team needs from the `/setup` command group.

### 3. Publish the ticket system
```
/setup tickets panel
```
This creates the ticket panel once your guild has the needed support/admin channels and roles configured.

### 4. Configure SLA (optional but recommended)
```
/setup tickets sla warning-minutes:60
```
This sets a 60-minute SLA for first response.

### 5. Turn on verification if needed
```
/verify setup
```

### 6. Choose your plan
- `Free` is enough for core ticketing and transcripts.
- `Pro` unlocks SLA rules, incident mode, auto-assignment, daily reports, `/stats sla`, and `/ticket playbook`.
- The bot owner can activate plans manually with `/debug entitlements`.

### 7. Test it
- Click the ticket button in your ticket channel
- Select a category
- Fill the form
- Your first ticket is created!

## Core Commands Reference

**Staff operations:**
- `/ticket claim` - Take ownership of a ticket
- `/ticket close` - Close the current ticket
- `/ticket brief` - See operational context and recommendations
- `/ticket info` - Full ticket details
- `/staff away-on` - Mark yourself as away
- `/staff my-tickets` - Review your active tickets

**Admin setup:**
- `/setup tickets` - Configure ticket system
- `/setup automod bootstrap` - Enable TON618-managed Discord AutoMod rules
- `/setup automod status` - Review AutoMod health, rules, and permissions
- `/setup general` - General bot settings
- `/verify setup` - Setup verification system
- `/stats server` - View server statistics
- `/stats sla` - View SLA metrics
- `/config status` - View a concise operational summary
- `/config tickets` - View all ticket configuration in one embed

**Owner tools:**
- `/debug status` - Bot health and deploy info
- `/debug automod-badge` - Live AutoMod badge progress across guilds
- `/debug entitlements status` - Inspect a guild plan
- `/debug entitlements set-plan` - Manually activate Free or Pro
- `/debug entitlements set-supporter` - Toggle supporter recognition
- `/audit` - View audit logs

## What's Next?

1. **Configure categories** - Edit `config.js` to customize ticket categories
2. **Confirm language and setup defaults** - Use `/setup language` and the `/setup general ...` group if the server needs changes after onboarding
3. **Setup verification** - Run `/verify setup` for member verification
4. **Enable Pro features if needed** - Playbooks, incident mode, SLA rules, and auto-assignment require Pro
5. **Review SLA settings** - Fine-tune response time expectations
6. **Setup audit logs** - Configure `/setup general logs` for audit trail

## Troubleshooting

**Bot doesn't respond to commands:**
- Check bot has proper permissions in your server
- Verify slash commands were deployed: `npm run deploy:compact`
- Check bot is online in Discord

**Tickets don't create:**
- Verify bot has "Manage Channels" permission
- Check MongoDB connection in logs
- Ensure ticket channel is configured

**Commands are missing:**
- Some commands are disabled by default in V1 (ping, embed, poll, etc.)
- To enable them, edit `COMMANDS_DISABLED_FILES` in `.env`

## Getting Help

- Check logs in console for error messages
- Review `docs/production-runbook.md` for operational guidance
- Ensure all required env vars are set: `npm run env:check:prod`

## Production Deployment

For production hosting, see `docs/DEPLOYMENT.md` for:
- The official VPS and PM2 architecture
- The required `lavalink`, `ton618-bot`, `ton618-web`, and `ton618-status` processes
- MongoDB backup strategies
- Health monitoring setup
