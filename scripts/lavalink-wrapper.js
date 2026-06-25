"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const TOKEN_FILE = path.join(ROOT, ".youtube-tokens.json");
const DEFAULT_JAR = path.join(ROOT, "lavalink", "Lavalink.jar");
const DEFAULT_CONFIG = path.join(ROOT, "lavalink", "application.yml");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function loadGeneratedTokens() {
  if (!fs.existsSync(TOKEN_FILE)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
    return {
      YOUTUBE_PO_TOKEN: data.poToken || "",
      YOUTUBE_VISITOR_DATA: data.visitorData || "",
    };
  } catch (error) {
    console.error(`[lavalink] No se pudieron leer los tokens generados: ${error.message}`);
    return {};
  }
}

const fileEnv = {
  ...loadEnvFile(path.join(ROOT, ".env")),
  ...loadEnvFile(path.join(ROOT, ".env.lavalink")),
};
const env = { ...fileEnv, ...loadGeneratedTokens(), ...process.env };
// Spring Boot maps SERVER_PORT directly to server.port. The bot also uses this
// variable for its HTTP health server, so it must not leak into Lavalink.
delete env.PORT;
delete env.SERVER_PORT;
delete env.SERVER_ADDRESS;
const jarPath = path.resolve(env.LAVALINK_JAR_PATH || DEFAULT_JAR);
const configPath = path.resolve(process.argv[2] || env.LAVALINK_CONFIG || DEFAULT_CONFIG);

if (!fs.existsSync(jarPath)) {
  console.error(`[lavalink] Falta Lavalink.jar en ${jarPath}`);
  console.error("[lavalink] Descárgalo con scripts/download-lavalink.ps1 o configura LAVALINK_JAR_PATH.");
  process.exit(1);
}
if (!fs.existsSync(configPath)) {
  console.error(`[lavalink] Falta la configuración en ${configPath}`);
  process.exit(1);
}

const proxyArgs = env.PROXY_HOST && env.PROXY_PORT
  ? [
      `-Dhttp.proxyHost=${env.PROXY_HOST}`,
      `-Dhttp.proxyPort=${env.PROXY_PORT}`,
      `-Dhttps.proxyHost=${env.PROXY_HOST}`,
      `-Dhttps.proxyPort=${env.PROXY_PORT}`,
      env.PROXY_USER ? `-Dhttp.proxyUser=${env.PROXY_USER}` : null,
      env.PROXY_PASSWORD ? `-Dhttp.proxyPassword=${env.PROXY_PASSWORD}` : null,
      env.PROXY_USER ? `-Dhttps.proxyUser=${env.PROXY_USER}` : null,
      env.PROXY_PASSWORD ? `-Dhttps.proxyPassword=${env.PROXY_PASSWORD}` : null,
      "-Djava.net.useSystemProxies=false",
    ].filter(Boolean)
  : [];

const javaArgs = [
  "-Djava.net.preferIPv4Stack=true",
  ...proxyArgs,
  `-Dspring.config.additional-location=file:${configPath}`,
  "-jar",
  jarPath,
];

console.log(`[lavalink] JAR: ${jarPath}`);
console.log(`[lavalink] Configuración: ${configPath}`);
const child = spawn(env.JAVA_BINARY || "java", javaArgs, {
  cwd: ROOT,
  env,
  stdio: "inherit",
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!child.killed) child.kill(signal);
  const timer = setTimeout(() => {
    if (!child.killed) child.kill("SIGKILL");
  }, 5000);
  timer.unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
child.on("error", (error) => {
  console.error(`[lavalink] No se pudo iniciar Java: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) console.log(`[lavalink] Finalizado por ${signal}`);
  process.exit(code ?? (shuttingDown ? 0 : 1));
});
