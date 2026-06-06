# TON618 - Arquitectura y deploy de produccion

Este documento describe la arquitectura operativa estable de TON618 y el
procedimiento de despliegue seguro. No sustituye los archivos de entorno ni la
configuracion privada de cada servicio.

## Arquitectura

```text
Discord
   |
   v
ton618-bot (PM2)
   |
   +-- carga ton618-music como modulo Node.js
   |      |
   |      +-- comandos, botones, players y colas
   |      |
   |      +----> Lavalink (PM2)
   |
   +-- servicios generales del bot

Internet
   |
   v
Cloudflare Tunnel (systemd)
   |
   +----> ton618-web    127.0.0.1:3000 (PM2)
   |
   +----> ton618-status 127.0.0.1:3001 (PM2)
```

### Responsabilidades

| Componente | Responsabilidad | Ejecucion |
| --- | --- | --- |
| `ton618-bot` | Discord, comandos, interacciones y carga del modulo de musica | PM2 |
| `ton618-music` | Codigo reutilizable de musica, controles y conexion con Lavalink | Modulo de `ton618-bot` |
| `lavalink` | Reproduccion y procesamiento de audio | PM2 |
| `ton618-web` | Sitio web compilado, publicado en el puerto 3000 | PM2 |
| `ton618-status` | Pagina de estado, publicada en el puerto 3001 | PM2 |
| `cloudflared` | Publicacion de web y status hacia los dominios publicos | systemd |

`ton618-music` no debe ejecutarse como proceso PM2 independiente. Aunque el
repositorio conserva un entry point autonomo para desarrollo, en produccion se
carga desde `ton618-bot` mediante la dependencia local `file:../ton618-music`.
Por tanto, un cambio en musica se activa reiniciando solamente `ton618-bot`.

## Estado esperado

`pm2 list` debe mostrar exactamente estos procesos de la plataforma:

```text
lavalink
ton618-bot
ton618-web
ton618-status
```

No debe existir un proceso llamado `ton618-music`. Tampoco se debe reiniciar
Lavalink, Cloudflare Tunnel, web o status al desplegar solamente codigo de
musica.

Puertos internos esperados:

| Servicio | Direccion |
| --- | --- |
| Web | `127.0.0.1:3000` |
| Status | `127.0.0.1:3001` |
| Lavalink | `127.0.0.1:2333` |

Los puertos son internos. Cloudflare Tunnel publica web y status sin exponer
directamente estos servicios.

## Preflight

Definir una vez la carpeta que contiene los repositorios:

```bash
export TON618_ROOT=/ruta/que/contiene/los/repositorios
```

Confirmar el estado antes de desplegar:

```bash
pm2 list
systemctl is-active cloudflared

git -C "$TON618_ROOT/ton618-bot" status --short
git -C "$TON618_ROOT/ton618-music" status --short
git -C "$TON618_ROOT/ton618-web" status --short
git -C "$TON618_ROOT/ton618-status" status --short
```

Si un repositorio tiene cambios locales, detener el despliegue y revisarlos.
No usar `git reset --hard`, `git clean -fdx` ni comandos que borren archivos de
entorno, configuraciones privadas o backups.

## Deploy seguro

### Musica

Los cambios de `ton618-music` se prueban en su repositorio y se activan
reiniciando `ton618-bot`. Lavalink no se reinicia.

```bash
cd "$TON618_ROOT/ton618-music"
git fetch origin
git log --oneline HEAD..origin/main
git merge --ff-only origin/main

node --test tests/musicEmbeds.test.js tests/services.test.js tests/tierLimits.test.js tests/musicComponents.test.js tests/musicControlService.test.js tests/musicComponentHandler.test.js
git diff --check

cd "$TON618_ROOT/ton618-bot"
node --test tests/interaction-router.test.js
pm2 restart ton618-bot
pm2 logs ton618-bot --lines 100 --nostream
```

Verificar que la dependencia local resuelve al repositorio hermano:

```bash
readlink -f "$TON618_ROOT/ton618-bot/node_modules/ton618-music"
```

Debe resolver a `"$TON618_ROOT/ton618-music"`. Si no lo hace, no reiniciar el
bot hasta revisar la instalacion local. Ejecutar `npm ci` solamente cuando el
lockfile aprobado haya cambiado o sea necesario reconstruir esa dependencia.

### Bot

```bash
cd "$TON618_ROOT/ton618-bot"
git fetch origin
git log --oneline HEAD..origin/main
git merge --ff-only origin/main

npm test
git diff --check
pm2 restart ton618-bot
pm2 logs ton618-bot --lines 100 --nostream
```

Si el cambio incluye `package.json` o `package-lock.json`, ejecutar `npm ci`
antes de las pruebas. No ejecutar despliegues de slash commands salvo que el
cambio aprobado modifique expresamente su definicion.

