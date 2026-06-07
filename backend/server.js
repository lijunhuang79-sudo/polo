/**
 * PLC-Sim API 服务
 * 运行在 3000 端口，供 api.plc-sim.com 反向代理
 * API Key 仅从环境变量读取，永不返回给前端
 * 三档收费：订单、基础版授权、AI 月卡 token（表名 ai_week_tokens 保留兼容）
 */
import http from 'http';
import crypto from 'crypto';
import { parse as parseUrl } from 'url';
import { URLSearchParams } from 'url';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));

const dbFile = join(__dirname, 'plc-sim.db');
const db = new Database(dbFile);

db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  product_type TEXT NOT NULL,
  amount REAL NOT NULL,
  pay_status TEXT NOT NULL,
  pay_channel TEXT,
  pay_time INTEGER,
  buyer_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS basic_licenses (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  license_key TEXT NOT NULL UNIQUE,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_week_tokens (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  valid_from INTEGER NOT NULL,
  valid_until INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
`);

const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  });
}

const PORT = Number(process.env.PORT) || 3001;
const ALIPAY_GATEWAY = process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do';
const ALIPAY_APP_ID = (process.env.ALIPAY_APP_ID || '').trim();
const ALIPAY_NOTIFY_URL = (process.env.ALIPAY_NOTIFY_URL || '').trim();
const ALIPAY_RETURN_URL = (process.env.ALIPAY_RETURN_URL || '').trim();
const ALIPAY_APP_PRIVATE_KEY = normalizePemKey(process.env.ALIPAY_APP_PRIVATE_KEY || '', 'private');
const ALIPAY_PUBLIC_KEY = normalizePemKey(process.env.ALIPAY_PUBLIC_KEY || '', 'public');
const ALIPAY_ENABLED = String(process.env.ALIPAY_ENABLED || '').trim().toLowerCase() === 'true';

function normalizePemKey(value, keyType) {
  if (!value) return '';
  const normalized = value.replace(/\\n/g, '\n').trim();
  if (normalized.includes('BEGIN ') && normalized.includes('END ')) return normalized;
  // 支持支付宝控制台复制的单行 Base64 密钥，自动包装为 PEM
  const compact = normalized.replace(/\s+/g, '');
  const body = compact.match(/.{1,64}/g)?.join('\n') || compact;
  if (keyType === 'private') return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
  return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`;
}

const SYSTEM_PROMPT = `You are an expert PLC engineer.

Your job is to convert a Chinese natural-language scene description into a coherent PLC control solution AND a small simulation-ready model.

Input format:
- The user text may optionally be followed by a JSON block named "logic_hints" that looks like:
  {
    "hasStartStop": true,
    "hasInterlock": false,
    "hasDelayOn": false,
    "hasDoublePressStart": false,
    "hasCounting": false,
    "hasTrafficLight": false,
    "hasSequencer": false,
    "hasEmergency": false,
    "hasLighting": false,
    "hasMultiModeLighting": false,
    "hasMotor": true,
    "hasPump": false,
    "hasStarDelta": false,
    "hasGarageDoor": false,
    "hasMixingTank": false,
    "hasElevator": false,
    "hasPID": false,
    "scenarioType": "motor"
  }
- These logic_hints are produced by a rule-based classifier and are very important.
- If they conflict with your own guess, PREFER the logic_hints flags and scenarioType.

You MUST output strictly valid JSON (RFC 8259), no markdown, no comments, no trailing commas.
The JSON MUST match this TypeScript shape:
{
  "io": [{"addr": "I0.0", "symbol": "START", "device": "启动按钮", "type": "DI", "spec": "NO", "location": "控制柜", "note": "", "isMomentary": true}],
  "hardware": [{"name": "PLC", "model": "CPU 224XP", "qty": 1, "spec": "", "note": "", "required": true}],
  "stlCode": "TITLE ...\\nLD I0.0 ...",
  "ladCode": "Network 1: ...",
  "sclCode": "\\"KM1\\" := ...",
  "logicConfig": {"hasStartStop": true, "hasInterlock": false, "hasDelayOn": false, "hasDoublePressStart": false, "hasCounting": false, "hasTrafficLight": false, "hasSequencer": false, "hasEmergency": false, "hasLighting": false, "hasMultiModeLighting": false, "hasMotor": false, "hasPump": false, "hasStarDelta": false, "hasGarageDoor": false, "hasMixingTank": false, "hasElevator": false, "hasPID": false, "scenarioType": "general"}
}

Important:
- IO addresses must be realistic S7-style strings like "I0.0", "I0.1", "Q0.0", "AIW0".
- IO, hardware, and program comments must clearly match the described scene.
- logicConfig must be consistent with both the natural language description AND logic_hints.`;

function getApiKey(model) {
  const env = process.env;
  switch (model) {
    case 'deepseek': return env.DEEPSEEK_API_KEY || '';
    case 'codex': return env.OPENAI_API_KEY || '';
    default: return '';
  }
}

function parseJsonBody(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function extractJsonFromContent(content) {
  if (!content || typeof content !== 'string') return '';
  let s = content.replace(/```json/gi, '').replace(/```/g, '').trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last !== -1) s = s.slice(first, last + 1);
  return s;
}

async function callDeepSeek(apiKey, userPrompt) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-coder',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      stream: false
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `DeepSeek API ${res.status}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  const jsonStr = extractJsonFromContent(content);
  return JSON.parse(jsonStr);
}

async function callCodex(apiKey, userPrompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 8192
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API ${res.status}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  const jsonStr = extractJsonFromContent(content);
  return JSON.parse(jsonStr);
}

async function generateWithModel(model, apiKey, userPrompt) {
  switch (model) {
    case 'deepseek': return callDeepSeek(apiKey, userPrompt);
    case 'codex': return callCodex(apiKey, userPrompt);
    default:
      throw new Error(`Unsupported model: ${model}`);
  }
}

async function testConnection(model, apiKey) {
  if (!apiKey) return false;
  try {
    if (model === 'deepseek') {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'deepseek-coder', messages: [{ role: 'user', content: 'Ping' }], max_tokens: 1 })
      });
      return res.ok;
    }
    if (model === 'codex') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Ping' }], max_tokens: 1 })
      });
      return res.ok;
    }
    return false;
  } catch {
    return false;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'https://www.plc-sim.com,https://plc-sim.com,http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const DEFAULT_CORS_ORIGIN = CORS_ORIGINS[0] || 'https://www.plc-sim.com';

function getCorsOrigin(req) {
  const origin = (req.headers?.origin || '').trim();
  const host = (req.headers?.host || '').trim();
  const isLocalBackend = host.indexOf('localhost') !== -1 || host.indexOf('127.0.0.1') !== -1;
  // 本地后端：Origin 为空、null 或 file 时允许任意来源，避免模拟到账页从 file:// 或异常来源打开时 Load failed
  if (isLocalBackend && (!origin || origin === 'null' || origin.toLowerCase().indexOf('file') === 0))
    return '*';
  return origin && CORS_ORIGINS.includes(origin) ? origin : DEFAULT_CORS_ORIGIN;
}

function send(res, req, status, data) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', getCorsOrigin(req));
  res.writeHead(status);
  res.end(JSON.stringify(data));
}

function cors(res, req) {
  res.setHeader('Access-Control-Allow-Origin', getCorsOrigin(req));
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ---------- 三档收费：SQLite 存储（持久化 orders / basic_licenses / ai_week_tokens） ----------
function genId() {
  return crypto.randomBytes(8).toString('hex');
}
function genLicenseKey() {
  return 'PLC-' + crypto.randomBytes(10).toString('hex').toUpperCase();
}
function genAiToken() {
  return crypto.randomBytes(16).toString('hex');
}

function findBasicLicenseByKey(licenseKey) {
  const stmt = db.prepare('SELECT * FROM basic_licenses WHERE license_key = ?');
  return stmt.get((licenseKey || '').trim());
}

function findAiTokenByToken(token) {
  const stmt = db.prepare('SELECT * FROM ai_week_tokens WHERE token = ?');
  return stmt.get((token || '').trim());
}

function insertOrder({ id, productType, amount }) {
  const stmt = db.prepare(`
    INSERT INTO orders (id, product_type, amount, pay_status, created_at)
    VALUES (?, ?, ?, 'pending', ?)
  `);
  stmt.run(id, productType, amount, Date.now());
}

function getOrderById(orderId) {
  const stmt = db.prepare('SELECT * FROM orders WHERE id = ?');
  return stmt.get(orderId);
}

function updateOrderPaid(orderId, { payChannel = 'simulate', buyerId = null } = {}) {
  const stmt = db.prepare(`
    UPDATE orders
    SET pay_status = 'paid', pay_time = ?, pay_channel = ?, buyer_id = ?
    WHERE id = ?
  `);
  stmt.run(Date.now(), payChannel, buyerId, orderId);
}

function insertBasicLicense({ id, orderId, licenseKey }) {
  const stmt = db.prepare(`
    INSERT INTO basic_licenses (id, order_id, license_key, created_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, orderId, licenseKey, Date.now());
}

