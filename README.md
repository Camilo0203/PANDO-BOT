# TON618

**Bilingual ops console for Discord staff teams**

TON618 is a bot-first operational platform for Discord communities that need professional ticket management, SLA tracking, live playbooks, incident mode, and staff productivity tools.

TON618 supports **English + Español** today. When the bot joins a server, it prompts an admin to choose the server language during onboarding. If nobody selects one yet, the guild temporarily stays on English until an admin sets it manually with `/setup language`.

## Commercial model

- `Free`: core ticketing, transcripts, categories, panel setup, audit basics, rating, and case context.
- `Pro`: advanced operations like SLA tuning, SLA rules, auto-assignment, incident mode, daily reports, `/stats sla`, and live playbooks.
  - `pro_monthly`: $9.99/month
  - `pro_yearly`: $99.99/year
  - `lifetime`: $299.99 one-time
- `Supporter`: recognition only. Donations never unlock premium features.

Billing source of truth lives in Supabase with Whop as payment provider. The bot queries premium status via `billing-guild-status` Edge Function using `BOT_API_KEY` authentication. Premium status is cached locally for 5 minutes with stale cache fallback (1 hour) for resilience. `/debug entitlements` remains available for support overrides and manual recovery flows.

## What makes TON618 different

- **Operational focus**: Built for staff teams, not general-purpose features
- **Live playbooks**: Context-aware recommendations for every ticket
- **SLA tracking**: Real metrics on response times and escalation
- **Incident mode**: Pause ticket creation during outages with custom messaging
- **Real AutoMod sync**: Manage production Discord AutoMod rules for spam, invites, and scam phrases
- **Case briefs**: Every ticket gets operational context, risk assessment, and next actions
- **Audit trail**: Full event history for compliance and review
- **Config backups**: Versioned configuration with rollback capability
- **Production-ready**: Enhanced health monitoring, rate limiting, input sanitization
- **Observability**: Structured logging, metrics, error tracking integration
- **Disaster recovery**: Comprehensive runbooks and automated backup support

## Requirements

- Node.js 20 or newer
- MongoDB
- A valid `.env` file with the bot credentials

## Core V1 commands (Discord)

**For staff:**
- `/ticket` - Complete ticket management (open, close, claim, assign, priority, notes, playbooks)
- `/staff` - Staff operations (away status, my-tickets, warnings)
- `/stats` - Server stats, SLA metrics, staff leaderboards

**For admins:**
- `/setup` - Configure tickets, verification, general settings
- `/setup automod` - Bootstrap, sync, status, and safe AutoMod management
- `/verify` - Verification system setup and management
- `/config center` - Centralized config with versioned backups
- `/audit` - Audit log viewer

**For owner:**
- `/debug` - System health, status, memory, cache, and entitlements
- `/debug automod-badge` - Live AutoMod badge progress across connected guilds
- `/ping` - Private owner-only latency check when deployed to your private commands guild

## Development commands

```bash
npm start
npm run env:check
npm run deploy:compact        # fast deploy (no rollback)
npm run deploy:safe:compact   # production deploy with rollback safety
npm run deploy:full
npm run build:fingerprint
npm run smoke:health
npm run cleanup:commands
npm run migrate:dates
npm run db:indexes
npm run test:concurrency:votes
npm test
```

## Project layout

- `index.js`: main bot entrypoint
- `config.js`: ticket categories and owner-level config
- `src/`: commands, events, handlers and utilities
- `scripts/`: operational and maintenance scripts
- `docs/archive/`: old planning notes and archived docs

## Deploy

Use `deploy.sh` on Linux hosts or run the equivalent manually:

```bash
npm ci
npm run deploy:compact
npm start
```

## V1 bot-first configuration

TON618 V1 is optimized for operational use. Generic utility commands (ping, embed, perfil, poll, suggest, welcome/goodbye messages, confessions, suggestions) are **disabled by default** in `.env.example`.

To enable any of these features, move them from `COMMANDS_DISABLED_FILES` to `COMMANDS_ENABLED_FILES` in your `.env` file.

## Language contract

- Supported languages: `English` and `Español`
- Fallback language before selection: `English`
- Language selection moment: onboarding prompt sent when the bot joins the server
- Manual change later: `/setup language`
- Core public flow: invite -> choose language -> `/setup` -> `/ticket` -> `/verify` -> `/staff` -> `/stats` -> `/config center` / `/audit` / `/debug`

## AutoMod management

- TON618 can manage real Discord AutoMod rules for spam prevention, invite-link blocking, and scam phrase blocking.
- Use `/setup automod bootstrap` to enable the managed rule pack for a guild.
- Use `/setup automod sync` after changing presets, alert channel, or exemptions.
- Use `/setup automod disable` to remove only TON618-managed rules.
- Use `/setup automod status` for per-guild visibility and `/debug automod-badge` for owner-only badge progress.
- Discord requires the bot to have `Manage Server` (`MANAGE_GUILD`) for AutoMod rule management. If you later opt into timeout actions, `Moderate Members` is also required.
- Badge progress comes from real AutoMod rules created across guilds over time. There is no manual claim flow.