### Web

```bash
cd "$TON618_ROOT/ton618-web"
git fetch origin
git log --oneline HEAD..origin/main
git merge --ff-only origin/main

npm run verify
npm run build
pm2 restart ton618-web
curl -fsS http://127.0.0.1:3000/ -o /dev/null
pm2 logs ton618-web --lines 100 --nostream
```

Si cambia el lockfile, ejecutar `npm ci` antes de `npm run verify`.

### Status

```bash
cd "$TON618_ROOT/ton618-status"
git fetch origin
git log --oneline HEAD..origin/main
git merge --ff-only origin/main

npm run build
pm2 restart ton618-status
curl -fsS http://127.0.0.1:3001/ -o /dev/null
pm2 logs ton618-status --lines 100 --nostream
```

Si cambia el lockfile, ejecutar `npm ci` antes del build.

### Solo documentacion

Un cambio exclusivo de Markdown no requiere reiniciar ningun proceso.

## Verificacion

### PM2

```bash
pm2 list
pm2 describe lavalink
pm2 describe ton618-bot
pm2 describe ton618-web
pm2 describe ton618-status

pm2 logs lavalink --lines 100 --nostream
pm2 logs ton618-bot --lines 100 --nostream
pm2 logs ton618-web --lines 100 --nostream
pm2 logs ton618-status --lines 100 --nostream
```

### Puertos locales

```bash
curl -fsS http://127.0.0.1:3000/ -o /dev/null -w 'web: %{http_code}\n'
curl -fsS http://127.0.0.1:3001/ -o /dev/null -w 'status: %{http_code}\n'
ss -ltnp | grep -E ':2333|:3000|:3001'
```

### Lavalink

Solicitar la clave sin guardarla en el historial:

```bash
read -rsp "Lavalink password: " LAVALINK_PASSWORD
echo
curl -fsS \
  -H "Authorization: $LAVALINK_PASSWORD" \
  http://127.0.0.1:2333/v4/stats
unset LAVALINK_PASSWORD
```

Una respuesta JSON confirma que el nodo atiende. Esta comprobacion no cambia
la configuracion ni reinicia Lavalink.

### Cloudflare Tunnel

```bash
systemctl status cloudflared --no-pager
journalctl -u cloudflared -n 100 --no-pager
```

No reiniciar `cloudflared` durante un deploy rutinario de bot, musica, web o
status.

## Git y archivos locales

Antes de preparar un commit:

```bash
git status --short
git diff
git diff --cached
```

Para quitar un archivo del staging sin borrar su copia local:

```bash
git restore --staged -- ruta/del/archivo
```

Agregar siempre archivos concretos. Para este documento:

```bash
git add README_DEPLOY.md
git diff --cached --stat
git diff --cached
```

Bloquear el commit si contiene nombres de archivos sensibles:

```bash
if git diff --cached --name-only | grep -Eiq '(^|/)\.env($|\.)|application-vps\.yml|\.env\.lavalink$|\.(pem|key|p12)$'; then
  echo "ERROR: hay un archivo sensible en staging"
  exit 1
fi
```

Comprobar posibles secretos agregados sin imprimir su contenido:

```bash
if git diff --cached -U0 | grep -Eiq '^\+.*(TOKEN|SECRET|PASSWORD|PRIVATE_KEY|REFRESH_TOKEN|REMOTE_CIPHER)[[:space:]]*[:=]'; then
  echo "ERROR: revisar posibles secretos agregados"
  exit 1
fi
```

Para inspeccionar archivos ignorados o backups sin borrarlos:

```bash
git status --short --ignored
find . -type f \( -name '*.bak' -o -name '*.backup' -o -name '*.old' -o -name '*.orig' -o -name '*~' \)
git clean -nd
```

`git clean -nd` solo simula. No ejecutar la eliminacion hasta revisar cada
ruta. Los patrones de backup que no esten ignorados deben incorporarse a
`.gitignore` en un commit separado; nunca se deben borrar como parte de una
limpieza rutinaria.

## Reglas operativas

- No editar ni reemplazar `.env`, `.env.lavalink` o archivos equivalentes.
- No incluir tokens, passwords, OAuth, `remoteCipher` ni credenciales en Git.
- No modificar la configuracion real de Lavalink durante deploys de aplicacion.
- No ejecutar `git add .`.
- No crear ni iniciar `ton618-music` en PM2.
- Reiniciar solamente el proceso afectado.
- No reiniciar Cloudflare Tunnel en despliegues rutinarios.
- No cambiar puertos durante un deploy.
- No borrar backups para obtener un `git status` limpio.
- Confirmar logs y health checks antes de considerar terminado el despliegue.
