# Legacy Square Cloud Guide

This deployment path is retired and is not the current TON618 production
architecture.

Production runs with PM2 on the VPS:

- `ton618-lavalink`
- `ton618-bot`
- `ton618-web`
- `ton618-status`

Music is built into `ton618-bot`; no extra repository or PM2 process is needed.
Web and status are published through Cloudflare Tunnel.

Use [README_DEPLOY.md](../README_DEPLOY.md) as the authoritative architecture,
deployment, verification and rollback runbook. Do not use this legacy filename
to configure Square Cloud, billing or production environment variables.
