"use strict";

/**
 * Tests for envValidator utility
 * Ensures proper validation of environment variables
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");

// Store original env vars
const originalEnv = { ...process.env };

describe("envValidator", () => {
  let envValidator;

  before(() => {
    // Clear cache before each test
    delete require.cache[require.resolve("../src/utils/envValidator")];
    envValidator = require("../src/utils/envValidator");
  });

  after(() => {
    // Restore original env vars
    Object.keys(process.env).forEach((key) => delete process.env[key]);
    Object.assign(process.env, originalEnv);

    // Clear cache
    delete require.cache[require.resolve("../src/utils/envValidator")];
  });

  describe("quickValidate", () => {
    it("should return valid=true when all required vars are set", () => {
      process.env.DISCORD_TOKEN = "test_token";
      process.env.MONGO_URI = "mongodb://localhost";
      process.env.OWNER_ID = "123456789012345678";

      const result = envValidator.quickValidate();

      assert.strictEqual(result.valid, true);
      assert.deepStrictEqual(result.missing, []);
    });

    it("should return valid=false when required vars are missing", () => {
      delete process.env.DISCORD_TOKEN;
      delete process.env.MONGO_URI;
      delete process.env.OWNER_ID;

      const result = envValidator.quickValidate();

      assert.strictEqual(result.valid, false);
      assert.ok(result.missing.includes("DISCORD_TOKEN"));
      assert.ok(result.missing.includes("MONGO_URI"));
      // OWNER_ID is optional — not in required list
      assert.ok(!result.missing.includes("OWNER_ID"));
    });

    it("should handle partial missing vars", () => {
      process.env.DISCORD_TOKEN = "test_token";
      delete process.env.MONGO_URI;
      process.env.OWNER_ID = "123456789012345678";

      const result = envValidator.quickValidate();

      assert.strictEqual(result.valid, false);
      assert.deepStrictEqual(result.missing, ["MONGO_URI"]);
    });
  });

  describe("validateAllEnv", () => {
    it("should validate all environment variables", () => {
      process.env.DISCORD_TOKEN = "test_token";
      process.env.MONGO_URI = "mongodb://localhost";
      process.env.OWNER_ID = "123456789012345678";
      process.env.PORT = "3000";
      process.env.MONGO_MAX_POOL_SIZE = "20";

      const result = envValidator.validateAllEnv();

      assert.strictEqual(result.valid, true);
      assert.deepStrictEqual(result.errors, []);
      assert.strictEqual(result.values.PORT, 3000);
      assert.strictEqual(result.values.MONGO_MAX_POOL_SIZE, 20);
    });

    it("should use default values for optional vars", () => {
      process.env.DISCORD_TOKEN = "test_token";
      process.env.MONGO_URI = "mongodb://localhost";
      process.env.OWNER_ID = "123456789012345678";
      delete process.env.PORT;
      delete process.env.LOG_LEVEL;

      const result = envValidator.validateAllEnv();

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.values.PORT, 80); // default
      assert.strictEqual(result.values.LOG_LEVEL, "info"); // default
    });

    it("should validate numeric ranges", () => {
      process.env.DISCORD_TOKEN = "test_token";
      process.env.MONGO_URI = "mongodb://localhost";
      process.env.OWNER_ID = "123456789012345678";
      process.env.MONGO_MAX_POOL_SIZE = "200"; // Exceeds max of 100

      const result = envValidator.validateAllEnv();

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("MONGO_MAX_POOL_SIZE")));
    });

    it("should validate OWNER_ID format", () => {
      process.env.DISCORD_TOKEN = "test_token";
      process.env.MONGO_URI = "mongodb://localhost";
      process.env.OWNER_ID = "invalid_id"; // Should be 17-20 digits

      const result = envValidator.validateAllEnv();

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("OWNER_ID")));
    });

    it("should warn about unknown environment variables", () => {
      // Clear require cache to ensure fresh validation
      delete require.cache[require.resolve("../src/utils/envValidator")];
      
      process.env.DISCORD_TOKEN = "test_token";
      process.env.MONGO_URI = "mongodb://localhost";
      process.env.OWNER_ID = "123456789012345678";
      process.env.UNKNOWN_VAR = "value";
      // Reset any problematic vars from previous tests
      delete process.env.MONGO_MAX_POOL_SIZE;

      const freshValidator = require("../src/utils/envValidator");
      const result = freshValidator.validateAllEnv();

      assert.strictEqual(result.valid, true);
      assert.ok(result.warnings.some((w) => w.includes("UNKNOWN_VAR")));
    });
  });

  describe("getEnv", () => {
    it("should return validated value", () => {
      process.env.DISCORD_TOKEN = "test_token";
      process.env.MONGO_URI = "mongodb://localhost";
      process.env.OWNER_ID = "123456789012345678";
      process.env.PORT = "8080";

      const port = envValidator.getEnv("PORT", 3000);
      assert.strictEqual(port, 8080);
    });

    it("should return default value when env var not set", () => {
      delete process.env.CUSTOM_VAR;

      const value = envValidator.getEnv("CUSTOM_VAR", "default");
      assert.strictEqual(value, "default");
    });

    it("should parse boolean values", () => {
      process.env.DISCORD_TOKEN = "test_token";
      process.env.MONGO_URI = "mongodb://localhost";
      process.env.OWNER_ID = "123456789012345678";
      process.env.MESSAGE_CONTENT_ENABLED = "true";

      const enabled = envValidator.getEnv("MESSAGE_CONTENT_ENABLED", false);
      assert.strictEqual(enabled, true);
    });

    it("should parse number values", () => {
      process.env.DISCORD_TOKEN = "test_token";
      process.env.MONGO_URI = "mongodb://localhost";
      process.env.OWNER_ID = "123456789012345678";
      process.env.MONGO_MAX_POOL_SIZE = "25";

      const size = envValidator.getEnv("MONGO_MAX_POOL_SIZE", 10);
      assert.strictEqual(size, 25);
    });
  });

  describe("ENV_SCHEMA completeness", () => {
    it("should have DISCORD_TOKEN as required", () => {
      const { ENV_SCHEMA } = envValidator;
      assert.strictEqual(ENV_SCHEMA.DISCORD_TOKEN.required, true);
      assert.strictEqual(ENV_SCHEMA.DISCORD_TOKEN.type, "string");
    });

    it("should have MONGO_URI as required", () => {
      const { ENV_SCHEMA } = envValidator;
      assert.strictEqual(ENV_SCHEMA.MONGO_URI.required, true);
      assert.strictEqual(ENV_SCHEMA.MONGO_URI.type, "string");
    });

    it("should have OWNER_ID with pattern validation", () => {
      const { ENV_SCHEMA } = envValidator;
      assert.strictEqual(ENV_SCHEMA.OWNER_ID.required, false);
      assert.ok(ENV_SCHEMA.OWNER_ID.pattern);
      assert.ok(ENV_SCHEMA.OWNER_ID.pattern.test("123456789012345678"));
      assert.ok(!ENV_SCHEMA.OWNER_ID.pattern.test("invalid"));
    });

    it("should have optional vars with defaults", () => {
      const { ENV_SCHEMA } = envValidator;
      assert.strictEqual(ENV_SCHEMA.PORT.required, false);
      assert.strictEqual(ENV_SCHEMA.PORT.default, 80);
      assert.strictEqual(ENV_SCHEMA.PORT.type, "number");
    });
  });
});
