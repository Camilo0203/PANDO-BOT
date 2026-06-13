"use strict";

module.exports = {
  tutorial: {
    slash_description: "Reenv\u00eda el tutorial de idioma y onboarding a un servidor",
    guild_id_description: "ID del servidor que recibir\u00e1 el tutorial (por defecto, este servidor)",
    owner_only: "Este comando solo est\u00e1 disponible para el owner del bot.",
    guild_not_found: "Servidor no encontrado. El bot no est\u00e1 en el servidor `{{guildId}}`.",
    sent: "Tutorial enviado correctamente a **{{guildName}}**.",
    delivery: "Entrega: {{delivery}}",
    channel: "Canal: <#{{channelId}}>",
    dm: "DM para: <@{{userId}}>",
    already_completed: "El tutorial ya se hab\u00eda completado en **{{guildName}}**. Restabl\u00e9celo e int\u00e9ntalo de nuevo.",
    failed: "No pude enviar el tutorial a **{{guildName}}**.",
    failed_hint: "Puede que al bot le falten permisos o que no haya canales donde pueda escribir.",
  },
};
