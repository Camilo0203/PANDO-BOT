# TON618 - Final Production Release Checklist

Checklist final y operativo para una sola persona.

Orden obligatorio:
1. Supabase
2. `ton618-web`
3. `ton618-bot`
4. Smoke E2E
5. Go / No-Go

Reglas de este release:
- No uses las funciones legacy `lemon-*` en producción. El stack vigente es `sync-discord-guilds` + `billing-*`.
- No uses `supabase db reset --linked` contra producción.
- No declares `GO` si `node scripts/deploy-commands.js --compact` falla o reporta validaciones/duplicados.
- No abras tráfico público de billing hasta terminar la Fase 4 completa.

## Variables que debes rellenar antes de empezar

```powershell
$WEB_DIR = "C:\Users\Camilo\Desktop\ton618-web"
$BOT_DIR = "C:\Users\Camilo\Desktop\ton618-bot"

$FINAL_SITE_URL = "https://ton618.app"
$FINAL_BOT_URL = "https://bot.ton618.app"   # o tu dominio final del bot / squareweb
$SUPABASE_URL = "https://TU_PROYECTO.supabase.co"
$TEST_GUILD_ID = "123456789012345678"
$RELEASE_TAG = "vX.Y.Z"
```

## 1. Pre-deploy

### 1.1 Revisión de envs

```powershell
cd $BOT_DIR
node scripts/validate-env.js --file=.env.production.example --mode=production

cd $WEB_DIR
node scripts/validate-env.mjs --file=.env.production.example --mode=production
```

Checklist:
- [ ] Ambos comandos pasan sin `ERROR:`.
- [ ] `VITE_SITE_URL` = `$FINAL_SITE_URL`.
- [ ] `SITE_URL` en secretos de Supabase = `$FINAL_SITE_URL`.
- [ ] `PRO_UPGRADE_URL` en `ton618-bot` = `$FINAL_SITE_URL/pricing`.
- [ ] `VITE_SUPABASE_URL` en web = `SUPABASE_URL` en bot = `$SUPABASE_URL`.
- [ ] `VITE_SUPABASE_ANON_KEY` en web = `SUPABASE_ANON_KEY` en Supabase/bot.
- [ ] `BOT_API_KEY` es exactamente el mismo en bot y Supabase.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` está en bot y en Supabase.
- [ ] `PORT=80` en web y bot.
- [ ] `LEMON_SQUEEZY_TEST_MODE=false` en producción.
- [ ] `DASHBOARD_BRIDGE_INTERVAL_MS=60000`.
- [ ] `MONGO_AUTO_INDEXES=true`.
- [ ] `MONGO_MAX_POOL_SIZE=5`.
- [ ] `HEALTH_STARTUP_GRACE_MS=90000`.
- [ ] `ERROR_LOG_TO_FILE=false` en Square Cloud.

### 1.2 OAuth Discord / Supabase

Discord Developer Portal:
- [ ] Redirect URI configurada: `$SUPABASE_URL/auth/v1/callback`.
- [ ] `CLIENT_ID` correcto y copiado a `VITE_DISCORD_CLIENT_ID`.
- [ ] `CLIENT_SECRET` correcto y cargado en Supabase.
- [ ] Bot token correcto en `DISCORD_TOKEN`.
- [ ] `SERVER MEMBERS INTENT` activo.
- [ ] `MESSAGE CONTENT INTENT` activo si `MESSAGE_CONTENT_ENABLED=true`.
- [ ] `PRESENCE INTENT` activo si `GUILD_PRESENCES_ENABLED=true`.

Supabase Auth:
- [ ] Provider Discord habilitado.
- [ ] `DISCORD_CLIENT_ID` y `DISCORD_CLIENT_SECRET` cargados.
- [ ] Site URL = `$FINAL_SITE_URL`.
- [ ] Redirect URL incluye `$FINAL_SITE_URL/auth/callback`.

### 1.3 Supabase migrations

```powershell
cd $WEB_DIR
supabase migration list
supabase db push
```

> **Nota v1 (2026-05-06):** Asegúrate de que la migración `20260506000000_unify_guild_entitlements_whop.sql` esté aplicada. Une `guild_subscriptions` (Whop) con `guild_effective_entitlements` para que el dashboard muestre correctamente el estado Pro de suscripciones Whop.
>
> **Nota v1 (2026-05-07):** Aplica `20260507100000_fix_rpc_jsonb_payload.sql`. Cambia `p_payload jsonb` → `json` en `request_guild_config_change` y `request_guild_backup_action` para evitar el error 400 "expected jsonb, received record" desde el dashboard.

Verifica en Supabase SQL Editor:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'bot_stats',
    'bot_guilds',
    'guild_metrics_daily',
    'user_guild_access',
    'guild_subscriptions',
    'purchases',
    'donations',
    'webhook_events'
  )
order by table_name;

select table_name
from information_schema.views
where table_schema = 'public'
  and table_name in ('guild_effective_entitlements');
```