## Notes

- Copy `.env.example` to `.env` and fill required values before first run.
- `cleanup:commands` removes slash commands from Discord. Set `CLEANUP_GUILD_ID` or `GUILD_ID` if you want to target a specific guild in addition to global commands.
- `PRIVATE_COMMANDS_GUILD_ID` lets you keep owner-only slash commands like `/ping` out of public servers and available only in your private admin guild.
- `migrate:dates` converts legacy string date fields in MongoDB into real `Date` values.
- `db:indexes` ensures MongoDB indexes on demand. Boot no longer needs to create indexes unless `MONGO_AUTO_INDEXES=true`.
- `/health` and `/debug status` now expose a deployment fingerprint (version + commit, plus optional `DEPLOY_TAG`) so you can verify whether a host actually pulled the latest code.
- Global command flags can be controlled with env vars:
  - `COMMANDS_DISABLED_FILES=admin/config/setup.js,public/utility/ping.js`
  - `COMMANDS_ENABLED_FILES=public/utility/ping.js` (reenables defaults)
- Privileged intents can be toggled with env vars (default: enabled):
  - `MESSAGE_CONTENT_ENABLED=true|false` (also accepts `1/0`, `yes/no`, `on/off`)
  - `GUILD_PRESENCES_ENABLED=true|false` (also accepts `1/0`, `yes/no`, `on/off`)
- Auto-assignment avoids full guild member fetches by default. Set `AUTO_ASSIGN_ALLOW_FULL_MEMBER_FETCH=true` only if you explicitly need the old fallback.
- File error logging can be tuned with:
  - `ERROR_LOG_TO_FILE=true|false`
  - `ERROR_LOG_DIR=/absolute/or/relative/path`
- Dashboard bridge with Supabase:
  - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` enable the bot-to-dashboard bridge.
  - The bot now keeps `bot_guilds` and `guild_metrics_daily` updated, seeds missing `guild_configs`, imports dashboard config back into Mongo settings, and projects `guild_effective_entitlements` into `commercial_settings` plus `dashboard_general_settings.opsPlan`.
  - Recommended: `DASHBOARD_BRIDGE_INTERVAL_MS=60000` (or legacy alias `SUPABASE_DASHBOARD_SYNC_INTERVAL_MS`) and `DASHBOARD_HTTP_TIMEOUT_MS`.
- Per-guild command flags are stored in settings as `disabled_commands` (command names like `["ping","music"]`).
- Per-guild command flags can be managed from the setup command group, including disable, enable, status, reset, list, and interactive panel flows.
- Config Center (`/config center` > `System`) keeps versioned config backups, supports backup list, and includes rollback to the latest snapshot.
- SLA management can now be configured from `/setup tickets sla` (including escalation role/channel and escalation threshold).
- Operational SLA visibility is available in `/stats sla`.
- Plan and supporter state can be inspected or overridden for support with `/debug entitlements status`, `/debug entitlements set-plan`, and `/debug entitlements set-supporter`.

## Production Features

### Security & Performance
- **User rate limiting**: Per-user command throttling with exponential backoff
- **Input sanitization**: Automatic sanitization of user inputs to prevent @everyone/@here abuse
- **Enhanced health checks**: `/health` endpoint with memory, Discord ping, and system metrics
- **Graceful shutdown**: Proper cleanup of connections and resources
- **Premium caching**: 5-minute cache with 1-hour stale fallback for backend resilience

### Monitoring & Observability
- **Structured logging**: JSON logs with event tracking and metrics
- **Error tracking**: Sentry integration for real-time error monitoring
- **Health monitoring**: Automated health checks with alerting
- **Metrics reporting**: Performance metrics with configurable intervals
- **Discord alerts**: Critical alerts sent to Discord webhook

### Reliability
- **Disaster recovery**: Complete runbook with RTO/RPO targets
- **Automated backups**: MongoDB backup strategy with restore procedures
- **Rollback capability**: Safe deployment with rollback scripts
- **Graceful degradation**: Premium features fall back to free tier on backend failure

See `PRODUCTION_CHECKLIST.md` for deployment guide and `docs/disaster-recovery.md` for incident response.

## Release workflow

- New GitHub Actions workflow: `.github/workflows/release.yml` (manual dispatch).
- Stages: `validate` -> `deploy_staging` -> `deploy_production`.
- `deploy_production` uses the `production` environment, so manual approval can be enforced from GitHub Environment protection rules.
- Enhanced CI/CD: Lint, security audit, tests, and build verification
- Required secrets:
  - `DISCORD_TOKEN`
  - `MONGO_URI`
  - `OWNER_ID` (recommended)
  - `STAGING_GUILD_ID` (for staging deploy)
  - `PRODUCTION_GUILD_ID` (optional; if omitted, deploy script uses global commands)
  - `SENTRY_DSN` (optional, for error tracking)
  - `LOGTAIL_SOURCE_TOKEN` (optional, for log aggregation)
