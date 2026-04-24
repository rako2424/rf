#!/bin/bash

# VPS-də proqramı avtomatik quran skript
echo "🚀 RF-SERVIS Quraşdırılır..."

# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js (if not installed)
if ! command -v node &> /dev/null
then
    echo "📦 Node.js quraşdırılır..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 3. Install PM2 (Process Manager)
sudo npm install -g pm2

# 4. Clone/Update code (Siz bura github linkinizi qoyacaqsınız)
# git clone <sizin-github-linki> app
# cd app

# 5. Install dependencies
npm install

# 6. Build frontend
npm run build

# 7. Start server with PM2
pm2 start server.ts --interpreter ./node_modules/.bin/tsx --name "rf-servis"

# 8. Setup PM2 to start on boot
pm2 save
pm2 startup

echo "✅ Quraşdırma tamamlandı! Server 3000 portunda işləyir."
