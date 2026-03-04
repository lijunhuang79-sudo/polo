#!/usr/bin/env node
/**
 * 模拟到账 — 本地控制脚本
 * 在您本机运行，向服务器发送「模拟到账」请求，由服务器将指定订单置为已支付并发放激活码/ token。
 * 用法：
 *   node tools/simulate-callback.js <订单号> [API 根地址]
 * 环境变量（可选）：
 *   SIMULATE_API_BASE  服务器 API 根地址，例如 https://www.plc-sim.com 或 https://api.plc-sim.com
 *   SIMULATE_AUTH      Basic 认证，格式 "用户名:密码"（若服务器开启了 Basic Auth）
 * 示例：
 *   node tools/simulate-callback.js abc123def456
 *   node tools/simulate-callback.js abc123def456 https://api.plc-sim.com
 *   SIMULATE_AUTH="admin:yourpass" node tools/simulate-callback.js abc123def456
 */

const orderId = process.argv[2];
const apiBase = process.argv[3] || process.env.SIMULATE_API_BASE || 'https://www.plc-sim.com';
const auth = process.env.SIMULATE_AUTH; // "user:pass"

if (!orderId || !orderId.trim()) {
  console.error('用法: node tools/simulate-callback.js <订单号> [API根地址]');
  console.error('示例: node tools/simulate-callback.js 248d5deabda9076f');
  process.exit(1);
}

const url = `${apiBase.replace(/\/$/, '')}/api/order/simulate-callback`;
const headers = { 'Content-Type': 'application/json' };
if (auth) {
  headers['Authorization'] = 'Basic ' + Buffer.from(auth, 'utf8').toString('base64');
}

(async () => {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ orderId: orderId.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data.ok || data.license_key || data.token)) {
      console.log('模拟到账成功');
      if (data.license_key) console.log('基础版授权码:', data.license_key);
      if (data.token) console.log('AI 周卡 token:', data.token);
      if (data.validUntil) console.log('AI 周卡有效期至:', data.validUntil);
      if (data.message) console.log(data.message);
    } else {
      console.error('失败:', data.error || data.message || res.statusText || res.status);
      process.exit(1);
    }
  } catch (e) {
    console.error('请求异常:', e.message);
    process.exit(1);
  }
})();
