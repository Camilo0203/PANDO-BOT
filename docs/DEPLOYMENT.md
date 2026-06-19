# TON618 Production Deployment

La arquitectura oficial usa una VPS, PM2 y Cloudflare Tunnel.

## Procesos PM2

Deben existir exactamente estos servicios de TON618:

- `lavalink`
- `ton618-bot`
- `ton618-web`
- `ton618-status`

`ton618-music` es un modulo cargado por `ton618-bot`; no debe ejecutarse como
proceso PM2 independiente.

## Puertos privados

- Web: `127.0.0.1:3000`
- Status: `127.0.0.1:3001`
- Health del bot: endpoint privado configurado en la VPS
- Lavalink: puerto privado configurado actualmente

No publiques puertos directamente. Cloudflare Tunnel debe enrutar los dominios
publicos a los servicios locales correspondientes.

## Deploy seguro

Usa [README_DEPLOY.md](../README_DEPLOY.md) como procedimiento principal. En
resumen:

```bash
git status --short
npm ci
npm test
npm run audit:i18n
npm run audit:readiness
npm run build:ts
pm2 restart ton618-bot --update-env
pm2 logs ton618-bot --lines 100
```

Para web y status, ejecuta sus propios tests/builds y reinicia unicamente el
proceso correspondiente. No reinicies Lavalink para cambios de frontend,
documentacion o bot que no alteren su configuracion.

## Verificacion

```bash
pm2 list
pm2 logs ton618-bot --lines 100
pm2 logs ton618-web --lines 100
pm2 logs ton618-status --lines 100
curl -fsS http://127.0.0.1:3000/
curl -fsS http://127.0.0.1:3001/
systemctl status cloudflared --no-pager
```

Confirma tambien:

- El bot aparece online y responde `/debug status`.
- `/play`, `/queue` y controles de musica funcionan.
- El status consulta `/api/bot-health`.
- El webhook Tebex recibe `2xx` sin challenge de Cloudflare.
- Compra, DM y `/premium activate` actualizan PRO.

## Seguridad

- Nunca copies `.env` al repositorio.
- No muestres tokens o secretos en logs.
- Usa `git add` con rutas explicitas.
- Rota cualquier secreto que haya aparecido en historial, capturas o chat.
- No hagas deploy si `git diff --check` o las suites obligatorias fallan.
