#!/bin/bash
# 后端健康与配置快速检查（对应 Failed to fetch 排查步骤 3、4、5）
# 在服务器上运行，例如：bash deploy/scripts/check-backend-health.sh
# 或：/var/www/plc-sim/polo/deploy/scripts/check-backend-health.sh

set -e
REPO_ROOT="${REPO_ROOT:-/var/www/plc-sim/polo}"
BACKEND_DIR="${BACKEND_DIR:-$REPO_ROOT/backend}"
PM2_APP_NAME="${PM2_APP_NAME:-plc-sim-api}"

echo "========== 步骤 3：CORS 白名单 =========="
if [ -f "$BACKEND_DIR/.env" ]; then
  if grep -q "CORS_ORIGINS" "$BACKEND_DIR/.env"; then
    echo "CORS_ORIGINS 当前值:"
    grep "CORS_ORIGINS" "$BACKEND_DIR/.env" | cut -d= -f2-
  else
    echo "未在 .env 中设置 CORS_ORIGINS，将使用代码默认值"
  fi
else
  echo "未找到 $BACKEND_DIR/.env"
fi
if command -v pm2 >/dev/null 2>&1; then
  echo "pm2 环境中的 CORS_ORIGINS:"
  pm2 env "$PM2_APP_NAME" 2>/dev/null | grep CORS || echo "未找到或进程不存在"
fi

echo ""
echo "========== 步骤 4：进程与端口 =========="
if command -v pm2 >/dev/null 2>&1; then
  echo "pm2 列表:"
  pm2 list 2>/dev/null || true
else
  echo "pm2 未安装"
fi
echo "端口 3000 监听:"
(ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null) | grep -E "3000|Address" || echo "未找到 3000 或命令不可用"
echo "本机 health:"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" http://127.0.0.1:3000/health 2>/dev/null || echo "  请求失败"
curl -s http://127.0.0.1:3000/health 2>/dev/null || true
echo ""
echo "api.plc-sim.com health (若 DNS 指向本机):"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" https://api.plc-sim.com/health 2>/dev/null || echo "  请求失败或域名未解析"

echo ""
echo "========== 步骤 5：API Key 是否已设置（不显示具体值）=========="
if [ -f "$BACKEND_DIR/.env" ]; then
  for v in DEEPSEEK_API_KEY GEMINI_API_KEY OPENAI_API_KEY; do
    if grep -q "^${v}=.\+" "$BACKEND_DIR/.env" 2>/dev/null; then
      echo "  $v: 已设置"
    else
      echo "  $v: 未设置"
    fi
  done
else
  echo "  未找到 $BACKEND_DIR/.env"
fi

echo ""
echo "========== 检查结束 =========="
