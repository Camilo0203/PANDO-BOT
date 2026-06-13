"use strict";

/**
 * @typedef {import('discord.js').ButtonInteraction|import('discord.js').ModalSubmitInteraction} VerifInteraction
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} = require("discord.js");
const {
  verifSettings,
  verifCodes,
  verifCaptchas,
  verifLogs,
  settings,
  verifMemberStates,
} = require("../utils/database");
const {
  VERIFICATION_LIMITS,
  normalizeVerificationAnswer,
  inspectVerificationConfiguration,
  applyVerification,
  resolveVerifiedRoleId,
  buildModeLabel,
} = require("../utils/verificationService");
const {
  analyzeUserRisk,
  generateCaptcha,
  verifyCaptchaAnswer,
  isAccountTooNew,
  getAccountAgeDays,
} = require("../utils/verificationRiskService");
const E = require("../utils/embeds");
const { resolveInteractionLanguage, t } = require("../utils/i18n");

/**
 * Route verification interactions by customId
 * @param {VerifInteraction} interaction - Discord.js interaction
 * @returns {Promise<*>}
 */
async function handleVerif(interaction) {
  const { customId } = interaction;

  if (customId === "verify_start") return handleVerifyStart(interaction);
  if (customId === "verify_help") return handleVerifyHelp(interaction);
  if (customId === "verify_code_modal") return handleCodeModal(interaction);
  if (customId === "verify_question_modal") return handleQuestionModal(interaction);
  if (customId === "verify_captcha_modal") return handleCaptchaModal(interaction);
  if (customId === "verify_enter_code") return handleEnterCode(interaction);
  if (customId === "verify_resend_code") return handleResendCode(interaction);

  return null;
}

/**
 * Resolve cooldown date from member state, returning null if expired
 * @param {Object|null} state - verifMemberStates record
 * @returns {Date|null}
 */
function buildCooldownDate(state) {
  const cooldown = state?.cooldown_until ? new Date(state.cooldown_until) : null;
  if (!cooldown || Number.isNaN(cooldown.getTime())) return null;
  return cooldown.getTime() > Date.now() ? cooldown : null;
}

/**
 * Build Discord relative timestamp string
 * @param {Date} date
 * @returns {string}
 */
