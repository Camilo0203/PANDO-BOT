require("dotenv").config({ path: [".env.local", ".env"], quiet: true });

const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const chalk = require("./chalk-compat");
const fs = require("fs");
const path = require("path");

const { connectDB, closeDB } = require("./src/utils/database");
const { getBuildInfo } = require("./src/utils/buildInfo");
const { validateEnv } = require("./src/utils/env");
const logger = require("./src/utils/structuredLogger");
const { logStructured } = require("./src/utils/structuredLogger");
const {
  recordError,
  stopMetricsReporter,
  flushWindowSummary,
} = require("./src/utils/observability");
const { quickValidate, validateAllEnv } = require("./src/utils/envValidator");
const { loadAndValidateCommands } = require("./src/utils/commandLoader");
const { parseBoolean, resolveRuntimePort } = require("./src/utils/envHelpers");
const {
  createHealthState,
  markDiscordGatewayEvent,
  updateMongoHealth,
} = require("./src/utils/runtimeHealth");
const { startMemoryMonitor, stopMemoryMonitor } = require("./src/utils/memoryManager");
const { initiateShutdown, isShuttingDown } = require("./src/utils/shutdownManager");
const { startWebServer, stopWebServer } = require("./src/web/server");

const GiveawayHandler = require("./src/handlers/giveawayHandler");
const AutoRoleHandler = require("./src/handlers/autoRoleHandler");
const ModerationHandler = require("./src/handlers/moderationHandler");
const StatsHandler = require("./src/handlers/statsHandler");

function formatError(error) {
  if (!error) return "Unknown error";
  return error.stack || error.message || String(error);
}

function logStartup(stage, message, color = "blue") {
  logger.startup(stage, message, color);
}

async function runStartupStage(stage, action, options = {}) {
  if (options.startMessage) {
    logStartup(stage, options.startMessage, options.startColor || "blue");
  }

  try {
    const result = await action();
    if (options.successMessage) {
      logStartup(stage, options.successMessage, options.successColor || "green");
    }
    return result;
  } catch (error) {
    recordError(`startup.${stage}`);
    if (!error.startupStage) {
      error.startupStage = stage;
    }

    const failureMessage = options.failureMessage || "Startup stage failed.";
    logger.error(`startup.${stage}`, failureMessage, { error: error?.message });
    logger.error(`startup.${stage}`, formatError(error), { stack: error?.stack });
    throw error;
  }
}

function validateEnvironmentOrThrow() {
  // Quick validation first
  const quickCheck = quickValidate();
  if (!quickCheck.valid) {
    const error = new Error(`Missing required env vars: ${quickCheck.missing.join(", ")}`);
    error.validationErrors = quickCheck.missing;
    throw error;
  }

  // Full validation
  const envCheck = validateAllEnv();

  for (const warning of envCheck.warnings) {
    // Unknown env vars are common in containerized environments (Square Cloud, etc.)
    // Log them as debug instead of warn to reduce noise
    if (warning.includes("Unknown environment variable")) {
      logger.debug("startup.env-validation", warning);
    } else {
      logger.warn("startup.env-validation", warning);
    }
  }

  if (!envCheck.errors.length) {
    return envCheck;
  }

  for (const errorMessage of envCheck.errors) {
    logger.error("startup.env-validation", errorMessage);
  }

  const error = new Error(envCheck.errors.join("\n"));
  error.validationErrors = envCheck.errors.slice();
  throw error;
}

