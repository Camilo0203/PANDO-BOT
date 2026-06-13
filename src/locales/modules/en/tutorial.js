"use strict";

module.exports = {
  tutorial: {
    slash_description: "Re-send the language onboarding tutorial to a server",
    guild_id_description: "Server ID to send the tutorial to (defaults to this server)",
    owner_only: "This command is only available to the bot owner.",
    guild_not_found: "Server not found. The bot is not in server `{{guildId}}`.",
    sent: "Tutorial sent successfully to **{{guildName}}**.",
    delivery: "Delivery: {{delivery}}",
    channel: "Channel: <#{{channelId}}>",
    dm: "DM to: <@{{userId}}>",
    already_completed: "The tutorial was already completed for **{{guildName}}**. Reset it and try again.",
    failed: "I could not send the tutorial to **{{guildName}}**.",
    failed_hint: "The bot may lack permissions or there may be no writable channels.",
  },
};