function buildRetryText(date) {
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

/**
 * @param {string[]} [issues=[]]
 * @returns {string}
 */
function buildIssueText(issues = []) {
  return issues.map((issue) => `- ${issue}`).join("\n");
}

/**
 * @param {string[]} [warnings=[]]
 * @param {string} [language="en"]
 * @returns {string}
 */
function buildWarningText(warnings = [], language = "en") {
  if (!Array.isArray(warnings) || warnings.length === 0) {
    return t(language, "verify.handler.log_warning_none");
  }

  return warnings.map((warning) => `- ${warning}`).join("\n").slice(0, 1024);
}

/**
 * Reply to an interaction ephemerally, using followUp if already replied/deferred
 * @param {VerifInteraction} interaction
 * @param {Object} payload - Discord.js reply payload
 * @returns {Promise<*>}
 */
async function replyEphemeral(interaction, payload) {
  if (interaction.replied || interaction.deferred) {
    return interaction.followUp({ ...payload, flags: 64 }).catch((err) => { console.error("[verifHandler] suppressed error:", err?.message || err); });
  }
  return interaction.reply({ ...payload, flags: 64 }).catch((err) => { console.error("[verifHandler] suppressed error:", err?.message || err); });
}

/**
 * Record a verification failure and enforce cooldown after threshold
 * @param {string} guildId
 * @param {string} userId
 * @param {string} mode - verification mode
 * @param {string} reason - failure reason code
 * @param {string} source - source identifier for audit
 * @param {Object} [metadata={}]
 * @returns {Promise<Date|null>} cooldownUntil if threshold reached
 */
async function markFailure(guildId, userId, mode, reason, source, metadata = {}) {
  const currentState = await verifMemberStates.get(guildId, userId);
  const nextFailures = Number(currentState?.active_failures || 0) + 1;
  const cooldownUntil = nextFailures >= VERIFICATION_LIMITS.maxFailuresBeforeCooldown
    ? new Date(Date.now() + VERIFICATION_LIMITS.failureCooldownMinutes * 60 * 1000)
    : null;

  await Promise.all([
    verifMemberStates.markFailed(guildId, userId, mode, reason, { cooldownUntil }),
    verifLogs.add({
      guild_id: guildId,
      user_id: userId,
      status: "failed",
      event: "verification_failed",
      mode,
      reason,
      source,
      metadata,
    }),
  ]);

  return cooldownUntil;
}

async function handleVerifyStart(interaction) {
  const guild = interaction.guild;
  const user = interaction.user;
  const [guildSettings, verificationSettings, state] = await Promise.all([
    settings.get(guild.id),
    verifSettings.get(guild.id),
    verifMemberStates.get(guild.id, user.id),
  ]);
  const language = resolveInteractionLanguage(interaction, guildSettings);

  if (!verificationSettings || !verificationSettings.enabled) {
    return replyEphemeral(interaction, {
      embeds: [E.errorEmbed(t(language, "verify.handler.not_active"))],
    });
  }

  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) {
    return replyEphemeral(interaction, {
      embeds: [E.errorEmbed(t(language, "verify.handler.member_not_found"))],
    });
  }

  const verifiedRoleId = resolveVerifiedRoleId(verificationSettings, guildSettings);
  if (verifiedRoleId && member.roles.cache.has(verifiedRoleId)) {
    return replyEphemeral(interaction, {
      embeds: [
        new EmbedBuilder()
          .setColor(E.Colors.SUCCESS)
          .setDescription(t(language, "verify.handler.already_verified")),
      ],
    });
  }

  const inspection = inspectVerificationConfiguration(
    guild,
    verificationSettings,
    guildSettings,
    { skipChannelChecks: true, language }
  );
  if (inspection.errors.length > 0) {
    await verifLogs.add({
      guild_id: guild.id,
      user_id: user.id,
      status: "permission_error",
      event: "permission_error",
      mode: verificationSettings.mode || "button",
      reason: inspection.errors.join(" | "),
      source: "interaction.verify.start",
      metadata: {
        warnings: inspection.warnings,
      },
    });
    return replyEphemeral(interaction, {
      embeds: [
        E.errorEmbed(
          t(language, "verify.handler.misconfigured", {
            issues: buildIssueText(inspection.errors),
          })
        ),
      ],
    });
  }

  const cooldownUntil = buildCooldownDate(state);
  if (cooldownUntil) {
    return replyEphemeral(interaction, {
      embeds: [
        E.warningEmbed(
          t(language, "verify.handler.too_many_attempts", {
            retryText: buildRetryText(cooldownUntil),
          })
        ),
      ],
    });
  }

  const joinedAt = state?.last_joined_at ? new Date(state.last_joined_at) : null;
  if (joinedAt && Number.isFinite(joinedAt.getTime())) {
    const minVerifyTime = joinedAt.getTime() + VERIFICATION_LIMITS.minJoinAgeSeconds * 1000;
    if (minVerifyTime > Date.now()) {
      return replyEphemeral(interaction, {
        embeds: [
          E.warningEmbed(
            t(language, "verify.handler.join_too_recent", {
              retryText: `<t:${Math.floor(minVerifyTime / 1000)}:R>`,
            })
          ),
        ],
      });
    }
  }

  const minAccountAgeDays = verificationSettings.min_account_age_days || 0;
  if (minAccountAgeDays > 0 && isAccountTooNew(user, minAccountAgeDays)) {
    const accountAgeDays = getAccountAgeDays(user);
    await verifLogs.add({
      guild_id: guild.id,
      user_id: user.id,
      status: "failed",
      event: "account_too_new",
      mode: verificationSettings.mode || "button",
      reason: `account_age_${accountAgeDays}d_required_${minAccountAgeDays}d`,
      source: "interaction.verify.start",
    });
    return replyEphemeral(interaction, {
      embeds: [
        E.errorEmbed(
          t(language, "verify.handler.account_too_new", {
            days: minAccountAgeDays,
            currentDays: accountAgeDays,
          })
        ),
      ],
    });
  }

  let riskAnalysis = null;
  let effectiveMode = verificationSettings.mode || "button";

  if (verificationSettings.risk_based_escalation) {
    const recentJoinCount = await verifMemberStates.countRecentJoins(
      guild.id,
      new Date(Date.now() - (verificationSettings.antiraid_seconds || 30) * 1000)
    );

    riskAnalysis = await analyzeUserRisk(user, member, state, verificationSettings, {
      recentJoinCount,
    });

    if (riskAnalysis.requiresEscalation) {
      effectiveMode = riskAnalysis.recommendation.mode;
      await verifLogs.add({
        guild_id: guild.id,
        user_id: user.id,
        status: "info",
        event: "risk_escalation",
        mode: effectiveMode,
        reason: `risk_${riskAnalysis.riskLevel}_score_${riskAnalysis.totalScore}`,
        source: "interaction.verify.start",
        metadata: {
          originalMode: verificationSettings.mode,
          escalatedMode: effectiveMode,
          riskLevel: riskAnalysis.riskLevel,
          riskScore: riskAnalysis.totalScore,
          flags: riskAnalysis.flags,
        },
      });
    }
  }

  await Promise.all([
    verifMemberStates.markStarted(guild.id, user.id, verificationSettings.mode || "button", {
      reason: "verification_started",
    }),
    verifLogs.add({
      guild_id: guild.id,
      user_id: user.id,
      status: "started",
      event: "verification_started",
      mode: verificationSettings.mode || "button",
      source: "interaction.verify.start",
    }),
  ]);

  if (effectiveMode === "captcha") {
    const captchaType = verificationSettings.captcha_type || "math";
    const captcha = generateCaptcha(captchaType);
    await verifCaptchas.generate(user.id, guild.id, captcha);

    await verifLogs.add({
      guild_id: guild.id,
      user_id: user.id,
      status: "captcha_prompt",
      event: "captcha_prompt_opened",
      mode: "captcha",
      source: "interaction.verify.start",
      metadata: {
        captchaType,
        riskAnalysis: riskAnalysis ? {
          riskLevel: riskAnalysis.riskLevel,
          totalScore: riskAnalysis.totalScore,
          flags: riskAnalysis.flags,
        } : null,
      },
    });

    const modal = new ModalBuilder()
      .setCustomId("verify_captcha_modal")
      .setTitle(t(language, "verify.handler.captcha_modal_title"));

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("captcha_input")
          .setLabel(captcha.question)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(20)
          .setPlaceholder(t(language, "verify.handler.captcha_placeholder"))
      )
    );

    return interaction.showModal(modal);
  }

  if (effectiveMode === "button") {
    return completeVerification({
      interaction,
      guild,
      guildSettings,
      verificationSettings,
      user,
      member,
      mode: "button",
      source: "interaction.verify.button",
    });
  }

  if (effectiveMode === "code") {
    const existingCode = await verifCodes.getActive(user.id, guild.id);
    const code = existingCode || await verifCodes.generate(user.id, guild.id);

    try {
      await user.send({
        embeds: [
          new EmbedBuilder()
            .setColor(E.Colors.SUCCESS)
            .setTitle(t(language, "verify.handler.code_dm_title"))
            .setDescription(t(language, "verify.handler.code_dm_description", {
              guild: guild.name,
              code,
              enterCodeLabel: t(language, "common.buttons.enter_code"),
            }))
            .setFooter({ text: guild.name })
            .setTimestamp(),
        ],
      });
    } catch (_) {
      await verifLogs.add({
        guild_id: guild.id,
        user_id: user.id,
        status: "permission_error",
        event: "permission_error",
        mode: "code",
        reason: "dm_delivery_failed",
        source: "interaction.verify.start",
      });
      return replyEphemeral(interaction, {
        embeds: [
          E.errorEmbed(t(language, "verify.handler.dm_failed")),
        ],
      });
    }

    await Promise.all([
      verifMemberStates.markCodeSent(guild.id, user.id, { reason: "code_sent" }),
      verifLogs.add({
        guild_id: guild.id,
        user_id: user.id,
        status: "code_sent",
        event: "code_sent",
        mode: "code",
        source: "interaction.verify.start",
      }),
    ]);

    return replyEphemeral(interaction, {
      embeds: [
        new EmbedBuilder()
          .setColor(E.Colors.SUCCESS)
          .setTitle(t(language, "verify.handler.code_sent_title"))
          .setDescription(t(language, "verify.handler.code_sent_description", {
            enterCodeLabel: t(language, "common.buttons.enter_code"),
          }))
          .setFooter({
            text: t(language, "verify.handler.code_sent_footer", {
              seconds: VERIFICATION_LIMITS.codeResendCooldownSeconds,
            }),
          })
          .setTimestamp(),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("verify_enter_code")
            .setLabel(t(language, "common.buttons.enter_code"))
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("verify_resend_code")
            .setLabel(t(language, "common.buttons.resend_code"))
            .setStyle(ButtonStyle.Secondary)
        ),
      ],
    });
  }

  if (effectiveMode === "question") {
    const questionPool = verificationSettings.question_pool || [];
    let selectedQuestion = null;
    let selectedAnswer = null;

    if (questionPool.length > 0) {
      const randomIndex = Math.floor(Math.random() * questionPool.length);
      selectedQuestion = questionPool[randomIndex].question;
      selectedAnswer = questionPool[randomIndex].answer;

      await verifMemberStates.setActiveQuestion(guild.id, user.id, {
        question: selectedQuestion,
        answer: selectedAnswer,
        index: randomIndex,
      });
    } else if (verificationSettings.question && verificationSettings.question_answer) {
      selectedQuestion = verificationSettings.question;
      selectedAnswer = verificationSettings.question_answer;
    }

    if (!selectedQuestion || !selectedAnswer) {
      return replyEphemeral(interaction, {
        embeds: [
          E.errorEmbed(t(language, "verify.handler.question_missing")),
        ],
      });
    }

    await verifLogs.add({
      guild_id: guild.id,
      user_id: user.id,
      status: "question_prompt",
      event: "question_prompt_opened",
      mode: "question",
      source: "interaction.verify.start",
      metadata: {
        questionPoolUsed: questionPool.length > 0,
        questionIndex: questionPool.length > 0 ? randomIndex : null,
      },
    });

    const modal = new ModalBuilder()
      .setCustomId("verify_question_modal")
      .setTitle(t(language, "verify.handler.question_modal_title"));

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("answer_input")
          .setLabel(selectedQuestion.substring(0, 45))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
          .setPlaceholder(t(language, "verify.handler.question_placeholder"))
      )
    );

    return interaction.showModal(modal);
  }

  return replyEphemeral(interaction, {
    embeds: [E.errorEmbed(t(language, "verify.handler.mode_invalid"))],
  });
}

