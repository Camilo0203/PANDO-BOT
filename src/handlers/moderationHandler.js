"use strict";

const { tempBans, mutes, modActions } = require("../utils/database");
const logger = require("../utils/structuredLogger");

class ModerationHandler {
  constructor(client) {
    this.client = client;
    this.checkInterval = null;
  }

  start() {
    logger.info("moderation.handler", "Started - expiry handled by cron moderationExpiry");
  }

  stop() {
    logger.info("moderation.handler", "Stopped");
  }

  async checkExpiredActions() {
    try {
      await Promise.all([
        this.checkExpiredBans(),
        this.checkExpiredMutes()
      ]);
    } catch (error) {
      logger.error("moderation.handler", "Error checking expired actions", { error: error?.message });
    }
  }

  async checkExpiredBans() {
    try {
      const expiredBans = await tempBans.getExpired(50);

      if (expiredBans.length === 0) return;

      logger.info("moderation.handler", `Found ${expiredBans.length} expired ban(s)`);

      for (const ban of expiredBans) {
        await this.unbanUser(ban);
      }
    } catch (error) {
      logger.error("moderation.handler", "Error checking expired bans", { error: error?.message });
    }
  }

  async checkExpiredMutes() {
    try {
      const expiredMutes = await mutes.getExpired(50);

      if (expiredMutes.length === 0) return;

      logger.info("moderation.handler", `Found ${expiredMutes.length} expired mute(s)`);

      for (const mute of expiredMutes) {
        await this.unmuteUser(mute);
      }
    } catch (error) {
      logger.error("moderation.handler", "Error checking expired mutes", { error: error?.message });
    }
  }

  async unbanUser(ban) {
    try {
      const guild = await this.client.guilds.fetch(ban.guild_id).catch(() => null);
      if (!guild) {
        logger.warn("moderation.handler", "Guild not found, removing ban record", { guildId: ban.guild_id, userId: ban.user_id });
        await tempBans.remove(ban.guild_id, ban.user_id);
        return;
      }

      // Verificar que el usuario esté baneado consultando SOLO su entry.
      // guild.bans.fetch() sin args descarga TODA la lista → API flood + memoria.
      // guild.bans.fetch(userId) hace una sola request GET /guilds/:id/bans/:userId.
      let isBanned = false;
      try {
        await guild.bans.fetch(ban.user_id);
        isBanned = true;
      } catch {
        isBanned = false;
      }
      if (!isBanned) {
        logger.info("moderation.handler", "User is not banned, removing stale record", { guildId: ban.guild_id, userId: ban.user_id });
        await tempBans.remove(ban.guild_id, ban.user_id);
        return;
      }

      // Unban
      await guild.members.unban(ban.user_id, "Temporary ban expired");

      // Actualizar base de datos
      await tempBans.remove(ban.guild_id, ban.user_id);

      // Registrar acción
      await modActions.record({
        guild_id: ban.guild_id,
        user_id: ban.user_id,
        moderator_id: this.client.user.id,
        action_type: "unban",
        reason: "Temporary ban expired (automatic)"
      });

      logger.info("moderation.handler", "Auto-unbanned user", { guildId: ban.guild_id, userId: ban.user_id, guildName: guild.name });
    } catch (error) {
      logger.error("moderation.handler", "Error unbanning user", { userId: ban.user_id, guildId: ban.guild_id, error: error?.message });
    }
  }

  async unmuteUser(mute) {
    try {
      const guild = await this.client.guilds.fetch(mute.guild_id).catch(() => null);
      if (!guild) {
        logger.warn("moderation.handler", "Guild not found, removing mute record", { guildId: mute.guild_id, userId: mute.user_id });
        await mutes.remove(mute.guild_id, mute.user_id);
        return;
      }

      const member = await guild.members.fetch(mute.user_id).catch(() => null);
      if (!member) {
        logger.info("moderation.handler", "User not in guild, removing stale mute record", { guildId: mute.guild_id, userId: mute.user_id });
        await mutes.remove(mute.guild_id, mute.user_id);
        return;
      }

      const muteRole = guild.roles.cache.find(r => r.name === "Muted");
      if (!muteRole) {
        logger.warn("moderation.handler", "Muted role not found", { guildId: mute.guild_id, guildName: guild.name });
        await mutes.remove(mute.guild_id, mute.user_id);
        return;
      }

      if (!member.roles.cache.has(muteRole.id)) {
        logger.info("moderation.handler", "User does not have muted role, removing stale record", { guildId: mute.guild_id, userId: mute.user_id });
        await mutes.remove(mute.guild_id, mute.user_id);
        return;
      }

      // Remover rol
      await member.roles.remove(muteRole, "Mute expired (automatic)");

      // Actualizar base de datos
      await mutes.remove(mute.guild_id, mute.user_id);

      // Registrar acción
      await modActions.record({
        guild_id: mute.guild_id,
        user_id: mute.user_id,
        moderator_id: this.client.user.id,
        action_type: "unmute",
        reason: "Mute expired (automatic)"
      });

      logger.info("moderation.handler", "Auto-unmuted user", { guildId: mute.guild_id, userId: mute.user_id, guildName: guild.name });
    } catch (error) {
      logger.error("moderation.handler", "Error unmuting user", { userId: mute.user_id, guildId: mute.guild_id, error: error?.message });
    }
  }
}

module.exports = ModerationHandler;
