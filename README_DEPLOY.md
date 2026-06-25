# TON618 — arquitectura y despliegue VPS

`ton618-bot` contiene el bot completo, música integrada y el arranque de Lavalink. El stack de producción queda así:

| Carpeta | Proceso | Función |
| --- | --- | --- |
| `ton618-shared` | — | Librería interna usada por el bot |
| `ton618-bot` | `ton618-lavalink` | Lavalink local |
| `ton618-bot` | `ton618-bot` | Discord bot, API interna, dashboard interno y música |
| `ton618-web` | `ton618-web` | Landing/dashboard web en `ton618bot.xyz` |
| `ton618-status` | `ton618-status` | Status page en `status.ton618bot.xyz` |

## Preparación en VPS

```bash
cd /opt/ton618/ton618-shared
npm ci
npm run build

cd /opt/ton618/ton618-bot
npm ci
cp .env.example .env
cp .env.lavalink.example .env.lavalink
mkdir -p lavalink
wget -O lavalink/Lavalink.jar \
  https://github.com/lavalink-devs/Lavalink/releases/download/4.2.2/Lavalink.jar

cd /opt/ton618/ton618-web
npm ci
npm run build

cd /opt/ton618/ton618-status
npm ci
cp .env.example .env
npm run build
```

Configura los `.env` sin guardar secretos en Git. `LAVALINK_PRO_PASSWORD` debe coincidir entre `ton618-bot/.env` y `ton618-bot/.env.lavalink`.

## Validación local antes de lanzar

```bash
cd /opt/ton618/ton618-bot
npm run env:check:prod
npm run build:ts
npm run audit:readiness
npm test
npm audit --omit=dev
```

## Deploy

```bash
bash /opt/ton618/ton618-bot/scripts/deploy-vps.sh
```

El script actualiza `shared`, `bot`, `web`, `status`, compila lo necesario y reinicia PM2.

## Comprobación

```bash
pm2 status
pm2 logs ton618-lavalink --lines 80 --nostream
pm2 logs ton618-bot --lines 80 --nostream
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:3001/api/bot-health
```

Para cambios solo del bot no hace falta reiniciar Lavalink. Si cambias `lavalink/application.yml` o credenciales de Lavalink, reinicia primero `ton618-lavalink` y después `ton618-bot`.
