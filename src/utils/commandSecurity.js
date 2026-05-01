"use strict";

/**
 * Command Security Module
 * Provides input validation and security checks for Discord commands
 */

const MAX_INPUT_LENGTHS = {
  // Text inputs
  string: 2000,
  message: 4000,
  embed_title: 256,
  embed_description: 4096,
  embed_field_name: 256,
  embed_field_value: 1024,
  embed_footer: 2048,
  channel_name: 100,
  role_name: 100,
  username: 32,
  nickname: 32,
  topic: 1024,
  reason: 512,
  note: 1000,
  tag: 100,
  custom_id: 100,
  
  // IDs
  snowflake: 22,
  guild_id: 22,
  channel_id: 22,
  user_id: 22,
  role_id: 22,
  message_id: 22,
  
  // Arrays
  max_array_length: 100,
  max_mentions: 50,
  max_roles: 250,
  max_channels: 500,
  
  // Numbers
  max_number: Number.MAX_SAFE_INTEGER,
  min_number: Number.MIN_SAFE_INTEGER,
};

// Patterns that could indicate injection attempts
const DANGEROUS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /data:text\/html/i,
  /\$where/i,
  /\$ne/i,
  /\$gt/i,
  /\$lt/i,
  /\$regex/i,
  /\.constructor/i,
  /\.prototype/i,
  /__proto__/i,
  /\[object Object\]/,
];

// Patterns for Discord-specific exploits
const DISCORD_EXPLOIT_PATTERNS = [
  /@everyone/,
  /@here/,
  /<@[!&]?\d{17,20}>/g,  // Mention spam
  /discord\.gg\/[a-zA-Z0-9-]+/gi,  // Invite links
  /(?:https?:\/\/)?(?:www\.)?(?:discord(?:app)?\.com\/invite\/|discord\.gg\/)[a-zA-Z0-9-]+/gi,
];

/**
 * Validate and sanitize string input length
 * @param {string} input - Input string
 * @param {string} fieldName - Field name for error messages
 * @param {number} maxLength - Maximum allowed length
 * @returns {object} - { valid: boolean, value: string, error?: string }
 */
function validateStringLength(input, fieldName, maxLength = MAX_INPUT_LENGTHS.string) {
  if (typeof input !== 'string') {
    return { valid: false, value: input, error: `${fieldName} must be a string` };
  }
  
  if (input.length > maxLength) {
    return { 
      valid: false, 
      value: input.substring(0, maxLength),
      error: `${fieldName} too long (${input.length} > ${maxLength} chars)`
    };
  }
  
  return { valid: true, value: input };
}

/**
 * Check for potentially dangerous content in input
 * @param {string} input - Input to check
 * @returns {object} - { safe: boolean, threats: string[] }
 */
function checkDangerousContent(input) {
  if (typeof input !== 'string') {
    return { safe: true, threats: [] };
  }
  
  const threats = [];
  
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(input)) {
      threats.push(`Dangerous pattern detected: ${pattern.toString()}`);
    }
  }
  
  return { safe: threats.length === 0, threats };
}

/**
 * Check for Discord-specific exploits
 * @param {string} input - Input to check
 * @returns {object} - { safe: boolean, threats: string[], sanitized: string }
 */
function checkDiscordExploits(input) {
  if (typeof input !== 'string') {
    return { safe: true, threats: [], sanitized: input };
  }
  
  const threats = [];
  let sanitized = input;
  
  // Check for @everyone/@here bypass attempts
  if (/@everyone/.test(input)) {
    threats.push('@everyone mention detected');
    sanitized = sanitized.replace(/@everyone/g, '@\u200Beveryone');
  }
  
  if (/@here/.test(input)) {
    threats.push('@here mention detected');
    sanitized = sanitized.replace(/@here/g, '@\u200Bhere');
  }
  
  // Check for invite spam
  const inviteMatches = input.match(DISCORD_EXPLOIT_PATTERNS[4]);
  if (inviteMatches && inviteMatches.length > 3) {
    threats.push(`Invite spam detected: ${inviteMatches.length} invites`);
  }
  
  return { safe: threats.length === 0, threats, sanitized };
}