async function handleVerifyHelp(interaction) {
  const [guildSettings, verificationSettings] = await Promise.all([
    settings.get(interaction.guild.id),
    verifSettings.get(interaction.guild.id),
  ]);
  const language = resolveInteractionLanguage(interaction, guildSettings);
  const modeHelp = {
    button: t(language, "verify.handler.help_mode_button"),
    code: t(language, "verify.handler.help_mode_code"),
    question: t(language, "verify.handler.help_mode_question"),
  };

  return replyEphemeral(interaction, {
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(t(language, "verify.handler.help_title"))
        .setDescription(
          modeHelp[verificationSettings?.mode] ||
          t(language, "verify.panel.description")
        )
        .addFields(
          {
            name: t(language, "verify.handler.help_dm_problems_label"),
            value: t(language, "verify.handler.help_dm_problems"),
            inline: false,
          },
          {
            name: t(language, "verify.handler.help_attempts_label"),
            value: t(language, "verify.handler.help_attempts", {
              failures: VERIFICATION_LIMITS.maxFailuresBeforeCooldown,
              minutes: VERIFICATION_LIMITS.failureCooldownMinutes,
            }),
            inline: false,
          },
          {
            name: t(language, "verify.handler.help_blocked_label"),
            value: t(language, "verify.handler.help_blocked"),
            inline: false,
          }
        )
        .setTimestamp(),
    ],
  });
}