Checklist:
- [ ] `supabase db push` termina sin error.
- [ ] La migración `20260407000000_billing_schema_fixup.sql` quedó aplicada.
- [ ] Existen las tablas listadas arriba.
- [ ] Existe la vista `guild_effective_entitlements`.

### 1.4 Edge Functions

```powershell
cd $WEB_DIR
supabase functions deploy sync-discord-guilds
supabase functions deploy billing-create-checkout
supabase functions deploy billing-get-guilds
supabase functions deploy billing-guild-status
supabase functions deploy billing-webhook
supabase functions list
```

Checklist:
- [ ] Las 5 funciones vigentes aparecen desplegadas.
- [ ] Ningún flujo productivo apunta a `lemon-create-checkout`.
- [ ] Ningún flujo productivo apunta a `lemon-get-user-guilds`.
- [ ] Ningún flujo productivo apunta a `lemon-get-guild-premium`.
- [ ] El webhook de Lemon Squeezy NO apunta a `lemon-squeezy-webhook`.

### 1.5 Secretos

Secretos mínimos en Supabase:
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `SUPABASE_ANON_KEY`
- [ ] `DISCORD_CLIENT_ID`
- [ ] `DISCORD_CLIENT_SECRET`
- [ ] `DISCORD_REDIRECT_URI=$SUPABASE_URL/auth/v1/callback`
- [ ] `SITE_URL=$FINAL_SITE_URL`
- [ ] `BOT_API_KEY`
- [ ] `LEMON_SQUEEZY_API_KEY`
- [ ] `LEMON_SQUEEZY_STORE_ID`
- [ ] `LEMON_SQUEEZY_WEBHOOK_SECRET`
- [ ] `LEMON_SQUEEZY_VARIANT_PRO_MONTHLY`
- [ ] `LEMON_SQUEEZY_VARIANT_PRO_YEARLY`
- [ ] `LEMON_SQUEEZY_VARIANT_LIFETIME`
- [ ] `LEMON_SQUEEZY_VARIANT_DONATE`
- [ ] `LEMON_SQUEEZY_TEST_MODE=false`

Recomendado en Supabase:
- [ ] `DISCORD_BOT_TOKEN` para el fallback de `sync-discord-guilds`.

Square Cloud `ton618-web`:
- [ ] Variables `VITE_*` cargadas.
- [ ] `VITE_ENABLE_DASHBOARD=true` si el dashboard será público desde este sitio.

Square Cloud `ton618-bot`:
- [ ] `DISCORD_TOKEN`
- [ ] `MONGO_URI`
- [ ] `MONGO_DB`
- [ ] `OWNER_ID`
- [ ] `BOT_API_KEY`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `SUPABASE_ANON_KEY`
- [ ] `PRO_UPGRADE_URL=$FINAL_SITE_URL/pricing`

### 1.6 Dominio final

Checklist:
- [ ] `$FINAL_SITE_URL` resuelve y tiene SSL válido.
- [ ] `$FINAL_BOT_URL` resuelve y tiene SSL válido.
- [ ] `VITE_SITE_URL`, `SITE_URL` y `PRO_UPGRADE_URL` apuntan al dominio final, no al staging.
- [ ] Supabase Auth usa el mismo dominio final del sitio.
- [ ] El pricing del bot envía a `$FINAL_SITE_URL/pricing`.

### 1.7 Healthchecks

Checklist:
- [ ] `ton618-web/squarecloud.app` usa `HEALTHCHECK_PATH=/`.
- [ ] `ton618-bot/squarecloud.config` usa `HEALTHCHECK_PATH=/health`.
- [ ] Tienes preparado un monitor externo para web en `/`.
- [ ] Tienes preparado un monitor externo para bot en `/health`.

## 2. Deploy de `ton618-web`

### 2.1 Build local

```powershell
cd $WEB_DIR
npm ci
npm run verify
npm run test:functions
npm run build
Get-ChildItem dist
```

Checklist:
- [ ] `npm run verify` pasa.
- [ ] `npm run test:functions` pasa.
- [ ] `dist\index.html` existe.
- [ ] `dist\robots.txt` existe.
- [ ] `dist\sitemap.xml` existe.
- [ ] Hay chunks JS/CSS en `dist\assets`.

