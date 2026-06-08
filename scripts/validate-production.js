#!/usr/bin/env node
/**
 * Pre-Deployment Validation for TON618 Production
 * Runs comprehensive checks before deployment
 * Usage: npm run validate:production
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

class DeploymentValidator {
  constructor() {
    this.checks = [];
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
  }

  printHeader() {
    console.log(`\n${colors.cyan}${'='.repeat(70)}${colors.reset}`);
    console.log(`${colors.bright}📋 TON618 PRODUCTION DEPLOYMENT VALIDATION${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(70)}${colors.reset}\n`);
  }

  printSection(title) {
    console.log(`\n${colors.bright}${colors.cyan}▸ ${title}${colors.reset}`);
    console.log(`${colors.cyan}${'─'.repeat(70)}${colors.reset}`);
  }

  checkPass(name, message = '') {
    this.passed++;
    console.log(`${colors.green}✅ PASS${colors.reset}  ${name}`);
    if (message) console.log(`        ${message}`);
  }

  checkFail(name, message = '') {
    this.failed++;
    console.log(`${colors.red}❌ FAIL${colors.reset}  ${name}`);
    if (message) console.log(`        ${message}`);
  }

  checkWarn(name, message = '') {
    this.warnings++;
    console.log(`${colors.yellow}⚠️  WARN${colors.reset}  ${name}`);
    if (message) console.log(`        ${message}`);
  }

  async runTests() {
    this.printHeader();

    // 1. Environment Files
    this.printSection('1. Environment Configuration');
    this.checkEnvironmentFiles();

    // 2. Dependencies
    this.printSection('2. Dependencies & Security');
    await this.checkDependencies();

    // 3. Configuration Files
    this.printSection('3. Configuration Files');
    this.checkConfigFiles();

    // 4. Build System
    this.printSection('4. Build System');
    this.checkBuildSystem();

    // 5. Lavalink Setup
    this.printSection('5. Lavalink Configuration');
    this.checkLavaliinkConfig();

    // 6. Database
    this.printSection('6. Database Configuration');
    this.checkDatabase();

    // 7. Scripts
    this.printSection('7. Deployment Scripts');
    this.checkScripts();

    // Print Summary
    this.printSummary();
  }

  checkEnvironmentFiles() {
    const envFiles = [
      { path: '.env.production.example', critical: true },
      { path: 'scripts/generate-production-keys.js', critical: true },
      { path: '.env', critical: false },
    ];

    for (const file of envFiles) {
      if (fs.existsSync(file.path)) {
        this.checkPass(
          `${file.path} exists`,
          file.critical ? '(CRITICAL)' : '(development only)'
        );
      } else if (file.critical) {
        this.checkFail(
          `${file.path} NOT FOUND`,
          'This file is REQUIRED for production deployment'
        );
      }
    }

    // Check if .env is in .gitignore
    if (fs.existsSync('.gitignore')) {
      const gitignore = fs.readFileSync('.gitignore', 'utf8');
      if (gitignore.includes('.env')) {
        this.checkPass('.env is in .gitignore', 'Secrets will not be committed');
      } else {
        this.checkFail(
          '.env not in .gitignore',
          'Add .env to .gitignore immediately to prevent secret leaks'
        );
      }
    }
  }

  async checkDependencies() {
    try {
      const output = execSync('npm audit --json 2>/dev/null || echo "{}"', { encoding: 'utf8' });
      const audit = JSON.parse(output);
      
      const vulnCount = audit.metadata?.vulnerabilities?.total || 0;
      
      if (vulnCount === 0) {
        this.checkPass('npm audit', 'No vulnerabilities found');
      } else {
        const critical = audit.metadata?.vulnerabilities?.critical || 0;
        const high = audit.metadata?.vulnerabilities?.high || 0;
        
        if (critical > 0) {
          this.checkFail(
            'npm audit',
            `${critical} CRITICAL vulnerabilities found. Run: npm audit fix`
          );
        } else if (high > 0) {
          this.checkWarn(
            'npm audit',
            `${high} HIGH vulnerabilities found. Run: npm audit fix`
          );
        }
      }
    } catch (error) {
      this.checkWarn('npm audit', 'Could not run npm audit');
    }
  }

  checkConfigFiles() {
    const configs = [
      { path: 'src/utils/envValidator.js', desc: 'Environment validator' },
      { path: 'src/web/server.js', desc: 'Web server configuration' },
      { path: '.env.production.example', desc: 'Production env template' },
    ];

    for (const config of configs) {
      if (fs.existsSync(config.path)) {
        this.checkPass(`${config.desc}`, config.path);
      } else {
        this.checkFail(`${config.desc} NOT FOUND`, config.path);
      }
    }
  }

  checkBuildSystem() {
    const buildFiles = ['package.json', 'package-lock.json'];
    
    for (const file of buildFiles) {
      if (fs.existsSync(file)) {
        this.checkPass(`${file} exists`);
      } else {
        this.checkFail(`${file} NOT FOUND`, 'Cannot build project');
      }
    }

    // Check deploy scripts
    if (fs.existsSync('deploy.sh')) {
      this.checkPass('deploy.sh exists');
    } else {
      this.checkWarn('deploy.sh NOT FOUND', 'Manual deployment may be required');
    }
  }

  checkLavaliinkConfig() {
    const lavaConfigs = [
      '../ton618-music/lavalink/application.yml',
      '../ton618-music/lavalink/application-free.yml',
    ];

    for (const config of lavaConfigs) {
      if (fs.existsSync(config)) {
        const content = fs.readFileSync(config, 'utf8');
        
        // Check for env var usage
        if (content.includes('${LAVALINK_') || content.includes('${SPOTIFY_')) {
          this.checkPass(
            `${path.basename(config)} uses env vars`,
            'Passwords are not hardcoded'
          );
        } else {
          this.checkWarn(
            `${path.basename(config)} may have hardcoded passwords`,
            'Verify LAVALINK_* env vars are used'
          );
        }
      }
    }
  }

  checkDatabase() {
    if (fs.existsSync('src/utils/database.js')) {
      this.checkPass('Database module exists');
    }
    
    // Check if MongoDB connection uses SSL
    const envExample = fs.existsSync('.env.production.example')
      ? fs.readFileSync('.env.production.example', 'utf8')
      : '';
    
    if (envExample.includes('mongodb+srv://') || envExample.includes('tls=true')) {
      this.checkPass('MONGO_URI uses SSL/TLS', 'Encrypted database connection');
    } else {
      this.checkWarn(
        'MONGO_URI may not enforce SSL/TLS',
        'Add ?tls=true or use mongodb+srv://'
      );
    }
  }

  checkScripts() {
    const scripts = [
      'scripts/generate-production-keys.js',
      'deploy.sh',
    ];

    for (const script of scripts) {
      if (fs.existsSync(script)) {
        const stat = fs.statSync(script);
        const isExecutable = (stat.mode & 0o111) !== 0;
        const msg = isExecutable ? 'executable' : 'not executable (may need chmod +x)';
        this.checkPass(`${script}`, msg);
      } else {
        this.checkWarn(`${script} NOT FOUND`);
      }
    }
  }

  printSummary() {
    const total = this.passed + this.failed + this.warnings;
    const status = this.failed === 0 ? colors.green : colors.red;
    
    console.log(`\n${colors.cyan}${'='.repeat(70)}${colors.reset}`);
    console.log(`${colors.bright}SUMMARY${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(70)}${colors.reset}`);
    
    console.log(`\n${colors.green}✅ Passed:  ${this.passed}${colors.reset}`);
    if (this.warnings > 0) console.log(`${colors.yellow}⚠️  Warnings: ${this.warnings}${colors.reset}`);
    if (this.failed > 0) console.log(`${colors.red}❌ Failed:  ${this.failed}${colors.reset}`);
    
    console.log(`\n${status}${colors.bright}Total: ${total}${colors.reset}\n`);

    if (this.failed > 0) {
      console.log(`${colors.red}🛑 DEPLOYMENT BLOCKED: Fix ${this.failed} critical issues before proceeding${colors.reset}\n`);
      process.exit(1);
    } else if (this.warnings > 0) {
      console.log(`${colors.yellow}⚠️  WARNINGS FOUND: Review before production deployment${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(`${colors.green}🚀 ALL CHECKS PASSED: Ready for production deployment${colors.reset}\n`);
      process.exit(0);
    }
  }
}

// Run validation
const validator = new DeploymentValidator();
validator.runTests().catch(err => {
  console.error(`${colors.red}Validation error: ${err.message}${colors.reset}`);
  process.exit(1);
});
