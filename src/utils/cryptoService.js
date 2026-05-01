"use strict";

/**
 * Crypto Service
 * Provides encryption/decryption for sensitive data
 * Uses AES-256-GCM for authenticated encryption
 */

const crypto = require("crypto");
const logger = require("./structuredLogger");

// Get encryption key from environment
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 16 bytes for AES
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM

// Fallback salt: random per-process value so it never silently uses a known default.
// In production, always set HASH_SALT explicitly.
const _PROCESS_SALT = require("crypto").randomBytes(16).toString("hex");

/**
 * Validate that encryption is properly configured
 */
function isEncryptionEnabled() {
  if (!ENCRYPTION_KEY) {
    return false;
  }
  // Key must be 32 bytes (256 bits) for AES-256
  return ENCRYPTION_KEY.length >= 32;
}

/**
 * Generate a secure random encryption key
 * Run once and save to .env
 */
function generateEncryptionKey() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Encrypt sensitive data
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted string in format: iv:authTag:ciphertext (base64)
 */
function encrypt(text) {
  if (!text) return text;
  if (!isEncryptionEnabled()) {
    logger.warn('cryptoService', 'Encryption disabled - returning plain text');
    return text;
  }

  try {
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const key = ENCRYPTION_KEY.length === 64
      ? Buffer.from(ENCRYPTION_KEY, "hex")
      : Buffer.from(ENCRYPTION_KEY.substring(0, 32));
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt
    let encrypted = cipher.update(String(text), "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Combine: iv + authTag + ciphertext
    const result = Buffer.concat([iv, authTag, Buffer.from(encrypted, "hex")]).toString("base64");

    return result;
  } catch (error) {
    logger.error('cryptoService', 'Encryption failed', { error: error?.message || String(error) });
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt encrypted data
 * @param {string} encryptedData - Encrypted string from encrypt()
 * @returns {string} - Decrypted plain text
 */
function decrypt(encryptedData) {
  if (!encryptedData) return encryptedData;
  if (!isEncryptionEnabled()) {
    return encryptedData;
  }

  try {
    // Decode from base64
    const buffer = Buffer.from(encryptedData, "base64");

    // Extract components
    const iv = buffer.slice(0, IV_LENGTH);
    const authTag = buffer.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = buffer.slice(IV_LENGTH + AUTH_TAG_LENGTH).toString("hex");

    // Create decipher
    const key = ENCRYPTION_KEY.length === 64
      ? Buffer.from(ENCRYPTION_KEY, "hex")
      : Buffer.from(ENCRYPTION_KEY.substring(0, 32));
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    logger.error('cryptoService', 'Decryption failed', { error: error?.message || String(error) });
    throw new Error("Failed to decrypt data - data may be corrupted or tampered");
  }
}

/**
 * Hash sensitive data (one-way, for comparison)
 * Use for things like API key fingerprints, not for data you need to retrieve
 */
function hash(text, salt = null) {
  if (!text) return null;

  const useSalt = salt || process.env.HASH_SALT || _PROCESS_SALT;
  if (!process.env.HASH_SALT && !salt) {
    logger.warn("cryptoService", "HASH_SALT not set — using ephemeral per-process salt. Hashes will not be stable across restarts.");
  }
  return crypto.createHmac("sha256", useSalt).update(String(text)).digest("hex");
}

/**
 * Mask sensitive data for display/logs
 * Shows only first and last 4 characters
 */
function mask(text, visibleChars = 4) {
  if (!text || text.length <= visibleChars * 2) {
    return "***";
  }
  const first = text.substring(0, visibleChars);
  const last = text.substring(text.length - visibleChars);
  return `${first}...${last}`;
}

/**
 * Check if text appears to be encrypted (heuristic)
 */
function isEncrypted(text) {
  if (!text || typeof text !== "string") return false;
  // Encrypted data is base64 and typically longer than original
  return text.length > 50 && /^[A-Za-z0-9+/=]+$/.test(text);
}

/**
 * Encrypt object fields selectively
 * @param {object} obj - Object to encrypt
 * @param {string[]} fields - Field names to encrypt
 * @returns {object} - Object with encrypted fields
 */
function encryptFields(obj, fields) {
  if (!obj || typeof obj !== "object") return obj;

  const result = { ...obj };
  for (const field of fields) {
    if (result[field] && typeof result[field] === "string") {
      result[field] = encrypt(result[field]);
      result[`${field}_encrypted`] = true;
    }
  }
  return result;
}

/**
 * Decrypt object fields selectively
 * @param {object} obj - Object with encrypted fields
 * @param {string[]} fields - Field names to decrypt
 * @returns {object} - Object with decrypted fields
 */
function decryptFields(obj, fields) {
  if (!obj || typeof obj !== "object") return obj;

  const result = { ...obj };
  for (const field of fields) {
    if (result[field] && typeof result[field] === "string" && result[`${field}_encrypted`]) {
      result[field] = decrypt(result[field]);
      delete result[`${field}_encrypted`];
    }
  }
  return result;
}

module.exports = {
  encrypt,
  decrypt,
  hash,
  mask,
  isEncrypted,
  isEncryptionEnabled,
  generateEncryptionKey,
  encryptFields,
  decryptFields,
};
