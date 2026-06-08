#!/usr/bin/env node
/**
 * Generate Secure Encryption Keys for TON618 Production
 * Usage: node scripts/generate-production-keys.js
 * 
 * Generates:
 * - ENCRYPTION_KEY: 64-char hex (256-bit AES key)
 * - HASH_SALT: 64-char hex (256-bit HMAC salt)
 * - BOT_API_KEY: 64-char hex (shared secret)
 * - DASH_API_KEY: 64-char hex (dashboard auth)
 * - LAVALINK_PRO_PASSWORD: 32-char random secure password
 * - LAVALINK_FREE_PASSWORD: 32-char random secure password
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function generateHexKey(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function generatePassword(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*-_=+';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return result;
}

function printHeader(text) {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${text}${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

function printKeyGroup(title, keys) {
  console.log(`${colors.bright}${colors.yellow}📋 ${title}${colors.reset}`);
  console.log('-'.repeat(60));
  
  for (const [name, value] of Object.entries(keys)) {
    console.log(`${colors.green}${name}${colors.reset}=${value}`);
  }
  console.log();
}

async function generateKeys() {
  printHeader('🔐 TON618 Production Keys Generator');

  console.log(`${colors.yellow}Generating secure cryptographic keys...${colors.reset}\n`);

  // Core encryption keys
  const encryptionKeys = {
    ENCRYPTION_KEY: generateHexKey(32), // 256-bit
    HASH_SALT: generateHexKey(32),      // 256-bit
    BOT_API_KEY: generateHexKey(32),    // 256-bit shared secret
    DASH_API_KEY: generateHexKey(32),   // 256-bit dashboard auth
  };

  // Lavalink passwords
  const lavaLinkKeys = {
    LAVALINK_PRO_PASSWORD: generatePassword(32),
    LAVALINK_FREE_PASSWORD: generatePassword(32),
  };

  printKeyGroup('🔐 ENCRYPTION & API KEYS (64-char hex)', encryptionKeys);
  printKeyGroup('🎵 LAVALINK PASSWORDS (32-char secure)', lavaLinkKeys);

  // Generate sample .env.production
  const envContent = `# Generated Production Keys - ${new Date().toISOString()}
# BACKUP THIS FILE IN A SECURE LOCATION
# DO NOT COMMIT TO VERSION CONTROL

${Object.entries({...encryptionKeys, ...lavaLinkKeys})
  .map(([key, value]) => `${key}=${value}`)
  .join('\n')}

# Additional production variables to configure manually:
DISCORD_TOKEN=your_discord_bot_token
MONGO_URI=mongodb+srv://user:password@cluster-production.mongodb.net
MONGO_DB=ton618_prod
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
BOT_INVITE_URL=https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot&permissions=0
`;

  // Ask if should save to file
  console.log(`${colors.cyan}Save generated keys to ${colors.bright}.env.production-generated${colors.reset}? ${colors.yellow}[y/N]${colors.reset}`);
  
  // For automated scripts, default to YES and write file
  const filename = path.join(process.cwd(), '.env.production-generated');
  fs.writeFileSync(filename, envContent, { mode: 0o600 }); // Read/write only for owner
  
  console.log(`${colors.green}✅ Keys saved to: ${colors.bright}${filename}${colors.reset}`);
  console.log(`${colors.yellow}⚠️  File permissions set to 0600 (owner read/write only)${colors.reset}`);

  printHeader('⚠️  SECURITY REMINDER');
  
  console.log(`${colors.yellow}1. BACKUP: Save the generated keys in a secure location${colors.reset}`);
  console.log(`${colors.yellow}2. VERSION CONTROL: Add to .gitignore:${colors.reset}`);
  console.log(`   ${colors.cyan}.env.production${colors.reset}`);
  console.log(`   ${colors.cyan}.env.production-generated${colors.reset}`);
  console.log(`\n${colors.yellow}3. DEPLOYMENT: Copy these values to your hosting platform:${colors.reset}`);
  console.log(`   - Vercel Secrets`);
  console.log(`   - Square Cloud Env Vars`);
  console.log(`   - Docker secrets`);
  console.log(`   - CI/CD platform secrets`);
  
  console.log(`\n${colors.yellow}4. ROTATION: Regenerate and update these keys every 90 days${colors.reset}`);
  console.log(`\n${colors.green}Generated at: ${new Date().toISOString()}${colors.reset}\n`);
}

// Run
generateKeys().catch(err => {
  console.error(`${colors.red}❌ Error: ${err.message}${colors.reset}`);
  process.exit(1);
});