function createDiscordClient(healthState) {
  const messageContentEnabled = parseBoolean(process.env.MESSAGE_CONTENT_ENABLED, true);
  const guildPresencesEnabled = parseBoolean(process.env.GUILD_PRESENCES_ENABLED, true);
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessageReactions,
  ];

  if (messageContentEnabled) intents.push(GatewayIntentBits.MessageContent);
  if (guildPresencesEnabled) intents.push(GatewayIntentBits.GuildPresences);

  const client = new Client({
    intents,
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.Reaction],
  });

  client.commands = new Collection();
  client.once("clientReady", () => {
    markDiscordGatewayEvent(healthState, "clientReady", true);
  });

  client.once("clientReady", async () => {
    try {
      const { MusicManager } = require("../ton618-music/src/music/MusicManager");
      const { VoiceStateMonitor } = require("../ton618-music/src/services/VoiceStateMonitor");
      const { YouTubeTokenService } = require("../ton618-music/src/services/YouTubeTokenService");

      client.musicManager = new MusicManager(client);

      const voiceMonitor = new VoiceStateMonitor(client, client.musicManager);
      voiceMonitor.start();
      client.voiceStateMonitor = voiceMonitor;

      const youtubeTokenService = new YouTubeTokenService();
      youtubeTokenService.start().catch((err) => {
        logger.warn("startup.music", "YouTubeTokenService failed to start, continuing without tokens", { error: err?.message });
      });
      client.youtubeTokenService = youtubeTokenService;

      logger.info("startup.music", "MusicManager + VoiceStateMonitor + YouTubeTokenService initialized");
    } catch (err) {
      logger.warn("startup.music", "MusicManager not available — music commands disabled", { error: err?.message });
    }
  });
  client.on("shardReady", (shardId) => {
    markDiscordGatewayEvent(healthState, "shardReady", true);
    logStructured("info", "discord.gateway.ready", { shardId });
  });
  client.on("shardResume", (shardId, replayedEvents) => {
    markDiscordGatewayEvent(healthState, "shardResume", true);
    logStructured("info", "discord.gateway.resume", { shardId, replayedEvents });
  });
  client.on("shardDisconnect", (event, shardId) => {
    markDiscordGatewayEvent(healthState, "shardDisconnect", false, {
      closeCode: event?.code ?? null,
    });
    logStructured("warn", "discord.gateway.disconnect", {
      shardId,
      closeCode: event?.code ?? null,
    });
  });
  client.on("shardError", (error, shardId) => {
    markDiscordGatewayEvent(healthState, "shardError", false);
    const errMsg = error?.message || String(error);
    // Log raw error to console so Square Cloud does not redact it in structured logs
    console.error(`[DISCORD SHARD ERROR] shardId=${shardId} error=${errMsg}`);
    logStructured("error", "discord.gateway.error", {
      shardId,
      error: errMsg,
    });
  });
  client.on("shardReconnecting", (shardId) => {
    markDiscordGatewayEvent(healthState, "shardReconnecting", false);
    logStructured("warn", "discord.gateway.reconnecting", { shardId });
  });
  client.on("invalidated", () => {
    markDiscordGatewayEvent(healthState, "invalidated", false);
    logStructured("warn", "discord.gateway.invalidated", {});
  });
  client.on("error", (error) => {
    const errMsg = error?.message || String(error);
    // Log raw error to console so Square Cloud does not redact it in structured logs
    console.error(`[DISCORD CLIENT ERROR] error=${errMsg}`);
    logStructured("error", "discord.client.error", {
      error: errMsg,
    });
  });

  return client;
}

function loadCommandsIntoClient(client, commandsPath) {
  const { commands: loadedCommands, validationErrors } = loadAndValidateCommands(commandsPath);

  if (validationErrors.length) {
    const error = new Error(validationErrors.map((entry) => `- ${entry}`).join("\n"));
    error.validationErrors = validationErrors.slice();
    throw error;
  }

  for (const command of loadedCommands) {
    client.commands.set(command.data.name, command);
    logger.debug("startup.command-loading", `Loaded: ${command.data.name}`);
  }

  logger.info("startup.command-loading", `Total commands loaded: ${client.commands.size}`);
  return loadedCommands.length;
}

function loadEventsIntoClient(client, eventsDir) {
  const eventFiles = fs.readdirSync(eventsDir)
    .filter((file) => file.endsWith(".js"))
    .sort((left, right) => left.localeCompare(right));

  for (const file of eventFiles) {
    const eventPath = path.join(eventsDir, file);
    let event = null;

    try {
      delete require.cache[require.resolve(eventPath)];
      event = require(eventPath);
    } catch (error) {
      throw new Error(`No se pudo cargar el evento '${file}': ${error?.message || String(error)}`);
    }

    if (!event?.name || typeof event.execute !== "function") {
      throw new Error(`El evento '${file}' es invalido. Se esperaba { name, execute() }.`);
    }

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }

  return eventFiles.length;
}

