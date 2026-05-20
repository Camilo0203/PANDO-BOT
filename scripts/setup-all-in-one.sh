#!/bin/bash
# TON618 - Setup Todo-en-Uno
# Ejecutar UNA SOLA VEZ como root en la VPS
# IP: 31.220.96.156

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

IP="31.220.96.156"
BASE="/opt/ton618"

echo -e "${GREEN}========================================"
echo -e " TON618 - Instalacion Completa"
echo -e " IP: $IP"
echo -e "========================================${NC}"
echo ""

# ========== PASO 1: ACTUALIZAR SISTEMA ==========
echo -e "${YELLOW}[1/8] Actualizando sistema...${NC}"
apt update -qq && apt upgrade -y -qq

# ========== PASO 2: INSTALAR JAVA 17 ==========
echo -e "${YELLOW}[2/8] Instalando Java 17...${NC}"
apt install -y -qq openjdk-17-jre-headless > /dev/null 2>&1
java -version 2>&1 | head -n 1

# ========== PASO 3: INSTALAR NODE.JS 20 ==========
echo -e "${YELLOW}[3/8] Instalando Node.js 20...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt install -y -qq nodejs > /dev/null 2>&1
fi
node -v
npm -v

# ========== PASO 4: INSTALAR PM2 ==========
echo -e "${YELLOW}[4/8] Instalando PM2...${NC}"
npm install -g pm2 > /dev/null 2>&1

# ========== PASO 5: INSTALAR GIT Y UTILIDADES ==========
echo -e "${YELLOW}[5/8] Instalando Git, Caddy, firewall...${NC}"
apt install -y -qq git curl ufw > /dev/null 2>&1

# Instalar Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https > /dev/null 2>&1
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' 2>/dev/null | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg > /dev/null 2>&1
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' 2>/dev/null | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null 2>&1
apt update -qq > /dev/null 2>&1
apt install -y -qq caddy > /dev/null 2>&1

# ========== PASO 6: CREAR DIRECTORIOS Y CLONAR REPOS ==========
echo -e "${YELLOW}[6/8] Descargando codigo fuente...${NC}"
mkdir -p $BASE
cd $BASE

if [ ! -d "$BASE/ton618-bot" ]; then
    echo "  Clonando ton618-bot..."
    git clone https://github.com/Camilo0203/ton618-bot.git > /dev/null 2>&1
fi

if [ ! -d "$BASE/ton618-music" ]; then
    echo "  Clonando ton618-music..."
    git clone https://github.com/Camilo0203/ton618-music.git > /dev/null 2>&1
fi

if [ ! -d "$BASE/ton618-web" ]; then
    echo "  Clonando ton618-web..."
    git clone https://github.com/Camilo0203/ton618-web.git > /dev/null 2>&1
fi

# ========== PASO 7: INSTALAR DEPENDENCIAS Y BUILD ==========
echo -e "${YELLOW}[7/8] Instalando dependencias (toma ~2 min)...${NC}"
cd $BASE/ton618-bot && npm ci > /dev/null 2>&1 && echo -e "  ${GREEN}Bot listo${NC}"
cd $BASE/ton618-music && npm ci > /dev/null 2>&1 && echo -e "  ${GREEN}Musica listo${NC}"
cd $BASE/ton618-web && npm ci > /dev/null 2>&1 && npm run build > /dev/null 2>&1 && echo -e "  ${GREEN}Web lista${NC}"

# Descargar Lavalink
echo "  Descargando Lavalink..."
mkdir -p $BASE/ton618-music/lavalink
cd $BASE/ton618-music/lavalink
if [ ! -f "Lavalink.jar" ]; then
    wget -q --show-progress https://github.com/lavalink-devs/Lavalink/releases/download/4.2.2/Lavalink.jar
fi

# ========== PASO 8: CONFIGURAR CADDY ==========
echo -e "${YELLOW}[8/8] Configurando Caddy (SSL auto)...${NC}"
cat > /etc/caddy/Caddyfile << 'EOF'
ton618bot.xyz {
    reverse_proxy localhost:3000
    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
    }
}

www.ton618bot.xyz {
    redir https://ton618bot.xyz{uri}
}
EOF

systemctl restart caddy > /dev/null 2>&1
systemctl enable caddy > /dev/null 2>&1

# Configurar firewall
echo "  Configurando firewall..."
ufw default deny incoming > /dev/null 2>&1
ufw default allow outgoing > /dev/null 2>&1
ufw allow ssh > /dev/null 2>&1
ufw allow 80/tcp > /dev/null 2>&1
ufw allow 443/tcp > /dev/null 2>&1
ufw allow 2333/tcp > /dev/null 2>&1
ufw --force enable > /dev/null 2>&1

echo ""
echo -e "${GREEN}========================================"
echo -e " INSTALACION COMPLETA!"
echo -e "========================================${NC}"
echo ""
echo "Ahora necesitas configurar los archivos .env"
echo "Escribe estos comandos UNO POR UNO:"
echo ""
echo -e "${YELLOW}1. Configurar el Bot:${NC}"
echo "   nano /opt/ton618/ton618-bot/.env"
echo ""
echo -e "${YELLOW}2. Configurar la Musica:${NC}"
echo "   nano /opt/ton618/ton618-music/.env"
echo ""
echo -e "${YELLOW}3. Configurar la Web:${NC}"
echo "   nano /opt/ton618/ton618-web/.env"
echo ""
echo -e "${YELLOW}4. Despues de configurar todo, ejecutar:${NC}"
echo "   bash /opt/ton618/ton618-bot/scripts/deploy-vps.sh"
echo ""
