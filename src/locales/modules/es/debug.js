module.exports = {
  debug: {
    access_denied: "No tienes permisos para usar comandos de debug.",
    description: {
      automod: "Conteo en vivo, solo para owner, de reglas de AutoMod gestionadas por TON618 en las guilds conectadas.",
      cache: "Discord.js gestiona la cache automaticamente.",
      health: "Snapshot de la ventana activa mas el ultimo heartbeat persistido.",
      voice: "Las colas de musica se gestionan por guild."
    },
    field: {
      api_ping: "Ping de API",
      cached_channels: "Canales en cache",
      cached_users: "Usuarios en cache",
      channels: "Canales",
      deploy: "Despliegue",
      external: "Externo",
      guild_coverage: "Cobertura por Guild",
      guilds: "Servidores",
      guilds_attention: "Guilds que requieren atención",
      guilds_live_rules: "Guilds con reglas vivas de TON618",
      heap_total: "Memoria total del heap",
      heap_used: "Heap usado",
      heartbeat: "Señal de actividad",
      interaction_window: "Ventana de interacciones",
      progress: "Progreso",
      quick_state: "Estado rapido",
      rss: "RSS",
      top_errors: "Errores principales",
      uptime: "Tiempo activo",
      users: "Usuarios"
    },
    no_connected_guilds: "No hay guilds conectadas.",
    options: {
      "debug_entitlements_set-plan_expires_in_days_expires_in_days": "Duración opcional en días para Pro",
      "debug_entitlements_set-plan_guild_id_guild_id": "ID del servidor objetivo",
      "debug_entitlements_set-plan_note_note": "Nota interna opcional",
      "debug_entitlements_set-plan_tier_tier": "Nivel de plan",
      "debug_entitlements_set-supporter_active_active": "Activar o desactivar reconocimiento de supporter",
      "debug_entitlements_set-supporter_expires_in_days_expires_in_days": "Duración opcional en días para estado de supporter",
      "debug_entitlements_set-supporter_guild_id_guild_id": "ID del servidor objetivo",
      "debug_entitlements_set-supporter_note_note": "Nota interna opcional",
      debug_entitlements_status_guild_id_guild_id: "ID del servidor objetivo"
    },
    slash: {
      description: "Herramientas de diagnóstico y derechos solo para el propietario",
      subcommands: {
        automod_badge: {
          description: "Ver progreso de insignia de AutoMod en vivo en todos los servidores"
        },
        cache: {
          description: "Ver tamaños de caché del bot"
        },
        entitlements_set_plan: {
          description: "Establecer un plan de servidor manualmente"
        },
        entitlements_set_supporter: {
          description: "Activar o desactivar reconocimiento de supporter"
        },
        entitlements_status: {
          description: "Inspeccionar el plan efectivo y estado de supporter para un servidor"
        },
        guilds: {
          description: "Listar servidores conectados"
        },
        health: {
          description: "Ver estado de salud y latido en vivo"
        },
        memory: {
          description: "Ver uso de memoria del proceso"
        },
        status: {
          description: "Ver estado del bot e información de despliegue"
        },
        voice: {
          description: "Ver estado del subsistema de música"
        }
      }
    },
    title: {
      automod: "Progreso del Badge de AutoMod",
      cache: "Estado de Cache",
      entitlements: "Entitlements de la Guild",
      guilds: "Guilds Conectadas",
      health: "Salud del Bot",
      memory: "Uso de Memoria",
      plan_updated: "Plan Actualizado",
      status: "Estado del Bot",
      supporter_updated: "Supporter Actualizado",
      voice: "Subsistema de Musica"
    },
    unknown_subcommand: "Subcomando desconocido.",
    value: {
      app_flag_present: "Flag de la app presente: {{value}}",
      automod_enabled: "AutoMod activado: `{{count}}`",
      error_rate: "Tasa de error: **{{state}}** ({{value}}%, umbral {{threshold}}%)",
      failed_partial_sync: "Sync fallida o parcial: `{{count}}`",
      heartbeat: "Ultima vez visto: `{{lastSeen}}`\nGuilds: `{{guilds}}`",
      high: "ALTO",
      interaction_totals: "Total: `{{total}}`\nOK/Error/Denied/Rate: `{{ok}}/{{errors}}/{{denied}}/{{rateLimited}}`",
      managed_rules: "Reglas gestionadas: `{{count}}`",
      missing_permissions: "Permisos faltantes: `{{count}}`",
      no: "No",
      ok: "OK",
      ping_state: "Ping: **{{state}}** ({{value}}ms, umbral {{threshold}}ms)",
      remaining_to_goal: "Restantes para {{goal}}: `{{count}}`",
      yes: "Si"
    }
  }
};