function initializeSupportHandlers(client) {
  logger.info("startup.handler-init", "Initializing handlers...");

  client.giveawayHandler = new GiveawayHandler(client);
  client.autoRoleHandler = new AutoRoleHandler(client);
  client.moderationHandler = new ModerationHandler(client);
  client.statsHandler = new StatsHandler(client);

  client.giveawayHandler.start();
  client.moderationHandler.start();
  client.statsHandler.start();

  logger.info("startup.handler-init", "Handlers initialized successfully");
}

async function cleanupStartupFailure(client, healthState) {
  try {
    if (client?.musicManager) {
      try {
        const playerIds = [...client.musicManager.kazagumo.players.keys()];
        await Promise.all(playerIds.map((id) => client.musicManager.destroyPlayer(id)));
      } catch {}
    }
    if (client && typeof client.destroy === "function") {
      client.destroy();
      markDiscordGatewayEvent(healthState, "startupFailure", false);
    }
  } catch {}

  try {
    await stopWebServer();
  } catch {}

  try {
    stopMemoryMonitor();
  } catch {}

  try {
    await closeDB();
    updateMongoHealth(healthState, false);
  } catch {}
}

async function startBot() {
  const buildInfo = getBuildInfo();
  const healthState = createHealthState();
  let client = null;

  async function shutdownGracefully(signal) {
    if (isShuttingDown()) return;

    logStructured("warn", "process.shutdown.start", { signal });

    const result = await initiateShutdown({
      signal,
      reason: signal,
    });

    if (result.alreadyRunning) return;

    healthState.shuttingDown = true;

    const forceTimer = setTimeout(() => {
      logStructured("error", "process.shutdown.force_exit", { signal });
      process.exit(1);
    }, Number(process.env.SHUTDOWN_FORCE_TIMEOUT_MS || 30000));

    try {
      try {
        if (client) {
          if (client.giveawayHandler) client.giveawayHandler.stop();
          if (client.moderationHandler) client.moderationHandler.stop();
          if (client.statsHandler) client.statsHandler.stop();

          if (client.voiceStateMonitor) client.voiceStateMonitor.stop();
          if (client.youtubeTokenService) client.youtubeTokenService.stop();

          if (client.musicManager) {
            try {
              const playerIds = [...client.musicManager.kazagumo.players.keys()];
              await Promise.all(playerIds.map((id) => client.musicManager.destroyPlayer(id)));
            } catch {}
          }

          if (typeof client.destroy === "function") {
            client.destroy();
          }
          markDiscordGatewayEvent(healthState, "shutdown", false);
        }
      } catch (error) {
        logStructured("error", "process.shutdown.client_error", {
          signal,
          error: error?.message || String(error),
        });
      }

      try {
        await stopWebServer();
      } catch (error) {
        logStructured("error", "process.shutdown.web_server_error", {
          signal,
          error: error?.message || String(error),
        });
      }

      try {
        stopMemoryMonitor();
      } catch (error) {
        logStructured("error", "process.shutdown.memory_monitor_error", {
          signal,
          error: error?.message || String(error),
        });
      }

      try {
        await closeDB();
        updateMongoHealth(healthState, false);
      } catch (error) {
        logStructured("error", "process.shutdown.db_error", {
          signal,
          error: error?.message || String(error),
        });
      }

      stopMetricsReporter();
      const summary = flushWindowSummary();
      if (summary.interactionsTotal) {
        logStructured("info", "metrics.final_window", summary);
      }

      logStructured("info", "process.shutdown.done", { signal, result });
      clearTimeout(forceTimer);
      process.exit(0);
    } catch (error) {
      clearTimeout(forceTimer);
      logStructured("error", "process.shutdown.error", {
        signal,
        error: error?.message || String(error),
      });
      process.exit(1);
    }
  }

  process.on("unhandledRejection", (error) => {
    logger.error("process.unhandledRejection", error?.message || "Unhandled rejection", {
      stack: error?.stack,
    });
    recordError("process.unhandledRejection");
    // Trigger graceful shutdown instead of abrupt exit
    shutdownGracefully("unhandledRejection").catch(() => process.exit(1));
  });
  process.on("uncaughtException", (error) => {
    logger.error("process.uncaughtException", error?.message || "Uncaught exception", {
      stack: error?.stack,
    });
    recordError("process.uncaughtException");
    shutdownGracefully("uncaughtException").catch(() => process.exit(1));
  });
  process.on("SIGINT", () => {
    shutdownGracefully("SIGINT").catch(() => process.exit(1));
  });
  process.on("SIGTERM", () => {
    shutdownGracefully("SIGTERM").catch(() => process.exit(1));
  });

  const healthPort = resolveRuntimePort(process.env, { defaultPort: 80 });

  try {
    logger.info("startup.build", `Active build: ${buildInfo.fingerprint}`, {
      version: buildInfo.version,
      commit: buildInfo.shortCommit,
      deployTag: buildInfo.deployTag,
    });

    await runStartupStage(
      "web-server",
      () => startWebServer({
        healthState,
        buildInfo,
        getClient: () => client,
        port: healthPort,
      }),
      {
        startMessage: `Iniciando web server con vhost en el puerto ${healthPort}...`,
        successMessage: `Web server listo en el puerto ${healthPort}.`,
        failureMessage: "No se pudo iniciar el web server.",
      }
    );

    await runStartupStage(
      "env-validation",
      () => validateEnvironmentOrThrow(),
      {
        startMessage: "Validando variables de entorno...",
        successMessage: "Variables de entorno validadas.",
        failureMessage: "La validacion del entorno aborto el startup.",
      }
    );

    await runStartupStage(
      "mongo-connect",
      async () => {
        await connectDB();
        updateMongoHealth(healthState, true);
      },
      {
        startMessage: "Conectando a MongoDB...",
        successMessage: "MongoDB conectado correctamente.",
        failureMessage: "No se pudo conectar a MongoDB.",
      }
    );

    const { premiumService } = require("./src/services/premiumService");
    await runStartupStage(
      "premium-service",
      async () => {
        await premiumService.initialize();
      },
      {
        startMessage: "Inicializando premiumService...",
        successMessage: "premiumService inicializado.",
        failureMessage: "premiumService no pudo inicializarse.",
      }
    );

    startMemoryMonitor({ intervalMs: 30000 });
    logger.info("startup.memory-monitor", "Memory monitor started");

    client = createDiscordClient(healthState);

    await runStartupStage(
      "command-loading",
      () => {
        const commandsPath = path.join(__dirname, "src/commands");
        logger.info("startup.command-loading", "Loading commands from", { path: commandsPath });
        return loadCommandsIntoClient(client, commandsPath);
      },
      {
        startMessage: "Cargando comandos...",
        successMessage: "Comandos cargados y validados.",
        failureMessage: "La carga de comandos detuvo el arranque.",
      }
    );

    await runStartupStage(
      "event-loading",
      () => {
        const eventsDir = path.join(__dirname, "src/events");
        return loadEventsIntoClient(client, eventsDir);
      },
      {
        startMessage: "Registrando eventos...",
        successMessage: "Eventos registrados correctamente.",
        failureMessage: "La carga de eventos detuvo el arranque.",
      }
    );

    await runStartupStage(
      "handler-init",
      () => initializeSupportHandlers(client),
      {
        startMessage: "Inicializando handlers internos...",
        successMessage: "Handlers internos activos.",
        failureMessage: "La inicializacion de handlers fallo.",
      }
    );

    logStructured("info", "startup.banner", {
      name: "TON618 ENTERPRISE",
      version: "3.0 BETA",
      suite: "Discord Management Suite"
    });

    await runStartupStage(
      "discord-login",
      async () => {
        await client.login(process.env.DISCORD_TOKEN);
        // Signal PM2 that the process is ready (requires wait_ready: true in ecosystem.config.js)
        if (typeof process.send === "function") process.send("ready");
      },
      {
        startMessage: "Iniciando sesion con Discord...",
        successMessage: "Login de Discord aceptado; esperando clientReady.",
        failureMessage: "Discord rechazo el login del bot.",
      }
    );
  } catch (error) {
    const stage = error?.startupStage || "startup";
    const errorMessage = error?.message || String(error);
    // Log explicitly to console before structured logger so error is visible in raw logs
    console.error(`[FATAL STARTUP ERROR] Stage: ${stage} | Error: ${errorMessage}`);
    logger.error(`startup.${stage}`, "Fatal startup error. Closing process.");
    logStructured("error", "startup.failed", {
      stage,
      error: errorMessage,
    });
    await cleanupStartupFailure(client, healthState);
    // Delay exit to prevent Square Cloud rapid restart loop
    setTimeout(() => process.exit(1), 5000);
    return;
  }
}

startBot();
