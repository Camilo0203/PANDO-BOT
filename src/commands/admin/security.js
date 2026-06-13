"use strict";

/**
 * Security Admin Command
 * Allows bot owner to view and manage security alerts
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { getAlerts, acknowledgeAlert, manualSecurityCheck, clearOldAlerts } = require("../../utils/securityAlerts");
const { sendSecurityAlert, testAlert } = require("../../utils/discordAlerts");
const { getSchedulerStatus, startSecurityScheduler, stopSecurityScheduler } = require("../../utils/securityScheduler");
const { setupAuditIndexes } = require("../../utils/database/setupAuditIndexes");
const { logAdminAction, logCommandExecution } = require("../../utils/auditLogger");
const logger = require("../../utils/structuredLogger");
const { isEncryptionEnabled, encrypt, decrypt, generateEncryptionKey, mask } = require("../../utils/cryptoService");
const { resolveInteractionLanguage, t } = require("../../utils/i18n");

const OWNER_ID = process.env.OWNER_ID;

function isOwner(userId) {
  return userId === OWNER_ID;
}

const data = new SlashCommandBuilder()
  .setName("security")
  .setDescription("Security monitoring and alerts (Owner only)")
  .setDescriptionLocalizations({
    "es-ES": "Monitoreo de seguridad y alertas (Solo owner)",
    "en-US": "Security monitoring and alerts (Owner only)",
  })
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName("alerts")
      .setDescription("View recent security alerts")
      .setDescriptionLocalizations({
        "es-ES": "Ver alertas de seguridad recientes",
        "en-US": "View recent security alerts",
      })
      .addStringOption((opt) =>
        opt
          .setName("severity")
          .setDescription("Filter by severity")
          .setDescriptionLocalizations({
            "es-ES": "Filtrar por severidad",
            "en-US": "Filter by severity",
          })
          .setRequired(false)
          .addChoices(
            { name: "Critical", value: "critical", name_localizations: { "es-ES": "Crítico", "es-419": "Crítico" } },
            { name: "Warning", value: "warning", name_localizations: { "es-ES": "Advertencia", "es-419": "Advertencia" } },
            { name: "Info", value: "info", name_localizations: { "es-ES": "Info", "es-419": "Info" } }
          )
      )
      .addIntegerOption((opt) =>
        opt
          .setName("limit")
          .setDescription("Number of alerts to show (max 25)")
          .setDescriptionLocalizations({
            "es-ES": "N\u00famero de alertas a mostrar (m\u00e1ximo 25)",
            "es-419": "N\u00famero de alertas a mostrar (m\u00e1ximo 25)",
          })
          .setMinValue(1)
          .setMaxValue(25)
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("check")
      .setDescription("Run manual security check")
      .setDescriptionLocalizations({
        "es-ES": "Ejecutar verificación manual de seguridad",
        "en-US": "Run manual security check",
      })
  )
  .addSubcommand((sub) =>
    sub
      .setName("status")
      .setDescription("View security system status")
      .setDescriptionLocalizations({
        "es-ES": "Ver estado del sistema de seguridad",
        "en-US": "View security system status",
      })
  )
  .addSubcommand((sub) =>
    sub
      .setName("setup")
      .setDescription("Setup security system (indexes, scheduler)")
      .setDescriptionLocalizations({
        "es-ES": "Configurar sistema de seguridad (índices, scheduler)",
        "en-US": "Setup security system (indexes, scheduler)",
      })
      .addBooleanOption((opt) =>
        opt
          .setName("indexes")
          .setDescription("Create MongoDB indexes")
          .setDescriptionLocalizations({
            "es-ES": "Crear \u00edndices de MongoDB",
            "es-419": "Crear \u00edndices de MongoDB",
          })
          .setRequired(false)
      )
      .addBooleanOption((opt) =>
        opt
          .setName("scheduler")
          .setDescription("Start security scheduler")
          .setDescriptionLocalizations({
            "es-ES": "Iniciar el programador de seguridad",
            "es-419": "Iniciar el programador de seguridad",
          })
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("acknowledge")
      .setDescription("Acknowledge an alert")
      .setDescriptionLocalizations({
        "es-ES": "Reconocer una alerta",
        "en-US": "Acknowledge an alert",
      })
      .addStringOption((opt) =>
        opt
          .setName("alert_id")
          .setDescription("Alert ID to acknowledge")
          .setDescriptionLocalizations({
            "es-ES": "ID de la alerta que se reconocer\u00e1",
            "es-419": "ID de la alerta que se reconocer\u00e1",
          })
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("test")
      .setDescription("Test Discord alert notifications")
      .setDescriptionLocalizations({
        "es-ES": "Probar notificaciones de alertas Discord",
        "en-US": "Test Discord alert notifications",
      })
  )
  .addSubcommand((sub) =>
    sub
      .setName("encryption")
      .setDescription("View encryption status and generate keys")
      .setDescriptionLocalizations({
        "es-ES": "Ver estado de encriptación y generar claves",
        "en-US": "View encryption status and generate keys",
      })
      .addBooleanOption((opt) =>
        opt
          .setName("generate_key")
          .setDescription("Generate a new encryption key")
          .setDescriptionLocalizations({
            "es-ES": "Generar una nueva clave de cifrado",
            "es-419": "Generar una nueva clave de cifrado",
          })
          .setRequired(false)
      )
  );

module.exports = {
  data,
  meta: {
    category: "admin",
    scope: "admin",
    ownerOnly: true,
    privateOnly: true,
  },

  async execute(interaction) {
    const startTime = Date.now();
    const language = resolveInteractionLanguage(interaction);

    // Owner only
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: t(language, "security.owner_only"),
        flags: 64,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === "alerts") {
        await this.handleAlerts(interaction);
      } else if (subcommand === "check") {
        await this.handleCheck(interaction);
      } else if (subcommand === "status") {
        await this.handleStatus(interaction);
      } else if (subcommand === "setup") {
        await this.handleSetup(interaction);
      } else if (subcommand === "acknowledge") {
        await this.handleAcknowledge(interaction);
      } else if (subcommand === "test") {
        await this.handleTest(interaction);
      } else if (subcommand === "encryption") {
        await this.handleEncryption(interaction);
      }

      // Log command execution
      await logCommandExecution({
        commandName: 'security',
        subcommand,
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        guildId: interaction.guild?.id || null,
        guildName: interaction.guild?.name || 'DM',
        channelId: interaction.channel?.id || null,
        options: {},
        success: true,
        executionTimeMs: Date.now() - startTime,
      });
    } catch (error) {
      logger.error('security', 'Command error', { error: error?.message || String(error) });

      await logCommandExecution({
        commandName: 'security',
        subcommand,
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        guildId: interaction.guild?.id || null,
        guildName: interaction.guild?.name || 'DM',
        channelId: interaction.channel?.id || null,
        options: {},
        success: false,
        errorMessage: error.message,
        executionTimeMs: Date.now() - startTime,
      });

      await interaction.reply({
        content: t(language, "common.error_with_message", { message: error.message }),
        flags: 64,
      });
    }
  },

  async handleAlerts(interaction) {
    await interaction.deferReply({ flags: 64 });
    const language = resolveInteractionLanguage(interaction);

    const severity = interaction.options.getString("severity");
    const limit = interaction.options.getInteger("limit") || 10;

    const alerts = getAlerts({ limit, severity, unacknowledged: false });

    if (alerts.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle(t(language, "security.alerts_title"))
        .setDescription(t(language, "security.no_alerts"))
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setColor(severity === 'critical' ? 0xED4245 : severity === 'warning' ? 0xF1C40F : 0x57F287)
      .setTitle(`${t(language, "security.alerts_title")} (${alerts.length})`)
      .setDescription(`${t(language, "common.showing")} ${alerts.length} ${alerts.length === 1 ? t(language, "security.alert_singular") : t(language, "security.alert_plural")}${severity ? ` (${severity})` : ''}`)
      .setTimestamp();

    for (const alert of alerts.slice(0, 10)) {
      const emoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';
      const status = alert.acknowledged ? '✅ ' + t(language, "common.acknowledged") : '⏳ ' + t(language, "common.pending");

      embed.addFields({
        name: `${emoji} ${alert.type} (${status})`,
        value: `**${alert.message.substring(0, 100)}${alert.message.length > 100 ? '...' : ''}**\n` +
               `${t(language, "common.severity")}: \`${alert.severity}\` | ${t(language, "common.time")}: <t:${Math.floor(alert.created_at.getTime() / 1000)}:R>\n` +
               `ID: \`${alert.id}\``,
        inline: false,
      });
    }

    if (alerts.length > 10) {
      embed.setFooter({ text: `${t(language, "common.and_more")} ${alerts.length - 10} ${t(language, "common.more")}...` });
    }

    // Add acknowledge button for first unacknowledged alert
    const firstUnacknowledged = alerts.find(a => !a.acknowledged);
    const components = [];

    if (firstUnacknowledged) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`security_ack_${firstUnacknowledged.id}`)
          .setLabel(`${t(language, "common.acknowledge")} ${firstUnacknowledged.type}`)
          .setStyle(ButtonStyle.Primary)
      );
      components.push(row);
    }

    await interaction.editReply({
      embeds: [embed],
      components: components.length > 0 ? components : undefined,
    });
  },

  async handleCheck(interaction) {
    await interaction.deferReply({ flags: 64 });
    const language = resolveInteractionLanguage(interaction);

    await interaction.editReply({
      content: "🔍 " + t(language, "security.check_title"),
    });

    const triggered = await manualSecurityCheck();

    const embed = new EmbedBuilder()
      .setColor(triggered > 0 ? 0xF1C40F : 0x57F287)
      .setTitle(t(language, "security.check_title"))
      .setDescription(triggered > 0
        ? t(language, "security.check_triggered", { count: triggered })
        : t(language, "security.check_clean"))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Audit log
    await logAdminAction({
      action: 'security.manual_check',
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: 'system',
      targetType: 'security_system',
      guildId: interaction.guild?.id || 'DM',
      guildName: interaction.guild?.name || 'Direct Message',
      beforeState: {},
      afterState: { alerts_triggered: triggered },
      reason: `Manual security check by owner`,
    });
  },

  async handleStatus(interaction) {
    await interaction.deferReply({ flags: 64 });
    const language = resolveInteractionLanguage(interaction);

    const status = getSchedulerStatus();
    const allAlerts = getAlerts({ limit: 1000 });
    const unacknowledged = allAlerts.filter(a => !a.acknowledged);
    const criticalAlerts = allAlerts.filter(a => a.severity === 'critical' && !a.acknowledged);

    const embed = new EmbedBuilder()
      .setColor(criticalAlerts.length > 0 ? 0xED4245 : unacknowledged.length > 0 ? 0xF1C40F : 0x57F287)
      .setTitle(t(language, "security.status_title"))
      .addFields(
        {
          name: t(language, "security.field_monitoring"),
          value: `${t(language, "common.status")}: ${status.isRunning ? t(language, "security.status_active") : t(language, "security.status_stopped")}\n` +
                 `${t(language, "security.check_interval")}: ${status.checkIntervalMs / 1000}s\n` +
                 `${t(language, "security.cleanup_interval")}: ${status.cleanupIntervalMs / 1000}s`,
          inline: true,
        },
        {
          name: t(language, "security.field_alerts"),
          value: `${t(language, "common.total")}: ${allAlerts.length}\n` +
                 `${t(language, "security.unacknowledged")}: ${unacknowledged.length}\n` +
                 `${t(language, "security.critical_unack")}: ${criticalAlerts.length}`,
          inline: true,
        },
        {
          name: t(language, "security.field_config"),
          value: `${t(language, "security.max_alert_age")}: ${status.maxAlertAgeHours}h\n` +
                 `Owner ID: ${OWNER_ID ? OWNER_ID.substring(0, 8) + '...' : t(language, "common.not_set")}`,
          inline: true,
        }
      )
      .setTimestamp();

    if (criticalAlerts.length > 0) {
      embed.addFields({
        name: t(language, "security.critical_alerts_list"),
        value: criticalAlerts.map(a => `• ${a.type}: ${a.message.substring(0, 50)}...`).join('\n'),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },

  async handleSetup(interaction) {
    await interaction.deferReply({ flags: 64 });
    const language = resolveInteractionLanguage(interaction);

    const setupIndexes = interaction.options.getBoolean("indexes") ?? true;
    const setupScheduler = interaction.options.getBoolean("scheduler") ?? true;

    const results = [];

    if (setupIndexes) {
      await interaction.editReply({
        content: t(language, "security.setting_up_indexes"),
      });

      const indexResult = await setupAuditIndexes();
      results.push(`${t(language, "security.indexes_label")}: ${indexResult ? t(language, "common.created") : t(language, "common.failed")}`);
    }

    if (setupScheduler) {
      const schedulerResult = startSecurityScheduler();
      results.push(`${t(language, "security.scheduler_label")}: ${schedulerResult ? t(language, "common.started") : t(language, "common.failed")}`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle(t(language, "security.setup_complete"))
      .setDescription(results.join('\n'))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Audit log
    await logAdminAction({
      action: 'security.setup',
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      targetId: 'system',
      targetType: 'security_system',
      guildId: interaction.guild?.id || 'DM',
      guildName: interaction.guild?.name || 'Direct Message',
      beforeState: { indexes_setup: false, scheduler_running: false },
      afterState: { indexes_setup: setupIndexes, scheduler_running: setupScheduler },
      reason: `Security system setup by owner`,
    });
  },

  async handleAcknowledge(interaction) {
    await interaction.deferReply({ flags: 64 });
    const language = resolveInteractionLanguage(interaction);

    const alertId = interaction.options.getString("alert_id");
    const result = acknowledgeAlert(alertId);

    if (result) {
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle(t(language, "security.alert_acknowledged_title"))
        .setDescription(t(language, "security.alert_acknowledged_desc", { alertId }))
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Audit log
      await logAdminAction({
        action: 'security.acknowledge_alert',
        actorId: interaction.user.id,
        actorTag: interaction.user.tag,
        targetId: alertId,
        targetType: 'security_alert',
        guildId: interaction.guild?.id || 'DM',
        guildName: interaction.guild?.name || 'Direct Message',
        beforeState: { acknowledged: false },
        afterState: { acknowledged: true },
        reason: `Alert acknowledged by owner`,
      });
    } else {
      await interaction.editReply({
        content: t(language, "security.alert_not_found", { alertId }),
      });
    }
  },

  async handleTest(interaction) {
    await interaction.deferReply({ flags: 64 });
    const language = resolveInteractionLanguage(interaction);

    const { testAlert } = require("../../utils/discordAlerts");
    const sent = await testAlert(interaction.client, interaction.guildId);

    if (sent) {
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle(t(language, "security.test_alert_sent_title"))
        .setDescription(t(language, "security.test_alert_sent_desc"))
        .addFields(
          {
            name: t(language, "security.webhook_url"),
            value: process.env.SECURITY_ALERTS_WEBHOOK_URL ? t(language, "common.configured") : t(language, "common.not_set"),
            inline: true,
          },
          {
            name: t(language, "security.alert_channel"),
            value: process.env.SECURITY_ALERTS_CHANNEL_ID ? t(language, "common.configured") : t(language, "common.not_set"),
            inline: true,
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      await logAdminAction({
        action: 'security.test_alert',
        actorId: interaction.user.id,
        actorTag: interaction.user.tag,
        targetId: 'system',
        targetType: 'security_system',
        guildId: interaction.guild?.id || 'DM',
        guildName: interaction.guild?.name || 'Direct Message',
        beforeState: {},
        afterState: { test_sent: true },
        reason: `Security alert test by owner`,
      });
    } else {
      await interaction.editReply({
        content: t(language, "security.test_alert_failed"),
      });
    }
  },

  async handleEncryption(interaction) {
    await interaction.deferReply({ flags: 64 });
    const language = resolveInteractionLanguage(interaction);

    const generateKey = interaction.options.getBoolean("generate_key");

    if (generateKey) {
      const key = generateEncryptionKey();

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle(t(language, "security.encryption_key_title"))
        .setDescription(
          t(language, "security.encryption_key_generated") + "\n\n" +
          t(language, "security.add_to_env") + "\n" +
          "```\nENCRYPTION_KEY=" + key + "\n```"
        )
        .addFields(
          {
            name: t(language, "security.important_warning"),
            value: t(language, "security.encryption_warnings"),
            inline: false,
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      await logAdminAction({
        action: 'security.generate_encryption_key',
        actorId: interaction.user.id,
        actorTag: interaction.user.tag,
        targetId: 'system',
        targetType: 'security_system',
        guildId: interaction.guild?.id || 'DM',
        guildName: interaction.guild?.name || 'Direct Message',
        beforeState: {},
        afterState: { key_generated: true },
        reason: `New encryption key generated by owner`,
      });
      return;
    }

    // Show current encryption status
    const encryptionEnabled = isEncryptionEnabled();
    const keyConfigured = !!process.env.ENCRYPTION_KEY;
    const keyLength = process.env.ENCRYPTION_KEY?.length || 0;

    const embed = new EmbedBuilder()
      .setColor(encryptionEnabled ? 0x57F287 : 0xED4245)
      .setTitle(t(language, "security.encryption_status_title"))
      .addFields(
        {
          name: t(language, "common.status"),
          value: encryptionEnabled ? t(language, "security.enabled") : t(language, "security.disabled"),
          inline: true,
        },
        {
          name: t(language, "security.key_configured"),
          value: keyConfigured ? t(language, "common.yes") : t(language, "common.no"),
          inline: true,
        },
        {
          name: t(language, "security.key_length"),
          value: `${keyLength} ${t(language, "security.chars")} ${keyLength >= 32 ? t(language, "security.valid") : t(language, "security.too_short")}`,
          inline: true,
        }
      )
      .setDescription(
        encryptionEnabled
          ? t(language, "security.encryption_enabled_desc")
          : t(language, "security.encryption_disabled_desc")
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
