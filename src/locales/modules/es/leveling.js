module.exports = {
  leveling: {
    embed: {
      field_level_name: "Field level name",
      field_progress_name: "Field progress name",
      field_total_xp_name: "Field total xp name",
      footer: "¡Mantente activo para subir de nivel!",
      level: "Nivel",
      messages: "Mensajes",
      progress: "Progreso",
      title: "Title",
      total_xp: "XP Total"
    },
    errors: {
      disabled: "❌ El sistema de niveles está desactivado en este servidor.",
      invalid_page: "❌ Página inválida. La página máxima es {{max}}.",
      no_data: "❌ No se encontraron datos para este servidor.",
      no_rank: "❌ Aún no tienes una posición. ¡Envía algunos mensajes!",
      user_not_found: "❌ Usuario no encontrado."
    },
    leaderboard: {
      empty: "Empty",
      footer: "Página {{page}}/{{total}} • {{users}} usuarios en total",
      stats: "Nivel: {{level}} | XP: {{xp}}",
      title: "Tabla de Clasificación del Servidor",
      unknown_user: "Usuario Desconocido"
    },
    rank: {
      description: "Tu posición actual es {{rank}} con nivel {{level}} y {{xp}} XP.",
      footer: "Footer",
      no_xp: "No xp",
      title: "Title"
    },
    slash: {
      description: "Sistema interactivo de niveles de niveles",
      options: {
        page: "Número de página a ver",
        user: "El usuario objetivo"
      },
      subcommands: {
        leaderboard: {
          description: "Ver la tabla de clasificación del servidor"
        },
        rank: {
          description: "Ver tu posición en la tabla de clasificación"
        },
        view: {
          description: "Ver tu nivel o el nivel de otro usuario"
        }
      }
    },
    status_disabled: "Status deshabilitado",
    user_not_found: "Usuario not found"
  },
  "leveling.embed.field_level_name": "Nivel",
  "leveling.embed.field_progress_name": "Progreso",
  "leveling.embed.field_total_xp_name": "XP Total",
  "leveling.embed.title": "Perfil de Nivel: {{user}}",
  "leveling.leaderboard.empty": "Aún no hay datos disponibles para la tabla de clasificación.",
  "leveling.rank.footer": "Sigue hablando para ganar más XP.",
  "leveling.rank.no_xp": "Todavía no hay XP registrada.",
  "leveling.rank.title": "Rango de {{user}}",
  "leveling.status_disabled": "El sistema de niveles está desactivado en este servidor.",
  "leveling.user_not_found": "No se pudo encontrar a ese usuario."
};
