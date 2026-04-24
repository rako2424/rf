#!/bin/bash

# RF-SERVIS Avtomatik Quraşdırma Skripti (VPS üçün)
echo "🚀 RF-SERVIS Quraşdırılır..."

# 1. Sistemi Yenilə və Lazımi Alətləri Quraşdır
echo "📦 Sistem alətləri quraşdırılır..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y unzip build-essential python3

# 2. Node.js Quraşdır (Yoxdursa)
if ! command -v node &> /dev/null
then
    echo "📦 Node.js quraşdırılır..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 3. PM2 Quraşdır
sudo npm install -g pm2

# 4. ZIP faylını çıxar
if [ -f "rf-servis.zip" ]; then
    echo "📂 Fayllar çıxarılır..."
    unzip -o rf-servis.zip
fi

# 5. Təmiz quraşdırma (Köhnə node_modules silinir)
echo "📥 Kitabxanalar yüklənir..."
rm -rf node_modules package-lock.json
npm install

# 6. Frontend Build
echo "🏗️ Frontend hazırlanır (Build)..."
npm run build

# 7. Serveri PM2 ilə başlat
echo "⚙️ Server başladılır..."
pm2 stop rf-servis 2>/dev/null || true
NODE_ENV=production pm2 start server.ts --interpreter ./node_modules/.bin/tsx --name "rf-servis"

# 8. Başlanğıcda avtomatik dostu et
pm2 save
pm2 startup

echo "===================================================="
echo "✅ TƏBRİKLƏR! RF-SERVIS UĞURLA QURAŞDIRILDI."
echo "🌐 Saytınız 3000 portunda işləyir."
echo "💡 PM2 statusunu yoxlamaq üçün: pm2 status"
echo "===================================================="
