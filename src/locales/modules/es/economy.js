module.exports = {
  economy: {
    buy: {
      crate_win: "Crate win",
      error: "Error",
      insufficient_funds: "Insufficient funds",
      not_found: "Not found",
      success: "Success"
    },
    daily: {
      already_claimed: "Already reclamado",
      error: "Error",
      success: "Success"
    },
    deposit: {
      error: "Error",
      insufficient: "Insufficient",
      success: "Success"
    },
    items: {
      background: {
        description: "Fondo personalizado para profile",
        name: "🖼️ Fondo"
      },
      badge: {
        description: "Insignia en tu perfil",
        name: "🏅 Insignia"
      },
      boost_daily: {
        description: "2x recompensas diarias por 7 días",
        name: "💰 Mejora diaria"
      },
      boost_xp: {
        description: "2x XP por 1 día",
        name: "⚡ Mejora de XP"
      },
      color: {
        description: "Color personalizado en embed",
        name: "🎨 Color de nombre"
      },
      crate_common: {
        description: "Suerte de 50-200 monedas",
        name: "📦 Caja Común"
      },
      crate_epic: {
        description: "Suerte de 500-1500 monedas",
        name: "💜 Caja Épica"
      },
      crate_legendary: {
        description: "Suerte de 1500-5000 monedas",
        name: "🔥 Caja Legendaria"
      },
      crate_rare: {
        description: "Suerte de 200-500 monedas",
        name: "✨ Caja Rara"
      },
      role_premium: {
        description: "Rol Premium por 30 días",
        name: "💎 Rol Premium"
      },
      role_staff: {
        description: "Rol Staff temporal",
        name: "👔 Rol Staff"
      },
      role_vip: {
        description: "Rol VIP por 30 días",
        name: "🎖️ Rol VIP"
      },
      ticket: {
        description: "Un ticket adicional",
        name: "🎫 Ticket Extra"
      }
    },
    transfer: {
      error: "Error",
      insufficient: "Insufficient",
      self_transfer: "Self transfer",
      success: "Success"
    },
    withdraw: {
      error: "Error",
      insufficient: "Insufficient",
      success: "Success"
    },
    work: {
      cooldown: "Enfriamiento",
      error: "Error",
      no_job: "No job",
      success: "Success"
    }
  },
  "economy.buy.crate_win": "¡Ganaste {{reward}} monedas de la caja!",
  "economy.buy.error": "Error al procesar la compra.",
  "economy.buy.insufficient_funds": "Necesitas {{price}} monedas. Tienes {{wallet}}.",
  "economy.buy.not_found": "El item no existe en la tienda.",
  "economy.buy.success": "¡Compraste {{name}}!",
  "economy.daily.already_claimed": "Ya reclamaste tus monedas diarias hoy.",
  "economy.daily.error": "Error al reclamar diario.",
  "economy.daily.success": "¡Reclamaste {{reward}} monedas! (Racha: {{streak}})",
  "economy.deposit.error": "Error al depositar.",
  "economy.deposit.insufficient": "No tienes suficientes monedas en tu wallet.",
  "economy.deposit.success": "Has depositado {{amount}} monedas.",
  "economy.transfer.error": "Error al transferir.",
  "economy.transfer.insufficient": "No tienes suficientes monedas.",
  "economy.transfer.self_transfer": "No puedes transferirte monedas a ti mismo.",
  "economy.transfer.success": "Has transferido {{amount}} monedas a {{user}}.",
  "economy.withdraw.error": "Error al retirar.",
  "economy.withdraw.insufficient": "No tienes suficientes monedas en el banco.",
  "economy.withdraw.success": "Has retirado {{amount}} monedas.",
  "economy.work.cooldown": "Espera {{remaining}} minutos para trabajar de nuevo.",
  "economy.work.error": "Error al trabajar.",
  "economy.work.no_job": "No tienes un trabajo. Usa `/work set` para conseguir uno.",
  "economy.work.success": "¡Trabajaste como **{{job}}** y ganaste {{amount}} monedas!"
};