async function handleEnterCode(interaction) {
  const [guildSettings, verificationSettings] = await Promise.all([
    settings.get(interaction.guild.id),
    verifSettings.get(interaction.guild.id),
  ]);
  const language = resolveInteractionLanguage(interaction, guildSettings);
  if (!verificationSettings || !verificationSettings.enabled) {
    return replyEphemeral(interaction, {
      embeds: [E.errorEmbed(t(language, "verify.handler.not_active"))],
    });
  }

  const memberState = await verifMemberStates.get(interaction.guild.id, interaction.user.id);
  const isInCodeMode = verificationSettings.mode === "code" || memberState?.current_mode === "code";
  if (!isInCodeMode) {
    return replyEphemeral(interaction, {
      embeds: [E.errorEmbed(t(language, "verify.handler.not_code_mode"))],
    });
  }

  const modal = new ModalBuilder()
    .setCustomId("verify_code_modal")
    .setTitle(t(language, "verify.handler.enter_code_title"));

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("code_input")
        .setLabel(t(language, "verify.handler.enter_code_label"))
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(VERIFICATION_LIMITS.codeLength)
        .setMaxLength(VERIFICATION_LIMITS.codeLength)
        .setPlaceholder(t(language, "verify.handler.enter_code_placeholder"))
    )
  );

  return interaction.showModal(modal);
}

