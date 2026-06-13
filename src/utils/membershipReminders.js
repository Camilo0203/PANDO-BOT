/**
 * Sistema de recordatorios de membresía premium
 * Envía DMs a owners de guilds antes de que venza su plan
 */

const { EmbedBuilder } = require("discord.js");
const { resolveCommercialState } = require("./commercial");
const { resolveGuildLanguage, t } = require("./i18n");
const { resolveGuildPremiumStatus } = require("./premiumStatus");
const { getProStoreUrl } = require("./proStore");
const logger = require("./structuredLogger");

const REMINDER_DAYS = [7, 3, 1]; // Días antes de vencer para enviar recordatorio
const REMINDER_COLLECTION = "membershipReminders";

/**
 * Calcula los días restantes hasta la expiración
 */
function getDaysUntilExpiration(expiresAt) {
  if (!expiresAt) return null;
  const now = new Date();
  const exp = new Date(expiresAt);
  const diffMs = exp.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determina qué recordatorios deben enviarse
 */
function getPendingReminders(daysUntil) {
  if (daysUntil === null || daysUntil < 0) return [];
  return REMINDER_DAYS.filter(days => daysUntil <= days && daysUntil > days - 1);
}

/**
 * Crea el embed de recordatorio de expiración
 */
function buildExpirationReminderEmbed(daysLeft, guildName, language = "es") {
  const isUrgent = daysLeft <= 1;
  const color = isUrgent ? 0xed4245 : 0xfee75c;

  const title = t(language, `premium.reminder.title_${daysLeft}`, { guildName });
  const description = t(language, `premium.reminder.description_${daysLeft}`, { guildName });
  const defaultTitle = t(language, "premium.status_title");
  const defaultDescription = t(language, "premium.pro_active", { guildName });

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title || defaultTitle)
    .setDescription(description || defaultDescription)
    .addFields(
      { name: t(language, "premium.reminder.field_server"), value: guildName, inline: true },
      { name: t(language, "premium.reminder.field_days_remaining"), value: String(daysLeft), inline: true },
      { name: t(language, "premium.reminder.field_plan"), value: "PRO", inline: true }
    )
    .setFooter({ text: t(language, "premium.reminder.footer") })
    .setTimestamp();
}

/**
 * Verifica si ya se envió un recordatorio para estos días específicos
 */
async function wasReminderSent(guildId, daysBefore) {
  const db = require("./database/core").getDb();
  if (!db) return false;
  
  const collection = db.collection(REMINDER_COLLECTION);
  const reminder = await collection.findOne({
    guild_id: guildId,
    days_before: daysBefore,
    created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Últimas 24h
  });
  
  return !!reminder;
}

/**
 * Registra que se envió un recordatorio
 */
async function recordReminderSent(guildId, ownerId, daysBefore) {
  const db = require("./database/core").getDb();
  if (!db) return;
  
  const collection = db.collection(REMINDER_COLLECTION);
  await collection.insertOne({
    guild_id: guildId,
    owner_id: ownerId,
    days_before: daysBefore,
    created_at: new Date(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // TTL 30 días
  });
}

/**
 * Envía recordatorio a un owner específico
 */
async function sendReminderToOwner(client, guild, ownerId, daysLeft, language = "en") {
  try {
    // Verificar si ya se envió
    if (await wasReminderSent(guild.id, daysLeft)) {
      return { sent: false, reason: "already_sent" };
    }

    // Obtener usuario
    const user = await client.users.fetch(ownerId).catch(() => null);
    if (!user) {
      return { sent: false, reason: "user_not_found" };
    }

    // Enviar DM
    const embed = buildExpirationReminderEmbed(daysLeft, guild.name, language);
    await user.send({ embeds: [embed] });

    // Registrar envío
    await recordReminderSent(guild.id, ownerId, daysLeft);

    return { sent: true };
  } catch (error) {
    logger.error('membershipReminders', `Error sending reminder to ${ownerId}`, { error: error?.message || String(error) });
    return { sent: false, reason: "error", error: error.message };
  }
}

/**
 * Procesa recordatorios para todas las guilds con plan PRO
 */
async function processMembershipReminders(client) {
  const results = {
    checked: 0,
    reminded: 0,
    errors: 0,
    details: []
  };

  try {
    // Obtener todas las guilds con plan PRO
    const db = require("./database/core").getDb();
    if (!db) return results;

    const guildsWithPro = await db.collection("settings")
      .find({ "commercial_settings.plan": "pro" })
      .toArray();

    for (const guildSettings of guildsWithPro) {
      results.checked++;
      
      try {
        const language = resolveGuildLanguage(guildSettings);
        const commercialState = resolveCommercialState({ commercial_settings: guildSettings.commercial_settings });
        
        // Solo procesar si tiene fecha de expiración
        if (!commercialState.planExpiresAt) continue;

        const daysUntil = getDaysUntilExpiration(commercialState.planExpiresAt);
        if (daysUntil === null || daysUntil < 0) continue;

        // Determinar qué recordatorios enviar
        const remindersToSend = getPendingReminders(daysUntil);
        if (remindersToSend.length === 0) continue;

        // Obtener guild y owner
        const guild = client.guilds.cache.get(guildSettings.guild_id);
        if (!guild) continue;

        const ownerId = guild.ownerId;
        if (!ownerId) continue;

        // Enviar recordatorios (solo el más urgente si hay múltiples)
        const mostUrgent = Math.min(...remindersToSend);
        const result = await sendReminderToOwner(client, guild, ownerId, mostUrgent, language);
        
        if (result.sent) {
          results.reminded++;
        }
        
        results.details.push({
          guildId: guild.id,
          guildName: guild.name,
          ownerId,
          daysUntil,
          daysBefore: mostUrgent,
          ...result
        });

      } catch (error) {
        results.errors++;
        logger.error('membershipReminders', `Error processing guild ${guildSettings.guild_id}`, { error: error?.message || String(error) });
      }
    }

  } catch (error) {
    logger.error('membershipReminders', 'Critical error processing reminders', { error: error?.message || String(error) });
    results.errors++;
  }

  return results;
}

/**
 * Obtiene información de membresía para un guild específico
 */
async function getMembershipStatus(guildId) {
  try {
    return await resolveGuildPremiumStatus(guildId);
  } catch (error) {
    logger.error('membershipReminders', `Error resolving premium status for guild ${guildId}`, { error: error?.message || String(error) });
    return {
      plan: "free",
      tier: null,
      tierLabel: "FREE",
      isPro: false,
      isPremium: false,
      isLifetime: false,
      planSource: "free",
      planStartedAt: null,
      planExpiresAt: null,
      expiresAt: null,
      daysUntil: null,
      supporterActive: false,
      supporterExpiresAt: null,
      ownerUserId: null,
      upgradeUrl: getProStoreUrl(),
      error: "premium_status_unavailable",
      meta: {
        source: "membership_status_error",
        stale: false,
        unavailable: true,
        errorCode: "premium_status_unavailable",
      },
    };
  }
}

module.exports = {
  REMINDER_DAYS,
  getDaysUntilExpiration,
  getPendingReminders,
  buildExpirationReminderEmbed,
  sendReminderToOwner,
  processMembershipReminders,
  getMembershipStatus,
  wasReminderSent,
  recordReminderSent
};
