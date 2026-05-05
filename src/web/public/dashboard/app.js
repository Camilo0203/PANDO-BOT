/* ── TON618 Dashboard App ── */

const API_BASE = "";
const REFRESH_INTERVAL = 10000;

let guildsData = [];
let refreshTimer = null;

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function formatNumber(n) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US");
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (!h && !m) parts.push(`${s}s`);
  return parts.join(" ");
}

function toast(message, type = "info") {
  const container = $(".toast-container") || (() => {
    const el = document.createElement("div");
    el.className = "toast-container";
    document.body.appendChild(el);
    return el;
  })();

  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add("toast-out");
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

function setLoading(selector, isLoading) {
  const el = $(selector);
  if (!el) return;
  if (isLoading) {
    el.classList.add("skeleton");
    el.style.minHeight = "1.2rem";
  } else {
    el.classList.remove("skeleton");
    el.style.minHeight = "";
  }
}

/* ── Fetch Stats ── */
async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("fetchStats:", err);
    return null;
  }
}

/* ── Fetch Guilds ── */
async function fetchGuilds() {
  try {
    const res = await fetch(`${API_BASE}/api/guilds`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    guildsData = data.guilds || [];
    return guildsData;
  } catch (err) {
    console.error("fetchGuilds:", err);
    guildsData = [];
    return [];
  }
}

/* ── Fetch Health ── */
async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("fetchHealth:", err);
    return null;
  }
}

/* ── Update KPI Cards ── */
function updateKPIs(stats, health) {
  const guilds = stats?.guilds ?? health?.discord?.guilds ?? 0;
  const ping = stats?.ping ?? health?.discord?.ping ?? null;
  const uptime = health?.uptimeSec ?? 0;
  const memory = health?.memory?.rssMB ?? null;

  const kpiGuilds = $("#kpi-guilds");
  if (kpiGuilds) {
    kpiGuilds.textContent = formatNumber(guilds);
    kpiGuilds.classList.remove("skeleton");
    kpiGuilds.style.minHeight = "";
  }

  const kpiPing = $("#kpi-ping");
  if (kpiPing) {
    kpiPing.textContent = ping !== null ? `${ping}ms` : "N/A";
    kpiPing.classList.remove("skeleton");
    kpiPing.style.minHeight = "";
  }

  const kpiUptime = $("#kpi-uptime");
  if (kpiUptime) {
    kpiUptime.textContent = formatDuration(uptime);
    kpiUptime.classList.remove("skeleton");
    kpiUptime.style.minHeight = "";
  }

  const kpiMemory = $("#kpi-memory");
  if (kpiMemory) {
    kpiMemory.textContent = memory !== null ? `${memory} MB` : "N/A";
    kpiMemory.classList.remove("skeleton");
    kpiMemory.style.minHeight = "";
  }

  // Status badge
  const statusBadge = $("#status-badge");
  if (statusBadge && health) {
    const isOk = health.status === "ok";
    statusBadge.className = `badge ${isOk ? "badge-online" : "badge-danger"}`;
    statusBadge.innerHTML = `<span class="badge-dot"></span> ${isOk ? "ONLINE" : "DEGRADED"}`;
  }
}

/* ── Update Memory Section ── */
function updateMemory(health) {
  const mem = health?.memory;
  if (!mem) return;

  const total = mem.rssMB;
  const used = mem.heapUsedMB;
  const heapTotal = mem.heapTotalMB;

  // If we have total memory, calculate percentages
  const heapPct = heapTotal > 0 ? Math.round((used / heapTotal) * 100) : 0;
  const rssPct = total > 0 ? Math.round((used / total) * 100) : 0;

  updateBar("mem-rss", total, `${total} MB`, "linear-gradient(90deg, #818cf8, #38bdf8)");
  updateBar("mem-heap", used, `${used} MB`, "linear-gradient(90deg, #34d399, #10b981)");
  updateBar("mem-heap-total", heapTotal, `${heapTotal} MB`, "linear-gradient(90deg, #fbbf24, #f59e0b)");
}

function updateBar(id, val, label, color) {
  const bar = $(`#${id}-bar`);
  const txt = $(`#${id}-val`);
  if (bar) {
    bar.style.width = "100%";
    bar.style.background = color;
  }
  if (txt) txt.textContent = label;
}

/* ── Update Guilds Table ── */
function updateGuildsTable(guilds) {
  const tbody = $("#guilds-tbody");
  if (!tbody) return;

  if (!guilds || guilds.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="4">
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <p>No guilds available</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = guilds.map((g, i) => `
    <tr class="fade-in" style="animation-delay:${i * 0.03}s">
      <td><span class="cell-id">${g.id || "—"}</span></td>
      <td><span class="cell-name">${escapeHtml(g.name || "Unknown")}</span></td>
      <td><span class="cell-num">${formatNumber(g.memberCount || 0)}</span></td>
      <td><span class="cell-date">${g.joinedAt ? new Date(g.joinedAt).toLocaleDateString() : "—"}</span></td>
    </tr>
  `).join("");

  const count = $("#guilds-count");
  if (count) count.textContent = `${guilds.length} server${guilds.length !== 1 ? "s" : ""}`;
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── Navigation ── */
function initNav() {
  const sections = ["overview", "guilds", "memory", "health"];
  sections.forEach(id => {
    const btn = $(`#nav-${id}`);
    const sec = $(`#section-${id}`);
    if (!btn || !sec) return;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      sections.forEach(s => {
        $(`#nav-${s}`)?.classList.remove("active");
        $(`#section-${s}`)?.classList.add("hidden-section");
      });
      btn.classList.add("active");
      sec.classList.remove("hidden-section");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // Show overview by default
  sections.slice(1).forEach(s => {
    $(`#section-${s}`)?.classList.add("hidden-section");
  });
}

/* ── Hidden section utility ── */
const style = document.createElement("style");
style.textContent = `.hidden-section { display: none !important; }`;
document.head.appendChild(style);

/* ── Refresh Button ── */
function initRefresh() {
  const btn = $("#btn-refresh");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "⟳ Refreshing...";
    await loadAll();
    toast("Data refreshed", "success");
    btn.disabled = false;
    btn.textContent = "↻ Refresh";
  });
}

/* ── Auto Refresh Toggle ── */
function initAutoRefresh() {
  const toggle = $("#auto-refresh");
  if (!toggle) return;
  toggle.addEventListener("change", () => {
    if (toggle.checked) {
      refreshTimer = setInterval(loadAll, REFRESH_INTERVAL);
      toast("Auto-refresh enabled (10s)");
    } else {
      clearInterval(refreshTimer);
      refreshTimer = null;
      toast("Auto-refresh disabled");
    }
  });
  // Start by default
  toggle.checked = true;
  refreshTimer = setInterval(loadAll, REFRESH_INTERVAL);
}

/* ── Load All Data ── */
async function loadAll() {
  const [stats, guilds, health] = await Promise.all([
    fetchStats(),
    fetchGuilds(),
    fetchHealth()
  ]);

  updateKPIs(stats, health);
  updateMemory(health);
  updateGuildsTable(guilds);

  // Update version / build
  const buildLabel = $("#build-label");
  if (buildLabel && health) {
    buildLabel.textContent = `v${health.version || "?"} · ${health.shortCommit || "dev"}`;
  }
}

/* ── Init ── */
document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initRefresh();
  initAutoRefresh();
  loadAll();
});
