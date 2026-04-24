#!/bin/bash

# Xəta olarsa dayansın
set -e

echo "🚀 GitHub-dan ən son kodlar çəkilir..."
git pull origin main

echo "📥 Yeni kitabxanalar yoxlanılır..."
npm install

echo "🏗️ Frontend Build edilir..."
npm run build

echo "⚙️ Server PM2 ilə yenilənir..."
pm2 restart rf-servis

echo "✅ Yenilənmə uğurla tamamlandı!"