/**
 * Validate command options with security checks
 * @param {object} options - Command options from interaction
 * @param {object} schema - Validation schema { fieldName: { type, maxLength, required } }
 * @returns {object} - { valid: boolean, errors: string[], sanitized: object }
 */
function validateCommandOptions(options, schema = {}) {
  const errors = [];
  const sanitized = {};
  
  for (const [key, value] of Object.entries(options)) {
    const rules = schema[key] || { type: 'string', maxLength: MAX_INPUT_LENGTHS.string };
    
    // Check required fields
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${key} is required`);
      continue;
    }
    
    if (value === undefined || value === null) {
      continue;
    }
    
    // Type validation
    if (rules.type === 'string' && typeof value !== 'string') {
      errors.push(`${key} must be a string`);
      continue;
    }
    
    if (rules.type === 'number' && typeof value !== 'number') {
      errors.push(`${key} must be a number`);
      continue;
    }
    
    if (rules.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`${key} must be a boolean`);
      continue;
    }
    
    // String-specific validations
    if (typeof value === 'string') {
      // Length check
      const lengthCheck = validateStringLength(value, key, rules.maxLength);
      if (!lengthCheck.valid) {
        errors.push(lengthCheck.error);
      }
      
      // Dangerous content check
      const dangerCheck = checkDangerousContent(value);
      if (!dangerCheck.safe) {
        errors.push(...dangerCheck.threats);
      }
      
      // Discord exploits check
      const exploitCheck = checkDiscordExploits(value);
      if (!exploitCheck.safe) {
        errors.push(...exploitCheck.threats);
      }
      
      // Use sanitized value
      sanitized[key] = exploitCheck.sanitized.substring(0, rules.maxLength || MAX_INPUT_LENGTHS.string);
    } else {
      sanitized[key] = value;
    }
  }
  
  return { valid: errors.length === 0, errors, sanitized };
}

/**
 * Sanitize Discord ID (snowflake)
 * @param {string} id - ID to sanitize
 * @returns {string|null} - Sanitized ID or null if invalid
 */
function sanitizeSnowflake(id) {
  if (typeof id !== 'string') return null;
  
  // Remove any non-digit characters
  const cleaned = id.replace(/\D/g, '');
  
  // Discord snowflakes are 17-20 digits
  if (cleaned.length < 17 || cleaned.length > 22) {
    return null;
  }
  
  return cleaned;
}

/**
 * Check if user is rate limited
 * @param {Map} rateLimitMap - Map to track rate limits
 * @param {string} userId - User ID
 * @param {string} commandName - Command name
 * @param {number} maxRequests - Max requests per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {object} - { limited: boolean, remaining: number, retryAfter: number }
 */
function checkRateLimit(rateLimitMap, userId, commandName, maxRequests = 5, windowMs = 10000) {
  const key = `${userId}:${commandName}`;
  const now = Date.now();
  
  let entry = rateLimitMap.get(key);
  
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
  }
  
  entry.count++;
  rateLimitMap.set(key, entry);
  
  const limited = entry.count > maxRequests;
  const remaining = Math.max(0, maxRequests - entry.count);
  const retryAfter = limited ? Math.ceil((entry.resetAt - now) / 1000) : 0;
  
  return { limited, remaining, retryAfter };
}

/**
 * Clean up old rate limit entries
 * @param {Map} rateLimitMap - Map to clean
 */
function cleanupRateLimits(rateLimitMap) {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetAt <= now) {
      rateLimitMap.delete(key);
    }
  }
}

module.exports = {
  MAX_INPUT_LENGTHS,
  validateStringLength,
  checkDangerousContent,
  checkDiscordExploits,
  validateCommandOptions,
  sanitizeSnowflake,
  checkRateLimit,
  cleanupRateLimits,
  DANGEROUS_PATTERNS,
  DISCORD_EXPLOIT_PATTERNS,
};