### 2.2 Start local

```powershell
cd $WEB_DIR
npm run start:prod
```

En otra terminal:

```powershell
curl.exe -I http://localhost/
curl.exe -I http://localhost/dashboard
curl.exe -I http://localhost/pricing
curl.exe -I http://localhost/auth/callback
curl.exe -I "http://localhost/billing/success?plan_key=pro_monthly&guild_id=$TEST_GUILD_ID"
```

Checklist:
- [ ] Todas las rutas anteriores devuelven `200`.
- [ ] Refrescar `/dashboard` no devuelve `404`.
- [ ] Refrescar `/auth/callback` no devuelve `404`.

### 2.3 Deploy a Square Cloud

Checklist:
- [ ] Deploy ejecutado a la app `ton618-web`.
- [ ] En logs aparece `vite build`.
- [ ] En logs aparece `serve -s dist -l 80 -n`.
- [ ] La app queda en estado `Running`.

### 2.4 Validación de rutas SPA

```powershell
curl.exe -I $FINAL_SITE_URL/
curl.exe -I $FINAL_SITE_URL/dashboard
curl.exe -I $FINAL_SITE_URL/pricing
curl.exe -I $FINAL_SITE_URL/auth/callback
curl.exe -I $FINAL_SITE_URL/terms
curl.exe -I $FINAL_SITE_URL/privacy
curl.exe -I $FINAL_SITE_URL/cookies
```

Checklist:
- [ ] Todas devuelven `200`.
- [ ] `/dashboard` y `/auth/callback` sirven la SPA correctamente.

### 2.5 Validación de callback OAuth

Prueba manual:
1. Abre `$FINAL_SITE_URL`.
2. Haz login con Discord.
3. Autoriza.
4. Verifica la secuencia `Discord -> Supabase callback -> $FINAL_SITE_URL/auth/callback -> /dashboard`.

Checklist:
- [ ] No aparece `Invalid redirect URI`.
- [ ] No aparece `missing session` ni `provider_token` error.
- [ ] Terminas en `/dashboard`.
- [ ] La sesión sobrevive a un refresh del navegador.

### 2.6 Validación de pricing / billing UI

Prueba manual:
1. Abre `$FINAL_SITE_URL/pricing`.
2. Verifica planes y CTA.
3. Si no estás autenticado, comprueba que el login con Discord es obligatorio.
4. Autenticado, selecciona plan y guild.
5. Verifica que `Proceed to Checkout` abra Lemon Squeezy.

Checklist:
- [ ] Se ve `Pro Monthly`.
- [ ] Se ve `Pro Yearly`.
- [ ] Se ve `Lifetime`.
- [ ] El selector de guilds carga.
- [ ] El botón de checkout funciona.
- [ ] Cancelar el checkout te devuelve a `/pricing`.

## 3. Deploy de `ton618-bot`

### 3.1 Pre-deploy del bot

```powershell
cd $BOT_DIR
npm ci
npm test
node scripts/audit-production-readiness.js
node scripts/print-build-fingerprint.js
node scripts/deploy-commands.js --compact
```

Checklist:
- [ ] `npm test` pasa.
- [ ] `audit-production-readiness.js` no reporta blockers.
- [ ] `deploy-commands.js --compact` termina sin `Validation error`.
- [ ] No aparece `Nombre duplicado '/premium'`.
- [ ] El fingerprint del release quedó anotado.

### 3.2 Deploy a Square Cloud

Checklist:
- [ ] Deploy ejecutado a la app `ton618-bot`.
- [ ] En logs aparece `Build activo:`.
- [ ] En logs aparece `MongoDB conectado correctamente`.
- [ ] En logs aparece `Premium service initialized`.
- [ ] En logs aparece `[HealthServer] Listening on 0.0.0.0:80`.
- [ ] En logs aparece `Conectado como`.
- [ ] En logs aparece `dashboard.bridge.sync_completed` o al menos no hay `dashboard.bridge.disabled` por config faltante.

### 3.3 Arranque

Checklist:
- [ ] La app queda en estado `Running`.
- [ ] El bot aparece `Online` en Discord.
- [ ] Un slash command básico responde.

### 3.4 Conexión Mongo

Validación:
- [ ] `irm "$FINAL_BOT_URL/health"` muestra `mongoConnected = true`.
- [ ] No hay timeouts o reconnect loops contra Mongo.

### 3.5 Conexión Discord

