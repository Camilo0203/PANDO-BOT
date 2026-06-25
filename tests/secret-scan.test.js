"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { scanFile } = require("../scripts/scan-secrets");

function withTempFile(relativePath, content, callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ton618-secret-scan-"));
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  try {
    return callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("secret scanner blocks tracked real env files", () => {
  const findings = withTempFile(".env", "DISCORD_TOKEN=placeholder\n", (root) =>
    scanFile(root, ".env")
  );

  assert.equal(findings.some((finding) => finding.type === "tracked-env-file"), true);
});

test("secret scanner allows env example placeholders", () => {
  const findings = withTempFile(".env.example", "DISCORD_TOKEN=your_discord_token_here\n", (root) =>
    scanFile(root, ".env.example")
  );

  assert.deepEqual(findings, []);
});

test("secret scanner detects high-confidence secrets without leaking values", () => {
  const findings = withTempFile("src/config.js", "const uri = 'mongodb+srv://user:supersecret@cluster0.mongodb.net/db';\n", (root) =>
    scanFile(root, "src/config.js")
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, "mongodb-uri-with-credentials");
  assert.equal(JSON.stringify(findings).includes("supersecret"), false);
});