async function handleCodeModal(interaction) {
  const guild = interaction.guild;
  const user = interaction.user;
  const [guildSettings, verificationSettings, state] = await Promise.all([
    settings.get(guild.id),
    verifSettings.get(guild.id),
    verifMemberStates.get(guild.id, user.id),
  ]);
  const language = resolveInteractionLanguage(interaction, guildSettings);

  const cooldownUntil = buildCooldownDate(state);
  if (cooldownUntil) {
    return replyEphemeral(interaction, {
      embeds: [
        E.warningEmbed(
          t(language, "verify.handler.too_many_attempts", {
            retryText: buildRetryText(cooldownUntil),
          })
        ),
      ],
    });
  }

  const codeInput = interaction.fields.getTextInputValue("code_input").toUpperCase().trim();
  const result = await verifCodes.verify(user.id, guild.id, codeInput);

  if (!result.valid) {
    const messages = {
      no_code: t(language, "verify.handler.code_reason_no_code"),
      expired: t(language, "verify.handler.code_reason_expired"),
      wrong: t(language, "verify.handler.code_reason_wrong"),
    };
    const retryDate = await markFailure(
      guild.id,
      user.id,
      "code",
      `code_${result.reason || "error"}`,
      "interaction.verify.code_modal",
      { input: codeInput }
    );

    const cooldownText = retryDate
      ? `\n\n${t(language, "verify.handler.too_many_attempts", {
        retryText: buildRetryText(retryDate),
      })}`
      : "";

    return replyEphemeral(interaction, {
      embeds: [E.errorEmbed(`${messages[result.reason] || t(language, "verify.handler.invalid_code")}${cooldownText}`)],
    });
  }

  const member = guild.members?.fetch
    ? await guild.members.fetch(user.id).catch(() => null)
    : interaction.member || null;

  return completeVerification({
    interaction,
    guild,
    guildSettings,
    verificationSettings,
    user,
    member,
    mode: "code",
    source: "interaction.verify.code_modal",
  });
}

