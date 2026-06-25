#!/bin/bash
# TON618 Full Deploy Script
# Run on the VPS after vps-setup.sh and .env files are configured

set -e

BASE="/opt/ton618"

echo "========================================"
echo " TON618 Production Deploy"
echo "========================================"

# Verify .env files exist
echo "[1/6] Verifying .env files..."
for repo in ton618-bot ton618-web ton618-status; do
    if [ ! -f "$BASE/$repo/.env" ]; then
        echo "ERROR: Missing $repo/.env — copy .env.example and fill values first"
        exit 1
    fi
done
echo "  All .env files present"

# Update code
echo "[2/6] Pulling latest code..."
cd $BASE/ton618-shared && git pull origin main
cd $BASE/ton618-bot && git pull origin main
cd $BASE/ton618-web && git pull origin main
cd $BASE/ton618-status && git pull origin main

# Reinstall dependencies if needed
echo "[3/6] Checking dependencies..."
cd $BASE/ton618-shared && npm ci && npm run build
cd $BASE/ton618-bot && npm ci
cd $BASE/ton618-web && npm ci && npm run build
cd $BASE/ton618-status && npm ci && npm run build

# Verify Lavalink JAR exists
echo "[4/6] Verifying Lavalink..."
if [ ! -f "$BASE/ton618-bot/lavalink/Lavalink.jar" ]; then
    echo "ERROR: Lavalink.jar not found. Run vps-setup.sh first or download manually:"
    echo "  wget -O $BASE/ton618-bot/lavalink/Lavalink.jar https://github.com/lavalink-devs/Lavalink/releases/download/4.2.2/Lavalink.jar"
    exit 1
fi

# Start/Reload PM2 services
echo "[5/6] Starting PM2 services..."

# Lavalink PRO node (must be running before bot connects)
cd $BASE/ton618-bot
pm2 delete ton618-lavalink 2>/dev/null || true
pm2 start ecosystem.config.js --only ton618-lavalink

echo "  Waiting 10s for Lavalink to initialize..."
sleep 10

# Bot (connects to Lavalink on startup)
cd $BASE/ton618-bot
pm2 delete ton618-bot 2>/dev/null || true
pm2 start ecosystem.config.js --only ton618-bot

# Web dashboard
cd $BASE/ton618-web
pm2 delete ton618-web 2>/dev/null || true
pm2 start ecosystem.config.js --only ton618-web

# Public status page
cd $BASE/ton618-status
pm2 delete ton618-status 2>/dev/null || true
pm2 start ecosystem.config.js --only ton618-status

# Save PM2 config
echo "[6/6] Saving PM2 config..."
pm2 save
pm2 startup systemd -u root --hp /root

# Reload Caddy
echo "Reloading Caddy..."
systemctl reload caddy 2>/dev/null || systemctl start caddy

echo ""
echo "========================================"
echo " Deploy complete!"
echo "========================================"
echo ""
pm2 status
echo ""
echo "Check health: curl http://localhost:3000/health"
echo "Check bot:    pm2 logs ton618-bot --lines 20"
