module.exports = {
  health: {
    active: "Activo",
    all_permissions: "Todos los permisos presentes",
    checks: {
      database: "Base de Datos",
      handlers: "Controladores",
      memory: "Memoria",
      permissions: "Permisos del Bot",
      uptime: "Tiempo Activo",
      version: "Versión"
    },
    connected: "Conectado",
    embed: {
      checks_title: "Diagnósticos",
      description: "Estado del sistema: {{status}}\nServidor: {{guild}}",
      errors_title: "Errores Críticos",
      footer: "Completado en {{elapsed}}ms • Discord.js {{discordjs}} • Node {{node}}",
      title: "🔍 Diagnóstico del Sistema",
      warnings_title: "Advertencias"
    },
    errors: {
      database: "Error de conexión a base de datos: {{error}}"
    },
    handlers_status: "Sorteos: {{giveaway}}, Estadísticas: {{stats}}",
    inactive: "Inactivo",
    memory_usage: "{{used}} MB / {{total}} MB",
    missing_count: "Faltan {{count}} permisos",
    no_checks: "No se pudieron realizar verificaciones",
    no_data: "Sin datos (primera vez)",
    slash: {
      description: "Verificar estado y diagnóstico del bot"
    },
    status: {
      critical: "Crítico",
      healthy: "Saludable",
      warning: "Advertencias"
    },
    unknown: "desconocido",
    unknown_error: "Error desconocido",
    uptime_format: "{{hours}}h {{minutes}}m",
    warnings: {
      handlers_inactive: "Algunos handlers están inactivos",
      high_memory: "Uso de memoria alto: {{mb}} MB",
      missing_permissions: "Faltan {{count}} permisos del bot"
    }
  }
};