async function handleQuestionModal(interaction) {
  const guild = interaction.guild;
  const user = interaction.user;
  const [guildSettings, verificationSettings, state, member] = await Promise.all([
    settings.get(guild.id),
    verifSettings.get(guild.id),
    verifMemberStates.get(guild.id, user.id),
    guild.members.fetch(user.id).catch(() => null),
  ]);
  const language = resolveInteractionLanguage(interaction, guildSettings);

  const cooldownUntil = buildCooldownDate(state);
  if (cooldownUntil) {
    return replyEphemeral(interaction, {
      embeds: [
        E.warningEmbed(
          t(language, "verify.handler.too_many_attempts", {
            retryText: buildRetryText(cooldownUntil),
          })
        ),
      ],
    });
  }

  const answer = normalizeVerificationAnswer(
    interaction.fields.getTextInputValue("answer_input")
  );

  const activeQuestion = await verifMemberStates.getActiveQuestion(guild.id, user.id);
  const expectedAnswer = activeQuestion?.answer || verificationSettings.question_answer || "";

  if (answer !== normalizeVerificationAnswer(expectedAnswer)) {
    const retryDate = await markFailure(
      guild.id,
      user.id,
      "question",
      "question_wrong_answer",
      "interaction.verify.question_modal"
    );
    const cooldownText = retryDate
      ? `\n\n${t(language, "verify.handler.too_many_attempts", {
        retryText: buildRetryText(retryDate),
      })}`
      : "";

    return replyEphemeral(interaction, {
      embeds: [
        new EmbedBuilder()
          .setColor(E.Colors.ERROR)
          .setDescription(t(language, "verify.handler.incorrect_answer", { cooldownText })),
      ],
    });
  }

  if (activeQuestion) {
    await verifMemberStates.clearActiveQuestion(guild.id, user.id);
  }

  return completeVerification({
    interaction,
    guild,
    guildSettings,
    verificationSettings,
    user,
    member,
    mode: "question",
    source: "interaction.verify.question_modal",
  });
}

async function handleCaptchaModal(interaction) {
  const guild = interaction.guild;
  const user = interaction.user;
  const [guildSettings, verificationSettings, state, member] = await Promise.all([
    settings.get(guild.id),
    verifSettings.get(guild.id),
    verifMemberStates.get(guild.id, user.id),
    guild.members.fetch(user.id).catch(() => null),
  ]);
  const language = resolveInteractionLanguage(interaction, guildSettings);

  const cooldownUntil = buildCooldownDate(state);
  if (cooldownUntil) {
    return replyEphemeral(interaction, {
      embeds: [
        E.warningEmbed(
          t(language, "verify.handler.too_many_attempts", {
            retryText: buildRetryText(cooldownUntil),
          })
        ),
      ],
    });
  }

  const answer = interaction.fields.getTextInputValue("captcha_input").trim();
  const result = await verifCaptchas.verify(user.id, guild.id, answer);

  if (!result.valid) {
    const messages = {
      no_captcha: t(language, "verify.handler.captcha_reason_no_captcha"),
      expired: t(language, "verify.handler.captcha_reason_expired"),
      wrong: t(language, "verify.handler.captcha_reason_wrong"),
    };
    const retryDate = await markFailure(
      guild.id,
      user.id,
      "captcha",
      `captcha_${result.reason || "error"}`,
      "interaction.verify.captcha_modal",
      { input: answer }
    );

    const cooldownText = retryDate
      ? `\n\n${t(language, "verify.handler.too_many_attempts", {
        retryText: buildRetryText(retryDate),
      })}`
      : "";

    return replyEphemeral(interaction, {
      embeds: [E.errorEmbed(`${messages[result.reason] || t(language, "verify.handler.captcha_invalid")}${cooldownText}`)],
    });
  }

  return completeVerification({
    interaction,
    guild,
    guildSettings,
    verificationSettings,
    user,
    member,
    mode: "captcha",
    source: "interaction.verify.captcha_modal",
  });
}

