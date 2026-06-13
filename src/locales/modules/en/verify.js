module.exports = {
  verify: {
    activity: {
      anti_raid: "Anti-raid",
      anti_raid_triggered: "Anti-raid triggered",
      force_unverified: "Verification removed manually",
      force_verified: "Manually verified",
      info: "Info",
      kicked: "Kicked",
      panel_publish_failed: "Panel publish failed",
      panel_published: "Panel published",
      permission_error: "Permission error",
      unverified: "Unverified",
      unverified_kicked: "Unverified member kicked",
      verified: "Verified"
    },
    audit: {
      completed: "Completed",
      removed: "Removed"
    },
    command: {
      account_age_pro: "Account age requirement above {{max}} days",
      actor: "Actor",
      anti_raid_disabled: "Anti-raid is now **disabled**.",
      anti_raid_enabled: "Anti-raid is now **enabled**.\nThreshold: **{{joins}} joins** in **{{seconds}}s**.\nAction: **{{action}}**.",
      anti_raid_triggers: "Anti-raid triggers",
      auto_kick_disabled: "Auto-kick for unverified members is now **disabled**.",
      auto_kick_enabled: "Unverified members will be kicked after **{{hours}} hour(s)**.",
      captcha_emoji: "Emoji count",
      captcha_emoji_pro: "Emoji CAPTCHA type",
      captcha_math: "Math",
      captcha_type: "CAPTCHA type",
      code_sends: "Code sends",
      confirmation_dm: "Confirmation DM",
      dm_updated: "Verification confirmation DM is now **{{state}}**.",
      enable_failed: "I cannot enable verification yet.\n\n{{issues}}",
      enabled_state: "Verification is now **{{state}}**.",
      failed: "Failed",
      force_bot: "Bots cannot be verified through the member verification flow.",
      force_failed: "I could not verify <@{{userId}}>.\n\n{{issues}}",
      force_log_title: "Member force-verified",
      force_success: "<@{{userId}}> was verified manually.{{warningText}}",
      force_unverified: "Force unverified",
      force_verified: "Force verified",
      invalid_color: "Invalid color. Use a 6-character hex value like `57F287`.",
      invalid_image: "Image URL must start with `https://`.",
      kicked: "Kicked",
      logs_permissions: "I cannot use {{channel}} for verification logs. Missing permissions: {{permissions}}.",
      logs_set: "Verification logs will be sent to {{channel}}.",
      member: "Member",
      message_require_one: "Provide at least one field to update: `title`, `description`, `color`, or `image`.",
      message_updated: "Verification panel updated. {{detail}}",
      min_account_age: "Min account age",
      mode_changed: "Verification mode changed to **{{mode}}**. {{detail}}",
      mode_failed: "I cannot switch to **{{mode}}** yet.\n\n{{issues}}",
      note_question_mode: "Question mode is active. Use `/verify question` if you want to replace the default challenge.",
      note_ticket_role_aligned: "Ticket minimum verification role was aligned automatically because it was not set.",
      operational_health: "Operational health",
      panel_publish_failed: "The verification panel could not be published.\n\n{{issues}}",
      panel_published: "Verification panel published.",
      panel_refreshed: "Verification panel refreshed.",
      panel_saved_but_not_published: "The verification configuration was saved, but the panel could not be published.\n\n{{issues}}",
      pending_members: "Pending members",
      permission_errors: "Permission errors",
      pool_added: "Question added: **{{question}}...**\nTotal questions: {{total}}",
      pool_cleared: "Cleared {{count}} question(s) from the pool.",
      pool_count: "{{count}} question(s) in pool",
      pool_empty: "No questions in the pool yet.\n\nUse `/verify question-pool add` to add questions.",
      pool_footer: "Use /verify question-pool add to add questions",
      pool_invalid_index: "Invalid index. Use a number between 1 and {{max}}.",
      pool_max_reached: "Maximum of 20 questions reached. Remove some before adding more.",
      pool_pro_feature: "More than 5 questions in the pool",
      pool_removed: "Question removed: **{{question}}...**\nRemaining: {{remaining}}",
      pool_title: "Question Pool",
      question_prompts: "Question prompts",
      question_updated: "Verification question updated.",
      raid_action: "Raid action",
      raid_threshold: "Raid threshold",
      risk_escalation: "Risk escalation",
      risk_escalation_pro: "Risk-based verification escalation",
      security_age_disabled: "Minimum account age check **disabled**",
      security_age_set: "Minimum account age set to **{{days}} days**",
      security_captcha_set: "CAPTCHA type set to **{{type}}**",
      security_footer: "Use /verify security with options to change settings",
      security_risk_disabled: "Risk-based escalation **disabled**",
      security_risk_enabled: "Risk-based escalation **enabled**",
      security_title: "Security Settings",
      security_updated: "Security settings updated:\n{{changes}}",
      setup_failed: "I cannot finish the setup yet.\n\n{{issues}}",
      setup_ready_description: "The verification system is configured and the live panel is available.",
      setup_ready_title: "Verification Ready",
      starts: "Starts",
      stats_footer: "Stored verification events: {{total}}",
      stats_title: "Verification Stats",
      unknown_subcommand: "Unknown verification subcommand.",
      unverify_bot: "Bots do not use the member verification flow.",
      unverify_failed: "I could not remove verification from <@{{userId}}>.\n\n{{issues}}",
      unverify_log_title: "Member unverified",
      unverify_success: "Verification removed from <@{{userId}}>.{{warningText}}",
      user_missing: "That user is not in this server.",
      verified: "Verified",
      verified_members: "Verified members"
    },
    handler: {
      account_too_new: "Your Discord account is too new. Accounts must be at least {{days}} days old to verify. Your account is {{currentDays}} days old.",
      already_verified: "You are already verified in this server.",
      bot_missing_permissions: "The bot is missing permissions to verify you (Manage Roles).",
      captcha_invalid: "Invalid captcha response.",
      captcha_modal_title: "Security Check",
      captcha_placeholder: "Type your answer",
      captcha_reason_expired: "Your captcha expired. Click **Verify me** to get a new one.",
      captcha_reason_no_captcha: "No pending captcha found. Click **Verify me** to start again.",
      captcha_reason_wrong: "Incorrect answer. Try again.",
      code_dm_description: "Your verification code for **{{guild}}** is:\n\n# `{{code}}`\n\nThis code expires in **10 minutes**.\nReturn to the server and click **{{enterCodeLabel}}**.",
      code_dm_title: "Verification Code",
      code_reason_expired: "Your code expired. Click **Verify me** to generate a new one.",
      code_reason_no_code: "No pending code was found. Click **Verify me** to generate a new one.",
      code_reason_wrong: "Incorrect code. Try again.",
      code_sent_description: "An 8-character code was sent to your direct messages.\n\n1. Open your DM inbox and copy the code.\n2. Return here and click **{{enterCodeLabel}}**.\n\nThe code expires in **10 minutes**.",
      code_sent_footer: "Resends are limited. Wait {{seconds}}s before requesting a new code.",
      code_sent_title: "Code sent by DM",
      completed_description: "Welcome to **{{guild}}**, <@{{userId}}>. You now have full access to the server.",
      completed_title: "Verification completed",
      completion_failed: "I could not finish your verification because the role setup is not operational.\n\n{{issues}}",
      dm_failed: "I could not send you a DM.\n\nEnable direct messages for this server and try again.",
      enter_code_label: "Code received by DM",
      enter_code_placeholder: "Example: AB1C2D3E",
      enter_code_title: "Enter your code",
      help_attempts: "After {{failures}} failed attempts, verification pauses for {{minutes}} minutes.",
      help_attempts_label: "Attempts protection",
      help_blocked: "Contact a server admin for manual help.",
      help_blocked_label: "Still blocked?",
      help_dm_problems: "Enable direct messages for this server and try again.",
      help_dm_problems_label: "DM problems?",
      help_mode_button: "Click **Verify me** and the bot will verify you immediately.",
      help_mode_code: "Click **Verify me**, check your DM inbox for the code, then enter it in the modal.",
      help_mode_question: "Click **Verify me** and answer the verification question correctly.",
      help_title: "How verification works",
      incorrect_answer: "Incorrect answer. Read the question carefully and try again.{{cooldownText}}",
      invalid_code: "Invalid verification code.",
      join_too_recent: "You joined too recently. Please wait {{retryText}} before verifying.",
      log_verified_title: "Member verified",
      log_warning_none: "None",
      max_resends_reached: "You have reached the maximum number of code resends ({{max}}). Please wait or contact an admin.",
      member_not_found: "Your member profile could not be found in this server.",
      misconfigured: "Verification is currently misconfigured.\n\n{{issues}}",
      mode_invalid: "Verification mode is not configured correctly.",
      new_code_description: "Your new verification code is:\n\n# `{{code}}`\n\nThis code expires in **10 minutes**.",
      new_code_title: "New verification code",
      not_active: "Verification is not active in this server.",
      not_code_mode: "This verification mode does not use DM codes.",
      question_missing: "No verification question is configured. Ask an admin to run `/verify question`.",
      question_modal_title: "Verification Question",
      question_placeholder: "Type your answer here",
      resend_dm_failed: "I could not send you a DM. Enable direct messages and try again.",
      resend_success: "A new verification code was sent by DM.",
      resend_wait: "Please wait before requesting another code. You can retry {{retryText}}.",
      too_many_attempts: "Too many failed attempts. Try again {{retryText}}.",
      verified_dm_description: "You were verified successfully in **{{guild}}**.",
      verified_dm_title: "You are verified"
    },
    info: {
      no_issues: "No issues detected.",
      protection_footer: "Protection: {{failures}} failed attempts -> {{minutes}}m cooldown",
      raid_action_kick: "Kick automatically",
      raid_action_pause: "Alert only",
      title: "Verification Configuration"
    },
    inspection: {
      answer_missing: "Question mode is enabled but the expected answer is empty.",
      apply_role_update_failed: "I could not update the verification roles.",
      apply_unverified_unmanageable: "I cannot remove {{role}}. Move my role above it and keep `Manage Roles` enabled.",
      apply_verified_missing: "Verified role is not configured or no longer exists.",
      apply_verified_unmanageable: "I cannot assign {{role}}. Move my role above it and keep `Manage Roles` enabled.",
      button_mode_antiraid_warning: "Button mode offers minimal protection against bots. Consider using 'code' or 'question' mode with anti-raid enabled.",
      channel_deleted: "The configured verification channel no longer exists.",
      channel_missing: "Verification channel is not configured.",
      channel_permissions: "I cannot publish the panel in {{channel}}. Missing permissions: {{permissions}}.",
      log_channel_deleted: "The configured verification log channel no longer exists.",
      log_channel_permissions: "I cannot write to {{channel}}. Missing permissions: {{permissions}}.",
      publish_failed: "I could not send or edit the verification panel in {{channel}}. Verify that I can send messages and embeds there.",
      question_missing: "Question mode is enabled but the verification question is empty.",
      revoke_role_update_failed: "I could not update the verification roles.",
      revoke_unverified_unmanageable: "I cannot assign {{role}}. Move my role above it and keep `Manage Roles` enabled.",
      revoke_verified_unmanageable: "I cannot remove {{role}}. Move my role above it and keep `Manage Roles` enabled.",
      roles_same: "Verified role and unverified role cannot be the same role.",
      unverified_role_deleted: "The configured unverified role no longer exists.",
      unverified_role_managed: "The unverified role is managed by an integration and cannot be assigned by the bot.",
      unverified_role_unmanageable: "I cannot manage the unverified role {{role}}. Move my role above it and keep `Manage Roles` enabled.",
      verified_role_deleted: "The configured verified role no longer exists.",
      verified_role_managed: "The verified role is managed by an integration and cannot be assigned by the bot.",
      verified_role_missing: "Verified role is not configured.",
      verified_role_unmanageable: "I cannot manage the verified role {{role}}. Move my role above it and keep `Manage Roles` enabled.",
      welcome_autorole_failed: "I could not assign the welcome auto-role {{role}}.",
      welcome_autorole_missing: "The welcome auto-role is configured but no longer exists.",
      welcome_autorole_process_failed: "I could not process the welcome auto-role."
    },
    mode: {
      button: "Button",
      code: "DM code",
      question: "Question"
    },
    options: {
      "verify_anti-raid_action_action": "Action to take when anti-raid triggers",
      "verify_anti-raid_enabled_enabled": "Whether anti-raid protection stays enabled",
      "verify_anti-raid_joins_joins": "Join threshold before anti-raid triggers",
      "verify_anti-raid_seconds_seconds": "Detection window in seconds",
      "verify_auto-kick_hours_hours": "Hours to wait before auto-kicking unverified members",
      verify_dm_enabled_enabled: "Whether confirmation DMs stay enabled",
      verify_enabled_enabled_enabled: "Whether the feature stays enabled",
      verify_force_user_user: "Member to verify manually",
      verify_logs_channel_channel: "Channel used for verification logs",
      verify_message_color_color: "Embed color in hex without `#`",
      verify_message_description_description: "Panel description",
      verify_message_image_image: "Image URL for the panel",
      verify_message_title_title: "Panel title",
      verify_mode_type_type: "Verification mode to switch to",
      "verify_question-pool_add_answer_answer": "Expected answer",
      "verify_question-pool_add_question_question": "Question text",
      "verify_question-pool_remove_index_index": "Pool item number to remove",
      verify_question_answer_answer: "Expected answer",
      verify_question_prompt_prompt: "Verification prompt or question",
      verify_security_captcha_type_captcha_type: "CAPTCHA type to require",
      verify_security_min_account_age_min_account_age: "Minimum account age in days",
      verify_security_risk_escalation_risk_escalation: "Whether risky accounts should face stronger checks",
      verify_setup_channel_channel: "Verification channel",
      verify_setup_mode_mode: "Verification mode to use",
      verify_setup_unverified_role_unverified_role: "Role assigned before verification",
      verify_setup_verified_role_verified_role: "Role granted after verification",
      verify_unverify_user_user: "Member to unverify manually"
    },
    panel: {
      description: "You need to verify before accessing the server. Click the button below to begin.",
      footer: "{{guild}} • Verification",
      help_label: "Help",
      start_label: "Verify me",
      title: "Verification"
    },
    slash: {
      choices: {
        anti_raid_action: {
          kick: "Kick automatically",
          pause: "Alert only"
        },
        captcha_type: {
          emoji: "Emoji count",
          math: "Math"
        },
        mode: {
          button: "Button",
          code: "DM code",
          question: "Question"
        }
      },
      description: "Configure the member verification system",
      groups: {
        question_pool: {
          description: "Manage the random verification question pool",
          options: {
            answer: "Expected answer",
            index: "Pool item number to remove",
            question: "Question text"
          },
          subcommands: {
            add: {
              description: "Add a question to the pool"
            },
            clear: {
              description: "Clear the entire question pool"
            },
            list: {
              description: "List the current question pool"
            },
            remove: {
              description: "Remove one question from the pool"
            }
          }
        }
      },
      options: {
        action: "Action to take when anti-raid triggers",
        answer: "Expected answer",
        anti_raid_enabled: "Whether anti-raid protection stays enabled",
        captcha_type: "CAPTCHA type to require",
        channel: "Verification channel",
        color: "Embed color in hex without `#`",
        description: "Panel description",
        dm_enabled: "Whether confirmation DMs stay enabled",
        enabled: "Whether the feature stays enabled",
        hours: "Hours to wait before auto-kicking unverified members",
        image: "Image URL for the panel",
        joins: "Join threshold before anti-raid triggers",
        log_channel: "Channel used for verification logs",
        min_account_age: "Minimum account age in days",
        mode: "Verification mode to use",
        prompt: "Verification prompt or question",
        risk_escalation: "Whether risky accounts should face stronger checks",
        seconds: "Detection window in seconds",
        title: "Panel title",
        type: "Verification mode to switch to",
        unverified_role: "Role assigned before verification",
        user_unverify: "Member to unverify manually",
        user_verify: "Member to verify manually",
        verified_role: "Role granted after verification"
      },
      subcommands: {
        anti_raid: {
          description: "Configure anti-raid protection for joins"
        },
        auto_kick: {
          description: "Configure the auto-kick delay for unverified members"
        },
        dm: {
          description: "Enable or disable the verification confirmation DM"
        },
        enabled: {
          description: "Enable or disable verification"
        },
        force: {
          description: "Verify a member manually"
        },
        info: {
          description: "View the current verification configuration"
        },
        logs: {
          description: "Set the verification log channel"
        },
        message: {
          description: "Customize the verification panel message"
        },
        mode: {
          description: "Change the verification mode"
        },
        panel: {
          description: "Publish or refresh the verification panel"
        },
        question: {
          description: "Update the verification question and expected answer"
        },
        security: {
          description: "Adjust account-age, CAPTCHA and risk settings"
        },
        setup: {
          description: "Set up verification with the main channel and roles"
        },
        stats: {
          description: "View verification statistics"
        },
        unverify: {
          description: "Remove verification from a member manually"
        }
      }
    }
  }
};
