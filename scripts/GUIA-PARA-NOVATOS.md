# Guia Paso a Paso para Novatos - TON618 VPS

## Que necesitas antes de empezar

Tener a la mano estos datos (los obtienes de tus plataformas):

| Dato | Donde lo consigues |
|------|-------------------|
| **DISCORD_TOKEN** | Discord Developer Portal > Bot > Token |
| **DISCORD_CLIENT_ID** | Discord Developer Portal > General Information > Application ID |
| **MONGO_URI** | MongoDB Atlas > Database > Connect > Drivers > Node.js |
| **OWNER_ID** | Tu ID de Discord (click derecho en tu nombre con modo desarrollador) |
| **SUPABASE_URL** | Supabase Dashboard > Settings > API > URL |
| **SUPABASE_ANON_KEY** | Supabase Dashboard > Settings > API > anon/public |
| **SUPABASE_SERVICE_ROLE_KEY** | Supabase Dashboard > Settings > API > service_role (secreto) |
| **BOT_API_KEY** | Lo creas tu: genera 64 caracteres random o usa el que ya tienes |

---

## PASO 1: Abrir PowerShell

1. Presiona la tecla `Windows`
2. Escribe: `powershell`
3. Click derecho en **Windows PowerShell** > **Ejecutar como administrador**
4. Click en **Si** cuando pregunte

---

## PASO 2: Conectarte a tu VPS

En la ventana negra de PowerShell, escribe esto y presiona Enter:

```powershell
ssh root@31.220.96.156
```

Te pedira password. Escribe el password que pusiste al comprar la VPS en Contabo.

**IMPORTANTE:** Mientras escribes el password, NO SE VE NADA en pantalla. Es normal. Presiona Enter cuando termines.

Si ves algo como `root@vps:~#` o similar, ya estas dentro.

---

## PASO 3: Ejecutar la instalacion automatica

Copia este comando COMPLETO, pegalo en la ventana (click derecho para pegar), y presiona Enter:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Camilo0203/ton618-bot/main/scripts/setup-all-in-one.sh)
```

Espera unos 5-10 minutos. Veras barras de progreso y mensajes verdes.

**Si el comando anterior no funciona**, usa este metodo alternativo:

```bash
cd /opt/ton618/ton618-bot/scripts && bash setup-all-in-one.sh
```

---

## PASO 4: Crear los archivos de configuracion (.env)

Despues de la instalacion, necesitas editar 3 archivos con tus datos reales.

Usamos un editor de texto simple llamado `nano`.

### 4.1 - Configurar el Bot principal

Ejecuta:
```bash
nano /opt/ton618/ton618-bot/.env
```

Se abre un editor. Borra TODO lo que esta ahi (Ctrl+K varias veces).

Luego pega esto (reemplaza los valores que dicen `CAMBIA_ESTO`):

```env
# ========== DATOS DE DISCORD (OBLIGATORIOS) ==========
DISCORD_TOKEN=CAMBIA_ESTO_pon_tu_token_de_discord
DISCORD_CLIENT_ID=CAMBIA_ESTO_pon_tu_client_id
OWNER_ID=CAMBIA_ESTO_pon_tu_discord_id

# ========== MONGODB (OBLIGATORIO) ==========
MONGO_URI=CAMBIA_ESTO_tu_uri_de_mongodb_atlas
MONGO_DB=ton618

# ========== SUPABASE (OBLIGATORIO) ==========
SUPABASE_URL=CAMBIA_ESTO_tu_url_de_supabase
SUPABASE_ANON_KEY=CAMBIA_ESTO_tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=CAMBIA_ESTO_tu_service_role_key
BOT_API_KEY=CAMBIA_ESTO_genera_64_caracteres_random

# ========== LAVALINK (misma VPS) ==========
LAVALINK_PRO_HOST=localhost
LAVALINK_PRO_PORT=2333
LAVALINK_PRO_PASSWORD=youshallnotpass
LAVALINK_PRO_SECURE=false
LAVALINK_FREE_HOST=localhost
LAVALINK_FREE_PORT=2333
LAVALINK_FREE_PASSWORD=youshallnotpass
LAVALINK_FREE_SECURE=false

# ========== SEGURIDAD (OBLIGATORIO EN PRODUCCION) ==========
ENCRYPTION_KEY=CAMBIA_ESTO_genera_64_hex_chars
HASH_SALT=CAMBIA_ESTO_genera_32_hex_chars
DASH_API_KEY=CAMBIA_ESTO_genera_32_hex_chars

# ========== OTROS ==========
NODE_ENV=production
PRO_UPGRADE_URL=https://ton618bot.xyz/pricing
```

**Guardar:** Presiona `Ctrl+O`, luego `Enter`, luego `Ctrl+X` para salir.

### 4.2 - Configurar la Musica

Ejecuta:
```bash
nano /opt/ton618/ton618-music/.env
```

Borra todo y pega:

```env
DISCORD_TOKEN=mismo_token_que_el_bot_principal
DISCORD_CLIENT_ID=mismo_client_id_que_el_bot

