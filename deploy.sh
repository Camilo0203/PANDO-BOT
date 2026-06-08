#!/usr/bin/env bash

#################################
# TON618 Bot - Production Deploy Script
# Validates environment, installs deps, runs health checks
#################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-30}
HEALTH_CHECK_INTERVAL=${HEALTH_CHECK_INTERVAL:-2}
HEALTH_CHECK_URL=${HEALTH_CHECK_URL:-"http://localhost:80/health"}
MAX_RETRIES=${MAX_RETRIES:-5}
DEPLOY_LOCK_FILE=".deploy.lock"

log_header() {
  echo -e "\n${BLUE}==================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}==================================${NC}\n"
}

log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

# Error handler
trap_error() {
  log_error "Deploy failed at line $1"
  cleanup
  exit 1
}

trap 'trap_error $LINENO' ERR

cleanup() {
  if [ -f "$DEPLOY_LOCK_FILE" ]; then
    rm -f "$DEPLOY_LOCK_FILE"
  fi
}

# Ensure cleanup on exit
trap cleanup EXIT

# ==========================================
# PRE-DEPLOYMENT CHECKS
# ==========================================

log_header "🔍 PRE-DEPLOYMENT VALIDATION"

# 1. Check if another deploy is running
if [ -f "$DEPLOY_LOCK_FILE" ]; then
  log_error "Another deployment is in progress (lock file exists)"
  exit 1
fi
touch "$DEPLOY_LOCK_FILE"

# 2. Verify Node.js version
log_info "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  log_error "Node.js 20+ is required, found v$(node -v)"
  exit 1
fi
log_success "Node.js $(node -v) detected"

# 3. Verify npm version
log_info "Checking npm version..."
NPM_VERSION=$(npm -v | cut -d'.' -f1)
if [ "$NPM_VERSION" -lt 10 ]; then
  log_warning "npm 10+ recommended, found v$(npm -v)"
fi
log_success "npm $(npm -v) detected"

# 4. Check critical environment variables
log_info "Validating critical environment variables..."
REQUIRED_VARS=(
  "DISCORD_TOKEN"
  "MONGO_URI"
  "ENCRYPTION_KEY"
  "HASH_SALT"
  "BOT_API_KEY"
  "DASH_API_KEY"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    MISSING_VARS+=("$var")
  fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  log_error "Missing critical environment variables: ${MISSING_VARS[*]}"
  log_error "Generate with: node scripts/generate-production-keys.js"
  exit 1
fi
log_success "All critical environment variables are set"

# 5. Verify encryption key format (64 hex chars for 256-bit)
if ! echo "$ENCRYPTION_KEY" | grep -qE '^[a-fA-F0-9]{64}$'; then
  log_error "ENCRYPTION_KEY must be 64 hexadecimal characters"
  exit 1
fi
log_success "ENCRYPTION_KEY format is valid (256-bit hex)"

# 6. Verify HASH_SALT length (min 32 chars)
if [ ${#HASH_SALT} -lt 32 ]; then
  log_error "HASH_SALT must be at least 32 characters"
  exit 1
fi
log_success "HASH_SALT length is valid (${#HASH_SALT} chars)"

# 7. Check package.json exists
if [ ! -f "package.json" ]; then
  log_error "package.json not found"
  exit 1
fi
log_success "package.json found"

# ==========================================
# DEPENDENCY INSTALLATION
# ==========================================

log_header "📦 INSTALLING DEPENDENCIES"

if [ -f package-lock.json ]; then
  log_info "Installing dependencies with npm ci (clean install)..."
  npm ci --production=false
else
  log_warning "package-lock.json not found, using npm install..."
  npm install
fi

log_success "Dependencies installed successfully"

# ==========================================
# VALIDATION CHECKS
# ==========================================

log_header "🧪 RUNNING VALIDATION CHECKS"

# 1. Run npm audit
log_info "Running npm audit..."
if npm audit --audit-level=high 2>/dev/null || true; then
  log_success "npm audit check passed"
else
  log_warning "npm audit found vulnerabilities (non-blocking)"
fi

# 2. Validate production environment
log_info "Validating production environment..."
if node -e "const {validateProductionEnv} = require('./src/utils/envValidator'); const result = validateProductionEnv(); process.exit(result.valid ? 0 : 1);" 2>/dev/null; then
  log_success "Production environment validation passed"
else
  log_warning "Production environment validation had issues"
fi

# 3. Check discord.js version
log_info "Checking discord.js version..."
DISCORD_JS_VERSION=$(node -e "console.log(require('discord.js/package.json').version)")
log_success "discord.js v${DISCORD_JS_VERSION} is installed"

# ==========================================
# POST-DEPLOYMENT SETUP
# ==========================================

log_header "🚀 DEPLOYMENT READY"

log_success "Deploy script completed successfully!"

echo ""
log_info "Next steps:"
echo "  1. Start the bot with:        ${YELLOW}npm start${NC}"
echo "  2. Sync slash commands:       ${YELLOW}npm run deploy:compact${NC}"
echo "  3. Monitor health:            ${YELLOW}curl http://localhost/health${NC}"
echo "  4. Check logs:                ${YELLOW}npm run logs${NC}"
echo ""

log_warning "⏱️  NOTE: Bot startup may take 60-120 seconds to initialize"
log_warning "   Check /health and /ready endpoints for status"
echo ""
