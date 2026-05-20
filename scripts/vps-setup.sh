#!/bin/bash
# TON618 VPS Initial Setup Script
# Run ONCE as root on a fresh Ubuntu 22.04 VPS
# IP: 31.220.96.156

set -e

IP="31.220.96.156"

echo "========================================"
echo " TON618 VPS Setup - Ubuntu 22.04"
echo " IP: $IP"
echo "========================================"
echo ""

# Update system
echo "[1/10] Updating system packages..."
apt update && apt upgrade -y

# Install Java 17 (Lavalink requirement)
echo "[2/10] Installing Java 17..."
apt install -y openjdk-17-jre-headless
java -version

# Install Node.js 20
echo "[3/10] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
npm -v

# Install PM2 globally
echo "[4/10] Installing PM2..."
npm install -g pm2

# Install Git and utilities
echo "[5/10] Installing Git, curl, ufw..."
apt install -y git curl ufw

# Install Caddy (reverse proxy + SSL)
echo "[6/10] Installing Caddy..."
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

# Create app directory
echo "[7/10] Creating /opt/ton618 directory..."
mkdir -p /opt/ton618
cd /opt/ton618

# Clone repositories
echo "[8/10] Cloning repositories..."
git clone https://github.com/Camilo0203/ton618-bot.git
git clone https://github.com/Camilo0203/ton618-music.git
git clone https://github.com/Camilo0203/ton618-web.git

# Install dependencies
echo "[9/10] Installing dependencies..."
cd /opt/ton618/ton618-bot && npm ci
cd /opt/ton618/ton618-music && npm ci
cd /opt/ton618/ton618-web && npm ci && npm run build

# Download Lavalink JAR
echo "[10/10] Downloading Lavalink..."
cd /opt/ton618/ton618-music/lavalink
wget -q --show-progress https://github.com/lavalink-devs/Lavalink/releases/download/4.2.2/Lavalink.jar

echo ""
echo "========================================"
echo " Base setup complete!"
echo "========================================"
echo ""
echo "NEXT STEPS:"
echo "  1. Copy your .env files into each repo"
echo "  2. Run: bash /opt/ton618/ton618-bot/scripts/deploy-vps.sh"
echo ""
