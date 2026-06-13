"use strict";

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { sendGuildLanguageOnboarding } = require("../../utils/guildOnboarding");
const { settings } = require("../../utils/database");
const { resolveGuildLanguage, resolveInteractionLanguage, t } = require("../../utils/i18n");
const { logCommandExecution } = require("../../utils/auditLogger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("send-tutorial")
    .setDescription(t("en", "tutorial.slash_description"))
    .setDescriptionLocalizations({
      "es-ES": t("es", "tutorial.slash_description"),
      "es-419": t("es", "tutorial.slash_description"),
    })
    .addStringOption((opt) =>
      opt
        .setName("guild_id")
        .setDescription(t("en", "tutorial.guild_id_description"))
        .setDescriptionLocalizations({
          "es-ES": t("es", "tutorial.guild_id_description"),
          "es-419": t("es", "tutorial.guild_id_description"),
        })
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  meta: {
    privateOnly: true,
  },

  async execute(interaction) {
    const interactionLanguage = resolveInteractionLanguage(interaction);

    // Owner-only check
    const ownerId = process.env.OWNER_ID || process.env.DISCORD_OWNER_ID;
    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: t(interactionLanguage, "tutorial.owner_only"),
        flags: 64,
      });
    }

    await interaction.deferReply({ flags: 64 });

    const guildId = interaction.options.getString("guild_id") || interaction.guildId;
    const guild = interaction.client.guilds.cache.get(guildId);

    if (!guild) {
      return interaction.editReply({
        content: t(interactionLanguage, "tutorial.guild_not_found", { guildId }),
      });
    }

    // Reset the onboarding flag so it can be sent again
    const currentSettings = await settings.get(guildId);
    if (currentSettings?.language_onboarding_completed) {
      await settings.update(guildId, {
        language_onboarding_completed: false,
      });
    }

    // Send the onboarding with the guild's preferred language
    const language = resolveGuildLanguage(currentSettings);
    const result = await sendGuildLanguageOnboarding(guild, language);

    if (result.delivered) {
      logCommandExecution(interaction, "send-tutorial", { guildId, delivered: true, language });

      const deliveryDetails = [
        t(interactionLanguage, "tutorial.delivery", { delivery: result.delivery }),
        result.channelId
          ? t(interactionLanguage, "tutorial.channel", { channelId: result.channelId })
          : null,
        result.userId
          ? t(interactionLanguage, "tutorial.dm", { userId: result.userId })
          : null,
      ].filter(Boolean).join(" | ");

      return interaction.editReply({
        content: `${t(interactionLanguage, "tutorial.sent", { guildName: guild.name })}\n${deliveryDetails}`,
      });
    } else if (result.skipped) {
      return interaction.editReply({
        content: t(interactionLanguage, "tutorial.already_completed", { guildName: guild.name }),
      });
    } else {
      return interaction.editReply({
        content: `${t(interactionLanguage, "tutorial.failed", { guildName: guild.name })}\n`
          + t(interactionLanguage, "tutorial.failed_hint"),
      });
    }
  },
};
