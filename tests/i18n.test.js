const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeLanguage,
  resolveInteractionLanguage,
  t,
} = require("../src/utils/i18n");

test("normalizeLanguage soporta codigos compuestos y fallback", () => {
  assert.equal(normalizeLanguage("es-MX", "en"), "es");
  assert.equal(normalizeLanguage("en-US", "es"), "en");
  assert.equal(normalizeLanguage("pt-BR", "es"), "es");
});

test("resolveInteractionLanguage prioriza bot_language del servidor", () => {
  const interaction = { locale: "en-US", guildLocale: "en-US" };
  assert.equal(resolveInteractionLanguage(interaction, { bot_language: "es" }), "es");
});

test("resolveInteractionLanguage usa Discord antes de completar onboarding", () => {
  const interaction = { locale: "es-ES", guildLocale: "es-ES" };
  const defaults = {
    bot_language: "en",
    language_onboarding_completed: false,
    language_selected_at: null,
    language_selected_by: null,
  };
  assert.equal(resolveInteractionLanguage(interaction, defaults), "es");
});

test("t traduce e interpola variables", () => {
  const msg = t("en", "interaction.command_disabled", { commandName: "ping" });
  assert.match(msg, /ping/);
  assert.match(msg, /disabled/i);
});
