"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { logStructured } = require("./observability");

const DEFAULT_LANGUAGE = "en";
const SUPPORTED_LANGUAGES = new Set(["es", "en"]);
const LOCALE_EVAL_TIMEOUT_MS = 10000;
const LOCALE_PATHS = {
  en: path.join(__dirname, "../locales/en.js"),
  es: path.join(__dirname, "../locales/es.js"),
};

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function deepMerge(target, source) {
  const output = { ...(isPlainObject(target) ? target : {}) };

  for (const [key, value] of Object.entries(source || {})) {
    if (isPlainObject(value) && isPlainObject(output[key])) {
      output[key] = deepMerge(output[key], value);
      continue;
    }

    output[key] = value;
  }

  return output;
}

function evaluateLocaleValue(rawValue, filename) {
  return vm.runInNewContext(`(${rawValue})`, {}, {
    filename,
    timeout: LOCALE_EVAL_TIMEOUT_MS,
  });
}

function findMatchingObjectEnd(source, objectStart) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;

  for (let i = objectStart; i < source.length; i += 1) {
    const char = source[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (!inDouble && !inTemplate && char === "'" && !inSingle) {
      inSingle = true;
      continue;
    } else if (inSingle && char === "'") {
      inSingle = false;
      continue;
    }

    if (!inSingle && !inTemplate && char === '"' && !inDouble) {
      inDouble = true;
      continue;
    } else if (inDouble && char === '"') {
      inDouble = false;
      continue;
    }

    if (!inSingle && !inDouble && char === "`") {
      inTemplate = !inTemplate;
      continue;
    }

    if (inSingle || inDouble || inTemplate) continue;

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function extractTopLevelEntries(source) {
  const exportIndex = source.indexOf("module.exports");
  const objectStart = source.indexOf("{", exportIndex);
  const objectEnd = findMatchingObjectEnd(source, objectStart);

  if (exportIndex === -1 || objectStart === -1 || objectEnd === -1) {
    return [];
  }

  const body = source.slice(objectStart + 1, objectEnd);
  const entryPattern = /^  (?:"([^"]+)"|([a-zA-Z_$][a-zA-Z0-9_$]*)): /gm;
  const matches = Array.from(body.matchAll(entryPattern));

  return matches.map((match, index) => {
    const valueStart = match.index + match[0].length;
    const valueEnd = index + 1 < matches.length ? matches[index + 1].index : body.length;
    let rawValue = body.slice(valueStart, valueEnd).trim();

    if (rawValue.endsWith(",")) {
      rawValue = rawValue.slice(0, -1).trimEnd();
    }

    return {
      key: match[1] || match[2],
      rawValue,
    };
  });
}

function loadLocale(language) {
  try {
    const filename = LOCALE_PATHS[language];
    delete require.cache[require.resolve(filename)];
    return require(filename);
  } catch (error) {
    logStructured("error", "i18n.locale_load_failed", {
      language,
      error: error?.message || String(error),
    });
    try {
      return require(`../locales/${language}`);
    } catch {
      return {};
    }
  }
}

const MESSAGES = {
  en: loadLocale("en"),
  es: loadLocale("es"),
};

function normalizeLanguage(value, fallback = DEFAULT_LANGUAGE) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (SUPPORTED_LANGUAGES.has(normalized)) return normalized;
  if (normalized.startsWith("es")) return "es";
  if (normalized.startsWith("en")) return "en";
  return fallback;
}

function getByPath(source, pathValue) {
  if (!source || !pathValue) return undefined;

  const key = String(pathValue);

  // First: try the full key as a literal property (flat dot-notation keys)
  if (Object.prototype.hasOwnProperty.call(source, key)) {
    return source[key];
  }

  // Second: walk the nested path
  const parts = key.split(".");
  let current = source;
  for (const segment of parts) {
    if (current === undefined || current === null) return undefined;
    if (typeof current !== 'object') return undefined;
    // Check both with dot notation and flat key
    if (Object.prototype.hasOwnProperty.call(current, segment)) {
      current = current[segment];
    } else {
      // Check if we have flat keys like "support.label" in the current object
      const flatKey = parts.slice(parts.indexOf(segment)).join('.');
      if (Object.prototype.hasOwnProperty.call(current, flatKey)) {
        return current[flatKey];
      }
      return undefined;
    }
  }
  return current;
}

function resolveInteractionLanguage(
  interaction,
  guildSettings = null,
  fallback = DEFAULT_LANGUAGE
) {
  const hasOnboardingFlag = Boolean(
    guildSettings
    && Object.prototype.hasOwnProperty.call(guildSettings, "language_onboarding_completed")
  );
  const hasExplicitGuildLanguage = Boolean(
    guildSettings?.language_onboarding_completed
    || guildSettings?.language_selected_at
    || guildSettings?.language_selected_by
    || guildSettings?.bot_language === "es"
    || (guildSettings?.bot_language === "en" && !hasOnboardingFlag)
  );
  const configured = hasExplicitGuildLanguage
    ? normalizeLanguage(guildSettings?.bot_language, "")
    : "";
  if (configured) return configured;

  const candidates = [
    interaction?.locale,
    interaction?.guildLocale,
    interaction?.guild?.preferredLocale,
  ];

  for (const locale of candidates) {
    const resolved = normalizeLanguage(locale, "");
    if (resolved) return resolved;
  }

  return normalizeLanguage(fallback, DEFAULT_LANGUAGE);
}

function resolveGuildLanguage(guildSettings = null, fallback = DEFAULT_LANGUAGE) {
  return normalizeLanguage(guildSettings?.bot_language, fallback);
}

function interpolate(template, vars = {}) {
  if (!template) return "";

  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : ""
  );
}

function t(language, key, vars = {}) {
  const lang = normalizeLanguage(language, DEFAULT_LANGUAGE);
  const template =
    getByPath(MESSAGES[lang], key) ??
    getByPath(MESSAGES[DEFAULT_LANGUAGE], key);

  if (template === undefined) {
    logStructured("warn", "i18n.lookup_failure", {
      language: lang,
      key,
    });
    return interpolate(key, vars);
  }

  return interpolate(template, vars);
}

function createTranslator(language) {
  const lang = normalizeLanguage(language, DEFAULT_LANGUAGE);
  return {
    language: lang,
    t: (key, vars = {}) => t(lang, key, vars),
  };
}

module.exports = {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  MESSAGES,
  normalizeLanguage,
  resolveInteractionLanguage,
  resolveGuildLanguage,
  createTranslator,
  t,
};
