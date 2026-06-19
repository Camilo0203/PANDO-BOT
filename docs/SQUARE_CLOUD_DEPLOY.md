# Legacy Square Cloud Guide

This deployment path is retired and is not the current TON618 production
architecture.

Production runs with PM2 on the VPS:

- `lavalink`
- `ton618-bot`
- `ton618-web`
- `ton618-status`

`ton618-music` is loaded as a module by `ton618-bot` and must not run as a
separate PM2 process. Web and status are published through Cloudflare Tunnel.

Use [README_DEPLOY.md](../README_DEPLOY.md) as the authoritative architecture,
deployment, verification and rollback runbook. Do not use this legacy filename
to configure Square Cloud, billing or production environment variables.
