const fsPromises = require("fs/promises");
const path = require("path");
const { parseBoolean } = require("./envHelpers");

function isFileErrorLoggingEnabled() {
  return parseBoolean(process.env.ERROR_LOG_TO_FILE, true);
}

function resolveErrorLogDir() {
  const customDir = String(process.env.ERROR_LOG_DIR || "").trim();
  if (customDir) return path.resolve(customDir);
  return path.join(__dirname, "../../data/logs");
}

function resolveErrorLogFile(timestamp = new Date()) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const day = Number.isFinite(date.getTime())
    ? date.toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];
  return path.join(resolveErrorLogDir(), `errors_${day}.jsonl`);
}

const SENSITIVE_LOG_FIELDS = [
  /token/i, /secret/i, /password/i, /key/i, /auth/i,
  /authorization/i, /cookie/i, /session/i, /content/i,
  /message/i, /user.*id/i, /guild.*id/i, /channel.*id/i,
  /email/i, /discord_token/i, /webhook_url/i, /api_key/i,
];

function sanitizeLogEntry(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const sanitized = {};
  for (const [key, value] of Object.entries(entry)) {
    if (SENSITIVE_LOG_FIELDS.some((re) => re.test(key))) {
      sanitized[key] = typeof value === "string" && value.length > 8
        ? `${value.slice(0, 4)}...${value.slice(-4)}`
        : "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeLogEntry(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

const LOG_MAX_SIZE_BYTES = Number(process.env.ERROR_LOG_MAX_SIZE_BYTES) || 10 * 1024 * 1024; // 10 MB default

async function rotateLogIfNeeded(filePath) {
  try {
    const stats = await fsPromises.stat(filePath);
    if (stats.size < LOG_MAX_SIZE_BYTES) return filePath;

    const rotatedPath = filePath.replace(/\.jsonl$/, `.${Date.now()}.jsonl`);
    await fsPromises.rename(filePath, rotatedPath);
    return filePath;
  } catch (err) {
    if (err.code === "ENOENT") return filePath;
    console.error("[errorLogger] Failed to rotate log:", err);
    return filePath;
  }
}

async function writeErrorLogEntry(entry) {
  if (!isFileErrorLoggingEnabled()) return null;
  let file = resolveErrorLogFile(entry?.timestamp);
  await fsPromises.mkdir(path.dirname(file), { recursive: true }).catch((err) => {
    console.error("[errorLogger] Failed to create log directory:", err);
  });
  file = await rotateLogIfNeeded(file);
  const sanitized = sanitizeLogEntry(entry);
  const line = `${JSON.stringify(sanitized)}\n`;
  await fsPromises.appendFile(file, line, "utf8");
  return file;
}

module.exports = {
  isFileErrorLoggingEnabled,
  resolveErrorLogDir,
  resolveErrorLogFile,
  writeErrorLogEntry,
};

