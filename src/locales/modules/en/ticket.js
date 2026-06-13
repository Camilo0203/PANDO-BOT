module.exports = {
  ticket: {
    categories: {
      support: {
        label: "General Support",
        description: "Help with general issues",
        welcome: "Hi {user}! 🛠️\n\nThanks for contacting **General Support**.\nA team member will help you shortly.\n\n> Please describe your issue with as much detail as possible."
      },
      billing: {
        label: "Billing",
        description: "Payments, invoices, or refunds",
        welcome: "Hi {user}! 💳\n\nYou opened a **Billing** ticket.\n\n> Never share full banking or card details."
      },
      report: {
        label: "User Report",
        description: "Report inappropriate behavior",
        welcome: "Hi {user}! 🚨\n\nYou opened a **User Report**.\nThe moderation team will review it as soon as possible.\n\n> Please include any useful evidence such as screenshots or message links."
      },
      partnership: {
        label: "Partnerships",
        description: "Collaboration or partnership requests",
        welcome: "Hi {user}! 🤝\n\nYou opened a **Partnerships** ticket.\nPlease share details about your server, brand, or project."
      },
      staff: {
        label: "Staff Application",
        description: "Apply to join the team",
        welcome: "Hi {user}! ⭐\n\nYou opened a **Staff Application**.\nPlease answer honestly and with enough detail for review."
      },
      bug: {
        label: "Bug Report",
        description: "Report a bug or broken flow",
        welcome: "Hi {user}! 🐛\n\nYou opened a **Bug Report**.\nPlease describe the issue clearly so we can reproduce it."
      },
      other: {
        label: "Other",
        description: "Anything else",
        welcome: "Hi {user}! 📩\n\nYou opened a ticket.\nThe team will help you soon."
      }
    },
    auto_reply: {
      footer: "──────────────────────────────────\n⚡ **Ultra-Fast Priority** (0.4s) | [Support TON618](https://store.ton618bot.xyz/)",
      footer_free: "──────────────────────────────────\n🎫 Ticket system powered by TON618",
      prefix: "🛡️ **TON618 PRO** | `Verified Support` — *\"{{trigger}}\"*",
      priority_badge: "🚨 **[URGENT PRIORITY DETECTED]**",
      priority_note: "⚠️ **Intelligence Note:** Manual review is being fast-tracked due to the critical nature of this ticket.",
      pro_badge: "🛡️ PRO VERIFIED SUPPORT",
      pro_footer_small: "Powered by TON618 PRO — Support excellence.",
      sentiment_angry: "😡 Angry / Critical Urgency",
      sentiment_calm: "😊 Calm (Standard)",
      sentiment_label: "🎭 User Sentiment",
      suggestion_label: "💡 PRO Suggestion",
      urgency_keywords: [
        "urgent",
        "emergency",
        "help",
        "error",
        "fail",
        "not working",
        "payment",
        "problem",
        "hack",
        "stolen",
        "asap",
        "assistance"
      ]
    },
    buttons: {
      claim: "Claim",
      claimed: "Claimed",
      close: "Close",
      reopen: "Reopen",
      transcript: "Transcript"
    },
    close_button: {
      already_closed: "This ticket is already closed.",
      auto_close_failed: "I could not close the ticket automatically. Please try again or notify an administrator.",
      bot_member_missing: "I could not verify my permissions in this server.",
      close_note_event_description: "{{userTag}} added an internal close note before closing ticket #{{ticketId}}.",
      close_note_event_title: "Close note added",
      missing_manage_channels: "I need the `Manage Channels` permission to close tickets.",
      modal_error: "There was an error while processing the ticket closure. Please try again later.",
      modal_title: "Close ticket #{{ticketId}}",
      notes_label: "Internal notes",
      notes_placeholder: "Extra staff-only notes...",
      open_form_error: "There was an error while opening the close form. Please try again.",
      permission_denied_description: "Only staff can close tickets.",
      permission_denied_title: "Permission denied",
      processing_description: "Starting the close workflow and transcript generation...",
      processing_title: "Processing closure",
      reason_label: "Closing reason",
      reason_placeholder: "Example: resolved, duplicate, request completed..."
    },
    command: {
      channel_renamed: "Channel renamed to **{{name}}**",
      closed_priority_denied: "You cannot change the priority of a closed ticket.",
      history_empty: "<@{{userId}}> has no tickets in this server.",
      history_open_now: "Open now",
      history_recently_closed: "Recently closed",
      history_summary: "Summary",
      history_summary_value: "Total: **{{total}}** | Open: **{{open}}** | Closed: **{{closed}}**",
      history_title: "Ticket history for {{user}}",
      move_select_description: "Select the category you want to move this ticket to:",
      move_select_placeholder: "Select the new category...",
      no_other_categories: "No other categories are available.",
      no_rating: "No rating",
      not_ticket_channel: "This is not a ticket channel.",
      note_added_event_description: "{{userTag}} added an internal note to ticket #{{ticketId}}.",
      note_added_footer: "By {{userTag}} · {{count}}/{{max}}",
      note_added_title: "Internal note added",
      note_limit_reached: "Ticket note limit reached (**{{max}}** notes max per ticket). Use `/ticket note clear` if you need to clean them up.",
      notes_cleared: "All ticket notes were cleared.",
      notes_cleared_event_description: "{{userTag}} cleared the internal notes for ticket #{{ticketId}}.",
      notes_empty: "There are no notes on this ticket yet.",
      notes_list_title: "Ticket notes — #{{ticketId}} ({{count}}/{{max}})",
      notes_title: "Ticket notes",
      only_admin_clear_notes: "Only administrators can clear all ticket notes.",
      only_staff_add: "Only staff can add users to the ticket.",
      only_staff_assign: "Only staff can assign tickets.",
      only_staff_brief: "Only staff can view the case brief.",
      only_staff_claim: "Only staff can claim tickets.",
      only_staff_close: "Only staff can close tickets.",
      only_staff_info: "Only staff can view ticket details.",
      only_staff_move: "Only staff can move tickets.",
      only_staff_notes: "Only staff can view or add notes.",
      only_staff_other_history: "Only staff can view another user's ticket history.",
      only_staff_priority: "Only staff can change ticket priority.",
      only_staff_remove: "Only staff can remove users from the ticket.",
      only_staff_rename: "Only staff can rename tickets.",
      only_staff_reopen: "Only staff can reopen tickets.",
      only_staff_transcript: "Only staff can generate transcripts.",
      priority_event_description: "{{userTag}} changed ticket #{{ticketId}} priority to {{label}}.",
      priority_event_title: "Priority updated",
      priority_updated: "Priority updated to **{{label}}**",
      release_denied: "You do not have permission to release this ticket.",
      rename_event_description: "{{userTag}} renamed ticket #{{ticketId}} to {{name}}.",
      rename_event_title: "Channel renamed",
      transcript_failed: "Failed to generate the transcript.",
      transcript_generated: "Transcript generated.",
      unknown_subcommand: "Unknown ticket subcommand.",
      valid_channel_name: "Provide a valid channel name."
    },
    create_errors: {
      duplicate_number: "There was an internal conflict while numbering the ticket. Please try again.",
      generic: "There was an error while creating the ticket. Verify my permissions or contact an administrator.",
      missing_permissions: "I do not have enough permissions to create or prepare the ticket channel.",
      reserve_number: "I could not reserve an internal ticket number. Please try again in a few seconds."
    },
    create_flow: {
      auto_escalation_applied: "Pro: Smart Escalation applied (Priority: Urgent)",
      blacklisted: "You are blacklisted.\n**Reason:** {{reason}}",
      category_not_found: "Category not found.",
      control_panel_failed: "The control panel could not be sent.",
      cooldown: "Please wait **{{minutes}} minute(s)** before opening another ticket.",
      created_success_description: "Your ticket has been created: <#{{channelId}}> | **#{{ticketId}}**\n\nPlease go to the channel to continue your request.{{warningText}}",
      created_success_title: "Ticket created successfully",
      dm_created_description: "Your ticket **#{{ticketId}}** has been created in **{{guild}}**.\nChannel: <#{{channelId}}>\n\nWe will let you know when the staff replies.",
      dm_created_title: "Ticket created",
      duplicate_request: "A ticket creation request is already being processed for you. Please wait a few seconds.",
      general_category: "General",
      global_limit: "This server reached the global limit of **{{limit}}** open tickets. Please wait until space is available.",
      invalid_form: "The form is not valid. Please expand the first answer.",
      min_days_required: "You must be in the server for at least **{{days}} day(s)** to open a ticket.",
      missing_permissions: "I do not have the permissions required to create tickets.\n\nRequired permissions: Manage Channels, View Channel, Send Messages, Manage Roles.",
      pending_ratings_description: "You have **{{count}}** closed ticket(s) waiting for a rating:\n\n{{tickets}}\n\n**Why does rating matter?**\nYour feedback helps us improve the service and is required before opening new tickets.\n\n**Check your DMs** to find the pending rating prompts.\nIf you cannot find them, use the button below to resend them.",
      pending_ratings_footer: "TON618 Tickets - Rating system",
      pending_ratings_title: "Pending ticket ratings",
      question_fallback: "Question {{index}}",
      resend_ratings_button: "Resend rating prompts",
      self_permissions_error: "I could not verify my permissions in this server.",
      submitted_form: "Submitted form",
      system_not_configured_description: "The ticket system is not configured correctly.\n\n**Problem:** there are no ticket categories configured.\n\n**Fix:** an administrator must create categories with:\n`/config category add`\n\nContact the server administration team to resolve this issue.",
      system_not_configured_footer: "TON618 Tickets - Configuration error",
      system_not_configured_title: "Ticket system not configured",
      user_limit: "You already have **{{openCount}}/{{maxPerUser}}** open tickets{{suffix}}",
      verify_role_required: "You need the role <@&{{roleId}}> to open tickets.",
      welcome_message_failed: "The welcome message could not be sent."
    },
    defaults: {
      control_panel_description: "This is the control panel for ticket **{ticket}**.\nUse the controls below to manage this ticket.",
      control_panel_footer: "{guild} • TON618 Tickets",
      control_panel_title: "Ticket Control Panel",
      public_panel_description: "Open a private ticket by selecting the category that best fits your request.",
      public_panel_footer: "{guild} • Professional support",
      public_panel_title: "Need help? We're here for you.",
      welcome_message: "Hi {user}, your ticket **{ticket}** has been created. Please share as much detail as possible."
    },
    error_label: "Error",
    events: {
      assigned_dashboard: "Ticket assigned from dashboard",
      assigned_dashboard_desc: "{{actor}} assigned themselves ticket #{{id}}.",
      claimed: "Ticket claimed",
      claimed_dashboard: "Ticket claimed from dashboard",
      claimed_dashboard_desc: "{{actor}} claimed ticket #{{id}} from the dashboard.",
      claimed_desc: "{{actor}} took this ticket from the dashboard.",
      closed: "Ticket closed",
      closed_dashboard: "Ticket closed from dashboard",
      closed_dashboard_desc: "{{actor}} closed ticket #{{id}} from the dashboard.",
      closed_desc: "{{actor}} closed this ticket from the dashboard.\nReason: {{reason}}",
      footer_bridge: "TON618 · Operational Inbox",
      internal_note: "Internal note added",
      internal_note_desc: "{{actor}} added an internal note from the dashboard.",
      macro_sent: "Macro sent",
      macro_sent_desc: "{{actor}} sent macro {{macro}} from the dashboard.",
      no_details: "No additional details.",
      priority_updated: "Priority updated",
      priority_updated_desc: "{{actor}} changed ticket #{{id}} priority to {{priority}}.",
      recommendation_confirmed: "Recommendation confirmed",
      recommendation_confirmed_desc: "{{actor}} confirmed an operational recommendation from the dashboard.",
      recommendation_discarded: "Recommendation discarded",
      recommendation_discarded_desc: "{{actor}} discarded an operational recommendation from the dashboard.",
      released_dashboard: "Ticket released from dashboard",
      released_dashboard_desc: "{{actor}} released ticket #{{id}} from the dashboard.",
      reopened: "Ticket reopened",
      reopened_dashboard: "Ticket reopened from dashboard",
      reopened_dashboard_desc: "{{actor}} reopened ticket #{{id}} from the dashboard.",
      reopened_desc: "{{actor}} reopened this ticket from the dashboard.",
      reply_sent: "Reply sent",
      reply_sent_desc: "{{actor}} replied to the customer from the dashboard.",
      reply_sent_title: "Reply from the dashboard",
      status_attending: "Attending",
      status_searching: "Searching Staff",
      status_updated: "Operational status updated",
      status_updated_desc: "{{actor}} changed ticket #{{id}} status to {{status}}.",
      tag_added: "Tag added",
      tag_added_desc: "{{actor}} added tag {{tag}} from the dashboard.",
      tag_removed: "Tag removed",
      tag_removed_desc: "{{actor}} removed tag {{tag}} from the dashboard.",
      unassigned: "Assignment removed",
      unassigned_desc: "{{actor}} removed the assignment for ticket #{{id}}."
    },
    faq: {
      description: "Here are the most common answers people need before opening a ticket. A quick check here can save you waiting time.",
      footer: "Still need help? Pick a category from the dropdown menu to open a ticket.",
      load_failed: "We could not load the FAQ right now. Please try again later.",
      q1_answer: "Go to our official store, or open a ticket in the **Sales** category if you need step-by-step help.",
      q1_question: "How do I buy a product or membership?",
      q2_answer: "Open a **Support / Billing** ticket and include your payment receipt plus transaction ID so the team can review it.",
      q2_question: "How do I request a refund?",
      q3_answer: "For a valid report, include clear screenshots or videos and explain the situation in a **Reports** ticket.",
      q3_question: "I want to report a user",
      q4_answer: "Partnership requests are handled through **Partnership** tickets. Make sure you meet the minimum requirements first.",
      q4_question: "I want to apply for a partnership",
      title: "Frequently Asked Questions"
    },
    field_assigned_to: "Assigned to",
    field_category: "Category",
    field_priority: "Priority",
    footer: "TON618 Tickets",
    labels: {
      assigned: "Assigned",
      category: "Category",
      claimed: "Claimed",
      priority: "Priority",
      status: "Status"
    },
    lifecycle: {
      assign: {
        assign_permissions_error: "There was an error while granting permissions to the assigned staff member: {{error}}",
        bot_denied: "You cannot assign the ticket to a bot.",
        closed_ticket: "You cannot assign a closed ticket.",
        creator_denied: "You cannot assign the ticket to the user who created it.",
        database_error: "There was an error while updating the ticket in the database.",
        dm_description: "Ticket **#{{ticketId}}** in **{{guild}}** was assigned to you.\n\n**{{categoryLabel}}:** {{category}}\n**User:** <@{{userId}}>\n**Channel:** [Go to ticket]({{channelLink}})\n\nPlease review it as soon as possible.",
        dm_line: "\n\nThe staff member was notified by DM.",
        dm_title: "Ticket assigned",
        dm_warning: "The staff member could not be notified by DM (DMs disabled).",
        event_description: "{{userTag}} assigned ticket #{{ticketId}} to {{staffTag}}.",
        invalid_assignee: "You can only assign the ticket to staff members (support role or administrator).",
        log_assigned_by: "Assigned by",
        log_assigned_to: "Assigned to",
        manage_channels_required: "I need the `Manage Channels` permission to assign tickets.",
        result_description: "Ticket **#{{ticketId}}** was assigned to <@{{staffId}}>.{{dmLine}}{{warningLine}}",
        result_title: "Ticket assigned",
        staff_member_missing: "I could not find that staff member in this server.",
        staff_only: "Only staff can assign tickets.",
        verify_permissions: "I could not verify my permissions in this server."
      },
      claim: {
        already_claimed_other: "Already claimed by <@{{userId}}>. Use `/ticket unclaim` first.",
        already_claimed_self: "You already claimed this ticket.",
        claimed_during_request: "This ticket was claimed by <@{{userId}}> while your request was being processed.",
        closed_ticket: "You cannot claim a closed ticket.",
        database_error: "There was an error while updating the ticket in the database. Please try again.",
        dm_description: "Your ticket **#{{ticketId}}** in **{{guild}}** now has an assigned staff member.\n\n**Assigned staff:** {{staff}}\n**{{categoryLabel}}:** {{category}}\n**Channel:** [Go to ticket]({{channelLink}})\n\nUse the link above to jump directly into your ticket and continue the conversation.",
        dm_line: "\n\nThe user was notified by DM.",
        dm_title: "Your ticket is being handled",
        event_description: "{{userTag}} claimed ticket #{{ticketId}}.",
        log_claimed_by: "Claimed by",
        manage_channels_required: "I need the `Manage Channels` permission to claim this ticket.",
        result_description: "You claimed ticket **#{{ticketId}}** successfully.{{dmLine}}{{warningBlock}}",
        result_title: "Ticket claimed",
        staff_only: "Only staff can claim tickets.",
        verify_permissions: "I could not verify my permissions in this server.",
        warning_dm: "The user could not be notified by DM (DMs disabled).",
        warning_permissions: "Your permissions could not be fully updated."
      },
      close: {
        already_closed: "This ticket is already closed.",
        already_closed_during_request: "This ticket was already closed while your request was being processed.",
        database_error: "There was an error while closing the ticket in the database. Please try again.",
        delete_reason: "Ticket closed",
        dm_field_category: "Category",
        dm_field_closed: "Closed at",
        dm_field_duration: "Total duration",
        dm_field_handled_by: "Handled by",
        dm_field_messages: "Messages",
        dm_field_opened: "Opened at",
        dm_field_reason: "Closing reason",
        dm_field_ticket: "Ticket",
        dm_field_transcript: "Online transcript",
        dm_footer: "Thanks for trusting our support - TON618 Tickets",
        dm_no_reason: "No reason provided",
        dm_receipt_description: "Thanks for contacting our support team. Here is a summary of your ticket.",
        dm_receipt_title: "Support receipt",
        dm_transcript_link: "View full transcript",
        dm_warning_description: "The closing DM could not be sent to <@{{userId}}>.\n\n**Possible cause:** the user has DMs disabled or blocked the bot.\n\n**Ticket:** #{{ticketId}}",
        dm_warning_title: "Warning: DM not delivered",
        dm_warning_transcript: "Transcript available",
        dm_warning_unavailable: "Not available",
        event_description: "{{userTag}} closed ticket #{{ticketId}}.",
        event_title: "Ticket closed",
        log_duration: "Duration",
        log_reason: "Reason",
        log_transcript: "Transcript",
        log_unavailable: "Not available",
        log_user: "User",
        manage_channels_required: "I need the `Manage Channels` permission to close this ticket.",
        result_closed_description: "The ticket was closed, but the channel will remain available until the transcript can be archived safely.",
        result_closed_title: "Ticket closed",
        result_closing_description: "This ticket will be deleted in **{{seconds}} seconds**.\n\n{{dmStatus}}",
        result_closing_title: "Closing ticket",
        result_dm_failed: "The user could not be notified by DM.",
        result_dm_sent: "A summary was sent to the user by direct message.",
        transcript_channel_missing: "No transcript channel is configured. The channel will remain closed and will not be deleted automatically.",
        transcript_channel_unavailable: "The configured transcript channel does not exist or is not accessible. The channel will not be deleted automatically.",
        transcript_closed_unavailable: "Not available",
        transcript_closed_unknown: "Unknown",
        transcript_embed_title: "Ticket transcript",
        transcript_field_closed: "Closed",
        transcript_field_duration: "Duration",
        transcript_field_messages: "Messages",
        transcript_field_rating: "Rating",
        transcript_field_staff: "Staff",
        transcript_field_user: "User",
        transcript_generate_error: "There was an error generating the transcript. The channel will remain closed to prevent history loss.",
        transcript_generate_failed: "The transcript could not be generated. The channel will remain closed to prevent history loss.",
        transcript_rating_none: "No rating",
        transcript_send_failed: "The transcript could not be sent to the configured channel. The channel will not be deleted automatically.",
        verify_permissions: "I could not verify my permissions in this server.",
        warning_channel_not_deleted: "The channel will not be deleted automatically until the transcript is archived safely.",
        warning_dm_failed: "The user could not be notified by DM."
      },
      members: {
        add: {
          bot_denied: "You cannot add bots to the ticket.",
          closed_ticket: "You cannot add users to a closed ticket.",
          creator_denied: "That user already owns this ticket.",
          event_description: "{{userTag}} added {{targetTag}} to ticket #{{ticketId}}.",
          event_title: "User added",
          manage_channels_required: "I need the `Manage Channels` permission to add users.",
          permissions_error: "There was an error while granting permissions to the user: {{error}}",
          result_description: "<@{{userId}}> was added to the ticket and can now see the channel.",
          result_title: "User added",
          verify_permissions: "I could not verify my permissions in this server."
        },
        move: {
          already_in_category: "This ticket is already in that category.",
          category_not_found: "Category not found.",
          closed_ticket: "You cannot move a closed ticket.",
          database_error: "There was an error while updating the ticket category in the database.",
          event_description: "{{userTag}} moved ticket #{{ticketId}} from {{from}} to {{to}}.",
          event_title: "Category updated",
          log_new: "New",
          log_previous: "Previous",
          log_priority: "Updated priority",
          manage_channels_required: "I need the `Manage Channels` permission to move tickets.",
          result_description: "Ticket moved from **{{from}}** -> **{{to}}**\n\n**New priority:** {{priority}}",
          result_title: "Category changed",
          verify_permissions: "I could not verify my permissions in this server."
        },
        remove: {
          admin_role_denied: "You cannot remove the admin role from the ticket.",
          bot_denied: "You cannot remove the bot from the ticket.",
          closed_ticket: "You cannot remove users from a closed ticket.",
          creator_denied: "You cannot remove the ticket creator.",
          event_description: "{{userTag}} removed {{targetTag}} from ticket #{{ticketId}}.",
          event_title: "User removed",
          manage_channels_required: "I need the `Manage Channels` permission to remove users.",
          permissions_error: "There was an error while removing permissions from the user: {{error}}",
          result_description: "<@{{userId}}> was removed from the ticket and can no longer view it.",
          result_title: "User removed",
          support_role_denied: "You cannot remove the support role from the ticket.",
          verify_permissions: "I could not verify my permissions in this server."
        }
      },
      reopen: {
        already_open: "This ticket is already open.",
        database_error: "There was an error while reopening the ticket in the database.",
        dm_description: "Your ticket **#{{ticketId}}** in **{{guild}}** was reopened by {{staff}}.\n\n**Channel:** [Go to ticket]({{channelLink}})\n\nYou can go back to the channel and continue the conversation.",
        dm_line: "\nThe user was notified by DM.",
        dm_title: "Ticket reopened",
        dm_warning: "The user could not be notified by DM (DMs may be disabled).",
        manage_channels_required: "I need the `Manage Channels` permission to reopen this ticket.",
        reopened_during_request: "This ticket was already reopened while your request was being processed.",
        result_description: "Ticket **#{{ticketId}}** was reopened successfully.\n\n**Total reopens:** {{count}}{{dmLine}}{{warningLine}}",
        log_reopened_by: "Reopened by",
        log_reopens: "Total reopens",
        result_title: "Ticket reopened",
        user_missing: "I could not find the user who created this ticket.",
        verify_permissions: "I could not verify my permissions in this server.",
        warning_line: "\n\nWarning: {{warning}}"
      },
      unclaim: {
        closed_ticket: "You cannot release a closed ticket.",
        database_error: "There was an error while updating the ticket in the database.",
        denied: "Only the user who claimed the ticket or an administrator can release it.",
        event_description: "{{userTag}} released ticket #{{ticketId}}.",
        log_previous_claimer: "Previously claimed by",
        log_released_by: "Released by",
        not_claimed: "This ticket is not claimed.",
        result_description: "The ticket has been released. Any staff member can claim it now.{{warningLine}}",
        result_title: "Ticket released",
        warning_permissions: "Some permissions could not be restored completely."
      }
    },
    maintenance: {
      default: "The ticket system is currently under maintenance. Please try again later.",
      description: "The ticket system is temporarily disabled.\n\n**Reason:** {{reason}}\n\nPlease come back later.",
      scheduled: "Scheduled maintenance",
      title: "System under maintenance"
    },
    modal: {
      category_unavailable: "This ticket category is no longer available. Please start again.",
      default_question: "How can we help you?",
      first_answer_short: "Your first answer is too short. Add more context before creating the ticket.",
      placeholder_answer: "Type your answer here...",
      placeholder_detailed: "Describe your issue with as much detail as possible..."
    },
    questions: {
      billing: {
        "0": "What is the billing issue?",
        "1": "What is your transaction or invoice ID?",
        "2": "Which payment method did you use?"
      },
      bug: {
        "0": "What went wrong?",
        "1": "How can we reproduce it?",
        "2": "Which device, browser, or platform are you using?"
      },
      other: {
        "0": "How can we help you today?"
      },
      partnership: {
        "0": "What is your server or project about?",
        "1": "How large is your community?",
        "2": "What kind of partnership are you proposing?"
      },
      report: {
        "0": "Who are you reporting?",
        "1": "What happened?",
        "2": "Do you have evidence to share?"
      },
      staff: {
        "0": "What is your age and moderation/support experience?",
        "1": "Why do you want to join the team?",
        "2": "How many hours per week are you available?",
        "3": "What is your timezone?"
      },
      support: {
        "0": "What problem are you facing?",
        "1": "When did it start happening?",
        "2": "What have you tried so far?"
      }
    },
    move_select: {
      move_failed: "I could not move the ticket right now. Please try again later."
    },
    options: {
      ticket_add_user_user: "User to add to the ticket",
      ticket_assign_staff_staff: "Staff member who will own the ticket",
      ticket_close_reason_reason: "Reason for closing the ticket",
      ticket_history_user_user: "Member whose history you want to inspect",
      ticket_note_add_note_note: "Internal note content",
      "ticket_playbook_apply-macro_recommendation_recommendation": "Recommendation ID",
      ticket_playbook_confirm_recommendation_recommendation: "Recommendation ID",
      ticket_playbook_disable_playbook_playbook: "Playbook name",
      ticket_playbook_dismiss_recommendation_recommendation: "Recommendation ID",
      ticket_playbook_enable_playbook_playbook: "Playbook name",
      ticket_priority_level_level: "New priority level",
      ticket_remove_user_user: "User to remove from the ticket",
      ticket_rename_name_name: "New channel name"
    },
    panel: {
      title: "🎫 Support Center",
      description: "👋 **Welcome to the ticket system!**\n\nSelect the category that best describes your issue:\n\n📋 **Before opening a ticket:**\n• Read the server rules\n• Check the FAQ or announcement channels\n• Be specific and include useful details\n\n⏰ **Response time:** Usually under 24h\n💬 **Need help?** Use the panel below 👇",
      footer: "🎫 TON618 Tickets v3.0 • Fast support",
      author_name: "🎫 Support Center",
      categories_cta: "👇 **Select a category** to create your ticket",
      categories_heading: "Choose a category",
      default_category: "General Support",
      default_description: "Help with general topics",
      faq_button: "FAQ",
      queue_name: "📊 Current queue",
      queue_value: "🎫 We currently have `{{openTicketCount}}` active ticket(s)\n⏱️ We will respond as soon as possible",
      no_categories_title: "⚠️ No categories configured",
      no_categories_description: "No ticket categories are available. An administrator must configure at least one category."
    },
    picker: {
      access_denied_description: "You cannot create tickets right now.\n**Reason:** {{reason}}",
      access_denied_footer: "If you think this is a mistake, contact an administrator.",
      access_denied_title: "Access denied",
      category_missing: "That category was not found or is not available right now. Please choose a different option.",
      cooldown: "Please wait **{{minutes}} minute(s)** before opening another ticket.\n\nThis cooldown helps the team manage incoming requests more effectively.",
      limit_reached_description: "You already have **{{openCount}}/{{maxTickets}}** open tickets.\n\n**Your active tickets:**\n{{ticketList}}\n\nClose one of your current tickets before opening a new one.",
      limit_reached_title: "Ticket limit reached",
      min_days: "You must be in the server for at least **{{days}} day(s)** to open a ticket.\n\nCurrent time in server: **{{currentDays}} day(s)**",
      no_categories: "There are no ticket categories configured for this server.",
      pending_ratings_description: "You have **{{count}}** closed ticket(s) waiting for a rating:\n\n{{tickets}}\n\n**Why does rating matter?**\nYour feedback helps us improve the service and is required before opening new tickets.\n\n**Check your DMs** to find the pending rating prompts.\nIf you cannot find them, use the button below to resend them.",
      pending_ratings_footer: "TON618 Tickets - Rating system",
      pending_ratings_title: "Pending ticket ratings",
      processing_error: "There was an error while preparing the ticket form. Please try again later.",
      resend_ratings_button: "Resend rating prompts",
      select_description: "👇 **Select the category** that best describes your issue\n\nEach category routes your request to the right team to help you faster.",
      select_placeholder: "🎫 Choose a category...",
      select_title: "🎫 Create new ticket"
    },
    playbook: {
      apply_macro_description: "Apply a playbook macro manually",
      confirm_description: "Confirm and apply a playbook recommendation",
      disable_description: "Disable a playbook for this server",
      dismiss_description: "Dismiss a playbook recommendation",
      enable_description: "Enable a playbook for this server",
      group_description: "Manage playbook recommendations",
      list_description: "List active playbook recommendations",
      option_playbook: "Playbook name",
      option_recommendation: "Recommendation ID"
    },
    priority: {
      high: "High",
      low: "Low",
      normal: "Normal",
      urgent: "Urgent"
    },
    workflow: {
      assigned: "Assigned",
      closed: "Closed",
      open: "Open",
      triage: "Under review",
      waiting_staff: "Waiting for staff",
      waiting_user: "Waiting for user"
    },
    field_names: {
      "Claimed by": "Claimed by",
      "Assigned to": "Assigned to",
      Priority: "Priority",
      Status: "Status",
      Category: "Category"
    },
    priorities: {
      low: "🟢 Low",
      normal: "🔵 Normal",
      high: "🟡 High",
      urgent: "🔴 Urgent"
    },
    quick_actions: {
      placeholder: "Quick staff actions...",
      priority_high: "Priority: High",
      priority_low: "Priority: Low",
      priority_normal: "Priority: Normal",
      priority_urgent: "Priority: Urgent",
      status_pending: "Status: Waiting for user",
      status_review: "Status: Under review",
      status_wait: "Status: Waiting for staff"
    },
    quick_feedback: {
      add_staff_prompt: "Mention the staff member you want to add to this ticket.",
      closed: "Quick actions are not available on closed tickets.",
      not_found: "Ticket information was not found.",
      only_staff: "Only staff can use these actions.",
      priority_event_description: "{{userTag}} updated ticket #{{ticketId}} priority to {{priority}} from quick actions.",
      priority_event_title: "Priority updated",
      priority_updated: "Ticket priority updated to **{{label}}** by <@{{userId}}>.",
      processing_error: "There was an error while processing this action.",
      unknown_action: "Unknown action.",
      workflow_event_description: "{{userTag}} updated ticket #{{ticketId}} workflow status to {{status}} from quick actions.",
      workflow_event_title: "Workflow status updated",
      workflow_updated: "Ticket status updated to **{{label}}** by <@{{userId}}>."
    },
    rating: {
      already_recorded_description: "You already rated this ticket with **{{rating}} star(s)**.",
      already_recorded_processing: "This ticket was rated while your response was being processed.",
      already_recorded_title: "Rating already recorded",
      event_description: "{{userTag}} rated ticket #{{ticketId}} with {{rating}}/5.",
      event_title: "Rating received",
      invalid_identifier_description: "The identifier for this rating prompt is invalid.",
      invalid_identifier_title: "Could not save your rating",
      invalid_value_description: "Select a score between 1 and 5 stars.",
      invalid_value_title: "Invalid rating",
      not_found_description: "I could not find the ticket linked to this rating prompt.",
      not_found_title: "Ticket not found",
      prompt_category_fallback: "General",
      prompt_description: "Hi <@{{userId}}>, your ticket **#{{ticketId}}** has been closed.\n\n**Rating required:** you must rate this ticket before opening new tickets in the future.\n\nYour feedback helps us improve the service and maintain a strong support experience.",
      prompt_footer: "Your opinion matters to us",
      prompt_option_1_description: "The support did not meet my expectations",
      prompt_option_1_label: "1 star",
      prompt_option_2_description: "The support was acceptable but needs improvement",
      prompt_option_2_label: "2 stars",
      prompt_option_3_description: "The support was solid and acceptable",
      prompt_option_3_label: "3 stars",
      prompt_option_4_description: "The support was very professional",
      prompt_option_4_label: "4 stars",
      prompt_option_5_description: "The support exceeded my expectations",
      prompt_option_5_label: "5 stars",
      prompt_placeholder: "Select a rating...",
      prompt_staff_label: "Staff member",
      prompt_title: "Rate the support you received",
      resend_clear: "**All clear!**\n\nYou no longer have any pending ticket ratings.\nYou can open a new ticket whenever you need one.",
      resend_error: "There was an error while resending the rating prompts. Please try again later.",
      resend_failed: "**Could not resend the rating prompts**\n\nMake sure your DMs are open and try again.",
      resend_partial_warning: "Warning: {{failCount}} prompt(s) could not be resent.",
      resend_sent: "**Rating prompts resent**\n\nWe resent **{{successCount}}** rating prompt(s) to your DMs.\n\n**Check your DMs** to rate the pending tickets.{{warning}}",
      resend_wrong_user: "This button can only be used by the matching user.",
      save_failed_description: "An unexpected error occurred. Please try again later.",
      save_failed_title: "Could not save your rating",
      thanks_description: "You rated the support experience **{{rating}} star(s)**.\n\nYour feedback was recorded successfully and helps improve the service.",
      thanks_title: "Thanks for your rating",
      unavailable_description: "Only the creator of this ticket can submit this rating.",
      unavailable_title: "Rating unavailable"
    },
    slash: {
      choices: {
        priority: {
          high: "High",
          low: "Low",
          normal: "Normal",
          urgent: "Urgent"
        },
        priorities: {
          low: "🟢 Low",
          normal: "🔵 Normal",
          high: "🟡 High",
          urgent: "🔴 Urgent"
        },
        categories: {
          support: {
            label: "General Support",
            description: "Help with general issues",
            welcome: "Hi {user}! 🛠️\n\nThank you for contacting **General Support**.\nA team member will assist you shortly.\n\n> Please describe your issue in as much detail as possible."
          },
          billing: {
            label: "Billing",
            description: "Payments, invoices or refunds",
            welcome: "Hi {user}! 💳\n\nYou opened a **Billing** ticket.\n\n> Never share full banking details."
          },
          report: {
            label: "Report User",
            description: "Report inappropriate behavior",
            welcome: "Hi {user}! 🚨\n\nYou opened a **User Report**.\nThe moderation team will review it as soon as possible.\n\n> Include any useful evidence such as screenshots or links."
          },
          partnership: {
            label: "Partnerships",
            description: "Collaboration or partnership requests",
            welcome: "Hi {user}! 🤝\n\nYou opened a **Partnership** ticket.\nShare details about your server, brand or project."
          },
          staff: {
            label: "Staff Application",
            description: "Apply to join the team",
            welcome: "Hi {user}! ⭐\n\nYou opened a **Staff Application**.\nAnswer honestly and with enough detail."
          },
          bug: {
            label: "Report Bug",
            description: "Report an error or broken flow",
            welcome: "Hi {user}! 🐛\n\nYou opened a **Bug Report**.\nDescribe the issue clearly so we can reproduce it."
          },
          other: {
            label: "Other",
            description: "Anything else",
            welcome: "Hi {user}! 📩\n\nYou opened a ticket.\nThe team will help you soon."
          }
        },
        panel: {
          title: "🎫 Support Center",
          description: "Welcome to the ticket system.\nChoose the category that best matches your request.\n\n**📋 Before opening a ticket:**\n▸ Read the server rules\n▸ Check the FAQ or announcement channels\n▸ Be specific and include useful details\n\n**⏰ Expected response time:** usually under 24h",
          footer: "TON618 Tickets v3.0 • Built for fast support"
        }
      },
      description: "Manage support tickets",
      groups: {
        note: {
          description: "Manage internal ticket notes",
          options: {
            note: "Internal note content"
          },
          subcommands: {
            add: {
              description: "Add an internal note to this ticket"
            },
            clear: {
              description: "Clear all internal notes from this ticket"
            },
            list: {
              description: "List internal notes for this ticket"
            }
          }
        }
      },
      options: {
        add_user: "User to add to the ticket",
        assign_staff: "Staff member who will own the ticket",
        close_reason: "Reason for closing the ticket",
        history_user: "Member whose history you want to inspect",
        priority_level: "New priority level",
        remove_user: "User to remove from the ticket",
        rename_name: "New channel name"
      },
      subcommands: {
        add: {
          description: "Add a user to the current ticket"
        },
        assign: {
          description: "Assign the current ticket to a staff member"
        },
        brief: {
          description: "Generate the case brief for this ticket"
        },
        claim: {
          description: "Claim the current ticket"
        },
        close: {
          description: "Close the current ticket"
        },
        history: {
          description: "View a member's ticket history"
        },
        info: {
          description: "View ticket details"
        },
        move: {
          description: "Move the ticket to another category"
        },
        open: {
          description: "Open a new ticket"
        },
        priority: {
          description: "Change the ticket priority"
        },
        remove: {
          description: "Remove a user from the current ticket"
        },
        rename: {
          description: "Rename the current ticket channel"
        },
        reopen: {
          description: "Reopen the current ticket"
        },
        transcript: {
          description: "Generate a ticket transcript"
        },
        unclaim: {
          description: "Release the current ticket"
        }
      }
    },
    transcript_button: {
      error: "There was an error while generating the transcript. Please try again later.",
      intro: "Here is the manual transcript for this ticket:",
      not_ticket: "I could not generate the transcript because this channel is no longer registered as a ticket.",
      unavailable_now: "I could not generate the ticket transcript right now."
    }
  }
};
