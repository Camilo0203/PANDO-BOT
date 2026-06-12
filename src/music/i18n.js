"use strict";

/**
 * i18n del módulo de música
 *
 * Usa el sistema i18n del bot principal, pero con un namespace "music." para
 * evitar colisiones con los locales de tickets/staff/utility.
 *
 * Ejemplo: t("music.error_voice_required", "es") -> locale "music.error_voice_required"
 */

const { t: rootT, normalizeLanguage: rootNormalize } = require("../utils/i18n");

const LOCALES = {
  en: require("../locales/modules/en/music"),
  es: require("../locales/modules/es/music"),
};

const PREFIX = "music.";

function normalizeLanguage(language) {
  return rootNormalize(language, "en");
}

function getByPath(source, path) {
  return path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), source);
}

function interpolate(template, vars) {
  if (typeof template !== "string") return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] !== undefined ? vars[key] : `{{${key}}}`));
}

function t(language, key, vars = {}) {
  const lang = normalizeLanguage(language);
  const subKey = key.startsWith(PREFIX) ? key.slice(PREFIX.length) : key;

  const message =
    getByPath(LOCALES[lang], subKey) ??
    getByPath(LOCALES.en, subKey);

  if (message === undefined) {
    // Fallback al sistema de i18n del bot por si alguna clave de música
    // se quedó en el locale global del bot (transición).
    return rootT(lang, key, vars);
  }
  return interpolate(message, vars);
}

module.exports = { t, normalizeLanguage, PREFIX };
