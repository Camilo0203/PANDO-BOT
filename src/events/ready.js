const cron = require("node-cron");
const chalk = require("../../chalk-compat");

const { startAlertChecker } = require("../utils/alertChecker");
const { startMetricsReporter, logStructured } = require("../utils/observability");
const logger = require("../utils/structuredLogger");
const { startBotStatsSync } = require("../utils/botStatsSync");
const { startDashboardBridge } = require("../utils/dashboardBridgeSync");
const { syncAllGuildLiveStats } = require("../utils/liveStatsChannels");
const { startHealthMonitor } = require("../utils/healthMonitor");
const { runSingleFlight } = require("../utils/guildTaskRunner");
const { safeRun } = require("../crons/common");
const { createTask: createRemindersTask } = require("../crons/reminders");
const { createTask: createPollsTask } = require("../crons/polls");

const cronRegistrars = [
  require("../crons/presence"),
  require("../crons/dashboardSync"),
  require("../crons/autoClose"),
  require("../crons/slaAlerts"),
  require("../crons/slaEscalation"),
  require("../crons/smartPing"),
  require("../crons/dailySlaReport"),
  require("../crons/weeklyReports"),
  require("../crons/verificationAutoKick"),
  require("../crons/deletedChannels"),
  require("../crons/configBackups"),
  require("../crons/auditCleanup"),
  require("../crons/botStats"),
  require("../crons/dataRetentionRegister"),
  require("../crons/membershipReminders"),
  require("../crons/moderationExpiry"),
];

function buildMinuteOpsTick({
  safeRunFn,
  runSingleFlightFn,
  remindersTask,
  pollsTask,
}) {
  return async function runMinuteOpsTick() {
    await safeRunFn("MINUTE REMINDERS", () => runSingleFlightFn("reminders.dispatch", remindersTask));
    await safeRunFn("MINUTE POLLS", () => runSingleFlightFn("polls.finalize_expired", pollsTask));
  };
}

module.exports = {
  name: "clientReady",
  once: true,
  async execute(client) {
    logger.startup("ready", `Connected as ${client.user.tag}`, "green");
    logger.startup("ready", `Active in ${client.guilds.cache.size} guilds`, "blue");
    logger.startup("ready", "TON618 operational", "cyan");

    logStructured("info", "bot.ready", {
      botTag: client.user.tag,
      guilds: client.guilds.cache.size,
      userId: client.user.id,
    });

    startMetricsReporter({
      intervalMs: Number(process.env.METRICS_REPORT_INTERVAL_MS || 300000),
    });
    startBotStatsSync(client);
    startDashboardBridge(client);
    await syncAllGuildLiveStats(client, { hydrateMembers: false });
    await startHealthMonitor(client);

    for (const registrar of cronRegistrars) {
      registrar.register(client);
    }

    const runMinuteOpsTick = buildMinuteOpsTick({
      safeRunFn: safeRun,
      runSingleFlightFn: runSingleFlight,
      remindersTask: createRemindersTask(client),
      pollsTask: createPollsTask(client),
    });

    cron.schedule("* * * * *", () => {
      void runMinuteOpsTick();
    });

    logger.startup("ready", "All cron jobs active", "green");

    try {
      await startAlertChecker(client);
      logger.startup("ready", "Alert system initialized", "green");
    } catch (error) {
      logger.error("ready.alert_system", "Failed to initialize alert system", {
        error: error.message,
      });
    }
  },
};

module.exports.__test = {
  buildMinuteOpsTick,
};