async function handleResendCode(interaction) {
  const guild = interaction.guild;
  const user = interaction.user;
  const [guildSettings, verificationSettings, state] = await Promise.all([
    settings.get(guild.id),
    verifSettings.get(guild.id),
    verifMemberStates.get(guild.id, user.id),
  ]);
  const language = resolveInteractionLanguage(interaction, guildSettings);

  if (!verificationSettings || verificationSettings.mode !== "code") {
    return replyEphemeral(interaction, {
      embeds: [E.errorEmbed(t(language, "verify.handler.not_code_mode"))],
    });
  }

  const cooldownUntil = buildCooldownDate(state);
  if (cooldownUntil) {
    return replyEphemeral(interaction, {
      embeds: [
        E.warningEmbed(
          t(language, "verify.handler.too_many_attempts", {
            retryText: buildRetryText(cooldownUntil),
          })
        ),
      ],
    });
  }

  if (state?.last_code_sent_at) {
    const lastSentAt = new Date(state.last_code_sent_at);
    const minNext = lastSentAt.getTime() + VERIFICATION_LIMITS.codeResendCooldownSeconds * 1000;
    if (Number.isFinite(lastSentAt.getTime()) && minNext > Date.now()) {
      return replyEphemeral(interaction, {
        embeds: [
          E.warningEmbed(
            t(language, "verify.handler.resend_wait", {
              retryText: `<t:${Math.floor(minNext / 1000)}:R>`,
            })
          ),
        ],
      });
    }
  }

  const resendCount = Number(state?.code_resend_count || 0);
  if (resendCount >= VERIFICATION_LIMITS.maxCodeResendsPerSession) {
    return replyEphemeral(interaction, {
      embeds: [
        E.errorEmbed(
          t(language, "verify.handler.max_resends_reached", {
            max: VERIFICATION_LIMITS.maxCodeResendsPerSession,
          })
        ),
      ],
    });
  }

  const code = await verifCodes.generate(user.id, guild.id);
  try {
    await user.send({
      embeds: [
        new EmbedBuilder()
          .setColor(E.Colors.SUCCESS)
          .setTitle(t(language, "verify.handler.new_code_title"))
          .setDescription(t(language, "verify.handler.new_code_description", { code }))
          .setFooter({ text: guild.name })
          .setTimestamp(),
      ],
    });
  } catch (_) {
    await verifLogs.add({
      guild_id: guild.id,
      user_id: user.id,
      status: "permission_error",
      event: "permission_error",
      mode: "code",
      reason: "dm_delivery_failed",
      source: "interaction.verify.resend_code",
    });
    return replyEphemeral(interaction, {
      embeds: [E.errorEmbed(t(language, "verify.handler.resend_dm_failed"))],
    });
  }

  await Promise.all([
    verifMemberStates.markCodeSent(guild.id, user.id, {
      reason: "code_resent",
      isResend: true,
    }),
    verifLogs.add({
      guild_id: guild.id,
      user_id: user.id,
      status: "code_sent",
      event: "code_sent",
      mode: "code",
      reason: "code_resent",
      source: "interaction.verify.resend_code",
      metadata: { resend: true },
    }),
  ]);

  return replyEphemeral(interaction, {
    embeds: [E.successEmbed(t(language, "verify.handler.resend_success"))],
  });
}

