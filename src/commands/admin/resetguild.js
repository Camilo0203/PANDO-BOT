"use strict";

/**
 * Reset Single Guild Configuration Command
 * Resets all configurations for a specific guild
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { getDB } = require("../../utils/database/core");
const { logAdminAction } = require("../../utils/auditLogger");
const { resolveInteractionLanguage, t } = require("../../utils/i18n");
const logger = require("../../utils/structuredLogger");

const OWNER_ID = process.env.OWNER_ID;

function isOwner(userId) {
  return userId === OWNER_ID;
}

// Colecciones que tienen datos por guild
const GUILD_COLLECTIONS = [
  "settings",
  "verifSettings",
  "configBackups",
  "autoResponses",
  "alerts",
  "counters",
  "giveaways",
  "polls",
  "suggestions",
  "reminders",
  "tickets",
  "ticketEvents",
  "notes",
  "blacklist",
  "auditLogs",
  "levels",
  "verifCodes",
  "verifLogs",
  "verifMemberStates",
  "verifMetrics",
  "verifCaptchas",
  "staffStats",
  "membershipReminders",
];

const data = new SlashCommandBuilder()
  .setName("resetguild")
  .setDescription("Reset all configurations for a specific guild (Owner Only)")
  .setDescriptionLocalizations({
    "es-ES": "Restablecer todas las configuraciones de un guild específico (Solo owner)",
    "en-US": "Reset all configurations for a specific guild (Owner Only)",
  })
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt
      .setName("guild_id")
      .setDescription("Guild ID to reset (or 'this' for current guild)")
      .setDescriptionLocalizations({
        "es-ES": "ID del guild a restablecer (o 'this' para el guild actual)",
        "en-US": "Guild ID to reset (or 'this' for current guild)",
      })
      .setRequired(true)
  )
  .addBooleanOption((opt) =>
    opt
      .setName("preserve_pro")
      .setDescription("Preserve Pro/premium status (default: true)")
      .setDescriptionLocalizations({
        "es-ES": "Preservar estado PRO/premium (por defecto: true)",
        "en-US": "Preserve Pro/premium status (default: true)",
      })
      .setRequired(false)
  )
  .addBooleanOption((opt) =>
    opt
      .setName("preserve_tickets")
      .setDescription("Preserve active tickets (default: false)")
      .setDescriptionLocalizations({
        "es-ES": "Preservar tickets activos (por defecto: false)",
        "en-US": "Preserve active tickets (default: false)",
      })
      .setRequired(false)
  )
  .addStringOption((opt) =>
    opt
      .setName("reason")
      .setDescription("Reason for the reset")
      .setDescriptionLocalizations({
        "es-ES": "Razón del restablecimiento",
        "en-US": "Reason for the reset",
      })
      .setRequired(false)
      .setMaxLength(500)
  )
  .addStringOption((opt) =>
    opt
      .setName("confirm_code")
      .setDescription("Confirmation code (run without this first to get it)")
      .setDescriptionLocalizations({
        "es-ES": "Código de confirmación (ejecuta sin esto primero para obtenerlo)",
        "en-US": "Confirmation code (run without this first to get it)",
      })
      .setRequired(false)
      .setMaxLength(32)
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
    const language = resolveInteractionLanguage(interaction);

    // Owner only
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: t(language, "resetguild.owner_only"),
        flags: 64,
      });
    }

    let guildIdInput = interaction.options.getString("guild_id");
    const preservePro = interaction.options.getBoolean("preserve_pro") ?? true;
    const preserveTickets = interaction.options.getBoolean("preserve_tickets") ?? false;
    const reason = interaction.options.getString("reason") || t(language, "resetguild.default_reason");
    const confirmCodeInput = interaction.options.getString("confirm_code");

    // Handle 'this' as current guild
    if (guildIdInput.toLowerCase() === "this") {
      guildIdInput = interaction.guild?.id;
    }

    if (!guildIdInput || guildIdInput.length < 10) {
      return interaction.reply({
        content: t(language, "resetguild.invalid_guild_id"),
        flags: 64,
      });
    }

    // Require confirmation code for destructive action
    const expectedCode = "RESET_GUILD_" + guildIdInput.slice(-4).toUpperCase() + "_" + Math.random().toString(36).substring(2, 6).toUpperCase();
    if (!confirmCodeInput || !confirmCodeInput.startsWith("RESET_GUILD_")) {
      const db = getDB();
      let totalDocs = 0;
      for (const collectionName of GUILD_COLLECTIONS) {
        try {
          totalDocs += await db.collection(collectionName).countDocuments({ guild_id: guildIdInput });
        } catch { /* ignore */ }
      }
      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle(t(language, "resetguild.preview_title") || "⚠️ Reset Guild Preview")
        .setDescription(
          `**Guild ID:** \`${guildIdInput}\`\n` +
          `**Documents to delete:** ${totalDocs}\n\n` +
          `**Confirmation code required:** \`${expectedCode}\`\n` +
          `Run this command again with \`confirm_code: ${expectedCode}\` to execute.`
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    await interaction.deferReply({ flags: 64 });

    const db = getDB();
    const targetGuildId = guildIdInput;

    try {
      // Get guild info if available
      let guildInfo = { id: targetGuildId, name: "Unknown" };
      try {
        const guild = await interaction.client.guilds.fetch(targetGuildId);
        guildInfo = { id: guild.id, name: guild.name, memberCount: guild.memberCount };
      } catch {
        // Guild not found or bot not in it
      }

      // Build list of collections to clear
      const collectionsToClear = [...GUILD_COLLECTIONS];

      // Exclude tickets if requested
      if (preserveTickets) {
        const idx = collectionsToClear.indexOf("tickets");
        if (idx > -1) collectionsToClear.splice(idx, 1);
      }

      // Get before stats
      const beforeStats = {};
      for (const collectionName of collectionsToClear) {
        try {
          const collection = db.collection(collectionName);
          beforeStats[collectionName] = await collection.countDocuments({ guild_id: targetGuildId });
        } catch {
          beforeStats[collectionName] = 0;
        }
      }

      const totalBefore = Object.values(beforeStats).reduce((a, b) => a + b, 0);

      if (totalBefore === 0) {
        return interaction.editReply({
          content: t(language, "resetguild.no_data", { guildName: guildInfo.name, guildId: targetGuildId }),
        });
      }

      // Execute deletions
      const results = [];
      let totalDeleted = 0;

      for (const collectionName of collectionsToClear) {
        try {
          const collection = db.collection(collectionName);
          const result = await collection.deleteMany({ guild_id: targetGuildId });

          if (result.deletedCount > 0) {
            results.push({
              collection: collectionName,
              deleted: result.deletedCount,
            });
            totalDeleted += result.deletedCount;
          }
        } catch (error) {
          results.push({
            collection: collectionName,
            error: error.message,
          });
        }
      }

      // Audit log
      await logAdminAction({
        action: "guild.reset_configuration",
        actorId: interaction.user.id,
        actorTag: interaction.user.tag,
        targetId: targetGuildId,
        targetType: "guild",
        guildId: targetGuildId,
        guildName: guildInfo.name,
        beforeState: { collections: beforeStats, total: totalBefore },
        afterState: {
          deleted: totalDeleted,
          collections_cleared: results.filter(r => r.deleted).length,
          preserve_pro: preservePro,
          preserve_tickets: preserveTickets,
        },
        reason: reason,
      });

      // Build response
      const embed = new EmbedBuilder()
        .setColor(totalDeleted > 0 ? 0x57F287 : 0xF1C40F)
        .setTitle(t(language, "resetguild.reset_title"))
        .setDescription(
          `**${t(language, "common.guild")}:** ${guildInfo.name}\n` +
          `**ID:** \`${targetGuildId}\`\n\n` +
          `**${t(language, "common.documents_deleted")}:** ${totalDeleted.toLocaleString()}\n` +
          `**${t(language, "common.collections_affected")}:** ${results.filter(r => r.deleted).length}`
        )
        .setTimestamp();

      // Show details
      const deletedItems = results.filter(r => r.deleted > 0);
      if (deletedItems.length > 0) {
        embed.addFields({
          name: t(language, "common.deleted_data"),
          value: deletedItems
            .map(r => `**${r.collection}**: ${r.deleted.toLocaleString()}`)
            .join("\n")
            .substring(0, 1024),
          inline: false,
        });
      }

      // Show preserved settings
      const preserved = [];
      if (preservePro) preserved.push(t(language, "common.pro_status_preserved"));
      if (preserveTickets) preserved.push(t(language, "common.tickets_preserved"));

      if (preserved.length > 0) {
        embed.addFields({
          name: `🔒 ${t(language, "common.preserved")}`,
          value: preserved.join("\n"),
          inline: false,
        });
      }

      embed.setFooter({
        text: `${t(language, "common.reset_by")}: ${interaction.user.tag} | ${t(language, "common.reason")}: ${reason.substring(0, 50)}${reason.length > 50 ? "..." : ""}`,
      });

      await interaction.editReply({ embeds: [embed] });

      // Console log
      logger.warn('resetguild', `Guild reset completed: ${guildInfo.name} (${targetGuildId}): ${totalDeleted} documents deleted by ${interaction.user.tag}`);

    } catch (error) {
      logger.error('resetguild', 'Reset guild error', { error: error?.message || String(error) });

      await interaction.editReply({
        content: t(language, "resetguild.error", { error: error.message }),
      });

      await logAdminAction({
        action: "guild.reset_configuration_failed",
        actorId: interaction.user.id,
        actorTag: interaction.user.tag,
        targetId: targetGuildId,
        targetType: "guild",
        guildId: targetGuildId,
        guildName: "Unknown",
        beforeState: {},
        afterState: { error: error.message },
        reason: reason,
      });
    }
  },
};
