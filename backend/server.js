/**
 * PLC-Sim API 服务
 * 运行在 3000 端口，供 api.plc-sim.com 反向代理
 * API Key 仅从环境变量读取，永不返回给前端
 */
import http from 'http';
import { parse as parseUrl } from 'url';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  });
}

const PORT = Number(process.env.PORT) || 3000;

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
    case 'gemini': return env.GEMINI_API_KEY || '';
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

async function callGemini(apiKey, userPrompt) {
  const model = 'gemini-3.1-pro-preview';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\nUser request:\n' + userPrompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
    })
  });
  const data = await res.json();
  if (!res.ok) {
    const errMsg = (data?.error?.message || data?.message) || (data?.error ? JSON.stringify(data.error) : `Gemini API ${res.status}`);
    throw new Error(errMsg);
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonStr = extractJsonFromContent(text);
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
    case 'gemini': return callGemini(apiKey, userPrompt);
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
    if (model === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Ping' }] }], generationConfig: { maxOutputTokens: 1 } })
      });
      const data = await res.json();
      if (!res.ok) return false;
      const candidate = data.candidates?.[0];
      const finishReason = candidate?.finishReason;
      if (finishReason === 'STOP' || finishReason === 'MAX_TOKENS') return true;
      if (candidate?.content?.parts?.length) return true;
      return false;
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
  const origin = req.headers?.origin || '';
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

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`plc-sim-api listening on http://0.0.0.0:${PORT}`);
});
