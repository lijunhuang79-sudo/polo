#!/bin/bash
# Polo PLC-Sim 从 GitHub 同步并部署
# 仓库: https://github.com/lijunhuang79-sudo/polo.git
# 运行位置: 服务器 213.111.157.18，建议用 root 或具备 /var/www/plc-sim/polo 权限的用户
#
# 用法:
#   bash deploy/scripts/deploy-polo.sh
# 或 (若在服务器上且已 chmod +x):
#   /var/www/plc-sim/polo/deploy/scripts/deploy-polo.sh

set -e
REPO_URL="${REPO_URL:-https://github.com/lijunhuang79-sudo/polo.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
# 仓库克隆/拉取根目录（与 Nginx root 的父目录一致）
REPO_ROOT="${REPO_ROOT:-/var/www/plc-sim/polo}"
# Nginx 提供前端静态文件的目录（构建产物复制到这里）
FRONTEND_WWW="${FRONTEND_WWW:-/var/www/plc-sim/polo/frontend}"
# 后端目录（与 repo 内 backend 一致，可直接用 repo 内 backend）
BACKEND_DIR="${REPO_ROOT}/backend"
PM2_APP_NAME="${PM2_APP_NAME:-plc-sim-api}"

echo "[$(date -Iseconds)] Deploy started: repo=$REPO_URL branch=$REPO_BRANCH"

# 1. 克隆或拉取
if [ ! -d "$REPO_ROOT/.git" ]; then
  echo "Cloning repo into $REPO_ROOT ..."
  sudo mkdir -p "$(dirname "$REPO_ROOT")"
  sudo git clone -b "$REPO_BRANCH" "$REPO_URL" "$REPO_ROOT"
  sudo chown -R "$USER:$USER" "$REPO_ROOT"
else
  echo "Pulling latest in $REPO_ROOT ..."
  cd "$REPO_ROOT"
  git fetch origin "$REPO_BRANCH"
  git reset --hard "origin/$REPO_BRANCH"
fi

cd "$REPO_ROOT"

# 2. 前端依赖与构建
echo "Installing frontend deps and building..."
export NODE_ENV=production
if [ -f .env.production ]; then
  export $(grep -v '^#' .env.production | xargs)
fi
npm ci --omit=dev
npm run build

if [ ! -d dist ]; then
  echo "ERROR: dist/ not found after build. Aborting."
  exit 1
fi

# 3. 发布前端到 Nginx 目录
echo "Publishing frontend to $FRONTEND_WWW ..."
sudo mkdir -p "$FRONTEND_WWW"
sudo rsync -a --delete dist/ "$FRONTEND_WWW/"
sudo chown -R www-data:www-data "$FRONTEND_WWW" 2>/dev/null || true

# 4. 后端：安装依赖并重启 pm2
if [ -d "$BACKEND_DIR" ] && [ -f "$BACKEND_DIR/server.js" ]; then
  echo "Backend: restarting $PM2_APP_NAME ..."
  cd "$BACKEND_DIR"
  if [ -f package.json ]; then
    npm ci --omit=dev 2>/dev/null || npm install --omit=dev 2>/dev/null || true
  fi
  if command -v pm2 >/dev/null 2>&1; then
    if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
      pm2 restart "$PM2_APP_NAME" --update-env
    else
      pm2 start server.js --name "$PM2_APP_NAME"
      pm2 save
    fi
  else
    echo "WARN: pm2 not found. Start backend manually: node server.js"
  fi
else
  echo "WARN: Backend dir not found or no server.js, skipping backend."
fi

echo "[$(date -Iseconds)] Deploy finished successfully."
