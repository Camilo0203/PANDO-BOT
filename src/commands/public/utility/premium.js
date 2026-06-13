"use strict";

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { t, resolveInteractionLanguage } = require("../../../utils/i18n");
const { getGuildSettings } = require("../../../utils/accessControl");
const { withInlineDescriptionLocalizations } = require("../../../utils/slashLocalizations");
const {
  isPremiumStatusUnavailable,
  resolveGuildPremiumStatus,
} = require("../../../utils/premiumStatus");
const { processRedemption } = require("../../../utils/proCodeService");
const { getProStoreHostname, getProStoreUrl } = require("../../../utils/proStore");
const logger = require("../../../utils/structuredLogger");

function toDiscordDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return `<t:${Math.floor(parsed.getTime() / 1000)}:D>`;
}

const PRO_UPGRADE_URL = getProStoreUrl();

const data = withInlineDescriptionLocalizations(
  new SlashCommandBuilder()
    .setName("premium")
    .setDescription(t("en", "premium.slash.description"))
    .addSubcommand((subcommand) =>
      withInlineDescriptionLocalizations(
        subcommand
          .setName("status")
          .setDescription(t("en", "premium.slash.status")),
        t("en", "premium.slash.status"),
        t("es", "premium.slash.status")
      )
    )
    .addSubcommand((subcommand) =>
      withInlineDescriptionLocalizations(
        subcommand
          .setName("info")
          .setDescription(t("en", "premium.slash.info_description")),
        t("en", "premium.slash.info_description"),
        t("es", "premium.slash.info_description")
      )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("activate")
        .setDescription("Activate a PRO plan with a purchase code")
        .setDescriptionLocalizations({
          "es-ES": "Activa un plan PRO con un c\u00f3digo de compra",
          "es-419": "Activa un plan PRO con un c\u00f3digo de compra",
        })
        .addStringOption((opt) =>
          opt
            .setName("code")
            .setDescription("Activation code (e.g. ABCD-EFGH-IJKL)")
            .setDescriptionLocalizations({
              "es-ES": "C\u00f3digo de activaci\u00f3n (ej. ABCD-EFGH-IJKL)",
              "es-419": "C\u00f3digo de activaci\u00f3n (ej. ABCD-EFGH-IJKL)",
            })
            .setRequired(true)
            .setMinLength(4)
            .setMaxLength(20)
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

  async handleActivate(interaction, language) {
    if (!interaction.guildId) {
      return interaction.reply({ content: t(language, "premium.guild_only"), flags: 64 });
    }

    const isOwner = interaction.user.id === interaction.guild?.ownerId;
    if (!isOwner) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle(t(language, "premium.activate.permission_title"))
            .setDescription(t(language, "premium.activate.permission_description")),
        ],
        flags: 64,
      });
    }

    const code = interaction.options.getString("code", true).trim().toUpperCase();
    await interaction.deferReply({ flags: 64 });

    try {
      const result = await processRedemption(
        code,
        interaction.user.id,
        interaction.guildId,
        interaction.client
      );

      if (!result.success) {
        const reasonKey = [
          "not_found",
          "already_redeemed",
          "expired",
          "revoked",
          "guild_not_found",
          "activation_failed",
          "billing_sync_failed",
        ].includes(result.error)
          ? result.error
          : "activation_failed";
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle(t(language, "premium.activate.failed_title"))
              .setDescription(t(language, `premium.activate.${reasonKey}`)),
          ],
        });
      }

      const { activation } = result;
      const isLifetime = activation.planExpiresAt === null;
      const expiresText = isLifetime
        ? `\u221e ${t(language, "premium.activate.lifetime")}`
        : `<t:${Math.floor(new Date(activation.planExpiresAt).getTime() / 1000)}:D>`;

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle(t(language, "premium.activate.success_title"))
            .setDescription(t(language, "premium.activate.success_description", {
              guild: interaction.guild.name,
              extension: activation.isExtension
                ? t(language, "premium.activate.extension_suffix")
                : "",
            }))
            .addFields(
              { name: t(language, "premium.activate.expires_label"), value: expiresText, inline: true },
              { name: t(language, "premium.activate.activated_by"), value: `<@${interaction.user.id}>`, inline: true }
            )
            .setFooter({ text: t(language, "premium.activate.footer") })
            .setTimestamp(),
        ],
      });
    } catch (error) {
      logger.error("premium", "activate error", { error: error?.message || String(error) });
      return interaction.editReply({ content: t(language, "premium.error_generic") });
    }
  },

  async execute(interaction) {
    const guildId = interaction.guildId;
    const guildSettings = guildId ? await getGuildSettings(guildId) : null;
    const language = resolveInteractionLanguage(interaction, guildSettings);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "activate") {
      return this.handleActivate(interaction, language);
    }

    if (subcommand === "info") {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(t(language, "premium.info.title"))
        .setDescription(t(language, "premium.info.description"))
        .addFields(
          { name: t(language, "premium.info.features_label"), value: t(language, "premium.info.features_value"), inline: false },
          { name: t(language, "premium.info.how_to_buy_label"), value: t(language, "premium.info.how_to_buy_value"), inline: false },
          { name: t(language, "premium.info.redeem_label"), value: t(language, "premium.info.redeem_value"), inline: false }
        )
        .setFooter({ text: t(language, "premium.info.footer") })
        .setTimestamp();

      embed.addFields({
        name: t(language, "premium.info.link_label"),
        value: `[${getProStoreHostname(PRO_UPGRADE_URL)}](${PRO_UPGRADE_URL})`,
        inline: false,
      });

      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    if (!guildId) {
      return interaction.reply({
        content: t(language, "premium.guild_only"),
        flags: 64,
      });
    }

    const isOwner = interaction.user.id === interaction.guild.ownerId;
    if (!isOwner) {
      return interaction.reply({
        content: t(language, "premium.owner_only"),
        flags: 64,
      });
    }

    await interaction.deferReply({ flags: 64 });

    try {
      const status = await resolveGuildPremiumStatus(guildId);

      if (isPremiumStatusUnavailable(status)) {
        logger.error('premium', `Unable to resolve premium status for guild ${guildId}`, {
          error: status.error || status.meta?.errorCode || "unknown_error"
        });
        return interaction.editReply({
          content: t(language, "premium.error_fetching"),
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(t(language, "premium.status_title"))
        .setTimestamp();

      if (status.isPro) {
        const daysUntil = status.daysUntil;
        let color = 0x57f287;
        let urgencyText = "";

        if (daysUntil !== null) {
          if (daysUntil <= 1) {
            color = 0xed4245;
            urgencyText = t(language, "premium.expires_tomorrow");
          } else if (daysUntil <= 3) {
            color = 0xfee75c;
            urgencyText = t(language, "premium.expires_soon", { days: daysUntil });
          } else if (daysUntil <= 7) {
            color = 0xfee75c;
            urgencyText = t(language, "premium.expires_week", { days: daysUntil });
          } else {
            urgencyText = t(language, "premium.expires_in", { days: daysUntil });
          }
        }

        const premiumFields = [
          {
            name: t(language, "premium.plan_label"),
            value: status.tier && ["pro_monthly", "pro_yearly", "lifetime"].includes(status.tier)
              ? t(language, `premium.tier_labels.${status.tier}`)
              : status.tierLabel || "PRO",
            inline: true,
          },
          {
            name: t(language, "premium.status_label"),
            value: t(language, "premium.active"),
            inline: true,
          },
        ];

        if (urgencyText) {
          premiumFields.push({
            name: t(language, "premium.time_remaining"),
            value: urgencyText,
            inline: true,
          });
        }

        embed
          .setColor(color)
          .setDescription(t(language, "premium.pro_active"))
          .addFields(...premiumFields);

        const startedAt = toDiscordDate(status.planStartedAt);
        if (startedAt) {
          embed.addFields({
            name: t(language, "premium.started_at"),
            value: startedAt,
            inline: true,
          });
        }

        const expiresAt = toDiscordDate(status.planExpiresAt);
        if (expiresAt) {
          embed.addFields({
            name: t(language, "premium.expires_at"),
            value: expiresAt,
            inline: true,
          });
        }

        if (status.planSource) {
          embed.addFields({
            name: t(language, "premium.source_label"),
            value: status.planSource,
            inline: true,
          });
        }

        if (status.supporterActive) {
          embed.addFields({
            name: t(language, "premium.supporter_status"),
            value: t(language, "premium.supporter_active"),
            inline: false,
          });
        }
      } else {
        embed
          .setColor(0x99aab5)
          .setDescription(t(language, "premium.free_plan"))
          .addFields(
            {
              name: t(language, "premium.plan_label"),
              value: "FREE",
              inline: true,
            },
            {
              name: t(language, "premium.status_label"),
              value: t(language, "premium.active"),
              inline: true,
            }
          );

        const upgradeUrl = status.upgradeUrl;
        if (upgradeUrl) {
          embed.addFields({
            name: t(language, "premium.upgrade_label"),
            value: `[${t(language, "premium.upgrade_cta")}](${upgradeUrl})`,
            inline: false,
          });
        }
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('premium', `Error executing /premium status for guild ${guildId}`, { error: error?.message || String(error) });
      await interaction.editReply({
        content: t(language, "premium.error_generic"),
      });
    }
  },
};
