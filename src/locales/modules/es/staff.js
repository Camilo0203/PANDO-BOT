module.exports = {
  staff: {
    away_off: "Away off",
    away_on_description: "Away on description",
    away_on_footer: "Away on pie de página",
    away_on_title: "Away on título",
    moderation_required: "No tienes permisos suficientes para gestionar las advertencias de los miembros.",
    my_tickets_empty: "My tickets vacío",
    my_tickets_title: "My tickets título",
    only_staff: "Only staff",
    ownership_assigned: "Ownership asignado",
    ownership_claimed: "Ownership reclamado",
    ownership_watching: "Ownership watching",
    slash: {
      description: "Utilidades de gestión y moderación exclusivas para el personal",
      options: {
        reason: "Nota que explica tu estado de ausencia",
        user: "El miembro a inspeccionar o advertir",
        warn_reason: "Descripción de la infracción",
        warning_id: "El ID de 6 caracteres de la advertencia"
      },
      subcommands: {
        away_off: {
          description: "Limpia tu estado de ausencia y vuelve a estar activo"
        },
        away_on: {
          description: "Márcate como ausente con una razón opcional"
        },
        my_tickets: {
          description: "Revisa tus tickets actualmente reclamados y asignados"
        },
        warn_add: {
          description: "Aplicar una advertencia formal a un miembro"
        },
        warn_check: {
          description: "Revisar el historial de advertencias de un miembro"
        },
        warn_remove: {
          description: "Eliminar una advertencia específica por su ID único"
        }
      }
    },
    staff_no_data_description: "No se encontraron estadísticas para <@{{userId}}>.",
    staff_no_data_title: "Sin datos del staff"
  },
  "staff.away_off": "Estado de ausencia eliminado. Ya vuelves a estar activo.",
  "staff.away_on_description": "Ahora apareces como ausente.{{reasonText}}",
  "staff.away_on_footer": "Recuerda desactivar el modo ausente cuando regreses.",
  "staff.away_on_title": "Estado de ausencia activado",
  "staff.my_tickets_empty": "No tienes tickets reclamados ni asignados en este momento.",
  "staff.my_tickets_title": "Tus Tickets ({{count}})",
  "staff.only_staff": "Solo los miembros del staff pueden usar este comando.",
  "staff.ownership_assigned": "Asignado a ti",
  "staff.ownership_claimed": "Reclamado por ti",
  "staff.ownership_watching": "Observando"
};
