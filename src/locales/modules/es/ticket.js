module.exports = {
  ticket: {
    categories: {
      "support.label": "Soporte",
      "billing.label": "Facturación",
      "report.label": "Reportar",
      "partnership.label": "Colaboraciones",
      "staff.label": "Staff",
      "bug.label": "Reporte de bug",
      "other.label": "Otro",
      "support.description": "Ayuda con problemas técnicos, consultas generales",
      "billing.description": "Pagos, suscripciones y problemas con tu cuenta",
      "report.description": "Reportar usuarios, contenido o comportamientos",
      "partnership.description": "Propuestas de colaboración y partnership",
      "staff.description": "Aplicar al equipo del servidor",
      "bug.description": "Reportar errores o problemas técnicos",
      "other.description": "Cualquier otra consulta",
      "support.welcome": "Gracias por abrir un ticket de soporte. Un miembro del equipo te atenderá pronto. Por favor describe tu problema con detalle.",
      "billing.welcome": "Gracias por contactar a soporte de facturación. Un miembro del equipo te atenderá lo antes posible.",
      "report.welcome": "Gracias por reportar. Nuestro equipo de moderación revisará tu reporte.",
      "partnership.welcome": "Gracias por tu interés en colaborar. Un miembro del equipo te contactará.",
      "staff.welcome": "Gracias por tu interés en nuestro equipo. Un líder te contactará.",
      "bug.welcome": "Gracias por reportar el error. Lo revisaremos lo antes posible.",
      "other.welcome": "Gracias por contactar. Un miembro del equipo te atenderá."
    },
    auto_reply: {
      footer: "──────────────────────────────────\n⚡ **Prioridad ultrarrápida** (0.4s) | [Apoya a TON618](https://store.ton618bot.xyz/)",
      footer_free: "──────────────────────────────────\n🎫 Sistema de tickets por TON618",
      prefix: "🛡️ **TON618 PRO** | `Soporte Verificado` — *\"{{trigger}}\"*",
      priority_badge: "🚨 **[PRIORIDAD URGENTE DETECTADA]**",
      priority_note: "⚠️ **Nota de Inteligencia:** Se ha acelerado la revisión manual debido a la naturaleza crítica de este ticket.",
      pro_badge: "🛡️ SOPORTE VERIFICADO PRO",
      pro_footer_small: "Impulsado por TON618 Pro — La excelencia en soporte.",
      sentiment_angry: "😡 Enfado / Urgencia Crítica",
      sentiment_calm: "😊 Calma (Estándar)",
      sentiment_label: "🎭 Sentimiento del Usuario",
      suggestion_label: "💡 Sugerencia Pro",
      urgency_keywords: [
        "urgente",
        "emergencia",
        "ayuda",
        "error",
        "fallo",
        "no funciona",
        "pago",
        "problema",
        "hack",
        "robo",
        "asap",
        "auxilio"
      ]
    },
    buttons: {
      claim: "Reclamar",
      claimed: "Reclamado",
      close: "Cerrar",
      reopen: "Reabrir",
      transcript: "Transcripción"
    },
    close_button: {
      already_closed: "Este ticket ya está cerrado.",
      auto_close_failed: "No pude cerrar el ticket automáticamente. Inténtalo de nuevo o avisa a un administrador.",
      bot_member_missing: "No pude verificar mis permisos en este servidor.",
      close_note_event_description: "{{userTag}} agregó una nota interna antes de cerrar el ticket #{{ticketId}}.",
      close_note_event_title: "Nota de cierre agregada",
      missing_manage_channels: "Necesito el permiso `Manage Channels` para cerrar tickets.",
      modal_error: "Ocurrió un error al procesar el cierre del ticket. Inténtalo de nuevo más tarde.",
      modal_title: "Cerrar ticket #{{ticketId}}",
      notes_label: "Notas internas",
      notes_placeholder: "Notas extra solo para staff...",
      open_form_error: "Ocurrió un error al abrir el formulario de cierre. Inténtalo otra vez.",
      permission_denied_description: "Solo el staff puede cerrar tickets.",
      permission_denied_title: "Permiso denegado",
      processing_description: "Iniciando el flujo de cierre y generación de transcripción...",
      processing_title: "Procesando cierre",
      reason_label: "Motivo de cierre",
      reason_placeholder: "Ejemplo: resuelto, duplicado, solicitud completada..."
    },
    command: {
      channel_renamed: "Canal renombrado a **{{name}}**",
      closed_priority_denied: "No puedes cambiar la prioridad de un ticket cerrado.",
      history_empty: "<@{{userId}}> no tiene tickets en este servidor.",
      history_open_now: "Abiertos ahora",
      history_recently_closed: "Cerrados recientemente",
      history_summary: "Resumen",
      history_summary_value: "Total: **{{total}}** | Abiertos: **{{open}}** | Cerrados: **{{closed}}**",
      history_title: "Historial de tickets de {{user}}",
      move_select_description: "Selecciona la categoría a la que quieres mover este ticket:",
      move_select_placeholder: "Selecciona la nueva categoría...",
      no_other_categories: "No hay otras categorías disponibles.",
      no_rating: "Sin calificación",
      not_ticket_channel: "Este no es un canal de ticket.",
      note_added_event_description: "{{userTag}} agregó una nota interna al ticket #{{ticketId}}.",
      note_added_footer: "Por {{userTag}} · {{count}}/{{max}}",
      note_added_title: "Nota interna agregada",
      note_limit_reached: "Se alcanzó el límite de notas del ticket (**{{max}}** notas máximas por ticket). Usa `/ticket note clear` si necesitas limpiarlas.",
      notes_cleared: "Se limpiaron todas las notas del ticket.",
      notes_cleared_event_description: "{{userTag}} limpió las notas internas del ticket #{{ticketId}}.",
      notes_empty: "Todavía no hay notas en este ticket.",
      notes_list_title: "Notas del ticket — #{{ticketId}} ({{count}}/{{max}})",
      notes_title: "Notas del ticket",
      only_admin_clear_notes: "Solo los administradores pueden limpiar todas las notas del ticket.",
      only_staff_add: "Solo el staff puede agregar usuarios al ticket.",
      only_staff_assign: "Solo el staff puede asignar tickets.",
      only_staff_brief: "Solo el staff puede ver el case brief.",
      only_staff_claim: "Solo el staff puede reclamar tickets.",
      only_staff_close: "Solo el staff puede cerrar tickets.",
      only_staff_info: "Solo el staff puede ver los detalles del ticket.",
      only_staff_move: "Solo el staff puede mover tickets.",
      only_staff_notes: "Solo el staff puede ver o agregar notas.",
      only_staff_other_history: "Solo el staff puede ver el historial de otro usuario.",
      only_staff_priority: "Solo el staff puede cambiar la prioridad del ticket.",
      only_staff_remove: "Solo el staff puede quitar usuarios del ticket.",
      only_staff_rename: "Solo el staff puede renombrar tickets.",
      only_staff_reopen: "Solo el staff puede reabrir tickets.",
      only_staff_transcript: "Solo el staff puede generar transcripciones.",
      priority_event_description: "{{userTag}} cambió la prioridad del ticket #{{ticketId}} a {{label}}.",
      priority_event_title: "Prioridad actualizada",
      priority_updated: "Prioridad actualizada a **{{label}}**",
      release_denied: "No tienes permiso para liberar este ticket.",
      rename_event_description: "{{userTag}} renombró el ticket #{{ticketId}} a {{name}}.",
      rename_event_title: "Canal renombrado",
      transcript_failed: "No se pudo generar la transcripción.",
      transcript_generated: "Transcripción generada.",
      unknown_subcommand: "Subcomando de ticket desconocido.",
      valid_channel_name: "Proporciona un nombre de canal válido."
    },
    create_errors: {
      duplicate_number: "Hubo un conflicto interno al numerar el ticket. Inténtalo de nuevo.",
      generic: "Ocurrió un error al crear el ticket. Verifica mis permisos o contacta a un administrador.",
      missing_permissions: "No tengo permisos suficientes para crear o preparar el canal del ticket.",
      reserve_number: "No pude reservar un número interno para el ticket. Inténtalo de nuevo en unos segundos."
    },
    create_flow: {
      auto_escalation_applied: "Pro: Escalamiento Inteligente aplicado (Prioridad: Urgente)",
      blacklisted: "Estás en blacklist.\n**Motivo:** {{reason}}",
      category_not_found: "Categoría no encontrada.",
      control_panel_failed: "No se pudo enviar el panel de control.",
      cooldown: "Espera **{{minutes}} minuto(s)** antes de abrir otro ticket.",
      created_success_description: "Tu ticket ha sido creado: <#{{channelId}}> | **#{{ticketId}}**\n\nVe al canal para continuar tu solicitud.{{warningText}}",
      created_success_title: "Ticket creado correctamente",
      dm_created_description: "Tu ticket **#{{ticketId}}** ha sido creado en **{{guild}}**.\nCanal: <#{{channelId}}>\n\nTe avisaremos cuando el staff responda.",
      dm_created_title: "Ticket creado",
      duplicate_request: "Ya se está procesando una solicitud de creación de ticket para ti. Espera unos segundos.",
      general_category: "General",
      global_limit: "Este servidor alcanzó el límite global de **{{limit}}** tickets abiertos. Espera a que se libere espacio.",
      invalid_form: "El formulario no es válido. Amplía la primera respuesta.",
      min_days_required: "Debes llevar al menos **{{days}} día(s)** en el servidor para abrir un ticket.",
      missing_permissions: "No tengo los permisos necesarios para crear tickets.\n\nPermisos requeridos: Manage Channels, View Channel, Send Messages, Manage Roles.",
      pending_ratings_description: "Tienes **{{count}}** ticket(s) cerrados esperando una calificación:\n\n{{tickets}}\n\n**¿Por qué importa calificar?**\nTu feedback nos ayuda a mejorar el servicio y es obligatorio antes de abrir nuevos tickets.\n\n**Revisa tus DMs** para encontrar los prompts pendientes.\nSi no los encuentras, usa el botón de abajo para reenviarlos.",
      pending_ratings_footer: "TON618 Tickets - Sistema de calificación",
      pending_ratings_title: "Calificaciones de tickets pendientes",
      question_fallback: "Pregunta {{index}}",
      resend_ratings_button: "Reenviar solicitudes de calificación",
      self_permissions_error: "No pude verificar mis permisos en este servidor.",
      submitted_form: "Formulario enviado",
      system_not_configured_description: "El sistema de tickets no está configurado correctamente.\n\n**Problema:** no hay categorías de tickets configuradas.\n\n**Solución:** un administrador debe crear categorías con:\n`/config category add`\n\nContacta al equipo de administración del servidor para resolver este problema.",
      system_not_configured_footer: "TON618 Tickets - Error de configuración",
      system_not_configured_title: "Sistema de tickets no configurado",
      user_limit: "Ya tienes **{{openCount}}/{{maxPerUser}}** tickets abiertos{{suffix}}",
      verify_role_required: "Necesitas el rol <@&{{roleId}}> para abrir tickets.",
      welcome_message_failed: "No se pudo enviar el mensaje de bienvenida."
    },
    defaults: {
      control_panel_description: "Este es el panel de control del ticket **{ticket}**.\nUsa los controles de abajo para gestionarlo.",
      control_panel_footer: "{guild} • TON618 Tickets",
      control_panel_title: "Panel de Control del Ticket",
      public_panel_description: "Abre un ticket privado seleccionando la categoría que mejor encaje con tu solicitud.",
      public_panel_footer: "{guild} • Soporte profesional",
      public_panel_title: "¿Necesitas ayuda? Estamos aquí para ti.",
      welcome_message: "Hola {user}, tu ticket **{ticket}** ha sido creado. Comparte todos los detalles posibles."
    },
    error_label: "Error",
    events: {
      assigned_dashboard: "Ticket asignado desde dashboard",
      assigned_dashboard_desc: "{{actor}} se asignó el ticket #{{id}}.",
      claimed: "Ticket reclamado",
      claimed_dashboard: "Ticket reclamado desde dashboard",
      claimed_dashboard_desc: "{{actor}} reclamó el ticket #{{id}} desde la dashboard.",
      claimed_desc: "{{actor}} tomó este ticket desde la dashboard.",
      closed: "Ticket cerrado",
      closed_dashboard: "Ticket cerrado desde dashboard",
      closed_dashboard_desc: "{{actor}} cerró el ticket #{{id}} desde la dashboard.",
      closed_desc: "{{actor}} cerró este ticket desde la dashboard.\nMotivo: {{reason}}",
      footer_bridge: "TON618 · Inbox operativa",
      internal_note: "Nota interna agregada",
      internal_note_desc: "{{actor}} agregó una nota interna desde la dashboard.",
      macro_sent: "Macro enviada",
      macro_sent_desc: "{{actor}} envió la macro {{macro}} desde la dashboard.",
      no_details: "Sin detalles adicionales.",
      priority_updated: "Prioridad actualizada",
      priority_updated_desc: "{{actor}} cambió la prioridad del ticket #{{id}} a {{priority}}.",
      recommendation_confirmed: "Recomendación confirmada",
      recommendation_confirmed_desc: "{{actor}} confirmó una recomendación operativa desde la dashboard.",
      recommendation_discarded: "Recomendación descartada",
      recommendation_discarded_desc: "{{actor}} descartó una recomendación operativa desde la dashboard.",
      released_dashboard: "Ticket liberado desde dashboard",
      released_dashboard_desc: "{{actor}} liberó el ticket #{{id}} desde la dashboard.",
      reopened: "Ticket reabierto",
      reopened_dashboard: "Ticket reabierto desde dashboard",
      reopened_dashboard_desc: "{{actor}} reabrió el ticket #{{id}} desde la dashboard.",
      reopened_desc: "{{actor}} reabrió este ticket desde la dashboard.",
      reply_sent: "Respuesta enviada",
      reply_sent_desc: "{{actor}} respondió al cliente desde la dashboard.",
      reply_sent_title: "Respuesta desde la dashboard",
      status_attending: "En Atención",
      status_searching: "Buscando Staff",
      status_updated: "Estado operativo actualizado",
      status_updated_desc: "{{actor}} cambió el estado del ticket #{{id}} a {{status}}.",
      tag_added: "Tag agregado",
      tag_added_desc: "{{actor}} agregó el tag {{tag}} desde la dashboard.",
      tag_removed: "Tag removido",
      tag_removed_desc: "{{actor}} removió el tag {{tag}} desde la dashboard.",
      unassigned: "Asignación removida",
      unassigned_desc: "{{actor}} removió la asignación del ticket #{{id}}."
    },
    faq: {
      description: "Aquí están las respuestas más comunes que la gente necesita antes de abrir un ticket. Revisarlas rápido puede ahorrarte tiempo de espera.",
      footer: "¿Sigues necesitando ayuda? Elige una categoría en el menú desplegable para abrir un ticket.",
      load_failed: "No pudimos cargar la FAQ ahora mismo. Inténtalo de nuevo más tarde.",
      q1_answer: "Ve a nuestra tienda oficial, o abre un ticket en la categoría **Ventas** si necesitas ayuda paso a paso.",
      q1_question: "¿Cómo compro un producto o membresía?",
      q2_answer: "Abre un ticket de **Soporte / Facturación** e incluye tu comprobante de pago más el ID de transacción para que el equipo lo revise.",
      q2_question: "¿Cómo solicito un reembolso?",
      q3_answer: "Para que un reporte sea válido, incluye capturas o videos claros y explica la situación en un ticket de **Reportes**.",
      q3_question: "Quiero reportar a un usuario",
      q4_answer: "Las solicitudes de partnership se gestionan por tickets de **Partnership**. Asegúrate de cumplir primero los requisitos mínimos.",
      q4_question: "Quiero aplicar para una partnership",
      title: "Preguntas frecuentes"
    },
    field_assigned_to: "Asignado a",
    field_category: "Categoría",
    field_priority: "Prioridad",
    footer: "TON618 Tickets",
    labels: {
      assigned: "Asignado",
      category: "Categoría",
      claimed: "Reclamado",
      priority: "Prioridad",
      status: "Estado"
    },
    lifecycle: {
      assign: {
        assign_permissions_error: "Hubo un error al dar permisos al miembro del staff asignado: {{error}}",
        bot_denied: "No puedes asignar el ticket a un bot.",
        closed_ticket: "No puedes asignar un ticket cerrado.",
        creator_denied: "No puedes asignar el ticket al usuario que lo creó.",
        database_error: "Hubo un error al actualizar el ticket en la base de datos.",
        dm_description: "Se te asignó el ticket **#{{ticketId}}** en **{{guild}}**.\n\n**{{categoryLabel}}:** {{category}}\n**Usuario:** <@{{userId}}>\n**Canal:** [Ir al ticket]({{channelLink}})\n\nPor favor revísalo lo antes posible.",
        dm_line: "\n\nSe notificó al miembro del staff por DM.",
        dm_title: "Ticket asignado",
        dm_warning: "No se pudo notificar al miembro del staff por DM (DMs desactivados).",
        event_description: "{{userTag}} asignó el ticket #{{ticketId}} a {{staffTag}}.",
        invalid_assignee: "Solo puedes asignar el ticket a miembros del staff (rol de soporte o administrador).",
        log_assigned_by: "Asignado por",
        log_assigned_to: "Asignado a",
        manage_channels_required: "Necesito el permiso `Manage Channels` para asignar tickets.",
        result_description: "El ticket **#{{ticketId}}** fue asignado a <@{{staffId}}>.{{dmLine}}{{warningLine}}",
        result_title: "Ticket asignado",
        staff_member_missing: "No pude encontrar a ese miembro del staff en este servidor.",
        staff_only: "Solo el staff puede asignar tickets.",
        verify_permissions: "No pude verificar mis permisos en este servidor."
      },
      claim: {
        already_claimed_other: "Ya fue reclamado por <@{{userId}}>. Usa `/ticket unclaim` primero.",
        already_claimed_self: "Ya reclamaste este ticket.",
        claimed_during_request: "Este ticket fue reclamado por <@{{userId}}> mientras se procesaba tu solicitud.",
        closed_ticket: "No puedes reclamar un ticket cerrado.",
        database_error: "Hubo un error al actualizar el ticket en la base de datos. Intenta de nuevo.",
        dm_description: "Tu ticket **#{{ticketId}}** en **{{guild}}** ya tiene un miembro del staff asignado.\n\n**Staff asignado:** {{staff}}\n**{{categoryLabel}}:** {{category}}\n**Canal:** [Ir al ticket]({{channelLink}})\n\nUsa el enlace de arriba para entrar directamente al ticket y continuar la conversación.",
        dm_line: "\n\nSe notificó al usuario por DM.",
        dm_title: "Tu ticket ya está siendo atendido",
        event_description: "{{userTag}} reclamó el ticket #{{ticketId}}.",
        log_claimed_by: "Reclamado por",
        manage_channels_required: "Necesito el permiso `Manage Channels` para reclamar este ticket.",
        result_description: "Reclamaste el ticket **#{{ticketId}}** correctamente.{{dmLine}}{{warningBlock}}",
        result_title: "Ticket reclamado",
        staff_only: "Solo el staff puede reclamar tickets.",
        verify_permissions: "No pude verificar mis permisos en este servidor.",
        warning_dm: "No se pudo notificar al usuario por DM (DMs desactivados).",
        warning_permissions: "Tus permisos no pudieron actualizarse completamente."
      },
      close: {
        already_closed: "Este ticket ya esta cerrado.",
        already_closed_during_request: "Este ticket ya fue cerrado mientras se procesaba tu solicitud.",
        database_error: "Hubo un error al cerrar el ticket en la base de datos. Intenta de nuevo.",
        delete_reason: "Ticket cerrado",
        dm_field_category: "Categoría",
        dm_field_closed: "Fecha de cierre",
        dm_field_duration: "Duración total",
        dm_field_handled_by: "Atendido por",
        dm_field_messages: "Mensajes",
        dm_field_opened: "Fecha de apertura",
        dm_field_reason: "Razón de cierre",
        dm_field_ticket: "Ticket",
        dm_field_transcript: "Transcripcion en linea",
        dm_footer: "Gracias por confiar en nuestro soporte - TON618 Tickets",
        dm_no_reason: "No se proporciono una razón",
        dm_receipt_description: "Gracias por contactar con nuestro equipo de soporte. Aqui tienes un resumen de tu ticket.",
        dm_receipt_title: "Recibo de soporte",
        dm_transcript_link: "Ver transcripcion completa",
        dm_warning_description: "No se pudo enviar el mensaje de cierre por DM a <@{{userId}}>.\n\n**Posible causa:** el usuario tiene los mensajes directos cerrados o ha bloqueado al bot.\n\n**Ticket:** #{{ticketId}}",
        dm_warning_title: "Aviso: DM no enviado",
        dm_warning_transcript: "Transcripcion disponible",
        dm_warning_unavailable: "No disponible",
        event_description: "{{userTag}} cerro el ticket #{{ticketId}}.",
        event_title: "Ticket cerrado",
        log_duration: "Duración",
        log_reason: "Razón",
        log_transcript: "Transcripcion",
        log_unavailable: "No disponible",
        log_user: "Usuario",
        manage_channels_required: "Necesito el permiso `Manage Channels` para cerrar este ticket.",
        result_closed_description: "El ticket ya fue cerrado, pero el canal permanecera disponible hasta que la transcripcion pueda archivarse de forma segura.",
        result_closed_title: "Ticket cerrado",
        result_closing_description: "Este ticket se eliminara en **{{seconds}} segundos**.\n\n{{dmStatus}}",
        result_closing_title: "Cerrando ticket",
        result_dm_failed: "No se pudo notificar al usuario por DM.",
        result_dm_sent: "Se envio un resumen al usuario por mensaje directo.",
        transcript_channel_missing: "No hay un canal de transcripciones configurado. El canal permanecera cerrado y no se eliminara automaticamente.",
        transcript_channel_unavailable: "El canal de transcripciones configurado no existe o no es accesible. El canal no se eliminara automaticamente.",
        transcript_closed_unavailable: "No disponible",
        transcript_closed_unknown: "Desconocido",
        transcript_embed_title: "Transcripcion de ticket",
        transcript_field_closed: "Cerrado",
        transcript_field_duration: "Duración",
        transcript_field_messages: "Mensajes",
        transcript_field_rating: "Calificacion",
        transcript_field_staff: "Staff",
        transcript_field_user: "Usuario",
        transcript_generate_error: "Ocurrio un error al generar la transcripcion. El canal permanecera cerrado para evitar perdida de historial.",
        transcript_generate_failed: "No se pudo generar la transcripcion. El canal permanecera cerrado para evitar perdida de historial.",
        transcript_rating_none: "Sin calificar",
        transcript_send_failed: "No se pudo enviar la transcripcion al canal configurado. El canal no se eliminara automaticamente.",
        verify_permissions: "No pude verificar mis permisos en este servidor.",
        warning_channel_not_deleted: "El canal no se eliminara automaticamente hasta que la transcripcion quede archivada de forma segura.",
        warning_dm_failed: "No se pudo enviar DM al usuario."
      },
      members: {
        add: {
          bot_denied: "No puedes agregar bots al ticket.",
          closed_ticket: "No puedes agregar usuarios a un ticket cerrado.",
          creator_denied: "Ese usuario ya es el creador del ticket.",
          event_description: "{{userTag}} agregó a {{targetTag}} al ticket #{{ticketId}}.",
          event_title: "Usuario agregado",
          manage_channels_required: "Necesito el permiso `Manage Channels` para agregar usuarios.",
          permissions_error: "Hubo un error al dar permisos al usuario: {{error}}",
          result_description: "<@{{userId}}> fue agregado al ticket y ahora puede ver el canal.",
          result_title: "Usuario agregado",
          verify_permissions: "No pude verificar mis permisos en este servidor."
        },
        move: {
          already_in_category: "El ticket ya esta en esta categoría.",
          category_not_found: "Categoría no encontrada.",
          closed_ticket: "No puedes mover un ticket cerrado.",
          database_error: "Hubo un error al actualizar la categoría del ticket en la base de datos.",
          event_description: "{{userTag}} movió el ticket #{{ticketId}} de {{from}} a {{to}}.",
          event_title: "Categoría actualizada",
          log_new: "Nueva",
          log_previous: "Anterior",
          log_priority: "Prioridad actualizada",
          manage_channels_required: "Necesito el permiso `Manage Channels` para mover tickets.",
          result_description: "Ticket movido de **{{from}}** -> **{{to}}**\n\n**Nueva prioridad:** {{priority}}",
          result_title: "Categoría cambiada",
          verify_permissions: "No pude verificar mis permisos en este servidor."
        },
        remove: {
          admin_role_denied: "No puedes quitar el rol de administrador del ticket.",
          bot_denied: "No puedes quitar al bot del ticket.",
          closed_ticket: "No puedes quitar usuarios de un ticket cerrado.",
          creator_denied: "No puedes quitar al creador del ticket.",
          event_description: "{{userTag}} quitó a {{targetTag}} del ticket #{{ticketId}}.",
          event_title: "Usuario quitado",
          manage_channels_required: "Necesito el permiso `Manage Channels` para quitar usuarios.",
          permissions_error: "Hubo un error al quitar permisos al usuario: {{error}}",
          result_description: "<@{{userId}}> fue quitado del ticket y ya no puede verlo.",
          result_title: "Usuario quitado",
          support_role_denied: "No puedes quitar el rol de soporte del ticket.",
          verify_permissions: "No pude verificar mis permisos en este servidor."
        }
      },
      reopen: {
        already_open: "Este ticket ya esta abierto.",
        database_error: "Hubo un error al reabrir el ticket en la base de datos.",
        dm_description: "Tu ticket **#{{ticketId}}** en **{{guild}}** fue reabierto por {{staff}}.\n\n**Canal:** [Ir al ticket]({{channelLink}})\n\nYa puedes volver al canal y continuar la conversacion.",
        dm_line: "\nSe notifico al usuario por DM.",
        dm_title: "Ticket reabierto",
        dm_warning: "No se pudo notificar al usuario por DM (puede tener los DMs desactivados).",
        manage_channels_required: "Necesito el permiso `Manage Channels` para reabrir este ticket.",
        reopened_during_request: "Este ticket ya fue reabierto mientras se procesaba tu solicitud.",
        result_description: "El ticket **#{{ticketId}}** fue reabierto correctamente.\n\n**Total de reaperturas:** {{count}}{{dmLine}}{{warningLine}}",
        log_reopened_by: "Reabierto por",
        log_reopens: "Total de reaperturas",
        result_title: "Ticket reabierto",
        user_missing: "No pude encontrar al usuario que creó este ticket.",
        verify_permissions: "No pude verificar mis permisos en este servidor.",
        warning_line: "\n\nAviso: {{warning}}"
      },
      unclaim: {
        closed_ticket: "No puedes liberar un ticket cerrado.",
        database_error: "Hubo un error al actualizar el ticket en la base de datos.",
        denied: "Solo quien reclamo el ticket o un administrador puede liberarlo.",
        event_description: "{{userTag}} liberó el ticket #{{ticketId}}.",
        log_previous_claimer: "Anteriormente reclamado por",
        log_released_by: "Liberado por",
        not_claimed: "Este ticket no esta reclamado.",
        result_description: "El ticket fue liberado. Cualquier miembro del staff puede reclamarlo ahora.{{warningLine}}",
        result_title: "Ticket liberado",
        warning_permissions: "Algunos permisos no pudieron restaurarse completamente."
      }
    },
    maintenance: {
      description: "El sistema de tickets está temporalmente desactivado.\n\n**Motivo:** {{reason}}\n\nPor favor vuelve más tarde.",
      scheduled: "Mantenimiento programado",
      title: "Sistema en mantenimiento",
      default: "El sistema de tickets está actualmente en mantenimiento. Por favor intenta de nuevo más tarde."
    },
    priorities: {
      low: "🟢 Baja",
      normal: "🔵 Normal",
      high: "🟡 Alta",
      urgent: "🔴 Urgente"
    },
    modal: {
      category_unavailable: "Esta categoría de ticket ya no está disponible. Vuelve a empezar.",
      default_question: "¿Cómo podemos ayudarte?",
      first_answer_short: "Tu primera respuesta es demasiado corta. Agrega más contexto antes de crear el ticket.",
      placeholder_answer: "Escribe tu respuesta aquí...",
      placeholder_detailed: "Describe tu problema con el mayor detalle posible..."
    },
    questions: {
      billing: {
        "0": "¿Cuál es el problema de facturación?",
        "1": "¿Cuál es tu ID de transacción o factura?",
        "2": "¿Qué método de pago usaste?"
      },
      bug: {
        "0": "¿Qué salió mal?",
        "1": "¿Cómo podemos reproducirlo?",
        "2": "¿Qué dispositivo, navegador o plataforma estás usando?"
      },
      other: {
        "0": "¿Cómo podemos ayudarte hoy?"
      },
      partnership: {
        "0": "¿De qué trata tu servidor o proyecto?",
        "1": "¿Qué tan grande es tu comunidad?",
        "2": "¿Qué tipo de partnership estás proponiendo?"
      },
      report: {
        "0": "¿A quién estás reportando?",
        "1": "¿Qué pasó?",
        "2": "¿Tienes evidencia para compartir?"
      },
      staff: {
        "0": "¿Cuál es tu edad y experiencia en moderación/soporte?",
        "1": "¿Por qué quieres unirte al equipo?",
        "2": "¿Cuántas horas por semana estás disponible?",
        "3": "¿Cuál es tu zona horaria?"
      },
      support: {
        "0": "¿Qué problema estás enfrentando?",
        "1": "¿Cuándo empezó a ocurrir?",
        "2": "¿Qué has intentado hasta ahora?"
      }
    },
    move_select: {
      move_failed: "No pude mover el ticket en este momento. Inténtalo de nuevo más tarde."
    },
    options: {
      ticket_add_user_user: "Usuario para agregar al ticket",
      ticket_assign_staff_staff: "Miembro del personal que será responsable del ticket",
      ticket_close_reason_reason: "Razón para cerrar el ticket",
      ticket_history_user_user: "Miembro cuyo historial de tickets deseas inspeccionar",
      ticket_note_add_note_note: "Contenido de la nota interna",
      "ticket_playbook_apply-macro_recommendation_recommendation": "ID de recomendación",
      ticket_playbook_confirm_recommendation_recommendation: "ID de recomendación",
      ticket_playbook_disable_playbook_playbook: "Nombre del playbook",
      ticket_playbook_dismiss_recommendation_recommendation: "ID de recomendación",
      ticket_playbook_enable_playbook_playbook: "Nombre del playbook",
      ticket_priority_level_level: "Nuevo nivel de prioridad",
      ticket_remove_user_user: "Usuario para eliminar del ticket",
      ticket_rename_name_name: "Nuevo nombre del canal"
    },
    panel: {
      categories_cta: "👇 **Selecciona una categoría** para crear tu ticket",
      categories_heading: "Elige una categoría",
      default_category: "Soporte General",
      default_description: "Ayuda con temas generales",
      faq_button: "FAQ",
      queue_name: "📊 Cola actual",
      queue_value: "🎫 Actualmente tenemos `{{openTicketCount}}` ticket(s) activo(s)\n⏱️ Te responderemos lo antes posible",
      title: "🎫 Centro de Soporte",
      description: "👋 **¡Bienvenido al sistema de tickets!**\n\nSelecciona la categoría que mejor describa tu problema:\n\n📋 **Antes de abrir un ticket:**\n• Lee las reglas del servidor\n• Revisa el FAQ o canales de anuncios\n• Sé específico e incluye detalles útiles\n\n⏰ **Tiempo de respuesta:** Generalmente menos de 24h\n💬 **¿Necesitas ayuda?** Usa el panel de abajo 👇",
      footer: "🎫 TON618 Tickets v3.0 • Soporte rápido",
      author_name: "🎫 Centro de Soporte",
      no_categories_title: "⚠️ No hay categorías configuradas",
      no_categories_description: "No hay categorías de tickets disponibles. Un administrador debe configurar al menos una categoría."
    },
    picker: {
      access_denied_description: "No puedes crear tickets ahora mismo.\n**Motivo:** {{reason}}",
      access_denied_footer: "Si crees que esto es un error, contacta a un administrador.",
      access_denied_title: "Acceso denegado",
      category_missing: "Esa categoría no se encontró o no está disponible ahora mismo. Elige otra opción.",
      cooldown: "Espera **{{minutes}} minuto(s)** antes de abrir otro ticket.\n\nEste cooldown ayuda al equipo a gestionar mejor las solicitudes entrantes.",
      limit_reached_description: "Ya tienes **{{openCount}}/{{maxTickets}}** tickets abiertos.\n\n**Tus tickets activos:**\n{{ticketList}}\n\nCierra uno de tus tickets actuales antes de abrir uno nuevo.",
      limit_reached_title: "Límite de tickets alcanzado",
      min_days: "Debes llevar al menos **{{days}} día(s)** en el servidor para abrir un ticket.\n\nTiempo actual en el servidor: **{{currentDays}} día(s)**",
      no_categories: "No hay categorías de tickets configuradas para este servidor.",
      pending_ratings_description: "Tienes **{{count}}** ticket(s) cerrados esperando una calificación:\n\n{{tickets}}\n\n**¿Por qué importa calificar?**\nTu feedback nos ayuda a mejorar el servicio y es obligatorio antes de abrir nuevos tickets.\n\n**Revisa tus DMs** para encontrar los prompts pendientes.\nSi no los encuentras, usa el botón de abajo para reenviarlos.",
      pending_ratings_footer: "TON618 Tickets - Sistema de calificación",
      pending_ratings_title: "Calificaciones de tickets pendientes",
      processing_error: "Ocurrió un error mientras se preparaba el formulario del ticket. Intenta de nuevo más tarde.",
      resend_ratings_button: "Reenviar solicitudes de calificación",
      select_description: "👇 **Selecciona la categoría** que mejor describa tu problema\n\nCada categoría enruta tu solicitud al equipo correcto para ayudarte más rápido.",
      select_placeholder: "🎫 Elige una categoría...",
      select_title: "🎫 Crear nuevo ticket"
    },
    playbook: {
      apply_macro_description: "Aplicar una macro de playbook manualmente",
      confirm_description: "Confirmar y aplicar una recomendación de playbook",
      disable_description: "Desactivar un playbook para este servidor",
      dismiss_description: "Descartar una recomendación de playbook",
      enable_description: "Activar un playbook para este servidor",
      group_description: "Gestionar recomendaciones de playbook",
      list_description: "Listar recomendaciones activas de playbook",
      option_playbook: "Nombre del playbook",
      option_recommendation: "ID de recomendación"
    },
    priority: {
      high: "Alta",
      low: "Baja",
      normal: "Normal",
      urgent: "Urgente"
    },
    workflow: {
      assigned: "Asignado",
      closed: "Cerrado",
      open: "Abierto",
      triage: "En revisión",
      waiting_staff: "Esperando al staff",
      waiting_user: "Esperando al usuario"
    },
    field_names: {
      "Claimed by": "Reclamado por",
      "Assigned to": "Asignado a",
      Priority: "Prioridad",
      Status: "Estado",
      Category: "Categoría"
    },
    quick_actions: {
      placeholder: "Acciones rápidas de staff...",
      priority_high: "Prioridad: Alta",
      priority_low: "Prioridad: Baja",
      priority_normal: "Prioridad: Normal",
      priority_urgent: "Prioridad: Urgente",
      status_pending: "Estado: Esperando al usuario",
      status_review: "Estado: En revisión",
      status_wait: "Estado: Esperando al staff"
    },
    quick_feedback: {
      add_staff_prompt: "Menciona al miembro del staff que quieres agregar a este ticket.",
      closed: "Las acciones rápidas no están disponibles en tickets cerrados.",
      not_found: "No se encontró la información del ticket.",
      only_staff: "Solo el staff puede usar estas acciones.",
      priority_event_description: "{{userTag}} actualizó la prioridad del ticket #{{ticketId}} a {{priority}} desde acciones rápidas.",
      priority_event_title: "Prioridad actualizada",
      priority_updated: "La prioridad del ticket se actualizó a **{{label}}** por <@{{userId}}>.",
      processing_error: "Ocurrió un error mientras se procesaba esta acción.",
      unknown_action: "Acción desconocida.",
      workflow_event_description: "{{userTag}} actualizó el estado operativo del ticket #{{ticketId}} a {{status}} desde acciones rápidas.",
      workflow_event_title: "Estado operativo actualizado",
      workflow_updated: "El estado del ticket se actualizó a **{{label}}** por <@{{userId}}>."
    },
    rating: {
      already_recorded_description: "Ya calificaste este ticket con **{{rating}} estrella(s)**.",
      already_recorded_processing: "Este ticket fue calificado mientras se procesaba tu respuesta.",
      already_recorded_title: "Calificación ya registrada",
      event_description: "{{userTag}} calificó el ticket #{{ticketId}} con {{rating}}/5.",
      event_title: "Calificación recibida",
      invalid_identifier_description: "El identificador de esta solicitud de calificación no es válido.",
      invalid_identifier_title: "No se pudo guardar tu calificación",
      invalid_value_description: "Selecciona una puntuación entre 1 y 5 estrellas.",
      invalid_value_title: "Calificación inválida",
      not_found_description: "No pude encontrar el ticket vinculado a esta solicitud de calificación.",
      not_found_title: "Ticket no encontrado",
      prompt_category_fallback: "General",
      prompt_description: "Hola <@{{userId}}>, tu ticket **#{{ticketId}}** ha sido cerrado.\n\n**Calificación obligatoria:** debes calificar este ticket antes de abrir nuevos tickets en el futuro.\n\nTu feedback nos ayuda a mejorar el servicio y mantener una experiencia de soporte sólida.",
      prompt_footer: "Tu opinión nos importa",
      prompt_option_1_description: "El soporte no cumplió mis expectativas",
      prompt_option_1_label: "1 estrella",
      prompt_option_2_description: "El soporte fue aceptable pero necesita mejorar",
      prompt_option_2_label: "2 estrellas",
      prompt_option_3_description: "El soporte fue sólido y aceptable",
      prompt_option_3_label: "3 estrellas",
      prompt_option_4_description: "El soporte fue muy profesional",
      prompt_option_4_label: "4 estrellas",
      prompt_option_5_description: "El soporte superó mis expectativas",
      prompt_option_5_label: "5 estrellas",
      prompt_placeholder: "Selecciona una calificación...",
      prompt_staff_label: "Miembro del staff",
      prompt_title: "Califica el soporte que recibiste",
      resend_clear: "**Todo al día.**\n\nYa no tienes calificaciones de tickets pendientes.\nPuedes abrir un nuevo ticket cuando lo necesites.",
      resend_error: "Ocurrió un error al reenviar las solicitudes de calificación. Inténtalo de nuevo más tarde.",
      resend_failed: "**No se pudieron reenviar las solicitudes de calificación**\n\nAsegúrate de tener los DMs abiertos e inténtalo otra vez.",
      resend_partial_warning: "Aviso: no se pudieron reenviar {{failCount}} solicitud(es).",
      resend_sent: "**Solicitudes de calificación reenviadas**\n\nReenviamos **{{successCount}}** solicitud(es) de calificación a tus DMs.\n\n**Revisa tus DMs** para calificar los tickets pendientes.{{warning}}",
      resend_wrong_user: "Este botón solo puede usarlo el usuario correspondiente.",
      save_failed_description: "Ocurrió un error inesperado. Inténtalo de nuevo más tarde.",
      save_failed_title: "No se pudo guardar tu calificación",
      thanks_description: "Calificaste la experiencia de soporte con **{{rating}} estrella(s)**.\n\nTu feedback se registró correctamente y nos ayuda a mejorar el servicio.",
      thanks_title: "Gracias por tu calificación",
      unavailable_description: "Solo el creador de este ticket puede enviar esta calificación.",
      unavailable_title: "Calificación no disponible"
    },
    slash: {
      choices: {
        priority: {
          high: "Alta",
          low: "Baja",
          normal: "Normal",
          urgent: "Urgente"
        },
        categories: {
          support: {
            label: "Soporte General",
            description: "Ayuda con problemas generales",
            welcome: "¡Hola {user}! 🛠️\n\nGracias por contactar **Soporte General**.\nUn miembro del equipo te ayudará pronto.\n\n> Por favor describe tu problema con el mayor detalle posible."
          },
          billing: {
            label: "Facturación",
            description: "Pagos, facturas o reembolsos",
            welcome: "¡Hola {user}! 💳\n\nAbriste un ticket de **Facturación**.\n\n> Nunca compartas datos bancarios completos."
          },
          report: {
            label: "Reportar Usuario",
            description: "Reportar comportamiento inapropiado",
            welcome: "¡Hola {user}! 🚨\n\nAbriste un **Reporte de Usuario**.\nEl equipo de moderación lo revisará lo antes posible.\n\n> Incluye cualquier evidencia útil como capturas de pantalla o enlaces."
          },
          partnership: {
            label: "Colaboraciones",
            description: "Solicitudes de colaboración o alianza",
            welcome: "¡Hola {user}! 🤝\n\nAbriste un ticket de **Partnerships**.\nComparte detalles sobre tu servidor, marca o proyecto."
          },
          staff: {
            label: "Aplicación Staff",
            description: "Aplica para unirte al equipo",
            welcome: "¡Hola {user}! ⭐\n\nAbriste una **Aplicación de Staff**.\nResponde honestamente y con suficiente detalle."
          },
          bug: {
            label: "Reportar Bug",
            description: "Reporta un error o flujo roto",
            welcome: "¡Hola {user}! 🐛\n\nAbriste un **Reporte de Bug**.\nDescribe el problema claramente para que podamos reproducirlo."
          },
          other: {
            label: "Otro",
            description: "Cualquier otra cosa",
            welcome: "¡Hola {user}! 📩\n\nAbriste un ticket.\nEl equipo te ayudará pronto."
          }
        },
        panel: {
          title: "🎫 Centro de Soporte",
          description: "Bienvenido al sistema de tickets.\nElige la categoría que mejor coincida con tu solicitud.\n\n**📋 Antes de abrir un ticket:**\n▸ Lee las reglas del servidor\n▸ Revisa el FAQ o canales de anuncios\n▸ Sé específico e incluye detalles útiles\n\n**⏰ Tiempo de respuesta esperado:** generalmente menos de 24h",
          footer: "TON618 Tickets v3.0 • Construido para soporte rápido"
        },
        priorities: {
          low: "🟢 Baja",
          normal: "🔵 Normal",
          high: "🟡 Alta",
          urgent: "🔴 Urgente"
        }
      },
      description: "Gestiona tickets de soporte",
      groups: {
        note: {
          description: "Gestiona las notas internas del ticket",
          options: {
            note: "Contenido de la nota interna"
          },
          subcommands: {
            add: {
              description: "Agrega una nota interna a este ticket"
            },
            clear: {
              description: "Limpia todas las notas internas de este ticket"
            },
            list: {
              description: "Lista las notas internas de este ticket"
            }
          }
        }
      },
      options: {
        add_user: "Usuario que se agregará al ticket",
        assign_staff: "Miembro del staff que tendrá el ticket",
        close_reason: "Motivo para cerrar el ticket",
        history_user: "Miembro cuyo historial quieres revisar",
        priority_level: "Nuevo nivel de prioridad",
        remove_user: "Usuario que se quitará del ticket",
        rename_name: "Nuevo nombre del canal"
      },
      subcommands: {
        add: {
          description: "Agrega un usuario al ticket actual"
        },
        assign: {
          description: "Asigna el ticket actual a un miembro del staff"
        },
        brief: {
          description: "Genera el resumen del caso para este ticket"
        },
        claim: {
          description: "Reclama el ticket actual"
        },
        close: {
          description: "Cierra el ticket actual"
        },
        history: {
          description: "Muestra el historial de tickets de un miembro"
        },
        info: {
          description: "Muestra los detalles del ticket"
        },
        move: {
          description: "Mueve el ticket a otra categoría"
        },
        open: {
          description: "Abre un ticket nuevo"
        },
        priority: {
          description: "Cambia la prioridad del ticket"
        },
        remove: {
          description: "Quita un usuario del ticket actual"
        },
        rename: {
          description: "Renombra el canal del ticket actual"
        },
        reopen: {
          description: "Reabre el ticket actual"
        },
        transcript: {
          description: "Genera la transcripción del ticket"
        },
        unclaim: {
          description: "Libera el ticket actual"
        }
      }
    },
    transcript_button: {
      error: "Hubo un error al generar la transcripción. Por favor, inténtalo de nuevo más tarde.",
      intro: "Aquí está la transcripción manual de este ticket:",
      not_ticket: "No pude generar la transcripción porque este canal ya no está registrado como un ticket.",
      unavailable_now: "No pude generar la transcripción del ticket en este momento."
    }
  },
  "ticket.labels.assigned": "Asignado a",
  "ticket.labels.category": "Categoría",
  "ticket.labels.claimed": "Reclamado por",
  "ticket.labels.priority": "Prioridad",
  "ticket.labels.status": "Estado",
  "ticket.workflow.assigned": "Asignado",
  "ticket.workflow.closed": "Cerrado",
  "ticket.workflow.open": "Abierto",
  "ticket.workflow.triage": "En revisión",
  "ticket.workflow.waiting_staff": "Esperando staff",
  "ticket.workflow.waiting_user": "Esperando usuario"
};
