# Configuración Webhook Tebex para TON618

## Archivos creados/modificados

1. **Nuevo**: `src/web/apps/tebex.js` — Handler del webhook
2. **Modificado**: `src/web/server.js` — Registro de la ruta `/webhook-tebex`

## Variables de entorno en Square Cloud

Accedé a tu panel de Square Cloud y agregá estas variables:

| Variable | Valor | Descripción |
|---|---|---|
| `TEBEX_SECRET_KEY` | `73d98efc31c4cd7adb33bceecf38fdc3` | Tu Secret Key de Tebex para validar firmas |
| `TEBEX_GUILD_ID` | `1214106731022655488` | ID del servidor Discord donde asignar roles |
| `TEBEX_ROLE_MAP` | Ver abajo | Mapeo de paquetes Tebex a roles Discord |

### Formato de TEBEX_ROLE_MAP

Opción A (JSON):
```json
{"package_1":"role_id_1","package_2":"role_id_2"}
```

Opción B (simplificada, sin espacios):
```
package_1:role_id_1,package_2:role_id_2
```

Ejemplo real:
```
12345:987654321012345678,67890:987654321012345679
```

## Obtener IDs de paquetes y roles

- **Package ID Tebex**: En tu panel de Tebex → Packages → copiá el ID del paquete
- **Role ID Discord**: En Discord → Ajustes del servidor → Roles → Click derecho en el rol → Copiar ID de rol (necesitás modo desarrollador activado)

## URL del webhook en Tebex

En tu panel de Tebex → Webhooks → Configurá la URL:
```
https://ton618bot.xyz/webhook-tebex
```

**Importante**: Seleccioná el evento `Payment Completed` (o `payment.completed`).

## Probar el webhook

Podés verificar que esté funcionando visitando:
```
https://ton618bot.xyz/webhook-tebex/health
```

Debería responder:
```json
{"status":"ok","configured":true,"roleMapEntries":2}
```

## Logs

Los logs del webhook aparecen en la consola de Square Cloud con el prefijo `[TebexWebhook]`.

## Seguridad

- Nunca compartas tu `TEBEX_SECRET_KEY` públicamente
- El webhook valida la firma HMAC-SHA256 de cada request
- Si la firma no coincide, devuelve 401 Unauthorized