Validación:
- [ ] `irm "$FINAL_BOT_URL/health"` muestra `discordReady = true`.
- [ ] `irm "$FINAL_BOT_URL/ready"` devuelve `status = ok`.
- [ ] El bot responde en Discord sin `Application did not respond`.

### 3.6 Health endpoint

```powershell
irm "$FINAL_BOT_URL/health"
irm "$FINAL_BOT_URL/ready"
node scripts/ops-smoke-check.js "$FINAL_BOT_URL/health"
```

Checklist:
- [ ] `/health` devuelve HTTP 200.
- [ ] `status = ok`.
- [ ] `booting = false` pasado el grace period.
- [ ] `/ready` devuelve HTTP 200.
- [ ] El smoke check pasa.

### 3.7 Premium status check

Backend autoritativo:

```powershell
curl.exe "$SUPABASE_URL/functions/v1/billing-guild-status/$TEST_GUILD_ID" `
  -H "X-Bot-Api-Key: REEMPLAZAR_BOT_API_KEY"
```

Checklist:
- [ ] Responde `200`.
- [ ] El JSON incluye `guild_id`, `has_premium`, `tier/plan_key`, `expires_at/ends_at`, `lifetime`.
- [ ] El resultado coincide con el estado real esperado del guild de prueba.

Chequeo user-facing en Discord:
- [ ] Ejecuta el slash premium que quedó registrado por el deploy.
- [ ] Responde sin error.
- [ ] Muestra `Free` o `Pro` en línea con `billing-guild-status`.

### 3.8 Dashboard bridge

Espera 1 ciclo del bridge.

Verifica en Supabase SQL Editor:

```sql
select id, servers, users, updated_at
from public.bot_stats
order by updated_at desc
limit 1;

select guild_id, guild_name, last_heartbeat_at
from public.bot_guilds
where guild_id = 'REEMPLAZAR_TEST_GUILD_ID';

select guild_id, metric_date, updated_at
from public.guild_metrics_daily
where guild_id = 'REEMPLAZAR_TEST_GUILD_ID'
order by metric_date desc
limit 1;

select guild_id, bridge_status, pending_mutations, failed_mutations, last_heartbeat_at
from public.guild_sync_status
where guild_id = 'REEMPLAZAR_TEST_GUILD_ID';
```

Checklist:
- [ ] `bot_stats` actualiza timestamp del release actual.
- [ ] `bot_guilds` contiene el guild de prueba.
- [ ] `guild_metrics_daily` tiene snapshot reciente.
- [ ] `guild_sync_status` no está en `error`.

## 4. Verificaciones post-deploy

### 4.1 Landing

Checklist:
- [ ] `$FINAL_SITE_URL/` carga completo.
- [ ] CTA de login funciona.
- [ ] CTA de pricing funciona.
- [ ] No hay errores críticos en consola.

### 4.2 Login

Checklist:
- [ ] Login con Discord completo.
- [ ] Refresh mantiene sesión.
- [ ] El dashboard muestra usuario autenticado.

### 4.3 Sync guilds

Checklist:
- [ ] El dashboard sincroniza guilds vía `sync-discord-guilds`.
- [ ] Solo aparecen guilds manejables.
- [ ] El guild de prueba aparece.
- [ ] No aparecen errores de `provider_token`, `Invalid JWT` o sync timeout.

### 4.4 Checkout

Haz una compra controlada en el guild de prueba.

Checklist:
- [ ] Desde web puedes abrir checkout para el guild correcto.
- [ ] El `plan_key` del checkout es el esperado.
- [ ] El `guild_id` del checkout es el esperado.
- [ ] El usuario vuelve a `$FINAL_SITE_URL/billing/success?...`.

### 4.5 Webhook

Verifica en Supabase:

```sql
select event_name, processed, error_message, created_at
from public.webhook_events
order by created_at desc
limit 5;

