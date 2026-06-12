"use strict";

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { t, resolveInteractionLanguage } = require("../../../utils/i18n");
const { getGuildSettings } = require("../../../utils/accessControl");
const { withInlineDescriptionLocalizations } = require("../../../utils/slashLocalizations");
const { processRedemption, isGuildOwner } = require("../../../utils/proCodeService");
const { validateCode } = require("../../../utils/database/proRedeemCodes");
const { logAdminAction, logCommandExecution } = require("../../../utils/auditLogger");
const logger = require("../../../utils/structuredLogger");

const data = withInlineDescriptionLocalizations(
  new SlashCommandBuilder()
    .setName("pro")
    .setDescription(t("en", "premium.slash.description"))
    .addSubcommand((subcommand) =>
      withInlineDescriptionLocalizations(
        subcommand
          .setName("redeem")
          .setDescription(t("en", "premium.slash.redeem_description"))
          .addStringOption((option) =>
            withInlineDescriptionLocalizations(
              option
                .setName("code")
                .setDescription(t("en", "premium.slash.code_option"))
                .setRequired(true)
                .setMinLength(8)
                .setMaxLength(20),
              t("en", "premium.slash.code_option"),
              t("es", "premium.slash.code_option")
            )
          ),
        t("en", "premium.slash.redeem_description"),
        t("es", "premium.slash.redeem_description")
      )
    ),
  t("en", "premium.slash.description"),
  t("es", "premium.slash.description")
);

