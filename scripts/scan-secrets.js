#!/usr/bin/env node
"use strict";

/**
 * Lightweight secret scanner for the repository.
 *
 * It intentionally reports only file paths, line numbers and finding types.
 * Never print matched secret values in CI logs.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

const SECRET_PATTERNS = [
  {
    id: "discord-token-like",
    regex: /[MN][A-Za-z\d]{23,28}\.[\w-]{6}\.[\w-]{27,}/,
    severity: "critical",
  },
  {
    id: "github-token-like",
    regex: /gh[pousr]_[A-Za-z0-9_]{30,}/,
    severity: "critical",
  },
  {
    id: "openai-key-like",
    regex: /sk-[A-Za-z0-9_-]{32,}/,
    severity: "critical",
  },
  {
    id: "stripe-secret-like",
    regex: /sk_(?:live|test)_[A-Za-z0-9]{20,}/,
    severity: "critical",
  },
  {
    id: "mongodb-uri-with-credentials",
    regex: /mongodb(?:\+srv)?:\/\/[^\s:@]+:[^\s@]+@/,
    severity: "critical",
  },
  {
    id: "private-key-block",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
    severity: "critical",
  },
  {
    id: "service-role-jwt-like",
    regex: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
    severity: "warning",
  },
];

const ENV_ASSIGNMENT_RE =
  /^\s*([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PRIVATE|SERVICE_ROLE|API_KEY|CLIENT_SECRET|WEBHOOK|MONGO_URI|DATABASE_URL|DSN|JWT)[A-Z0-9_]*)\s*=\s*(.*?)\s*$/;

const PLACEHOLDER_RE =
  /(?:example|placeholder|changeme|change_me|your_|xxx|todo|demo|test|localhost|127\.0\.0\.1|<|>|not-set|dummy|fake|replace|optional|opcional|none|null|generated|openssl|random|sample|user:pass|username:password|db_password)/i;

const TRACKED_ENV_ALLOWLIST = new Set([
  ".env.example",
  ".env.production.example",
  ".env.staging.example",
  ".env.lavalink.example",
  ".env.lemon-squeezy.example",
]);

function toPosixPath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function isBinaryFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  return buffer.includes(0);
}

function getTrackedFiles(root = ROOT) {
  try {
    const output = execSync("git ls-files", {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function shouldSkipFile(relativePath) {
  const normalized = toPosixPath(relativePath);
  return (
    normalized === "package-lock.json" ||
    normalized.endsWith(".lock") ||
    normalized.startsWith("node_modules/") ||
    normalized.startsWith("dist/") ||
    normalized.startsWith("build/") ||
    normalized.startsWith("coverage/")
  );
}

function isAllowedExampleContext(relativePath) {
  const normalized = toPosixPath(relativePath);
  return (
    normalized.endsWith(".example") ||
    normalized.includes("/docs/") ||
    normalized.startsWith("docs/") ||
    normalized.startsWith("tests/") ||
    normalized.endsWith(".md") ||
    normalized === ".github/workflows/ci.yml" ||
    normalized === "scripts/generate-production-keys.js"
  );
}

function scanFile(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  const findings = [];

  if (!fs.existsSync(absolutePath) || shouldSkipFile(relativePath)) {
    return findings;
  }

  const normalized = toPosixPath(relativePath);
  const baseName = path.basename(normalized);
  if (baseName.startsWith(".env") && !TRACKED_ENV_ALLOWLIST.has(baseName)) {
    findings.push({
      severity: "critical",
      type: "tracked-env-file",
      file: normalized,
      line: 1,
      message: "A real .env file is tracked by git. Remove it with git rm --cached.",
    });
  }

  let text;
  try {
    if (isBinaryFile(absolutePath)) return findings;
    text = fs.readFileSync(absolutePath, "utf8");
  } catch {
    return findings;
  }

  const allowedExampleContext = isAllowedExampleContext(normalized);
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/^\s*#/.test(line)) return;

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(line)) {
        if (allowedExampleContext || PLACEHOLDER_RE.test(line)) continue;
        findings.push({
          severity: pattern.severity,
          type: pattern.id,
          file: normalized,
          line: index + 1,
          message: "High-confidence secret pattern detected.",
        });
      }
    }

    const envMatch = line.match(ENV_ASSIGNMENT_RE);
    if (envMatch) {
      const value = String(envMatch[2] || "").trim().replace(/^['"]|['"]$/g, "");
      if (!value || PLACEHOLDER_RE.test(value) || allowedExampleContext) return;
      findings.push({
        severity: "warning",
        type: "specific-env-assignment",
        file: normalized,
        line: index + 1,
        message: `Sensitive-looking env assignment for ${envMatch[1]}.`,
      });
    }
  });

  return findings;
}

function scanRepository(root = ROOT) {
  const trackedFiles = getTrackedFiles(root);
  const findings = trackedFiles.flatMap((relativePath) => scanFile(root, relativePath));
  findings.sort((left, right) =>
    left.file.localeCompare(right.file) ||
    left.line - right.line ||
    left.type.localeCompare(right.type)
  );
  return findings;
}

function printFindings(findings) {
  if (!findings.length) {
    console.log(`${COLORS.green}✓ Secret scan passed: no tracked secrets detected.${COLORS.reset}`);
    return;
  }

  console.log(`${COLORS.red}${COLORS.bold}Secret scan found ${findings.length} issue(s).${COLORS.reset}`);
  for (const finding of findings) {
    const color = finding.severity === "critical" ? COLORS.red : COLORS.yellow;
    console.log(
      `${color}${finding.severity.toUpperCase()}${COLORS.reset} ${finding.file}:${finding.line} ${finding.type} - ${finding.message}`
    );
  }
}

if (require.main === module) {
  const findings = scanRepository(ROOT);
  printFindings(findings);
  const hasCritical = findings.some((finding) => finding.severity === "critical");
  process.exit(hasCritical ? 1 : 0);
}

module.exports = {
  scanFile,
  scanRepository,
  SECRET_PATTERNS,
};
