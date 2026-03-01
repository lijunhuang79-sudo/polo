#!/bin/bash
# 在服务器 213.111.157.18 上执行（Linux）
# 用法: bash setup-nginx.sh 或 chmod +x setup-nginx.sh && ./setup-nginx.sh

set -e
NGINX_CONF_DIR="${NGINX_CONF_DIR:-/etc/nginx/sites-available}"
NGINX_ENABLED_DIR="${NGINX_ENABLED_DIR:-/etc/nginx/sites-enabled}"
SITE_ROOT="/var/www/plc-sim"

echo "Creating site root..."
sudo mkdir -p "$SITE_ROOT/frontend" "$SITE_ROOT/backend"
sudo chown -R "$USER:$USER" "$SITE_ROOT"

echo "Enable site config (copy plc-sim.conf to $NGINX_CONF_DIR first)..."
if [ -f "$NGINX_CONF_DIR/plc-sim.conf" ]; then
  sudo ln -sf "$NGINX_CONF_DIR/plc-sim.conf" "$NGINX_ENABLED_DIR/plc-sim.conf"
  sudo nginx -t && sudo systemctl reload nginx
  echo "Nginx reloaded."
else
  echo "Put plc-sim.conf into $NGINX_CONF_DIR then run: sudo nginx -t && sudo systemctl reload nginx"
fi

echo "Done. Frontend: $SITE_ROOT/frontend, Backend: $SITE_ROOT/backend"
