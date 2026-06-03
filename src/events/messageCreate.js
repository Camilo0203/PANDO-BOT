const { EmbedBuilder } = require("discord.js");
const { tickets, autoResponses, levels, levelSettings } = require("../utils/database");
const { getGuildSettings, hasStaffPrivileges } = require("../utils/accessControl");
const { updateTicketControlPanelEmbed } = require("../utils/ticketEmbedUpdater");
const { t } = require("../utils/i18n");
const { hasRequiredPlan } = require("../utils/commercial");

// Cooldown para XP (1 minuto por usuario)
const xpCooldowns = new Map();

/**
 * Función de Inteligencia: Detecta si un mensaje es crítico
 */
function checkUrgency(content, keywords) {
  if (!content || !keywords || !Array.isArray(keywords)) return false;
  const lowerContent = content.toLowerCase();
  return keywords.some(keyword => {
    const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
    return regex.test(lowerContent);
  });
}

/**
 * Función de Inteligencia: Analiza el sentimiento del usuario
 */
function checkSentiment(content) {
  if (!content || content.length < 5) return "calm";
  const letters = content.match(/[a-zA-Z]/g) || [];
  const caps = content.match(/[A-Z]/g) || [];
  if (letters.length > 5 && (caps.length / letters.length) > 0.6) return "angry";
  if (content.includes("!!!") || content.includes("???")) return "angry";
  return "calm";
}

module.exports = {
  name: "messageCreate",
  async execute(message, client) {
    try {
      if (message.author.bot || !message.guild) return;

      // ... (stats y levels logic)
  // ...
      // 1. SISTEMA DE TICKETS (INTELLIGENCE ENGINE)
      const ticketData = await tickets.get(message.channel.id);
      if (ticketData && ticketData.status === "open") {
        const s = await getGuildSettings(message.guild.id);
        const isStaff = hasStaffPrivileges(message.member, s);
        await tickets.incrementMessages(message.channel.id, isStaff);

        if (!isStaff && message.content) {
          const match = await autoResponses.match(message.guild.id, message.content);
          const sentiment = checkSentiment(message.content);
          const lang = s.language || "en";
          
          // Actualizar Panel de Control con Intel
          await updateTicketControlPanelEmbed(message.channel, ticketData, {
            language: lang,
            sentiment: t(lang, `ticket.auto_reply.sentiment_${sentiment}`),
            suggestion: match ? match.response : null,
            color: sentiment === "angry" ? 0xFF0000 : null
          }).catch(err => console.error("[messageCreate] failed to update ticket panel:", err?.message));

          if (match && hasRequiredPlan(s, "pro")) {
            await autoResponses.use(message.guild.id, match.trigger);
            
            const urgencyKeywords = t(lang, "ticket.auto_reply.urgency_keywords");
            const isUrgent = checkUrgency(message.content, urgencyKeywords) || sentiment === "angry";
            
            const prefix = t(lang, "ticket.auto_reply.prefix", { trigger: match.trigger });
            const footer = t(lang, "ticket.auto_reply.footer");
            
            const responseEmbed = new EmbedBuilder()
              .setAuthor({ 
                name: isUrgent ? t(lang, "ticket.auto_reply.priority_badge") : prefix,
                iconURL: client.user.displayAvatarURL() 
              })
              .setColor(isUrgent ? 0xFF0000 : 0x2F3136)
              .setDescription(`${match.response}${isUrgent ? `\n\n${t(lang, "ticket.auto_reply.priority_note")}` : ""}\n\n${footer}`)
              .setTimestamp();

            await message.channel.sendTyping().catch((err) => { console.error("[messageCreate] suppressed error:", err?.message || err); });
            setTimeout(async () => {
               await message.reply({ embeds: [responseEmbed] }).catch((err) => { console.error("[messageCreate] suppressed error:", err?.message || err); });
            }, isUrgent ? 1200 : 600);
          }
        }
      }
    } catch (error) {
      console.error("[messageCreate] Unhandled error in execute:", error?.message || error);
    }
  },
};