select guild_id, plan_key, status, premium_enabled, lifetime, cancel_at_period_end, ends_at, updated_at
from public.guild_subscriptions
where guild_id = 'REEMPLAZAR_TEST_GUILD_ID'
order by updated_at desc
limit 5;
```

Checklist:
- [ ] El evento nuevo entra en `webhook_events`.
- [ ] `processed = true`.
- [ ] `error_message is null`.
- [ ] `guild_subscriptions` refleja el plan comprado.
- [ ] `premium_enabled = true`.

### 4.6 Activación de Pro en dashboard

Verifica en Supabase:

```sql
select guild_id, effective_plan, subscription_status, current_period_end, updated_at
from public.guild_effective_entitlements
where guild_id = 'REEMPLAZAR_TEST_GUILD_ID';
```

Checklist:
- [ ] `effective_plan = 'pro'`.
- [ ] El dashboard muestra badge/estado Pro.
- [ ] El estado persiste después de refresh.

### 4.7 Activación de Pro en bot

Checklist:
- [ ] `billing-guild-status/$TEST_GUILD_ID` devuelve `has_premium = true`.
- [ ] El slash premium del bot refleja `Pro`.
- [ ] Si el bot tarda en reflejar, esperaste al menos 5 minutos de TTL antes de declarar fallo.

### 4.8 Reflejo en dashboard

Checklist:
- [ ] El módulo de billing del dashboard muestra plan activo.
- [ ] El guild seleccionado refleja estado Pro sin desalineación con `guild_effective_entitlements`.

### 4.9 Reflejo en bot

Checklist:
- [ ] El bot responde acorde al nuevo plan.
- [ ] No hay errores del `premiumService` en logs.
- [ ] El bridge no dejó `commercial_settings` / `opsPlan` en estado incoherente.

### 4.10 Cancelación

Haz una cancelación controlada desde Lemon Squeezy Customer Portal.

Checklist:
- [ ] Entra evento de cancelación al webhook.
- [ ] `guild_subscriptions.cancel_at_period_end = true`.
- [ ] `premium_enabled` sigue en `true` hasta `ends_at`.
- [ ] `guild_effective_entitlements` sigue mostrando Pro mientras la suscripción siga vigente.
- [ ] El dashboard sigue mostrando activo hasta fin de periodo.
- [ ] El bot sigue mostrando Pro hasta fin de periodo.

### 4.11 Rollback básico

Si falla algo crítico:

1. [ ] Cierra o degrada el CTA público de billing en web.
2. [ ] Si el problema es billing, pausa temporalmente el webhook de Lemon Squeezy o deja de enviar tráfico nuevo.
3. [ ] Rollback `ton618-web` a la última versión sana en Square Cloud.
4. [ ] Rollback `ton618-bot` a la última versión sana en Square Cloud.
5. [ ] Si el fallo es de funciones, redeploy de la última versión sana de:
   - `sync-discord-guilds`
   - `billing-create-checkout`
   - `billing-get-guilds`
   - [x] `billing-guild-status`
   - `billing-webhook`
6. [ ] No borres filas de `webhook_events`, `guild_subscriptions`, `purchases` o `donations`.
7. [ ] Si hubo cobro válido sin activación, corrige datos solo con evidencia y documenta.

## 5. Go / No-Go

### GO solo si TODO esto es verdadero

- [ ] Web en dominio final responde `200` en `/`, `/pricing`, `/dashboard`, `/auth/callback`.
- [ ] Login con Discord funciona de punta a punta en dominio final.
- [ ] `sync-discord-guilds` sincroniza el guild de prueba.
- [ ] Checkout controlado abre Lemon Squeezy para el guild correcto.
- [ ] `billing-webhook` procesa el evento y deja `processed = true`.
- [ ] `guild_subscriptions` refleja el plan correcto con `premium_enabled = true`.
- [ ] `guild_effective_entitlements` muestra `effective_plan = 'pro'`.
- [ ] Bot responde sano en `/health` y `/ready`.
- [ ] `billing-guild-status/$TEST_GUILD_ID` devuelve `has_premium = true`.
- [ ] Dashboard refleja Pro.
- [ ] Bot refleja Pro.
- [ ] Cancelación controlada mantiene Pro hasta fin de periodo.
- [ ] No hay errores críticos nuevos en logs de Square Cloud, Supabase o Lemon Squeezy.

### NO-GO inmediato si ocurre cualquiera de estos

- [ ] `deploy-commands.js --compact` falla.
- [ ] Hay validaciones o duplicados de slash commands.
- [ ] El login OAuth falla o redirige mal.
- [ ] `/dashboard` o `/auth/callback` devuelven 404/500.
- [ ] El checkout cobra pero no genera `webhook_events`.
- [ ] `webhook_events.processed = false` o `error_message` no es nulo.
- [ ] `guild_subscriptions` no refleja el pago.
- [ ] `billing-guild-status` no coincide con Supabase.
- [ ] El bot no queda `mongoConnected=true` y `discordReady=true`.
- [ ] El bridge queda en `error` para el guild de prueba.

## Decisión final

- [ ] `GO`
- [ ] `NO-GO`

Notas del release:
- Fecha:
- Operador:
- Release tag:
- Guild de prueba:
- Incidencias:

