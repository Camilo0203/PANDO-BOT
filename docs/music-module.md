# TON618 Music Module

Módulo de música integrado en `ton618-bot` (migrado desde `ton618-music` en 2025).

## Stack

- **Lavalink** (servidor de audio externo, NO incluido en este repo)
- **Kazagumo + Shoukaku** (clientes Node para Lavalink)
- **youtubei.js** + **Playwright** (generación de poToken/visitorData para YouTube)
- **discord.js v14**

## Arquitectura

```
src/music/
├── MusicManager.js                Core: kazagumo + shoukaku + circuit breaker
├── premiumResolver.js            Wrapper sobre @ton618/shared
├── i18n.js                        i18n namespaced (music.*)
├── config/
│   └── lavalinkConfig.js         TIER_LIMITS + node config
├── services/
│   ├── LavalinkFailoverService.js Failover PRO <-> FREE
│   ├── NodeHealthMonitor.js      Circuit breaker + métricas
│   ├── TrackErrorHandler.js      403 / antibot / FFmpeg / network
│   ├── VoiceStateMonitor.js      Voice state + alone timer + zombie check
│   ├── YouTubeTokenService.js    poToken + visitorData (Innertube/Playwright)
│   ├── MusicControlService.js    Validación + pause/skip/loop/shuffle
│   └── SearchCacheService.js     Cache de búsquedas + paginación
├── utils/
│   ├── musicEmbeds.js            Embeds now-playing/queue/control
│   ├── musicComponents.js        Botones + select menus
│   ├── musicQueuePagination.js   Paginación con session id
│   └── interactionResponses.js   ensureDeferred + safeRespond
├── handlers/music/
│   ├── musicInteractionHandler.js Rate limit + routing
│   ├── musicComponentHandler.js  Botones (pause/skip/loop/...)
│   └── musicSearchHandler.js     Search results + paginación
└── commands/
    ├── public/music/             (12 comandos: play, skip, stop, queue,
    │                              nowplaying, volume, filter, shuffle,
    │                              loop, pause, search)
    └── developer/musicstatus.js  Owner-only: estado de nodos
```

## PRO vs FREE

| Característica       | FREE         | PRO          |
|----------------------|--------------|--------------|
| Calidad de audio     | 128 kbps     | 320 kbps     |
| Cola máxima          | 10 pistas    | 200 pistas   |
| Duración máx         | 5 min        | 6 horas      |
| Volumen máximo       | 80%          | 100%         |
| Filtros (EQ, Bass)   | ❌           | ✅           |
| Spotify              | ❌           | ✅           |
| Playlists completas  | ❌           | ✅           |
| Loop de cola         | ❌           | ✅           |
| Shuffle              | ❌           | ✅           |
| Skip múltiple        | ❌           | ✅ (hasta 10) |

## Variables de entorno

Lee automáticamente del `.env` del bot:

| Variable | Default | Descripción |
|----------|---------|-------------|
| `LAVALINK_PRO_HOST` | localhost | Host del nodo Lavalink |
| `LAVALINK_PRO_PORT` | 2333 | Puerto del nodo Lavalink |
| `LAVALINK_PRO_PASSWORD` | (requerido) | Password del nodo |
| `LAVALINK_PRO_SECURE` | false | TLS |
| `LAVALINK_RECONNECT_TRIES` | 5 | Reintentos de reconexión |
| `LAVALINK_RECONNECT_INTERVAL_MS` | 5000 | Intervalo entre reintentos |
| `LAVALINK_REST_TIMEOUT_MS` | 15000 | Timeout de REST |
| `PLAYER_IDLE_TIMEOUT_MS` | 180000 | Destruir player tras 3 min idle |
| `VOICE_ALONE_TIMEOUT_MS` | 60000 | Destruir si bot queda solo |
| `TRACK_MAX_RETRIES` | 2 | Reintentos por track error |
| `TRACK_RETRY_BACKOFF_MS` | 3000 | Backoff entre reintentos |
| `YOUTUBE_TOKEN_CACHE` | .youtube-tokens.json | Archivo de cache de tokens |
| `YOUTUBE_TOKEN_REFRESH_MS` | 1800000 | Refrescar tokens cada 30 min |
| `YOUTUBE_TOKEN_TTL_MS` | 3600000 | TTL de tokens (1h) |
| `COMMAND_COOLDOWN_MS` | 1500 | Cooldown por usuario |
| `GUILD_COMMAND_COOLDOWN_MS` | 800 | Cooldown por guild |
| `MUSIC_ALLOWED_GUILD_IDS` | (vacío = todos) | Whitelist de guilds |
| `MUSIC_FORCE_TIER` | (vacío = dinámico) | Forzar tier: `free` o `pro` |
| `PRO_UPGRADE_URL` | https://ton618.app/pricing | URL de upgrade |

## VPS / PM2

Sigue usando `ton618-music` para correr Lavalink como app separada en PM2. El bot se conecta a Lavalink por HTTP/WS. **No requiere cambios en el VPS** para esta integración.

## Deploy

```bash
npm run deploy:compact
npm start
```

Los 13 comandos de música (12 públicos + 1 owner) se deployan automáticamente con el resto.

## i18n

Las claves de música viven en `src/locales/modules/{en,es}/music.js` con namespace `music.*`. El `t()` interno del módulo quita el prefijo automáticamente.

Para añadir una clave nueva:
1. Añadir la clave a `src/locales/modules/en/music.js` y `es/music.js`
2. Usar `t(language, "music.<key>")` en el código

## Tests

Pendiente de migrar de `ton618-music/tests/`. Por ahora los tests existentes siguen en el repo viejo y se deben migrar manualmente.

## Historial

- 2025-Q1: Creado como repo separado `ton618-music`
- 2025-Q4: **Migrado a `ton618-bot` como submódulo** (este archivo)
