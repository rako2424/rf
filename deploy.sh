#!/bin/bash

# RF-SERVIS Avtomatik Quraşdırma Skripti (Ver: 1.1)
# Bu skript VPS mühitini təmizləyir və proqramı yenidən qurur.

set -e # Hər hansı bir xəta olsa dayansın

echo "===================================================="
echo "🚀 RF-SERVIS QURAŞDIRMA PROSESİ BAŞLAYIR..."
echo "===================================================="

# 1. Lazımi Paketlərin Quraşdırılması
echo "📦 1/7: Sistem alətləri quraşdırılır..."
sudo apt update
sudo apt install -y unzip build-essential python3 curl

# 2. Node.js (V20) Quraşdırılması
if ! command -v node &> /dev/null; then
    echo "📦 2/7: Node.js quraşdırılır..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js artıq quraşdırılıb."
fi

# 3. PM2 Quraşdırılması
if ! command -v pm2 &> /dev/null; then
    echo "📦 3/7: PM2 quraşdırılır..."
    sudo npm install -g pm2
else
    echo "✅ PM2 artıq quraşdırılıb."
fi

# 4. ZIP Faylının Çıxarılması
if [ -f "rf-servis.zip" ]; then
    echo "📂 4/7: rf-servis.zip faylı çıxarılır..."
    unzip -o rf-servis.zip
else
    echo "⚠️ XƏTA: rf-servis.zip tapılmadı! Lütfən faylı cari qovluğa yükləyin."
    exit 1
fi

# 5. Köhnə Qalıqların Təmizlənməsi və Kitabxanaların Yüklənməsi
echo "📥 5/7: Kitabxanalar yüklənir (npm install)..."
rm -rf node_modules package-lock.json
npm install

# 6. Frontend Build Prosesi
echo "🏗️ 6/7: Frontend hazırlanır (npm run build)..."
npm run build

# 7. Serverin PM2 ilə Başladılması
echo "⚙️ 7/7: Server işə salınır..."
pm2 delete rf-servis 2>/dev/null || true
NODE_ENV=production pm2 start server.ts --interpreter ./node_modules/.bin/tsx --name "rf-servis"

# 8. Konfiqurasiyanın yadda saxlanılması
pm2 save
pm2 startup | tail -n 1 | bash # PM2 startup komandasını avtomatik işlədir || true

echo ""
echo "===================================================="
echo "✅ RF-SERVIS UĞURLA QURAŞDIRILDI!"
echo "🌐 URL: http://SİZİN_SERVER_IP:3000"
echo "🛠️ Komandalar:"
echo "   - Status: pm2 status"
echo "   - Loqlar: pm2 logs rf-servis"
echo "   - Dayandır: pm2 stop rf-servis"
echo "===================================================="
