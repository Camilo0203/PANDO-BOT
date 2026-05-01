const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const {
  buildHealthSnapshot,
  getPersistedHealthSnapshot,
} = require("../../../utils/healthMonitor");
const { getBuildInfo } = require("../../../utils/buildInfo");
const { settings } = require("../../../utils/database");
const {
  AUTOMOD_BADGE_GOAL,
  buildAutomodPermissionReport,
  buildAutomodStatusSnapshot,
  humanizeAutomodPermission,
  summarizeAutomodBadgeProgress,
} = require("../../../utils/automod");
const {
  buildCommercialStatusLines,
  resolveCommercialState,
} = require("../../../utils/commercial");
const {
  buildCommercialProjectionFromEntitlement,
} = require("../../../utils/dashboardBridge/transforms");
const dashboardGuilds = require("../../../utils/dashboardBridge/guilds");
const { queueDashboardBridgeSync } = require("../../../utils/dashboardBridgeSync");
const { resolveInteractionLanguage, t } = require("../../../utils/i18n");
const { withDescriptionLocalizations, withInlineDescriptionLocalizations } = require("../../../utils/slashLocalizations");

function formatUptime(secondsTotal) {
  const days = Math.floor(secondsTotal / 86400);
  const hours = Math.floor((secondsTotal % 86400) / 3600);
  const minutes = Math.floor((secondsTotal % 3600) / 60);
  const seconds = Math.floor(secondsTotal % 60);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function formatHeartbeatAge(lastSeen) {
  if (!lastSeen) return "No persisted heartbeat";
  const ageMs = Date.now() - new Date(lastSeen).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return "Invalid data";
  const sec = Math.floor(ageMs / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
}

function formatBuildValue(buildInfo) {
  return [
    `Fingerprint: \`${buildInfo.fingerprint}\``,
    `Version: \`${buildInfo.version}\``,
    `Commit: \`${buildInfo.shortCommit || "unknown"}\``,
    buildInfo.deployTag ? `Tag: \`${buildInfo.deployTag}\`` : null,
  ].filter(Boolean).join("\n");
}

function getOwnerId(interaction) {
  return process.env.OWNER_ID || process.env.DISCORD_OWNER_ID || interaction.client.application?.owner?.id || null;
}

function isOwner(interaction) {
  const ownerId = getOwnerId(interaction);
  return Boolean(ownerId) && interaction.user.id === ownerId;
}

function normalizeDebugSubcommand(sub) {
  return sub === "salud" ? "health" : sub;
}

async function resolveDebugLanguage(interaction) {
  if (!interaction?.guildId) return resolveInteractionLanguage(interaction, null);
  const guildSettings = await settings.get(interaction.guildId).catch(() => null);
  return resolveInteractionLanguage(interaction, guildSettings);
}

function addDays(baseDate, days) {
  const out = new Date(baseDate);
  out.setUTCDate(out.getUTCDate() + Number(days || 0));
  return out;
}

function buildCommercialStatusEmbed(title, guildId, guildName, settingsRecord, language) {
  const state = resolveCommercialState(settingsRecord);
  return new EmbedBuilder()
    .setColor(state.isPro ? 0x57F287 : 0x5865F2)
    .setTitle(title)
    .setDescription(
      `Guild: **${guildName || "Unknown"}**\n` +
      `Guild ID: \`${guildId}\``
    )
    .addFields({
      name: t(language, "status.commercial"),
      value: buildCommercialStatusLines(settingsRecord, language).join("\n"),
      inline: false,
    })
    .setTimestamp();
}

module.exports = {
  data: withDescriptionLocalizations(
    new SlashCommandBuilder()
      .setName("debug")
      .setDescription(t("en", "debug.slash.description"))
      .addSubcommand((s) => withDescriptionLocalizations(
        s.setName("status").setDescription(t("en", "debug.slash.subcommands.status.description")),
        "debug.slash.subcommands.status.description"
      ))
      .addSubcommand((s) => withDescriptionLocalizations(
        s.setName("automod-badge").setDescription(t("en", "debug.slash.subcommands.automod_badge.description")),
        "debug.slash.subcommands.automod_badge.description"
      ))
      .addSubcommand((s) => withDescriptionLocalizations(
        s.setName("health").setDescription(t("en", "debug.slash.subcommands.health.description")),
        "debug.slash.subcommands.health.description"
      ))
      .addSubcommand((s) => withDescriptionLocalizations(
        s.setName("memory").setDescription(t("en", "debug.slash.subcommands.memory.description")),
        "debug.slash.subcommands.memory.description"
      ))
      .addSubcommand((s) => withDescriptionLocalizations(
        s.setName("cache").setDescription(t("en", "debug.slash.subcommands.cache.description")),
        "debug.slash.subcommands.cache.description"
      ))
      .addSubcommand((s) => withDescriptionLocalizations(
        s.setName("guilds").setDescription(t("en", "debug.slash.subcommands.guilds.description")),
        "debug.slash.subcommands.guilds.description"
      ))
      .addSubcommand((s) => withDescriptionLocalizations(
        s.setName("voice").setDescription(t("en", "debug.slash.subcommands.voice.description")),
        "debug.slash.subcommands.voice.description"
      ))
      .addSubcommandGroup((group) =>
        withInlineDescriptionLocalizations(
          group
            .setName("entitlements")
            .setDescription("Inspect or update guild commercial access"),
          "Inspect or update guild commercial access",
          "Inspeccionar o actualizar el acceso comercial del servidor"
        )
          .addSubcommand((s) =>
            withDescriptionLocalizations(
              s
                .setName("status")
                .setDescription(t("en", "debug.slash.subcommands.entitlements_status.description"))
                .addStringOption((o) =>
                  withInlineDescriptionLocalizations(
                    o.setName("guild_id").setDescription("Target guild ID").setRequired(true),
                    "Target guild ID",
                    "ID del servidor objetivo"
                  )
                ),
              "debug.slash.subcommands.entitlements_status.description"
            )
          )
          .addSubcommand((s) =>
            withDescriptionLocalizations(
              s
                .setName("set-plan")
                .setDescription(t("en", "debug.slash.subcommands.entitlements_set_plan.description"))
            .addStringOption((o) =>
              withInlineDescriptionLocalizations(
                o.setName("guild_id").setDescription("Target guild ID").setRequired(true),
                "Target guild ID",
                "ID del servidor objetivo"
              )
            )
            .addStringOption((o) =>
              withInlineDescriptionLocalizations(
                o
                  .setName("tier")
                  .setDescription("Plan tier")
                  .setRequired(true)
                  .addChoices(
                    { name: "Free", value: "free", name_localizations: { "es-ES": "Free", "es-419": "Free" } },
                    { name: "Pro", value: "pro", name_localizations: { "es-ES": "Pro", "es-419": "Pro" } },
                    { name: "Enterprise", value: "enterprise", name_localizations: { "es-ES": "Empresarial", "es-419": "Empresarial" } },
                  ),
                "Plan tier",
                "Nivel del plan"
              )
            )
            .addIntegerOption((o) =>
              withInlineDescriptionLocalizations(
                o
                  .setName("expires_in_days")
                  .setDescription("Optional duration in days for Pro")
                  .setRequired(false)
                  .setMinValue(1)
                  .setMaxValue(3650),
                "Optional duration in days for Pro",
                "Duración opcional en días para Pro"
              )
            )
                .addStringOption((o) =>
                  withInlineDescriptionLocalizations(
                    o
                      .setName("note")
                      .setDescription("Optional internal note")
                      .setRequired(false)
                      .setMaxLength(500),
                    "Optional internal note",
                    "Nota interna opcional"
                  )
                ),
              "debug.slash.subcommands.entitlements_set_plan.description"
            )
          )
          .addSubcommand((s) =>
            withDescriptionLocalizations(
              s
                .setName("set-supporter")
                .setDescription(t("en", "debug.slash.subcommands.entitlements_set_supporter.description"))
            .addStringOption((o) =>
              withInlineDescriptionLocalizations(
                o.setName("guild_id").setDescription("Target guild ID").setRequired(true),
                "Target guild ID",
                "ID del servidor objetivo"
              )
            )
            .addBooleanOption((o) =>
              withInlineDescriptionLocalizations(
                o.setName("active").setDescription("Enable or disable supporter recognition").setRequired(true),
                "Enable or disable supporter recognition",
                "Activar o desactivar reconocimiento de supporter"
              )
            )
            .addIntegerOption((o) =>
              withInlineDescriptionLocalizations(
                o
                  .setName("expires_in_days")
                  .setDescription("Optional duration in days for supporter status")
                  .setRequired(false)
                  .setMinValue(1)
                  .setMaxValue(3650),
                "Optional duration in days for supporter status",
                "Duración opcional en días para el estado supporter"
              )
            )
                .addStringOption((o) =>
                  withInlineDescriptionLocalizations(
                    o
                      .setName("note")
                      .setDescription("Optional internal note")
                      .setRequired(false)
                      .setMaxLength(500),
                    "Optional internal note",
                    "Nota interna opcional"
                  )
                ),
              "debug.slash.subcommands.entitlements_set_supporter.description"
            )
          )
      ),
    "debug.slash.description"
  ),
  meta: {
    hidden: true,
    privateOnly: true,
  },

  async execute(interaction) {
    const language = await resolveDebugLanguage(interaction);
    if (!isOwner(interaction)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription(t(language, "debug.access_denied")),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    let group = null;
    try {
      group = interaction.options.getSubcommandGroup(false);
    } catch (e) {
      // getSubcommandGroup throws if no group exists, which is expected
      // Keep group as null and continue with subcommand logic
    }

    const sub = normalizeDebugSubcommand(interaction.options.getSubcommand());

    if (group === "entitlements") {
      if (sub === "status") return this.entitlementStatus(interaction, language);
      if (sub === "set-plan") return this.setPlan(interaction, language);
      if (sub === "set-supporter") return this.setSupporter(interaction, language);
    }

    if (sub === "status") return this.status(interaction, language);
    if (sub === "automod-badge") return this.automodBadge(interaction, language);
    if (sub === "health") return this.health(interaction, language);
    if (sub === "memory") return this.memory(interaction, language);
    if (sub === "cache") return this.cache(interaction, language);
    if (sub === "guilds") return this.guilds(interaction, language);
    if (sub === "voice") return this.voice(interaction, language);

    return interaction.reply({
      content: t(language, "debug.unknown_subcommand"),
      flags: MessageFlags.Ephemeral,
    });
  },

  async status(interaction, language) {
    const client = interaction.client;
    const buildInfo = getBuildInfo();
    const embed = new EmbedBuilder()
      .setTitle(t(language, "debug.title.status"))
      .setColor(0x5865F2)
      .addFields(
        { name: t(language, "debug.field.api_ping"), value: `\`${client.ws.ping}ms\``, inline: true },
        { name: t(language, "debug.field.uptime"), value: `\`${formatUptime(process.uptime())}\``, inline: true },
        { name: t(language, "debug.field.guilds"), value: `\`${client.guilds.cache.size}\``, inline: true },
        { name: t(language, "debug.field.cached_users"), value: `\`${client.users.cache.size}\``, inline: true },
        { name: t(language, "debug.field.cached_channels"), value: `\`${client.channels.cache.size}\``, inline: true },
        { name: t(language, "debug.field.deploy"), value: formatBuildValue(buildInfo), inline: false }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },

  async automodBadge(interaction, language) {
    const guildEntries = [];
    const issueLines = [];

    let application = interaction.client.application || null;
    if (application?.fetch) {
      application = await application.fetch().catch(() => application);
    }

    for (const guild of interaction.client.guilds.cache.values()) {
      const current = await settings.get(guild.id);

      let me = guild.members?.me || null;
      if (!me && guild.members?.fetchMe) {
        me = await guild.members.fetchMe().catch(() => null);
      }

      const permissionReport = buildAutomodPermissionReport(me?.permissions, current);
      let liveRules = [];

      if (permissionReport.ok) {
        try {
          const fetchedRules = await guild.autoModerationRules.fetch();
          liveRules = Array.from(fetchedRules.values());
        } catch (error) {
          permissionReport.ok = false;
          permissionReport.missing = ["MANAGE_GUILD"];
          issueLines.push(
            `- **${guild.name}**: could not inspect AutoMod rules (${error?.message || "unknown error"})`
          );
        }
      } else {
        issueLines.push(
          `- **${guild.name}**: missing ${permissionReport.missing
            .map(humanizeAutomodPermission)
            .join(", ")}`
        );
      }

      guildEntries.push({
        guildId: guild.id,
        guildName: guild.name,
        ...buildAutomodStatusSnapshot({
          settingsRecord: current,
          liveRules,
          permissionReport,
        }),
      });
    }

    const progress = summarizeAutomodBadgeProgress(guildEntries, {
      goal: AUTOMOD_BADGE_GOAL,
      appFlags: application?.flags || null,
    });

    const topGuildLines = guildEntries
      .filter((entry) => entry.liveManagedRuleCount > 0)
      .sort((a, b) => b.liveManagedRuleCount - a.liveManagedRuleCount)
      .slice(0, 8)
      .map((entry) => `- **${entry.guildName}**: \`${entry.liveManagedRuleCount}\` live rules`);

    const embed = new EmbedBuilder()
      .setColor(progress.remainingRuleCount === 0 ? 0x57F287 : 0x5865F2)
      .setTitle(t(language, "debug.title.automod"))
      .setDescription(t(language, "debug.description.automod"))
      .addFields(
        {
          name: t(language, "debug.field.progress"),
          value:
            `${t(language, "debug.value.managed_rules", { count: progress.totalManagedRuleCount })}\n` +
            `${t(language, "debug.value.remaining_to_goal", { goal: AUTOMOD_BADGE_GOAL, count: progress.remainingRuleCount })}\n` +
            `${t(language, "debug.value.app_flag_present", { value: progress.badgeFlagActive ? t(language, "debug.value.yes") : t(language, "debug.value.no") })}`,
          inline: false,
        },
        {
          name: t(language, "debug.field.guild_coverage"),
          value:
            `${t(language, "debug.value.automod_enabled", { count: progress.enabledGuildCount })}\n` +
            `${t(language, "debug.value.missing_permissions", { count: progress.missingPermissionsGuildCount })}\n` +
            `${t(language, "debug.value.failed_partial_sync", { count: progress.failedSyncGuildCount })}`,
          inline: false,
        }
      )
      .setTimestamp();

    if (topGuildLines.length) {
      embed.addFields({
        name: t(language, "debug.field.guilds_live_rules"),
        value: topGuildLines.join("\n").slice(0, 1024),
        inline: false,
      });
    }

    if (issueLines.length) {
      embed.addFields({
        name: t(language, "debug.field.guilds_attention"),
        value: issueLines.slice(0, 8).join("\n").slice(0, 1024),
        inline: false,
      });
    }

    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },

  async health(interaction, language) {
    const buildInfo = getBuildInfo();
    const pingWarnMs = Math.max(50, Number(process.env.HEALTH_PING_WARN_MS || 300));
    const errorWarnPct = Math.max(1, Number(process.env.HEALTH_ERROR_RATE_WARN_PCT || 25));

    const snapshot = buildHealthSnapshot(interaction.client);
    const persisted = await getPersistedHealthSnapshot();
    const topErrors = snapshot.summary?.topErrors || [];

    const pingState = snapshot.pingMs >= pingWarnMs ? t(language, "debug.value.high") : t(language, "debug.value.ok");
    const errorState = snapshot.errorRatePct >= errorWarnPct ? t(language, "debug.value.high") : t(language, "debug.value.ok");

    const embed = new EmbedBuilder()
      .setColor(errorState === "HIGH" || pingState === "HIGH" ? 0xE67E22 : 0x57F287)
      .setTitle(t(language, "debug.title.health"))
      .setDescription(t(language, "debug.description.health"))
      .addFields(
        {
          name: t(language, "debug.field.quick_state"),
          value:
            `${t(language, "debug.value.ping_state", { state: pingState, value: snapshot.pingMs, threshold: pingWarnMs })}\n` +
            `${t(language, "debug.value.error_rate", { state: errorState, value: snapshot.errorRatePct, threshold: errorWarnPct })}`,
          inline: false,
        },
        {
          name: t(language, "debug.field.interaction_window"),
          value:
            t(language, "debug.value.interaction_totals", {
              total: snapshot.interactionsTotal,
              ok: snapshot.byStatus.ok,
              errors: snapshot.byStatus.errors,
              denied: snapshot.byStatus.denied,
              rateLimited: snapshot.byStatus.rateLimited,
            }),
          inline: false,
        },
        {
          name: t(language, "debug.field.heartbeat"),
          value:
            t(language, "debug.value.heartbeat", {
              lastSeen: formatHeartbeatAge(persisted?.last_seen),
              guilds: persisted?.guilds ?? interaction.client.guilds.cache.size,
            }),
          inline: false,
        },
        {
          name: "🔒 Security",
          value:
            `Encryption: \`${process.env.ENCRYPTION_KEY ? "enabled" : "disabled"}\`\n` +
            `Hash Salt: \`${process.env.HASH_SALT ? "enabled" : "disabled"}\`\n` +
            `Mongo TLS: \`${(process.env.MONGO_URI || "").includes("tls=true") || (process.env.MONGO_URI || "").includes("mongodb+srv://") ? "enabled" : "check"}\`\n` +
            `Env Validated: \`${Boolean(process.env.OWNER_ID)}\``,
          inline: false,
        },
        {
          name: t(language, "debug.field.deploy"),
          value: formatBuildValue(buildInfo),
          inline: false,
        }
      )
      .setTimestamp();

    if (topErrors.length) {
      const lines = topErrors
        .slice(0, 3)
        .map((item, idx) => `${idx + 1}. ${item.kind}:${item.name} -> ${item.errors} errors`);
      embed.addFields({
        name: t(language, "debug.field.top_errors"),
        value: lines.join("\n").slice(0, 1024),
        inline: false,
      });
    }

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },

  async memory(interaction, language) {
    const memory = process.memoryUsage();
    const formatMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

    const embed = new EmbedBuilder()
      .setTitle(t(language, "debug.title.memory"))
      .setColor(0xFEE75C)
      .addFields(
        { name: t(language, "debug.field.rss"), value: `\`${formatMB(memory.rss)}\``, inline: true },
        { name: t(language, "debug.field.heap_total"), value: `\`${formatMB(memory.heapTotal)}\``, inline: true },
        { name: t(language, "debug.field.heap_used"), value: `\`${formatMB(memory.heapUsed)}\``, inline: true },
        { name: t(language, "debug.field.external"), value: `\`${formatMB(memory.external)}\``, inline: true }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },

  async cache(interaction, language) {
    const client = interaction.client;
    const embed = new EmbedBuilder()
      .setTitle(t(language, "debug.title.cache"))
      .setColor(0x57F287)
      .setDescription(t(language, "debug.description.cache"))
      .addFields(
        { name: t(language, "debug.field.users"), value: `\`${client.users.cache.size}\``, inline: true },
        { name: t(language, "debug.field.channels"), value: `\`${client.channels.cache.size}\``, inline: true },
        { name: t(language, "debug.field.guilds"), value: `\`${client.guilds.cache.size}\``, inline: true }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },

  async guilds(interaction, language) {
    const guilds = interaction.client.guilds.cache.map((g) => ({
      name: g.name,
      id: g.id,
      members: g.memberCount,
    }));

    if (!guilds.length) {
      return interaction.reply({
        content: t(language, "debug.no_connected_guilds"),
        flags: MessageFlags.Ephemeral,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(t(language, "debug.title.guilds"))
      .setColor(0x5865F2)
      .setDescription(
        guilds
          .slice(0, 20)
          .map((g) => `**${g.name}** (\`${g.id}\`) - ${g.members} members`)
          .join("\n")
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },

  async voice(interaction, language) {
    const embed = new EmbedBuilder()
      .setTitle(t(language, "debug.title.voice"))
      .setColor(0x57F287)
      .setDescription(t(language, "debug.description.voice"))
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },

  async entitlementStatus(interaction, language) {
    const guildId = interaction.options.getString("guild_id", true);
    const current = await settings.get(guildId);
    const currentEntitlement = await dashboardGuilds.fetchGuildEffectiveEntitlement(guildId).catch(() => null);
    const targetSettings = currentEntitlement
      ? { ...current, ...buildCommercialProjectionFromEntitlement(current, currentEntitlement) }
      : current;
    const guildName = interaction.client.guilds.cache.get(guildId)?.name || null;

    return interaction.reply({
      embeds: [
        buildCommercialStatusEmbed(t(language, "debug.title.entitlements"), guildId, guildName, targetSettings, language),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },

  async setPlan(interaction, language) {
    const guildId = interaction.options.getString("guild_id", true);
    const tier = interaction.options.getString("tier", true);
    const expiresInDays = interaction.options.getInteger("expires_in_days");
    const note = interaction.options.getString("note");
    const now = new Date();
    const current = await settings.get(guildId);
    const currentEntitlement = await dashboardGuilds.fetchGuildEffectiveEntitlement(guildId).catch(() => null);
    await dashboardGuilds.requestSupabase("guild_entitlement_overrides", {
      method: "POST",
      query: { on_conflict: "guild_id" },
      body: [
        {
          guild_id: guildId,
          plan_override: tier,
          plan_override_expires_at: tier !== "free" && expiresInDays ? addDays(now, expiresInDays).toISOString() : null,
          supporter_enabled: currentEntitlement?.supporter_enabled === true,
          supporter_expires_at: currentEntitlement?.supporter_expires_at || null,
          note: note || null,
          source: "owner_debug",
          updated_by_actor: interaction.user.id,
        },
      ],
      preferResolution: true,
      returnMinimal: true,
    });
    const entitlementRow = await dashboardGuilds.fetchGuildEffectiveEntitlement(guildId);
    const patch = buildCommercialProjectionFromEntitlement(current, entitlementRow, { now });
    const updated = await settings.update(guildId, patch, {
      skipDashboardSync: true,
      dashboardSyncReason: "owner_debug_entitlement_set_plan",
    });
    queueDashboardBridgeSync(interaction.client, {
      guildId,
      reason: "owner_debug_entitlement_set_plan",
      delayMs: 0,
    });
    const guildName = interaction.client.guilds.cache.get(guildId)?.name || null;

    return interaction.reply({
      embeds: [
        buildCommercialStatusEmbed(t(language, "debug.title.plan_updated"), guildId, guildName, updated || { ...current, ...patch }, language),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },

  async setSupporter(interaction, language) {
    const guildId = interaction.options.getString("guild_id", true);
    const active = interaction.options.getBoolean("active", true);
    const expiresInDays = interaction.options.getInteger("expires_in_days");
    const note = interaction.options.getString("note");
    const now = new Date();
    const current = await settings.get(guildId);
    const currentEntitlement = await dashboardGuilds.fetchGuildEffectiveEntitlement(guildId).catch(() => null);
    await dashboardGuilds.requestSupabase("guild_entitlement_overrides", {
      method: "POST",
      query: { on_conflict: "guild_id" },
      body: [
        {
          guild_id: guildId,
          plan_override: currentEntitlement?.effective_plan || current?.commercial_settings?.plan || current?.dashboard_general_settings?.opsPlan || "free",
          plan_override_expires_at: currentEntitlement?.plan_expires_at || null,
          supporter_enabled: active,
          supporter_expires_at: active && expiresInDays ? addDays(now, expiresInDays).toISOString() : null,
          note: note || null,
          source: "owner_debug",
          updated_by_actor: interaction.user.id,
        },
      ],
      preferResolution: true,
      returnMinimal: true,
    });
    const entitlementRow = await dashboardGuilds.fetchGuildEffectiveEntitlement(guildId);
    const patch = buildCommercialProjectionFromEntitlement(current, entitlementRow, { now });
    const updated = await settings.update(guildId, patch, {
      skipDashboardSync: true,
      dashboardSyncReason: "owner_debug_entitlement_set_supporter",
    });
    queueDashboardBridgeSync(interaction.client, {
      guildId,
      reason: "owner_debug_entitlement_set_supporter",
      delayMs: 0,
    });
    const guildName = interaction.client.guilds.cache.get(guildId)?.name || null;

    return interaction.reply({
      embeds: [
        buildCommercialStatusEmbed(t(language, "debug.title.supporter_updated"), guildId, guildName, updated || { ...current, ...patch }, language),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};

module.exports.alias = {
  help: { redirect: "help" },
  soporte: { redirect: "help", options: { seccion: "tickets" } },
  estadisticas: { redirect: "stats", subcommand: "server" },
};