LAVALINK_PRO_HOST=localhost
LAVALINK_PRO_PORT=2333
LAVALINK_PRO_PASSWORD=youshallnotpass
LAVALINK_PRO_SECURE=false

LAVALINK_FREE_HOST=localhost
LAVALINK_FREE_PORT=2333
LAVALINK_FREE_PASSWORD=youshallnotpass
LAVALINK_FREE_SECURE=false

MONGO_URI=misma_uri_de_mongodb
SUPABASE_URL=misma_url_de_supabase
BOT_API_KEY=mismo_bot_api_key
OWNER_ID=tu_discord_id
NODE_ENV=production
```

**Guardar:** `Ctrl+O`, `Enter`, `Ctrl+X`

### 4.3 - Configurar la Web

Ejecuta:
```bash
nano /opt/ton618/ton618-web/.env
```

Borra todo y pega:

```env
VITE_DISCORD_CLIENT_ID=tu_client_id_de_discord
VITE_DISCORD_PERMISSIONS=8
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
VITE_SITE_URL=https://ton618bot.xyz
VITE_ENABLE_DASHBOARD=true
VITE_BOT_NAME=TON618
NODE_ENV=production
```

**Guardar:** `Ctrl+O`, `Enter`, `Ctrl+X`

---

## PASO 5: Desplegar todo

Ahora ejecuta UN SOLO COMANDO para levantar todo:

```bash
bash /opt/ton618/ton618-bot/scripts/deploy-vps.sh
```

Espera unos 2 minutos. Veras mensajes como:
- `[1/6] Verifying .env files...`
- `[5/6] Starting PM2 services...`
- `Deploy complete!`

Al final vera un cuadrito con los 3 procesos (lavalink, ton618-bot, ton618-web) y sus estados.

Si los 3 dicen `online` en verde, todo esta funcionando.

---

## PASO 6: Configurar plataformas externas (ultimo paso)

### Discord Developer Portal
1. Ve a https://discord.com/developers/applications
2. Selecciona tu aplicacion TON618
3. Ve a **OAuth2 > General**
4. En **Redirects**, agrega: `https://ton618bot.xyz/auth/callback`
5. Guarda

### Supabase
1. Ve a tu proyecto en https://supabase.com/dashboard
2. **Authentication > URL Configuration**
3. Site URL: `https://ton618bot.xyz`
4. Redirect URLs: agrega `https://ton618bot.xyz/auth/callback`
5. Guarda

### DNS (dominio)
1. Ve a tu proveedor de dominio (donde compraste ton618bot.xyz)
2. Busca **DNS Management** o **Records**
3. Crea un registro tipo **A**:
   - Name: `@` (o dejalo en blanco)
   - Value: `31.220.96.156`
4. Crea un registro tipo **CNAME**:
   - Name: `www`
   - Value: `ton618bot.xyz`
5. Guarda (puede tardar 5-30 minutos en propagarse)

---

## Como verificar que todo funciona

Desde PowerShell o cualquier navegador:

```bash
# Verificar la web
curl https://ton618bot.xyz

# Verificar health del bot
curl http://31.220.96.156:3000/health

# Ver procesos
pm2 status

# Ver logs del bot
pm2 logs ton618-bot --lines 20
```

---

## Comandos utiles (guardalos)

| Que quieres hacer | Comando |
|---|---|
| Ver si todo esta corriendo | `pm2 status` |
| Ver logs del bot | `pm2 logs ton618-bot` |
| Reiniciar el bot | `pm2 restart ton618-bot` |
| Reiniciar la web | `pm2 restart ton618-web` |
| Reiniciar Lavalink | `pm2 restart lavalink` |
| Ver logs de Lavalink | `pm2 logs lavalink` |
| Editar config del bot | `nano /opt/ton618/ton618-bot/.env` |
| Salir de la VPS | `exit` |

---

## Si algo sale mal

**"Permission denied" al conectar por SSH**
- Revisa que escribiste bien la IP: `31.220.96.156`
- Revisa que el password es el correcto (distingue mayusculas)

**"Lavalink.jar not found"**
```bash
wget -O /opt/ton618/ton618-music/lavalink/Lavalink.jar https://github.com/lavalink-devs/Lavalink/releases/download/4.2.2/Lavalink.jar
```

**La web no carga**
```bash
pm2 logs ton618-web --lines 50
```
Revisa que el build fue exitoso.

**El bot no responde a comandos**
```bash
pm2 logs ton618-bot --lines 50
```
Revisa que DISCORD_TOKEN es correcto.

---

## Resumen visual

```
[Tu PC] --SSH--> [VPS 31.220.96.156]
                      |
                      |-- Lavalink (puerto 2333)
                      |-- TON618 Bot
                      |-- Web Dashboard (puerto 3000)
                      |-- Caddy (SSL + reverse proxy)
                      |
                   [ton618bot.xyz] <--DNS-- [Usuario final]
```

Caddy recibe las peticiones HTTPS en `ton618bot.xyz` y las manda al dashboard en `localhost:3000`.

---

**Listo! Si tienes alguna duda durante el proceso, copia el mensaje de error exacto y pegalo aqui.**
