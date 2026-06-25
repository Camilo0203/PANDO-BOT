# TON618 Music

El sistema de música está integrado completamente en `ton618-bot`.

## Componentes

- `src/music/`: manager, límites, salud de nodos, tokens y reproducción.
- `src/handlers/music/`: comandos, botones, búsquedas y paginación.
- `src/commands/public/music/`: comandos slash públicos.
- `src/commands/developer/musicstatus.js`: diagnóstico para el owner.
- `lavalink/application.yml`: configuración segura del nodo.
- `scripts/lavalink-wrapper.js`: arranque de Java con `.env.lavalink`.

## Configuración

```powershell
Copy-Item .env.lavalink.example .env.lavalink
.\scripts\download-lavalink.ps1
npm run lavalink
```

El bot usa `LAVALINK_PRO_HOST`, `LAVALINK_PRO_PORT` y
`LAVALINK_PRO_PASSWORD` desde `.env`. La contraseña debe coincidir con
`.env.lavalink`.

Variables útiles:

| Variable | Valor por defecto |
| --- | --- |
| `LAVALINK_PRO_HOST` | `localhost` |
| `LAVALINK_PRO_PORT` | `2333` |
| `LAVALINK_PRO_SECURE` | `false` |
| `LAVALINK_RECONNECT_TRIES` | `5` |
| `PLAYER_IDLE_TIMEOUT_MS` | `180000` |
| `VOICE_ALONE_TIMEOUT_MS` | `60000` |
| `COMMAND_COOLDOWN_MS` | `1500` |
| `GUILD_COMMAND_COOLDOWN_MS` | `800` |
| `MUSIC_ALLOWED_GUILD_IDS` | todos |

## PM2

`ecosystem.config.js` incluye `ton618-lavalink` y `ton618-bot`:

```bash
pm2 start ecosystem.config.js --only ton618-lavalink
sleep 10
pm2 start ecosystem.config.js --only ton618-bot
```

## Verificación

```bash
npm test
npm run build:ts
npm run audit:i18n
npm run audit:readiness
```

La suite principal cubre el router musical, componentes e inventario de
comandos. Desde el 23 de junio de 2026 no existe ninguna dependencia de
ejecución hacia un repositorio musical separado.