function insertAiWeekToken({ id, orderId, token, validFrom, validUntil }) {
  const stmt = db.prepare(`
    INSERT INTO ai_week_tokens (id, order_id, token, valid_from, valid_until, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, orderId, token, validFrom, validUntil, Date.now());
}

function issueOrderEntitlements(order) {
  if (order.product_type === 'basic') {
    const existing = db.prepare('SELECT license_key FROM basic_licenses WHERE order_id = ?').get(order.id);
    if (existing?.license_key) return { license_key: existing.license_key };
    const license_key = genLicenseKey();
    insertBasicLicense({ id: genId(), orderId: order.id, licenseKey: license_key });
    return { license_key };
  }
  if (order.product_type === 'ai_week') {
    const existing = db.prepare('SELECT token, valid_until FROM ai_week_tokens WHERE order_id = ?').get(order.id);
    if (existing?.token) {
      return { token: existing.token, validUntil: new Date(existing.valid_until).toISOString() };
    }
    const now = Date.now();
    const valid_until = now + 30 * 24 * 60 * 60 * 1000;
    const token = genAiToken();
    insertAiWeekToken({ id: genId(), orderId: order.id, token, validFrom: now, validUntil: valid_until });
    return { token, validUntil: new Date(valid_until).toISOString() };
  }
  return {};
}

function formatAlipayDate(ts = Date.now()) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function buildAlipaySignContent(params) {
  return Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '' && key !== 'sign')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
}

function signAlipayParams(params) {
  if (!ALIPAY_APP_PRIVATE_KEY) throw new Error('ALIPAY_APP_PRIVATE_KEY 未配置');
  const signContent = buildAlipaySignContent(params);
  return crypto.createSign('RSA-SHA256').update(signContent, 'utf8').sign(ALIPAY_APP_PRIVATE_KEY, 'base64');
}

function verifyAlipaySign(params, sign) {
  if (!ALIPAY_PUBLIC_KEY || !sign) return false;
  const signContent = buildAlipaySignContent(params);
  return crypto.createVerify('RSA-SHA256').update(signContent, 'utf8').verify(ALIPAY_PUBLIC_KEY, sign, 'base64');
}

function isAlipayReady() {
  return ALIPAY_ENABLED && !!ALIPAY_APP_ID && !!ALIPAY_NOTIFY_URL && !!ALIPAY_APP_PRIVATE_KEY && !!ALIPAY_PUBLIC_KEY;
}

function getAlipayConfigStatus() {
  const missing = [];
  if (!ALIPAY_ENABLED) missing.push('ALIPAY_ENABLED');
  if (!ALIPAY_APP_ID) missing.push('ALIPAY_APP_ID');
  if (!ALIPAY_NOTIFY_URL) missing.push('ALIPAY_NOTIFY_URL');
  if (!ALIPAY_APP_PRIVATE_KEY) missing.push('ALIPAY_APP_PRIVATE_KEY');
  if (!ALIPAY_PUBLIC_KEY) missing.push('ALIPAY_PUBLIC_KEY');
  return {
    enabled: isAlipayReady(),
    mode: isAlipayReady() ? 'alipay_page' : 'manual',
    missing,
    gateway: ALIPAY_GATEWAY,
    notifyUrlConfigured: !!ALIPAY_NOTIFY_URL,
    returnUrlConfigured: !!ALIPAY_RETURN_URL,
  };
}

function createAlipayPagePayUrl({ orderId, amount, subject }) {
  const bizContent = JSON.stringify({
    out_trade_no: orderId,
    total_amount: Number(amount).toFixed(2),
    subject,
    product_code: 'FAST_INSTANT_TRADE_PAY',
  });
  const params = {
    app_id: ALIPAY_APP_ID,
    method: 'alipay.trade.page.pay',
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatAlipayDate(),
    version: '1.0',
    notify_url: ALIPAY_NOTIFY_URL,
    biz_content: bizContent,
  };
  if (ALIPAY_RETURN_URL) params.return_url = ALIPAY_RETURN_URL;
  const sign = signAlipayParams(params);
  const search = new URLSearchParams({ ...params, sign });
  return `${ALIPAY_GATEWAY}?${search.toString()}`;
}

async function callAlipayApi(method, bizContent) {
  const params = {
    app_id: ALIPAY_APP_ID,
    method,
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatAlipayDate(),
    version: '1.0',
    biz_content: JSON.stringify(bizContent),
  };
  const sign = signAlipayParams(params);
  const body = new URLSearchParams({ ...params, sign }).toString();
  const res = await fetch(ALIPAY_GATEWAY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
  });
  if (!res.ok) throw new Error(`Alipay HTTP ${res.status}`);
  return res.json();
}

async function queryAlipayTrade(orderId) {
  const data = await callAlipayApi('alipay.trade.query', { out_trade_no: orderId });
  const root = data?.alipay_trade_query_response || {};
  if (root.code !== '10000') {
    return { ok: false, reason: root.sub_msg || root.msg || 'query failed', tradeStatus: root.trade_status || '' };
  }
  return {
    ok: true,
    tradeStatus: root.trade_status || '',
    buyerId: root.buyer_user_id || null,
    totalAmount: root.total_amount || null,
  };
}

async function reconcileOrderWithAlipay(order) {
  if (!order || order.pay_status === 'paid' || !isAlipayReady()) {
    return { reconciled: false, reason: 'skip' };
  }
  const q = await queryAlipayTrade(order.id);
  if (!q.ok) {
    return { reconciled: false, reason: q.reason || 'query_failed', tradeStatus: q.tradeStatus || '' };
  }
  if (q.tradeStatus !== 'TRADE_SUCCESS' && q.tradeStatus !== 'TRADE_FINISHED') {
    return { reconciled: false, reason: 'not_paid', tradeStatus: q.tradeStatus };
  }
  const paidAmount = Number(q.totalAmount || 0);
  if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - Number(order.amount)) > 1e-6) {
    return { reconciled: false, reason: 'amount_mismatch', tradeStatus: q.tradeStatus };
  }
  updateOrderPaid(order.id, { payChannel: 'alipay_query', buyerId: q.buyerId || null });
  issueOrderEntitlements(order);
  return { reconciled: true, tradeStatus: q.tradeStatus };
}

const server = http.createServer(async (req, res) => {
  const { pathname } = parseUrl(req.url || '', true);

  if (req.method === 'OPTIONS') {
    cors(res, req);
    res.writeHead(204);
    res.end();
    return;
  }

  cors(res, req);

  if (pathname === '/health' || pathname === '/api/health') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, service: 'plc-sim-api' }));
    return;
  }

  if (pathname === '/api/order/payment-capability' && req.method === 'GET') {
    send(res, req, 200, getAlipayConfigStatus());
    return;
  }

  if (pathname === '/api/ai/test' && req.method === 'GET') {
    const model = parseUrl(req.url, true).query?.model || 'deepseek';
    const apiKey = getApiKey(model);
    const ok = apiKey ? await testConnection(model, apiKey) : false;
    send(res, req, 200, { ok });
    return;
  }

  if (pathname === '/api/ai/generate' && req.method === 'POST') {
    const body = await readBody(req);
    const payload = parseJsonBody(body);
    const model = payload?.model || 'deepseek';
    const prompt = payload?.prompt || payload?.sceneText || '';
    const logicHints = payload?.logicHints;
    const userPrompt = logicHints
      ? `${prompt}\n\n[logic_hints]\n${JSON.stringify(logicHints, null, 2)}`
      : prompt;

    if (!prompt.trim()) {
      send(res, req, 400, { error: 'Missing prompt or sceneText' });
      return;
    }

    const apiKey = getApiKey(model);
    if (!apiKey) {
      send(res, req, 503, { error: `API Key not configured for model: ${model}` });
      return;
    }

    try {
      const solution = await generateWithModel(model, apiKey, userPrompt);
      send(res, req, 200, solution);
    } catch (err) {
      send(res, req, 502, { error: err.message || 'AI request failed' });
    }
    return;
  }

  // ---------- 三档收费：授权与 token 校验 ----------
  if (pathname === '/api/license/activate' && req.method === 'POST') {
    const body = await readBody(req);
    const payload = parseJsonBody(body);
    const licenseKey = (payload?.licenseKey || payload?.license_key || '').trim();
    if (!licenseKey) {
      send(res, req, 400, { success: false, valid: false, message: '请输入授权码' });
      return;
    }
    const license = findBasicLicenseByKey(licenseKey);
    if (!license) {
      send(res, req, 200, { success: false, valid: false, message: '授权码无效' });
      return;
    }
    send(res, req, 200, { success: true, valid: true });
    return;
  }

  if (pathname === '/api/license/validate' && req.method === 'GET') {
    const { query } = parseUrl(req.url || '', true);
    const licenseKey = (query?.licenseKey || query?.license_key || req.headers?.['x-license-key'] || '').trim();
    if (!licenseKey) {
      send(res, req, 200, { valid: false });
      return;
    }
    const license = findBasicLicenseByKey(licenseKey);
    send(res, req, 200, { valid: !!license });
    return;
  }

  if (pathname === '/api/ai-token/validate' && req.method === 'GET') {
    const { query } = parseUrl(req.url || '', true);
    const t = (query?.t || '').trim();
    if (!t) {
      send(res, req, 400, { valid: false, message: '缺少 token' });
      return;
    }
    const row = findAiTokenByToken(t);
    const now = Date.now();
    if (!row || row.valid_until < now) {
      send(res, req, 200, { valid: false, message: '链接已失效' });
      return;
    }
    send(res, req, 200, { valid: true, validUntil: new Date(row.valid_until).toISOString() });
    return;
  }

  // ---------- 三档收费：订单创建与状态 ----------
  if (pathname === '/api/order/create' && req.method === 'POST') {
    const body = await readBody(req);
    const payload = parseJsonBody(body);
    const productType = payload?.productType || payload?.product_type;
    const basicLicenseKey = (payload?.basicLicenseKey || payload?.basic_license_key || '').trim();

    console.log('[order/create] 收到请求 productType=%s basicLicenseKey=%s', productType, basicLicenseKey ? '有' : '无');

    if (productType !== 'basic' && productType !== 'ai_week') {
      send(res, req, 400, { code: 'INVALID_PRODUCT', message: 'productType 须为 basic 或 ai_week' });
      return;
    }

    // AI 月卡无需先购买基础版，可直接购买
    const amount = productType === 'basic' ? 9.9 : 19.9;
    const orderId = genId();
    insertOrder({ id: orderId, productType, amount });
    if (productType === 'ai_week') console.log('[order/create] AI 月卡订单已创建，无需基础版:', orderId);
    let payQrContent = null;
    let payChannel = 'manual';
    if (isAlipayReady()) {
      try {
        const subject = productType === 'basic' ? 'PLC-Sim 基础版授权' : 'PLC-Sim AI月卡';
        payQrContent = createAlipayPagePayUrl({ orderId, amount, subject });
        payChannel = 'alipay_page';
      } catch (e) {
        console.error('[alipay] 生成支付链接失败，回退 manual 模式:', e?.message || e);
      }
    }
    send(res, req, 200, { orderId, amount, productType, payQrContent, payChannel });
    return;
  }

  if (pathname === '/api/order/status' && req.method === 'GET') {
    const { query } = parseUrl(req.url || '', true);
    const orderId = (query?.orderId || query?.order_id || '').trim();
    if (!orderId) {
      send(res, req, 400, { error: '缺少 orderId' });
      return;
    }
    let order = getOrderById(orderId);
    if (!order) {
      send(res, req, 404, { error: '订单不存在' });
      return;
    }
    // 自动兜底确认：若异步回调偶发丢失，查询状态接口会主动向支付宝查单并自动入账
    if (order.pay_status !== 'paid' && isAlipayReady()) {
      try {
        await reconcileOrderWithAlipay(order);
        order = getOrderById(order.id) || order;
      } catch (e) {
        console.error('[alipay] status query fallback failed:', e?.message || e);
      }
    }
    const out = { orderId: order.id, pay_status: order.pay_status, amount: order.amount, productType: order.product_type };
    if (order.pay_status === 'paid') {
      if (order.product_type === 'basic') {
        const lic = db.prepare('SELECT license_key FROM basic_licenses WHERE order_id = ?').get(order.id);
        if (lic) out.license_key = lic.license_key;
      } else if (order.product_type === 'ai_week') {
        const tok = db.prepare('SELECT token, valid_until FROM ai_week_tokens WHERE order_id = ?').get(order.id);
        if (tok) {
          out.token = tok.token;
          out.validUntil = new Date(tok.valid_until).toISOString();
        }
      }
    }
    send(res, req, 200, out);
    return;
  }

  /** 联调用：模拟支付回调，将订单置为已支付并发放 license/token（仅开发或显式开启时可用） */
  if (pathname === '/api/order/simulate-callback' && req.method === 'POST') {
    const body = await readBody(req);
    const payload = parseJsonBody(body);
    const orderId = (payload?.orderId || payload?.order_id || '').trim();
    if (!orderId) {
      send(res, req, 400, { error: '缺少 orderId' });
      return;
    }
    const order = getOrderById(orderId);
    if (!order) {
      send(res, req, 404, { error: '订单不存在' });
      return;
    }
    if (order.pay_status === 'paid') {
      send(res, req, 200, { ok: true, message: '订单已支付' });
      return;
    }
    updateOrderPaid(order.id, { payChannel: 'simulate' });
    const payloadOut = issueOrderEntitlements(order);
    send(res, req, 200, { ok: true, ...payloadOut });
    return;
  }

  if (pathname === '/api/order/alipay-notify' && req.method === 'POST') {
    const body = await readBody(req);
    const form = new URLSearchParams(body);
    const raw = {};
    for (const [k, v] of form.entries()) raw[k] = v;
    const sign = raw.sign || '';
    const signType = raw.sign_type || '';
    if (signType && signType !== 'RSA2') {
      res.writeHead(400);
      res.end('invalid sign_type');
      return;
    }
    const verifyPayload = { ...raw };
    delete verifyPayload.sign;
    delete verifyPayload.sign_type;
    if (!verifyAlipaySign(verifyPayload, sign)) {
      res.writeHead(400);
      res.end('invalid sign');
      return;
    }
    if (raw.app_id !== ALIPAY_APP_ID) {
      res.writeHead(400);
      res.end('invalid app_id');
      return;
    }
    const orderId = (raw.out_trade_no || '').trim();
    if (!orderId) {
      res.writeHead(400);
      res.end('missing out_trade_no');
      return;
    }
    const order = getOrderById(orderId);
    if (!order) {
      res.writeHead(404);
      res.end('order not found');
      return;
    }
    const paidAmount = Number(raw.total_amount || 0);
    if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - Number(order.amount)) > 1e-6) {
      res.writeHead(400);
      res.end('amount mismatch');
      return;
    }
    const tradeStatus = String(raw.trade_status || '');
    if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'TRADE_FINISHED') {
      res.writeHead(200);
      res.end('success');
      return;
    }
    if (order.pay_status !== 'paid') {
      updateOrderPaid(order.id, { payChannel: 'alipay', buyerId: raw.buyer_id || null });
    }
    issueOrderEntitlements(order);
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('success');
    return;
  }

  if (pathname === '/api/order/reconcile' && req.method === 'POST') {
    const body = await readBody(req);
    const payload = parseJsonBody(body);
    const orderId = (payload?.orderId || payload?.order_id || '').trim();
    if (!orderId) {
      send(res, req, 400, { error: '缺少 orderId' });
      return;
    }
    const order = getOrderById(orderId);
    if (!order) {
      send(res, req, 404, { error: '订单不存在' });
      return;
    }
    try {
      const r = await reconcileOrderWithAlipay(order);
      const after = getOrderById(orderId) || order;
      send(res, req, 200, {
        ok: true,
        pay_status: after.pay_status,
        reconciled: r.reconciled,
        reason: r.reason || '',
        tradeStatus: r.tradeStatus || '',
      });
    } catch (e) {
      send(res, req, 502, { ok: false, error: e?.message || 'reconcile failed' });
    }
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`plc-sim-api listening on http://0.0.0.0:${PORT}`);
});
