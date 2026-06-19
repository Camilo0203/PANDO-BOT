# Staging vs Production for TON618 Bot

## Separacion obligatoria

- una Discord application distinta por entorno
- una base Mongo distinta por entorno
- un proyecto Supabase distinto por entorno
- variables `.env` distintas por entorno

## Checklist antes de promover

1. `npm run env:check -- --file=.env.staging.example`
2. `npm test`
3. `npm run build:fingerprint`
4. deploy de comandos en staging
5. `npm run smoke:health "$BOT_HEALTHCHECK_URL"`
6. validar bridge, inbox y playbooks con un servidor de prueba

## Checklist de produccion

1. `npm run env:check -- --file=.env.production.example`
2. `npm test`
3. `npm run deploy:safe:compact`
4. reiniciar el proceso del bot
5. `npm run smoke:health "$BOT_HEALTHCHECK_URL"`
6. verificar fingerprint nuevo en `/health`

## No mezclar nunca

- `DISCORD_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MONGO_URI`
- callbacks o IDs de la app de Discord
- backups o restores entre staging y production sin revision humana
