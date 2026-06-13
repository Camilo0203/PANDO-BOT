"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { resolveGuildTier } = require("../../../music/premiumResolver");
const {
  createMusicErrorEmbed,
  createMusicSuccessEmbed,
  proOnlyEmbed,
} = require("../../../music/utils/musicEmbeds");
const { t, normalizeLanguage } = require("../../../music/i18n");
const logger = require("../../../utils/structuredLogger");
const { ensureDeferred, safeRespond } = require("../../../music/utils/interactionResponses");
const { getProStoreUrl } = require("../../../utils/proStore");

const log = { error: (msg, meta) => logger.error("Music.FILTER", msg, meta || {}) };

const UPGRADE_URL = getProStoreUrl();

const data = new SlashCommandBuilder()
  .setName("filter")
  .setDescription("Aplica un filtro de audio [Solo PRO]")
  .setDescriptionLocalizations({
    "en-US": "Apply an audio filter [PRO Only]",
    "en-GB": "Apply an audio filter [PRO Only]",
    "es-ES": "Aplica un filtro de audio [Solo PRO]",
    "es-419": "Aplica un filtro de audio [Solo PRO]",
  })
  .addStringOption((opt) =>
    opt.setName("tipo").setDescription("Tipo de filtro a aplicar").setDescriptionLocalizations({
      "en-US": "Filter type to apply",
      "en-GB": "Filter type to apply",
      "es-ES": "Tipo de filtro a aplicar",
      "es-419": "Tipo de filtro a aplicar",
    }).setRequired(true).addChoices(
      { name: "🔊 Bass Boost", value: "bassboost" },
      { name: "⚡ Nightcore", value: "nightcore" },
      { name: "🌊 Vaporwave", value: "vaporwave" },
      { name: "🔄 Reset (sin filtros)", value: "reset" }
    )
  );

module.exports = {
  data,
  meta: { scope: "public", category: "music" },
  category: "music",

  async execute(interaction) {
    if (!(await ensureDeferred(interaction))) return;
    const language = normalizeLanguage(interaction.locale || interaction.guildLocale);
    const FILTER_DESCRIPTIONS = {
      bassboost: t(language, "music.filter_bassboost"),
      nightcore: t(language, "music.filter_nightcore"),
      vaporwave: t(language, "music.filter_vaporwave"),
      reset: t(language, "music.filter_reset"),
    };

    const tier = await resolveGuildTier(interaction.guildId);
    if (tier !== "pro") {
      return safeRespond(interaction, { embeds: [proOnlyEmbed(t(language, "music.filter_pro_only"), UPGRADE_URL, language)] });
    }

    const voiceChannel = interaction.guild?.members?.cache?.get(interaction.user.id)?.voice?.channel;
    if (!voiceChannel) {
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.filter_voice_required"), language)] });
    }

    const musicManager = interaction.client.musicManager;
    if (!musicManager) {
      log.error("musicManager not available", { guildId: interaction.guildId });
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_lavalink"), language)] });
    }
    const player = musicManager.kazagumo.players.get(interaction.guildId);
    if (!player || !player.playing) {
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.filter_no_player"), language)] });
    }

    const filterName = interaction.options.getString("tipo");
    const result = await musicManager.applyFilter(player, filterName);
    if (!result.ok) {
      log.warn("Filter could not be applied", { guildId: interaction.guildId, filter: filterName, reason: result.reason });
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_generic"), language)] });
    }

    if (filterName === "reset") {
      return safeRespond(interaction, {
        embeds: [createMusicSuccessEmbed(t(language, "music.filter_removed"), t(language, "music.filter_removed_desc"), { tier, language })],
      });
    }
    return safeRespond(interaction, {
      embeds: [createMusicSuccessEmbed(t(language, "music.filter_applied"), FILTER_DESCRIPTIONS[filterName] || filterName, { tier, language })],
    });
  },
};