module.exports = {
  data,
  meta: {
    category: "utility",
    scope: "public",
  },

  async execute(interaction) {
    const guildSettings = interaction.guildId ? await getGuildSettings(interaction.guildId) : null;
    const language = resolveInteractionLanguage(interaction, guildSettings);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "redeem") {
      return this.handleRedeem(interaction, language);
    }
  },

  async handleRedeem(interaction, language) {
    const code = interaction.options.getString("code");
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const startTime = Date.now();

    // Validar que esté en un servidor
    if (!guildId) {
      await logCommandExecution({
        commandName: 'pro',
        subcommand: 'redeem',
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        guildId: null,
        guildName: 'No Guild',
        channelId: interaction.channel?.id || null,
        options: { code: code?.substring(0, 4) + '...' },
        success: false,
        errorMessage: 'Not in guild',
        executionTimeMs: Date.now() - startTime,
      });

      return interaction.reply({
        content: t(language, "pro.redeem.guild_only"),
        flags: 64,
      });
    }

    // Validar que sea owner del servidor
    if (!isGuildOwner(userId, interaction.guild)) {
      await logCommandExecution({
        commandName: 'pro',
        subcommand: 'redeem',
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        guildId: interaction.guild?.id || null,
        guildName: interaction.guild?.name || 'Unknown',
        channelId: interaction.channel?.id || null,
        options: { code: code?.substring(0, 4) + '...' },
        success: false,
        errorMessage: 'Not guild owner',
        executionTimeMs: Date.now() - startTime,
      });

      return interaction.reply({
        content: t(language, "pro.redeem.owner_only"),
        flags: 64,
      });
    }

    await interaction.deferReply({ flags: 64 });

    try {
      // Validar el código antes de procesar
      const validation = await validateCode(code);

      if (!validation.valid) {
        // AUDIT: Intentó canjear código inválido
        await logAdminAction({
          action: 'pro.redeem_failed',
          actorId: interaction.user.id,
          actorTag: interaction.user.tag,
          targetId: guildId,
          targetType: 'guild',
          guildId: guildId,
          guildName: interaction.guild.name,
          beforeState: { code_valid: false, reason: validation.reason },
          afterState: {},
          reason: `Failed redeem: ${validation.reason}`,
        });

        await logCommandExecution({
          commandName: 'pro',
          subcommand: 'redeem',
          userId: interaction.user.id,
          userTag: interaction.user.tag,
          guildId: interaction.guild?.id || null,
          guildName: interaction.guild?.name || 'Unknown',
          channelId: interaction.channel?.id || null,
          options: { code: code?.substring(0, 4) + '...' },
          success: false,
          errorMessage: `Code validation failed: ${validation.reason}`,
          executionTimeMs: Date.now() - startTime,
        });

        const errorKey = validation.reason === "not_found" 
          ? "pro.redeem.code_not_found"
          : validation.reason === "already_redeemed"
          ? "pro.redeem.code_used"
          : validation.reason === "revoked"
          ? "pro.redeem.code_revoked"
          : validation.reason === "expired"
          ? "pro.redeem.code_expired"
          : "pro.redeem.invalid_code";

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle(t(language, "pro.redeem.error_title"))
          .setDescription(t(language, errorKey))
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // Procesar el canje con asignación de rol automática
      const result = await processRedemption(code, userId, guildId, interaction.client);

      if (!result.success) {
        await logAdminAction({
          action: 'pro.redeem_failed',
          actorId: interaction.user.id,
          actorTag: interaction.user.tag,
          targetId: guildId,
          targetType: 'guild',
          guildId: guildId,
          guildName: interaction.guild.name,
          beforeState: { code_valid: true },
          afterState: { processing_error: true },
          reason: 'Processing redemption failed',
        });

        await logCommandExecution({
          commandName: 'pro',
          subcommand: 'redeem',
          userId: interaction.user.id,
          userTag: interaction.user.tag,
          guildId: interaction.guild?.id || null,
          guildName: interaction.guild?.name || 'Unknown',
          channelId: interaction.channel?.id || null,
          options: { code: code?.substring(0, 4) + '...' },
          success: false,
          errorMessage: 'Processing redemption failed',
          executionTimeMs: Date.now() - startTime,
        });

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle(t(language, "pro.redeem.error_title"))
          .setDescription(t(language, "pro.redeem.processing_error"))
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // Éxito - construir mensaje
      const { redemption, activation } = result;
      const isLifetime = redemption.duration_days === null;
      const isExtension = activation.isExtension;

      // AUDIT: Canje exitoso de Pro
      await logAdminAction({
        action: 'pro.redeem_success',
        actorId: interaction.user.id,
        actorTag: interaction.user.tag,
        targetId: guildId,
        targetType: 'guild',
        guildId: guildId,
        guildName: interaction.guild.name,
        beforeState: {
          had_premium_before: activation.isExtension,
          previous_expires: activation.previousExpiresAt || null,
        },
        afterState: {
          plan: redemption.plan,
          duration_days: redemption.duration_days,
          is_lifetime: isLifetime,
          is_extension: isExtension,
          new_expires: activation.planExpiresAt,
          role_assigned: activation.roleAssigned,
          code_prefix: redemption.code.substring(0, 4) + '...',
          redeemed_by: redemption.redeemed_by,
        },
        reason: isExtension ? 'Extended Pro subscription' : 'New Pro activation',
      });

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle(t(language, "pro.redeem.success_title"));

      let description = t(language, "pro.redeem.success_description", {
        code: redemption.code,
        plan: redemption.plan.toUpperCase(),
      });

      if (isLifetime) {
        description += "\n\n" + t(language, "pro.redeem.lifetime_access");
      } else if (activation.planExpiresAt) {
        const expiresTimestamp = Math.floor(activation.planExpiresAt.getTime() / 1000);
        description += "\n\n" + t(language, "pro.redeem.expires_at", {
          date: `<t:${expiresTimestamp}:D>`,
        });

        if (isExtension) {
          description += "\n" + t(language, "pro.redeem.extended");
        }
      }

      embed.setDescription(description);

      // Agregar campo con duración
      embed.addFields({
        name: t(language, "pro.redeem.duration_label"),
        value: isLifetime 
          ? t(language, "pro.redeem.lifetime")
          : t(language, "pro.redeem.days", { days: redemption.duration_days }),
        inline: true,
      });

      // Agregar campo con servidor
      embed.addFields({
        name: t(language, "pro.redeem.server_label"),
        value: interaction.guild.name,
        inline: true,
      });

      embed.setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Log successful execution
      await logCommandExecution({
        commandName: 'pro',
        subcommand: 'redeem',
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        guildId: interaction.guild?.id || null,
        guildName: interaction.guild?.name || 'Unknown',
        channelId: interaction.channel?.id || null,
        options: { code: code?.substring(0, 4) + '...' },
        success: true,
        executionTimeMs: Date.now() - startTime,
      });

    } catch (error) {
      logger.error('pro', 'Redeem command error', { error: error?.message || String(error) });

      // AUDIT: Error inesperado
      await logAdminAction({
        action: 'pro.redeem_error',
        actorId: interaction.user.id,
        actorTag: interaction.user.tag,
        targetId: guildId,
        targetType: 'guild',
        guildId: guildId,
        guildName: interaction.guild?.name || 'Unknown',
        beforeState: {},
        afterState: { error: true, error_message: error.message },
        reason: `Unexpected error: ${error.message}`,
      });

      await logCommandExecution({
        commandName: 'pro',
        subcommand: 'redeem',
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        guildId: interaction.guild?.id || null,
        guildName: interaction.guild?.name || 'Unknown',
        channelId: interaction.channel?.id || null,
        options: { code: code?.substring(0, 4) + '...' },
        success: false,
        errorMessage: error.message,
        executionTimeMs: Date.now() - startTime,
      });

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle(t(language, "pro.redeem.error_title"))
        .setDescription(t(language, "pro.redeem.generic_error"))
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  },
};
