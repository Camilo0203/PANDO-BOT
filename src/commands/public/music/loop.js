"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { resolveGuildTier } = require("../../../music/premiumResolver");
const {
  COLORS,
  createMusicErrorEmbed,
  createMusicSuccessEmbed,
  createMusicWarningEmbed,
} = require("../../../music/utils/musicEmbeds");
const { t, normalizeLanguage } = require("../../../music/i18n");
const logger = require("../../../utils/structuredLogger");
const { ensureDeferred, safeRespond } = require("../../../music/utils/interactionResponses");
const { MusicControlService } = require("../../../music/services/MusicControlService");
const { getProStoreUrl } = require("../../../utils/proStore");

const log = { error: (msg, meta) => logger.error("Music.LOOP", msg, meta || {}) };
const UPGRADE_URL = getProStoreUrl();

const data = new SlashCommandBuilder()
  .setName("loop")
  .setDescription("Activa o desactiva el modo de repetición")
  .setDescriptionLocalizations({
    "en-US": "Toggle repeat mode",
    "en-GB": "Toggle repeat mode",
    "es-ES": "Activa o desactiva el modo de repetición",
    "es-419": "Activa o desactiva el modo de repetición",
  })
  .addStringOption((opt) =>
    opt.setName("modo").setDescription("Modo de repetición").setDescriptionLocalizations({
      "en-US": "Repeat mode",
      "en-GB": "Repeat mode",
      "es-ES": "Modo de repetición",
      "es-419": "Modo de repetición",
    }).setRequired(true).addChoices(
      { name: "🔂 Pista (repetir la canción actual)", value: "track" },
      { name: "🔁 Cola (repetir toda la cola) [PRO]", value: "queue" },
      { name: "❌ Desactivar", value: "none" }
    )
  );

module.exports = {
  data,
  meta: { scope: "public", category: "music" },
  category: "music",

  async execute(interaction) {
    if (!(await ensureDeferred(interaction))) return;
    const language = normalizeLanguage(interaction.locale || interaction.guildLocale);
    const LOOP_LABELS = {
      track: t(language, "music.label_track"),
      queue: t(language, "music.label_queue"),
      none: t(language, "music.label_disabled"),
    };

    const musicManager = interaction.client.musicManager;
    if (!musicManager) {
      log.error("musicManager not available", { guildId: interaction.guildId });
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.error_lavalink"), language)] });
    }
    const player = musicManager.kazagumo.players.get(interaction.guildId);
    if (!player) {
      return safeRespond(interaction, { embeds: [createMusicErrorEmbed(t(language, "music.loop_no_player"), language)] });
    }

    const mode = interaction.options.getString("modo");
    const tier = await resolveGuildTier(interaction.guildId);
    if (mode === "queue" && tier !== "pro") {
      return safeRespond(interaction, {
        embeds: [createMusicWarningEmbed(t(language, "music.loop_queue_pro_only", { url: UPGRADE_URL }), tier, language)],
      });
    }

    const controlService = new MusicControlService(musicManager);
    controlService.setLoop(player, mode);

    return safeRespond(interaction, {
      embeds: [createMusicSuccessEmbed(
        t(language, "music.loop_set", { label: LOOP_LABELS[mode] }),
        t(language, "music.loop_set_desc", { mode: LOOP_LABELS[mode] }),
        { color: mode === "none" ? COLORS.NEUTRAL : COLORS.PLAYING, tier, language }
      )],
    });
  },
};
