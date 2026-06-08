#!/usr/bin/env node
/**
 * Post-Deployment Health Check for TON618 Production
 * Validates bot is responding and MongoDB is connected
 * Usage: npm run health:check
 */

const http = require('http');
const https = require('https');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

const HEALTH_URL = process.env.HEALTH_CHECK_URL || 'http://localhost:80/health';
const READY_URL = process.env.READY_CHECK_URL || 'http://localhost:80/ready';
const TIMEOUT_MS = 5000;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

async function checkHealth(url, name, retryCount = 0) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, { timeout: TIMEOUT_MS }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const status = res.statusCode >= 200 && res.statusCode < 300 ? 'pass' : 'fail';
          resolve({
            name,
            status,
            statusCode: res.statusCode,
            data: json,
            healthy: status === 'pass',
          });
        } catch (e) {
          resolve({
            name,
            status: 'fail',
            statusCode: res.statusCode,
            error: 'Invalid JSON response',
            healthy: false,
          });
        }
      });
    });

    request.on('error', (err) => {
      if (retryCount < MAX_RETRIES) {
        setTimeout(() => {
          console.log(`${colors.yellow}↻ Retry ${retryCount + 1}/${MAX_RETRIES} for ${name}...${colors.reset}`);
          checkHealth(url, name, retryCount + 1).then(resolve);
        }, RETRY_DELAY_MS);
      } else {
        resolve({
          name,
          status: 'fail',
          error: err.message,
          healthy: false,
          retrysFailed: true,
        });
      }
    });

    request.on('timeout', () => {
      request.destroy();
      if (retryCount < MAX_RETRIES) {
        setTimeout(() => {
          checkHealth(url, name, retryCount + 1).then(resolve);
        }, RETRY_DELAY_MS);
      } else {
        resolve({
          name,
          status: 'fail',
          error: 'Timeout',
          healthy: false,
          retrysFailed: true,
        });
      }
    });
  });
}

async function printResult(result) {
  const icon = result.healthy ? `${colors.green}✅` : `${colors.red}❌`;
  console.log(`${icon}${colors.reset} ${result.name}`);
  
  if (result.statusCode) {
    console.log(`   Status: ${result.statusCode}`);
  }
  
  if (result.error) {
    console.log(`   ${colors.red}Error: ${result.error}${colors.reset}`);
  }
  
  if (result.data) {
    console.log(`   Uptime: ${result.data.uptime || 'N/A'}`);
    console.log(`   Memory: ${result.data.memoryUsage?.heapUsed || 'N/A'}`);
  }
  
  if (result.retrysFailed) {
    console.log(`   ${colors.yellow}Failed after ${MAX_RETRIES} retries${colors.reset}`);
  }
  
  console.log();
}

async function main() {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}🏥 TON618 POST-DEPLOYMENT HEALTH CHECK${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);

  console.log(`Checking: ${HEALTH_URL}`);
  console.log(`Timeout: ${TIMEOUT_MS}ms, Max Retries: ${MAX_RETRIES}\n`);

  // Run both checks in parallel
  const [healthResult, readyResult] = await Promise.all([
    checkHealth(HEALTH_URL, 'Bot Health'),
    checkHealth(READY_URL, 'Bot Ready State'),
  ]);

  // Print results
  await printResult(healthResult);
  await printResult(readyResult);

  // Summary
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  
  const allHealthy = healthResult.healthy && readyResult.healthy;
  
  if (allHealthy) {
    console.log(`${colors.green}✅ ALL CHECKS PASSED${colors.reset}`);
    console.log(`\n🚀 Bot is healthy and ready for production!\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}❌ SOME CHECKS FAILED${colors.reset}`);
    console.log(`\n⚠️  Bot may not be ready yet. Check logs for details.\n`);
    
    if (!healthResult.healthy) {
      console.log(`${colors.yellow}Troubleshooting:${colors.reset}`);
      console.log('  1. Check if bot process is running: npm start');
      console.log('  2. Verify MongoDB connection: check MONGO_URI env var');
      console.log('  3. Check logs: npm run logs');
      console.log('  4. Verify Discord token: check DISCORD_TOKEN env var\n');
    }
    
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`);
  process.exit(1);
});
