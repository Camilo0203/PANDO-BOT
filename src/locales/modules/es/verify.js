module.exports = {
  verify: {
    activity: {
      anti_raid: "Anti-raid",
      anti_raid_triggered: "Anti-raid activado",
      force_unverified: "Verificación retirada manualmente",
      force_verified: "Verificado manualmente",
      info: "Información",
      kicked: "Expulsado",
      panel_publish_failed: "Falló la publicación del panel",
      panel_published: "Panel publicado",
      permission_error: "Error de permisos",
      unverified: "Sin verificar",
      unverified_kicked: "Miembro sin verificar expulsado",
      verified: "Verificado"
    },
    audit: {
      completed: "Completed",
      removed: "Removed"
    },
    command: {
      account_age_pro: "Requisito de edad de cuenta mayor a {{max}} días",
      actor: "Responsable",
      anti_raid_disabled: "El anti-raid ahora está **desactivado**.",
      anti_raid_enabled: "El anti-raid ahora está **activado**.\nUmbral: **{{joins}} joins** en **{{seconds}}s**.\nAcción: **{{action}}**.",
      anti_raid_triggers: "Activaciones anti-raid",
      auto_kick_disabled: "El auto-kick para miembros sin verificar ahora está **desactivado**.",
      auto_kick_enabled: "Los miembros sin verificar serán expulsados después de **{{hours}} hora(s)**.",
      captcha_emoji: "Contar emojis",
      captcha_emoji_pro: "Tipo de CAPTCHA con emojis",
      captcha_math: "Matemático",
      captcha_type: "Tipo de CAPTCHA",
      code_sends: "Códigos enviados",
      confirmation_dm: "DM de confirmación",
      dm_updated: "El DM de confirmación de verificación ahora está **{{state}}**.",
      enable_failed: "Todavía no puedo activar la verificación.\n\n{{issues}}",
      enabled_state: "La verificación ahora está **{{state}}**.",
      failed: "Fallidos",
      force_bot: "Los bots no pueden verificarse mediante el flujo de verificación de miembros.",
      force_failed: "No pude verificar a <@{{userId}}>.\n\n{{issues}}",
      force_log_title: "Miembro verificado manualmente",
      force_success: "<@{{userId}}> fue verificado manualmente.{{warningText}}",
      force_unverified: "Desverificados manualmente",
      force_verified: "Verificados manualmente",
      invalid_color: "Color inválido. Usa un valor hexadecimal de 6 caracteres como `57F287`.",
      invalid_image: "La URL de la imagen debe comenzar con `https://`.",
      kicked: "Expulsados",
      logs_permissions: "No puedo usar {{channel}} para los logs de verificación. Permisos faltantes: {{permissions}}.",
      logs_set: "Los logs de verificación se enviarán a {{channel}}.",
      member: "Miembro",
      message_require_one: "Proporciona al menos un campo para actualizar: `title`, `description`, `color` o `image`.",
      message_updated: "Panel de verificación actualizado. {{detail}}",
      min_account_age: "Edad mínima de cuenta",
      mode_changed: "El modo de verificación cambió a **{{mode}}**. {{detail}}",
      mode_failed: "Todavía no puedo cambiar a **{{mode}}**.\n\n{{issues}}",
      note_question_mode: "El modo pregunta está activo. Usa `/verify question` si quieres reemplazar el desafío por defecto.",
      note_ticket_role_aligned: "El rol mínimo de verificación para tickets se alineó automáticamente porque no estaba configurado.",
      operational_health: "Salud operativa",
      panel_publish_failed: "El panel de verificación no pudo publicarse.\n\n{{issues}}",
      panel_published: "Panel de verificación publicado.",
      panel_refreshed: "Panel de verificación actualizado.",
      panel_saved_but_not_published: "La configuración de verificación se guardó, pero el panel no pudo publicarse.\n\n{{issues}}",
      pending_members: "Miembros pendientes",
      permission_errors: "Errores de permisos",
      pool_added: "Pregunta agregada: **{{question}}...**\nTotal de preguntas: {{total}}",
      pool_cleared: "Se eliminaron {{count}} pregunta(s) del pool.",
      pool_count: "{{count}} pregunta(s) en el pool",
      pool_empty: "No hay preguntas en el pool todavía.\n\nUsa `/verify question-pool add` para agregar preguntas.",
      pool_footer: "Usa /verify question-pool add para agregar preguntas",
      pool_invalid_index: "Índice inválido. Usa un número entre 1 y {{max}}.",
      pool_max_reached: "Máximo de 20 preguntas alcanzado. Elimina algunas antes de agregar más.",
      pool_pro_feature: "Más de 5 preguntas en el pool",
      pool_removed: "Pregunta eliminada: **{{question}}...**\nRestantes: {{remaining}}",
      pool_title: "Pool de Preguntas",
      question_prompts: "Prompts de pregunta",
      question_updated: "Pregunta de verificación actualizada.",
      raid_action: "Acción anti-raid",
      raid_threshold: "Umbral de raid",
      risk_escalation: "Escalado por riesgo",
      risk_escalation_pro: "Escalado de verificación basado en riesgo",
      security_age_disabled: "Verificación de edad de cuenta **desactivada**",
      security_age_set: "Edad mínima de cuenta establecida en **{{days}} días**",
      security_captcha_set: "Tipo de CAPTCHA establecido a **{{type}}**",
      security_footer: "Usa /verify security con opciones para cambiar la configuración",
      security_risk_disabled: "Escalado basado en riesgo **desactivado**",
      security_risk_enabled: "Escalado basado en riesgo **activado**",
      security_title: "Configuración de Seguridad",
      security_updated: "Configuración de seguridad actualizada:\n{{changes}}",
      setup_failed: "Todavía no puedo completar la configuración.\n\n{{issues}}",
      setup_ready_description: "El sistema de verificación está configurado y el panel en vivo está disponible.",
      setup_ready_title: "Verificación lista",
      starts: "Inicios",
      stats_footer: "Eventos de verificación almacenados: {{total}}",
      stats_title: "Estadísticas de verificación",
      unknown_subcommand: "Subcomando de verificación desconocido.",
      unverify_bot: "Los bots no usan el flujo de verificación de miembros.",
      unverify_failed: "No pude quitar la verificación de <@{{userId}}>.\n\n{{issues}}",
      unverify_log_title: "Miembro desverificado",
      unverify_success: "Se quitó la verificación de <@{{userId}}>.{{warningText}}",
      user_missing: "Ese usuario no está en este servidor.",
      verified: "Verificados",
      verified_members: "Miembros verificados"
    },
    handler: {
      account_too_new: "Tu cuenta de Discord es muy nueva. Las cuentas deben tener al menos {{days}} días de antigüedad para verificarse. Tu cuenta tiene {{currentDays}} días.",
      already_verified: "Ya estás verificado en este servidor.",
      bot_missing_permissions: "El bot no tiene permisos suficientes para verificarte (Gestionar Roles).",
      captcha_invalid: "Respuesta de captcha inválida.",
      captcha_modal_title: "Verificación de seguridad",
      captcha_placeholder: "Escribe tu respuesta",
      captcha_reason_expired: "Tu captcha expiró. Pulsa **Verificarme** para obtener uno nuevo.",
      captcha_reason_no_captcha: "No se encontró un captcha pendiente. Pulsa **Verificarme** para empezar de nuevo.",
      captcha_reason_wrong: "Respuesta incorrecta. Intenta de nuevo.",
      code_dm_description: "Tu código de verificación para **{{guild}}** es:\n\n# `{{code}}`\n\nEste código expira en **10 minutos**.\nVuelve al servidor y pulsa **{{enterCodeLabel}}**.",
      code_dm_title: "Código de verificación",
      code_reason_expired: "Tu código expiró. Pulsa **Verificarme** para generar uno nuevo.",
      code_reason_no_code: "No se encontró un código pendiente. Pulsa **Verificarme** para generar uno nuevo.",
      code_reason_wrong: "Código incorrecto. Intenta otra vez.",
      code_sent_description: "Se envió un código de 8 caracteres a tus mensajes directos.\n\n1. Abre tu bandeja de DMs y copia el código.\n2. Vuelve aquí y pulsa **{{enterCodeLabel}}**.\n\nEl código expira en **10 minutos**.",
      code_sent_footer: "Los reenvíos están limitados. Espera {{seconds}}s antes de pedir otro código.",
      code_sent_title: "Código enviado por DM",
      completed_description: "Bienvenido a **{{guild}}**, <@{{userId}}>. Ahora ya tienes acceso completo al servidor.",
      completed_title: "Verificación completada",
      completion_failed: "No pude completar tu verificación porque la configuración de roles no está operativa.\n\n{{issues}}",
      dm_failed: "No pude enviarte un DM.\n\nActiva los mensajes directos para este servidor y vuelve a intentarlo.",
      enter_code_label: "Código recibido por DM",
      enter_code_placeholder: "Ejemplo: AB1C2D3E",
      enter_code_title: "Ingresa tu código",
      help_attempts: "Después de {{failures}} intentos fallidos, la verificación se pausa durante {{minutes}} minutos.",
      help_attempts_label: "Protección de intentos",
      help_blocked: "Contacta a un administrador del servidor para obtener ayuda manual.",
      help_blocked_label: "¿Sigues bloqueado?",
      help_dm_problems: "Activa los mensajes directos para este servidor y vuelve a intentarlo.",
      help_dm_problems_label: "¿Problemas con DM?",
      help_mode_button: "Pulsa **Verificarme** y el bot te verificará inmediatamente.",
      help_mode_code: "Pulsa **Verificarme**, revisa tu DM para ver el código y luego ingrésalo en el modal.",
      help_mode_question: "Pulsa **Verificarme** y responde correctamente la pregunta de verificación.",
      help_title: "Cómo funciona la verificación",
      incorrect_answer: "Respuesta incorrecta. Lee la pregunta con cuidado e inténtalo de nuevo.{{cooldownText}}",
      invalid_code: "Código de verificación inválido.",
      join_too_recent: "Te uniste muy recientemente. Por favor espera {{retryText}} antes de verificarte.",
      log_verified_title: "Miembro verificado",
      log_warning_none: "Ninguno",
      max_resends_reached: "Has alcanzado el número máximo de reenvíos de código ({{max}}). Por favor espera o contacta a un admin.",
      member_not_found: "No pude encontrar tu perfil de miembro en este servidor.",
      misconfigured: "La verificación está mal configurada en este momento.\n\n{{issues}}",
      mode_invalid: "El modo de verificación no está configurado correctamente.",
      new_code_description: "Tu nuevo código de verificación es:\n\n# `{{code}}`\n\nEste código expira en **10 minutos**.",
      new_code_title: "Nuevo código de verificación",
      not_active: "La verificación no está activa en este servidor.",
      not_code_mode: "Este modo de verificación no usa códigos por DM.",
      question_missing: "No hay una pregunta de verificación configurada. Pide a un admin que ejecute `/verify question`.",
      question_modal_title: "Pregunta de verificación",
      question_placeholder: "Escribe tu respuesta aquí",
      resend_dm_failed: "No pude enviarte un DM. Activa los mensajes directos e inténtalo de nuevo.",
      resend_success: "Se envió un nuevo código de verificación por DM.",
      resend_wait: "Espera antes de pedir otro código. Podrás reintentar {{retryText}}.",
      too_many_attempts: "Demasiados intentos fallidos. Intenta de nuevo {{retryText}}.",
      verified_dm_description: "Te verificaste correctamente en **{{guild}}**.",
      verified_dm_title: "Ya estás verificado"
    },
    info: {
      no_issues: "No se detectaron problemas.",
      protection_footer: "Protección: {{failures}} intentos fallidos -> {{minutes}}m de enfriamiento",
      raid_action_kick: "Expulsar automáticamente",
      raid_action_pause: "Solo alerta",
      title: "Configuración de verificación"
    },
    inspection: {
      answer_missing: "El modo pregunta está activado pero la respuesta esperada está vacía.",
      apply_role_update_failed: "No pude actualizar los roles de verificación.",
      apply_unverified_unmanageable: "No puedo quitar {{role}}. Sube mi rol por encima de él y mantén `Manage Roles` activado.",
      apply_verified_missing: "El rol verificado no está configurado o ya no existe.",
      apply_verified_unmanageable: "No puedo asignar {{role}}. Sube mi rol por encima de él y mantén `Manage Roles` activado.",
      button_mode_antiraid_warning: "El modo botón ofrece protección mínima contra bots. Considera usar el modo 'code' o 'question' con anti-raid activado.",
      channel_deleted: "El canal de verificación configurado ya no existe.",
      channel_missing: "El canal de verificación no está configurado.",
      channel_permissions: "No puedo publicar el panel en {{channel}}. Permisos faltantes: {{permissions}}.",
      log_channel_deleted: "El canal de logs de verificación configurado ya no existe.",
      log_channel_permissions: "No puedo escribir en {{channel}}. Permisos faltantes: {{permissions}}.",
      publish_failed: "No pude enviar o editar el panel de verificación en {{channel}}. Verifica que pueda enviar mensajes y embeds allí.",
      question_missing: "El modo pregunta está activado pero la pregunta de verificación está vacía.",
      revoke_role_update_failed: "No pude actualizar los roles de verificación.",
      revoke_unverified_unmanageable: "No puedo asignar {{role}}. Sube mi rol por encima de él y mantén `Manage Roles` activado.",
      revoke_verified_unmanageable: "No puedo quitar {{role}}. Sube mi rol por encima de él y mantén `Manage Roles` activado.",
      roles_same: "El rol verificado y el rol sin verificar no pueden ser el mismo.",
      unverified_role_deleted: "El rol sin verificar configurado ya no existe.",
      unverified_role_managed: "El rol sin verificar está gestionado por una integración y el bot no puede asignarlo.",
      unverified_role_unmanageable: "No puedo gestionar el rol sin verificar {{role}}. Sube mi rol por encima de él y mantén `Manage Roles` activado.",
      verified_role_deleted: "El rol verificado configurado ya no existe.",
      verified_role_managed: "El rol verificado está gestionado por una integración y el bot no puede asignarlo.",
      verified_role_missing: "El rol verificado no está configurado.",
      verified_role_unmanageable: "No puedo gestionar el rol verificado {{role}}. Sube mi rol por encima de él y mantén `Manage Roles` activado.",
      welcome_autorole_failed: "No pude asignar el auto-rol de bienvenida {{role}}.",
      welcome_autorole_missing: "El auto-rol de bienvenida está configurado pero ya no existe.",
      welcome_autorole_process_failed: "No pude procesar el auto-rol de bienvenida."
    },
    mode: {
      button: "Botón",
      code: "Código por DM",
      question: "Pregunta"
    },
    options: {
      "verify_anti-raid_action_action": "Acción a tomar cuando el anti-raid se active",
      "verify_anti-raid_enabled_enabled": "Si la protección anti-raid permanece habilitada",
      "verify_anti-raid_joins_joins": "Umbral de entradas antes de que el anti-raid se active",
      "verify_anti-raid_seconds_seconds": "Ventana de detección en segundos",
      "verify_auto-kick_hours_hours": "Horas de espera antes de expulsar automáticamente a miembros no verificados",
      verify_dm_enabled_enabled: "Si los MD de confirmación permanecen habilitados",
      verify_enabled_enabled_enabled: "Si la función permanece habilitada",
      verify_force_user_user: "Miembro a verificar manualmente",
      verify_logs_channel_channel: "Canal usado para los registros de verificación",
      verify_message_color_color: "Color del embed en hex sin `#`",
      verify_message_description_description: "Descripción del panel",
      verify_message_image_image: "URL de la imagen para el panel",
      verify_message_title_title: "Título del panel",
      verify_mode_type_type: "Modo de verificación al que cambiar",
      "verify_question-pool_add_answer_answer": "Respuesta esperada",
      "verify_question-pool_add_question_question": "Texto de la pregunta",
      "verify_question-pool_remove_index_index": "Número de elemento del pool para eliminar",
      verify_question_answer_answer: "Respuesta esperada",
      verify_question_prompt_prompt: "Mensaje o pregunta de verificación",
      verify_security_captcha_type_captcha_type: "Tipo de CAPTCHA requerido",
      verify_security_min_account_age_min_account_age: "Edad mínima de cuenta en días",
      verify_security_risk_escalation_risk_escalation: "Si las cuentas de riesgo deberían enfrentar verificaciones más estrictas",
      verify_setup_channel_channel: "Canal de verificación",
      verify_setup_mode_mode: "Modo de verificación a usar",
      verify_setup_unverified_role_unverified_role: "Rol asignado antes de la verificación",
      verify_setup_verified_role_verified_role: "Rol otorgado tras la verificación",
      verify_unverify_user_user: "Miembro a desverificar manualmente"
    },
    panel: {
      description: "Necesitas verificarte antes de acceder al servidor. Pulsa el botón de abajo para comenzar.",
      footer: "{{guild}} • Verificación",
      help_label: "Ayuda",
      start_label: "Verificarme",
      title: "Verificación"
    },
    slash: {
      choices: {
        anti_raid_action: {
          kick: "Expulsar automáticamente",
          pause: "Solo alertar"
        },
        captcha_type: {
          emoji: "Contar emojis",
          math: "Matemático"
        },
        mode: {
          button: "Botón",
          code: "Código por DM",
          question: "Pregunta"
        }
      },
      description: "Configura el sistema de verificación de miembros",
      groups: {
        question_pool: {
          description: "Gestiona el pool aleatorio de preguntas de verificación",
          options: {
            answer: "Respuesta esperada",
            index: "Número del elemento que quieres eliminar",
            question: "Texto de la pregunta"
          },
          subcommands: {
            add: {
              description: "Agrega una pregunta al pool"
            },
            clear: {
              description: "Limpia por completo el pool de preguntas"
            },
            list: {
              description: "Lista el pool actual de preguntas"
            },
            remove: {
              description: "Elimina una pregunta del pool"
            }
          }
        }
      },
      options: {
        action: "Acción al dispararse el anti-raid",
        answer: "Respuesta esperada",
        anti_raid_enabled: "Si la protección anti-raid debe quedar activa",
        captcha_type: "Tipo de CAPTCHA requerido",
        channel: "Canal de verificación",
        color: "Color del embed en hex sin `#`",
        description: "Descripción del panel",
        dm_enabled: "Si el DM de confirmación debe seguir activo",
        enabled: "Si la función debe quedar activa",
        hours: "Horas antes de expulsar miembros sin verificar",
        image: "URL de imagen para el panel",
        joins: "Cantidad de entradas antes de disparar el anti-raid",
        log_channel: "Canal usado para los logs de verificación",
        min_account_age: "Edad mínima de la cuenta en días",
        mode: "Modo de verificación que se usará",
        prompt: "Pregunta o texto del reto",
        risk_escalation: "Si las cuentas riesgosas deben pasar controles más fuertes",
        seconds: "Ventana de detección en segundos",
        title: "Título del panel",
        type: "Modo de verificación al que quieres cambiar",
        unverified_role: "Rol asignado antes de verificar",
        user_unverify: "Miembro al que quieres quitar la verificación",
        user_verify: "Miembro que quieres verificar manualmente",
        verified_role: "Rol que se entrega al verificar"
      },
      subcommands: {
        anti_raid: {
          description: "Configura la protección anti-raid en entradas"
        },
        auto_kick: {
          description: "Configura el tiempo para expulsar miembros sin verificar"
        },
        dm: {
          description: "Activa o desactiva el DM de confirmación de verificación"
        },
        enabled: {
          description: "Activa o desactiva la verificación"
        },
        force: {
          description: "Verifica manualmente a un miembro"
        },
        info: {
          description: "Muestra la configuración actual de verificación"
        },
        logs: {
          description: "Define el canal de logs de verificación"
        },
        message: {
          description: "Personaliza el mensaje del panel de verificación"
        },
        mode: {
          description: "Cambia el modo de verificación"
        },
        panel: {
          description: "Publica o actualiza el panel de verificación"
        },
        question: {
          description: "Actualiza la pregunta y respuesta esperada"
        },
        security: {
          description: "Ajusta edad de cuenta, CAPTCHA y riesgo"
        },
        setup: {
          description: "Configura la verificación con su canal y roles principales"
        },
        stats: {
          description: "Muestra estadísticas de verificación"
        },
        unverify: {
          description: "Quita manualmente la verificación a un miembro"
        }
      }
    }
  },
  "verify.audit.completed": "Verificación completada",
  "verify.audit.removed": "Verificación eliminada"
};
