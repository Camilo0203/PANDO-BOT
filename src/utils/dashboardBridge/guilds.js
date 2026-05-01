"use strict";

const {
  logStructured,
  settings,
  verifSettings,
  welcomeSettings,
  suggestSettings,
  modlogSettings,
} = require("./runtime");
const {
  fetchWithTimeout,
  getConfig,
  getHeaders,
} = require("./config");

async function readGuildRecords(guildId) {
  const [
    settingsRecord,
    verificationRecord,
    welcomeRecord,
    suggestRecord,
    modlogRecord,
  ] = await Promise.all([
    settings.get(guildId),
    verifSettings.get(guildId),
    welcomeSettings.get(guildId),
    suggestSettings.get(guildId),
    modlogSettings.get(guildId),
  ]);

  return {
    settingsRecord,
    verificationRecord,
    welcomeRecord,
    suggestRecord,
    modlogRecord,
  };
}

async function requestSupabase(path, options = {}) {
  const config = getConfig();
  if (!config.enabled) {
    throw new Error("Dashboard bridge is not configured.");
  }

  const url = new URL(`${config.url}/rest/v1/${path}`);
  const query = options.query && typeof options.query === "object" ? options.query : {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const method = options.method || "GET";
  const maxRetries = Number(options.maxRetries ?? process.env.SUPABASE_MAX_RETRIES) || 3;
  const baseDelay = Number(options.baseDelayMs ?? process.env.SUPABASE_RETRY_DELAY_MS) || 1000;

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetchWithTimeout(
      url.toString(),
      {
        method,
        headers: getHeaders(config, {
          includeBody: options.body !== undefined,
          preferResolution: options.preferResolution === true,
          returnRepresentation: options.returnRepresentation === true,
          returnMinimal: options.returnMinimal === true,
        }),
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      },
      options.timeoutMs
    );

    if (response.ok) {
      if (response.status === 204) {
        return null;
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await response.text().catch(() => "");
        return text || null;
      }

      return response.json();
    }

    const rawBody = await response.text().catch(() => "");
    lastError = new Error(
      `Supabase ${method} ${path} failed (${response.status}): ${rawBody || response.statusText}`
    );

    const isRetryable = response.status === 429 || response.status >= 500;
    if (!isRetryable || attempt === maxRetries) {
      throw lastError;
    }

    const delay = baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
    logStructured("warn", "dashboard.bridge.retry", {
      attempt: attempt + 1,
      maxRetries,
      status: response.status,
      path,
      delayMs: delay,
    });
    await new Promise((r) => setTimeout(r, delay));
  }

  throw lastError;
}

async function upsertRows(table, rows, options = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  return requestSupabase(table, {
    method: "POST",
    query: options.onConflict ? { on_conflict: options.onConflict } : undefined,
    body: rows,
    preferResolution: true,
    returnRepresentation: options.returnRepresentation === true,
    returnMinimal: options.returnRepresentation !== true,
  });
}

async function patchRows(table, query, data, options = {}) {
  return requestSupabase(table, {
    method: "PATCH",
    query: options.returnRepresentation ? { ...query, select: "*" } : query,
    body: data,
    returnRepresentation: options.returnRepresentation === true,
    returnMinimal: options.returnRepresentation !== true,
  });
}

async function deleteRows(table, query) {
  return requestSupabase(table, {
    method: "DELETE",
    query,
    returnMinimal: true,
  });
}

async function insertDashboardEvent(row) {
  return requestSupabase("guild_dashboard_events", {
    method: "POST",
    body: [row],
    returnMinimal: true,
  });
}

async function fetchGuildEffectiveEntitlement(guildId) {
  if (!guildId) {
    return null;
  }

  const rows = await requestSupabase("guild_effective_entitlements", {
    query: {
      guild_id: `eq.${guildId}`,
      select: "guild_id,effective_plan,plan_source,plan_expires_at,current_period_end,subscription_status,billing_interval,cancel_at_period_end,supporter_enabled,supporter_expires_at,updated_at",
    },
  });

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

module.exports = {
  readGuildRecords,
  requestSupabase,
  upsertRows,
  patchRows,
  deleteRows,
  insertDashboardEvent,
  fetchGuildEffectiveEntitlement,
};
