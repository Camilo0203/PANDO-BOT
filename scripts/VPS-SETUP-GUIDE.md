# TON618 VPS Setup Guide — Paso a Paso

**IP VPS:** `31.220.96.156`  
**OS:** Ubuntu 22.04 LTS  
**Usuario:** `root`  
**Password:** El que pusiste al comprar en Contabo

---

## Paso 1 — Conectarte por SSH (desde Windows)

Abre **PowerShell** (como administrador) y ejecuta:

```powershell
ssh root@31.220.96.156
```

Te pedirá el password. Escribe el que pusiste en Contabo (no se ve en pantalla, es normal) y presiona Enter.

---

## Paso 2 — Copiar archivos de configuración (.env)

Necesitas crear los archivos `.env` en cada repo. Usa estos comandos (reemplaza con tus valores reales):

### Bot principal:
```bash
cat > /opt/ton618/ton618-bot/.env << 'EOF'
DISCORD_TOKEN=tu-token-aqui
MONGO_URI=tu-mongo-uri-aqui
OWNER_ID=tu-discord-id
ENCRYPTION_KEY=tu-hex-key-64-chars
HASH_SALT=tu-salt-32-chars
SUPABASE_URL=https://tu-proyecto.supabase.co
BOT_API_KEY=tu-api-key
NODE_ENV=production
EOF
```

### Música:
```bash
cat > /opt/ton618/ton618-bot/.env.lavalink << 'EOF'
DISCORD_TOKEN=mismo-token-del-bot
DISCORD_CLIENT_ID=tu-client-id
LAVALINK_PRO_HOST=localhost
LAVALINK_PRO_PORT=2333
LAVALINK_PRO_PASSWORD=youshallnotpass
LAVALINK_PRO_SECURE=false
MONGO_URI=misma-mongo-uri
SUPABASE_URL=misma-supabase-url
BOT_API_KEY=misma-api-key
OWNER_ID=tu-discord-id
NODE_ENV=production
EOF
```

### Web:
```bash
cat > /opt/ton618/ton618-web/.env << 'EOF'
VITE_DISCORD_CLIENT_ID=tu-client-id
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
VITE_SITE_URL=https://ton618bot.xyz
VITE_ENABLE_DASHBOARD=true
NODE_ENV=production
EOF
```

---

## Paso 3 — Correr setup inicial

```bash
bash /opt/ton618/ton618-bot/scripts/vps-setup.sh
```

Esto instala: Java 17, Node 20, PM2, Caddy, Git, y clona los repos.

**Toma ~5-10 minutos.**

---

## Paso 4 — Configurar Caddy (SSL auto)

```bash
cp /opt/ton618/ton618-bot/scripts/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
```

Caddy automáticamente obtiene SSL para `ton618bot.xyz`.

---

## Paso 5 — Deploy todo

```bash
bash /opt/ton618/ton618-bot/scripts/deploy-vps.sh
```

Esto levanta: Lavalink (puerto 2333), Bot, y Web Dashboard (puerto 3000).

---

## Paso 6 — Verificar que todo funciona

```bash
# Ver procesos
pm2 status

# Ver logs del bot
pm2 logs ton618-bot --lines 20

# Ver logs de Lavalink
pm2 logs lavalink --lines 20

# Ver logs de la web
pm2 logs ton618-web --lines 20

# Health check del bot
curl http://31.220.96.156:3000/health

# Verificar HTTPS
curl -I https://ton618bot.xyz
```

---

## Paso 7 — Configuración externa (manual)

### Supabase Dashboard
1. Ve a **Authentication → URL Configuration**
2. Site URL: `https://ton618bot.xyz`
3. Redirect URLs → Agrega: `https://ton618bot.xyz/auth/callback`

### Discord Developer Portal
1. Ve a tu app → **OAuth2 → General**
2. Redirects → Agrega: `https://ton618bot.xyz/auth/callback`

### DNS (Cloudflare o tu proveedor)
1. `ton618bot.xyz` → A → `31.220.96.156`
2. `www.ton618bot.xyz` → CNAME → `ton618bot.xyz`

---

## Comandos útiles (guarda esto)

```bash
pm2 status              # Ver todos los procesos
pm2 logs ton618-bot     # Logs del bot en tiempo real
pm2 restart ton618-bot  # Reiniciar bot
pm2 restart lavalink    # Reiniciar Lavalink
pm2 restart ton618-web  # Reiniciar web
pm2 save               # Guardar config de PM2
```

---

## Si algo falla

### Bot no responde
```bash
pm2 logs ton618-bot --lines 50
# Revisa: DISCORD_TOKEN correcto, intents habilitados
```

### Lavalink no conecta
```bash
pm2 logs lavalink --lines 50
# Revisa: Java 17 instalado, puerto 2333 libre
```

### Web no carga
```bash
curl http://localhost:3000/health
pm2 logs ton618-web --lines 20
# Revisa: build exitoso, puerto 3000 libre
```

### SSL no funciona
```bash
systemctl status caddy
journalctl -u caddy --no-pager -n 20
# Revisa: DNS apunta a la IP, puertos 80/443 abiertos
```
