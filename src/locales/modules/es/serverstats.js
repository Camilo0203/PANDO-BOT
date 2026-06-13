module.exports = {
  serverstats: {
    activity: {
      footer: "Período: {{period}}",
      messages: "💬 Mensajes",
      messages_value: "**Total:** {{total}}\n**Prom/Día:** {{avgPerDay}}",
      peak_hour: "⏰ Hora Pico",
      peak_hour_value: "**{{hour}}:00 - {{hourEnd}}:00** con {{messages}} mensajes",
      title: "📊 Estadísticas de Actividad - {{period}}",
      top_channels: "🔥 Top Canales",
      top_channels_value: "{{num}}. <#{{channelId}}> - {{count}} mensajes",
      top_users: "⭐ Usuarios Más Activos",
      top_users_value: "{{num}}. <@{{userId}}> - {{count}} mensajes"
    },
    channels: {
      channel_entry: "**{{num}}.** <#{{channelId}}>\n└ {{count}} mensajes",
      entry: "**{{index}}.** {{channel}}\n└ {{messages}} mensajes",
      footer: "Período: {{period}} | Top 10 canales",
      title: "📝 Actividad de Canales - {{period}}"
    },
    choices: {
      period_all: "Todo el Tiempo",
      period_day: "Hoy",
      period_month: "Este Mes",
      period_week: "Esta Semana"
    },
    errors: {
      activity_failed: "❌ Error al obtener estadísticas de actividad. Por favor intenta de nuevo.",
      channels_failed: "❌ Error al obtener estadísticas de canales. Por favor intenta de nuevo.",
      growth_failed: "❌ Error al obtener estadísticas de crecimiento. Por favor intenta de nuevo.",
      members_failed: "❌ Error al obtener estadísticas de miembros. Por favor intenta de nuevo.",
      no_activity: "📊 No hay datos de actividad de canales disponibles aún.",
      no_data: "📊 No hay suficientes datos aún. Las estadísticas de {{type}} estarán disponibles después de algunos días de seguimiento.",
      overview_failed: "❌ Error al obtener la vista general del servidor. Por favor intenta de nuevo.",
      roles_failed: "❌ Error al obtener estadísticas de roles. Por favor intenta de nuevo.",
      support_failed: "❌ Error al obtener estadísticas de soporte. Por favor intenta de nuevo."
    },
    growth: {
      "30day": "📊 Crecimiento de 30 Días",
      "30day_value": "**Cambio Total:** {{change}}\n**Porcentaje:** {{percent}}%\n**Inicio:** {{start}}\n**Actual:** {{current}}",
      footer: "Basado en los últimos 30 días de datos",
      stats_30d: "📊 30 Días Crecimiento",
      stats_30d_value: "**Cambio total:** {{change}}\n**Porcentaje:** {{percent}}%\n**Inicio:** {{start}}\n**Actual:** {{current}}",
      title: "📈 Estadísticas de Crecimiento del Servidor",
      trend: "📅 Tendencia Reciente",
      trend_value: "**Crecimiento Diario Prom:** {{avgDaily}}\n**Proyectado (30d):** {{projected}}"
    },
    members: {
      current: "📈 Estadísticas Actuales",
      current_stats: "📈 Estadísticas Actuales",
      current_stats_value: "**Miembros totales:** {{total}}\n**Personas:** {{humans}}\n**Bots:** {{bots}}",
      current_value: "**Total de Miembros:** {{total}}\n**Humanos:** {{humans}}\n**Bots:** {{bots}}",
      footer: "Período: {{period}}",
      growth: "📊 Crecimiento",
      growth_value: "**Cambio:** {{change}}\n**Porcentaje:** {{percent}}%",
      new_members: "🆕 Nuevos Miembros",
      new_members_value: "**Se unieron:** {{joined}}\n**Promedio/Día:** {{avgPerDay}}",
      period_footer: "Período: {{period}}",
      title: "👥 Estadísticas de Miembros - {{period}}"
    },
    options: {
      serverstats_activity_period_period: "Período de tiempo para ver estadísticas",
      serverstats_channels_period_period: "Período de tiempo para ver estadísticas",
      serverstats_growth_period_period: "Período de tiempo para ver estadísticas",
      serverstats_members_period_period: "Período de tiempo para ver estadísticas",
      serverstats_support_period_period: "Período de tiempo para ver estadísticas"
    },
    overview: {
      boosts: "🚀 Boosts",
      boosts_value: "**Cantidad:** {{count}}\n**Boosters:** {{boosters}}",
      channels: "📝 Canales",
      channels_value: "**Total:** {{total}}\n**Texto:** {{text}}\n**Voz:** {{voice}}",
      emojis: "😀 Emojis",
      emojis_value: "**Total:** {{total}}\n**Estáticos:** {{static}}\n**Animados:** {{animated}}",
      footer: "ID del Servidor: {{id}}",
      info: "ℹ️ Info del Servidor",
      info_value: "**Dueño:** {{owner}}\n**Creado:** {{created}}\n**Nivel de Boost:** {{boostLevel}}",
      members: "👥 Miembros",
      members_value: "**Total:** {{total}}\n**Humanos:** {{humans}}\n**Bots:** {{bots}}\n**En línea:** {{online}}",
      roles: "🎭 Roles",
      roles_value: "**Total:** {{total}}\n**Más alto:** {{highest}}",
      title: "📊 {{server}} - Vista General del Servidor"
    },
    periods: {
      all: "Todo el Tiempo",
      day: "Hoy",
      month: "Este Mes",
      week: "Esta Semana"
    },
    roles: {
      entry: "**{{index}}.** {{role}}\n└ {{count}} miembros ({{percent}}%)",
      footer: "Total de roles: {{total}} | Mostrando top 15",
      role_entry: "**{{num}}.** {{role}}\n└ {{count}} miembros ({{percent}}%)",
      title: "🎭 Distribución de Roles"
    },
    slash: {
      description: "Ver estadísticas del servidor",
      subcommands: {
        activity: {
          description: "Ver estadísticas de actividad",
          options: {
            period: "Período de tiempo para ver estadísticas"
          }
        },
        channels: {
          description: "Ver estadísticas de actividad de canales",
          options: {
            period: "Período de tiempo para ver estadísticas"
          }
        },
        growth: {
          description: "Ver estadísticas de crecimiento del servidor"
        },
        members: {
          description: "Ver estadísticas de miembros",
          options: {
            period: "Período de tiempo para ver estadísticas"
          }
        },
        overview: {
          description: "Ver vista general del servidor"
        },
        roles: {
          description: "Ver estadísticas de distribución de roles"
        },
        support: {
          description: "Ver estadísticas de tickets de soporte",
          options: {
            period: "Período de tiempo para ver estadísticas"
          }
        }
      }
    },
    support: {
      footer: "Período: {{period}}",
      response_times: "⏱️ Tiempos de Respuesta",
      response_times_value: "**Respuesta Prom:** {{avgResponse}}\n**Resolución Prom:** {{avgResolution}}",
      tickets: "📊 Tickets",
      tickets_value: "**Total:** {{total}}\n**Abiertos:** {{open}}\n**Cerrados:** {{closed}}",
      times: "⏱️ Tiempos de Respuesta",
      times_value: "**Promedio Respuesta:** {{avgResponse}}\n**Promedio Resolución:** {{avgResolution}}",
      title: "🎫 Estadísticas de Soporte - {{period}}",
      top_staff: "⭐ Top Staff (Todo el Tiempo)",
      top_staff_value: "{{num}}. <@{{userId}}> - {{count}} tickets"
    }
  }
};