async function completeVerification({
  interaction,
  guild,
  guildSettings,
  verificationSettings,
  user,
  member: providedMember = null,
  mode,
  source,
}) {
  const language = resolveInteractionLanguage(interaction, guildSettings);
  const member = providedMember || await guild.members.fetch(user.id).catch(() => null);
  if (!member) {
    return replyEphemeral(interaction, {
      embeds: [E.errorEmbed(t(language, "verify.handler.member_not_found"))],
    });
  }

  // Validate bot has required permissions before attempting verification
  const botMember = guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    const permissionError = t(language, "verify.handler.bot_missing_permissions", {
      permission: "Manage Roles",
    });
    await verifLogs.add({
      guild_id: guild.id,
      user_id: user.id,
      status: "permission_error",
      event: "bot_missing_permissions",
      mode,
      reason: permissionError,
      source,
    });
    return replyEphemeral(interaction, {
      embeds: [E.errorEmbed(permissionError)],
    });
  }

  const result = await applyVerification(member, guild, verificationSettings, {
    guildSettings,
    reason: "Verification completed",
    language,
  });

  if (!result.ok) {
    await verifLogs.add({
      guild_id: guild.id,
      user_id: user.id,
      status: "permission_error",
      event: "permission_error",
      mode,
      reason: result.errors.join(" | "),
      source,
      metadata: {
        warnings: result.warnings,
      },
    });
    return replyEphemeral(interaction, {
      embeds: [
        E.errorEmbed(
          t(language, "verify.handler.completion_failed", {
            issues: buildIssueText(result.errors),
          })
        ),
      ],
    });
  }

  await Promise.all([
    verifCodes.clearForUser(user.id, guild.id),
    verifMemberStates.markVerified(guild.id, user.id, {
      mode,
      reason: "verified_success",
    }),
    verifLogs.add({
      guild_id: guild.id,
      user_id: user.id,
      status: "verified",
      event: "verified_success",
      mode,
      source,
      metadata: {
        warnings: result.warnings,
      },
    }),
  ]);

  await replyEphemeral(interaction, {
    embeds: [
      new EmbedBuilder()
        .setColor(E.Colors.SUCCESS)
        .setTitle(t(language, "verify.handler.completed_title"))
        .setDescription(t(language, "verify.handler.completed_description", {
          guild: guild.name,
          userId: user.id,
        }))
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setTimestamp(),
    ],
  });

  if (verificationSettings.dm_on_verify) {
    await user.send({
      embeds: [
        new EmbedBuilder()
          .setColor(E.Colors.SUCCESS)
          .setTitle(t(language, "verify.handler.verified_dm_title"))
          .setDescription(t(language, "verify.handler.verified_dm_description", {
            guild: guild.name,
          }))
          .setThumbnail(guild.iconURL({ dynamic: true }))
          .setFooter({ text: guild.name })
          .setTimestamp(),
      ],
    }).catch((err) => { console.error("[verifHandler] suppressed error:", err?.message || err); });
  }

  if (verificationSettings.log_channel) {
    const logChannel = guild.channels.cache.get(verificationSettings.log_channel);
    await logChannel?.send({
      embeds: [
        new EmbedBuilder()
          .setColor(E.Colors.SUCCESS)
          .setTitle(t(language, "verify.handler.log_verified_title"))
          .addFields(
            { name: t(language, "common.labels.user"), value: `${user.tag} (<@${user.id}>)`, inline: true },
            { name: t(language, "common.labels.mode"), value: buildModeLabel(mode, language), inline: true },
            {
              name: t(language, "common.labels.warnings"),
              value: buildWarningText(result.warnings, language),
              inline: false,
            }
          )
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .setTimestamp(),
      ],
    }).catch((err) => { console.error("[verifHandler] suppressed error:", err?.message || err); });
  }
}

module.exports = { handleVerif };
