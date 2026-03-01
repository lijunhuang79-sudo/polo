import { GeneratedSolution } from '../types';

const SYSTEM_PROMPT = `
You are an expert PLC engineer.

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
  "io": [{
    "addr": "I0.0",
    "symbol": "START",
    "device": "启动按钮",
    "type": "DI",
    "spec": "NO",
    "location": "控制柜",
    "note": "",
    "isMomentary": true
  }],
  "hardware": [{
    "name": "PLC",
    "model": "CPU 224XP",
    "qty": 1,
    "spec": "",
    "note": "",
    "required": true
  }],
  "stlCode": "TITLE ...\\nLD I0.0 ...",
  "ladCode": "Network 1: ...",
  "sclCode": "\"KM1\" := ...",
  "logicConfig": {
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
    "hasMotor": false,
    "hasPump": false,
    "hasStarDelta": false,
    "hasGarageDoor": false,
    "hasMixingTank": false,
    "hasElevator": false,
    "hasPID": false,
    "scenarioType": "general"
  }
}

Important:
- IO addresses must be realistic S7-style strings like "I0.0", "I0.1", "Q0.0", "AIW0".
- IO, hardware, and program comments must clearly match the described scene.
- logicConfig must be consistent with both the natural language description AND logic_hints.
`;

export async function callDeepSeekAI(apiKey: string, userPrompt: string): Promise<GeneratedSolution> {
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
    const err = await res.json();
    throw new Error(err.error?.message || 'API Request Failed');
  }
  const data = await res.json();
  let content = data.choices[0].message.content || '';
  content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
  const first = content.indexOf('{');
  const last = content.lastIndexOf('}');
  if (first !== -1 && last !== -1) content = content.slice(first, last + 1);
  return JSON.parse(content) as GeneratedSolution;
}

export async function testDeepSeekConnection(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'deepseek-coder', messages: [{ role: 'user', content: 'Ping' }], max_tokens: 1 })
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 生产生成使用；与《Gemini_Connection_Fix_Sop》一致 */
const GEMINI_MODEL_GENERATE = 'gemini-3.1-pro-preview';
/** 连接测试使用，兼容性更好；与 SOP 一致 */
const GEMINI_MODEL_TEST = 'gemini-flash-latest';

export async function callGeminiAI(apiKey: string, userPrompt: string): Promise<GeneratedSolution> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_GENERATE}:generateContent?key=${encodeURIComponent(apiKey)}`;
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
    if (typeof console !== 'undefined' && console.log) {
      console.log('Gemini Generate Error Response', data);
    }
    const errMsg = (data?.error?.message || data?.message) || JSON.stringify(data?.error || data);
    throw new Error(errMsg);
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  let content = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const first = content.indexOf('{');
  const last = content.lastIndexOf('}');
  if (first !== -1 && last !== -1) content = content.slice(first, last + 1);
  return JSON.parse(content) as GeneratedSolution;
}

export async function testGeminiConnection(apiKey: string): Promise<boolean> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_TEST}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Ping' }] }],
      generationConfig: { maxOutputTokens: 1 }
    })
  });
  const data = await res.json();
  if (typeof console !== 'undefined' && console.log) {
    console.log('Gemini Test Full Response', data);
  }
  if (!res.ok) {
    const errPayload = data?.error || data;
    const errMsg = typeof errPayload === 'string' ? errPayload : JSON.stringify(errPayload || { message: `HTTP ${res.status}` });
    throw new Error(errMsg);
  }
  const candidate = data.candidates?.[0];
  const finishReason = candidate?.finishReason || candidate?.content?.finishReason;
  if (finishReason === 'STOP' || finishReason === 'MAX_TOKENS') {
    return true;
  }
  if (finishReason) {
    throw new Error(JSON.stringify({ finishReason, message: `API 返回: ${finishReason}`, raw: data }));
  }
  if (data.candidates?.[0]?.content?.parts?.length) {
    return true;
  }
  throw new Error(JSON.stringify(data?.error || data || { message: 'Unknown Gemini response' }));
}

/** GPT5.2 Pro / OpenAI 接口：OpenAI Chat Completions API，模型 gpt-5.2-pro */
export async function callCodexAI(apiKey: string, userPrompt: string): Promise<GeneratedSolution> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-5.2-pro',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 8192,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message || `OpenAI API ${res.status}`);
  }
  const data = await res.json();
  let content = data.choices?.[0]?.message?.content || '';
  content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
  const first = content.indexOf('{');
  const last = content.lastIndexOf('}');
  if (first !== -1 && last !== -1) content = content.slice(first, last + 1);
  return JSON.parse(content) as GeneratedSolution;
}

export async function testCodexConnection(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2-pro',
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 1,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Qwen 模拟接口（暂无真实 API 时使用） */
export async function testQwenConnection(apiKey: string): Promise<boolean> {
  try {
    await new Promise((r) => setTimeout(r, 500));
    return apiKey.startsWith('sk-');
  } catch {
    return false;
  }
}

export async function callQwenAI(apiKey: string, userPrompt: string): Promise<GeneratedSolution> {
  await new Promise((r) => setTimeout(r, 1500));
  const text = (userPrompt || '').toLowerCase();
  const hasLighting = /灯泡|led|照明|灯光|电灯/i.test(text);
  const hasMotor = /电机|马达|驱动|伺服/i.test(text);
  const hasPump = /泵|抽水|供水|排水/i.test(text);
  let deviceName = '输出设备';
  let startBtnName = '启动按钮';
  let stopBtnName = '停止按钮';
  if (hasLighting) {
    deviceName = '照明灯';
    startBtnName = '开灯按钮';
    stopBtnName = '关灯按钮';
  } else if (hasMotor) deviceName = '电机';
  else if (hasPump) deviceName = '水泵';

  return {
    io: [
      { addr: 'I0.0', symbol: 'START_BTN', device: startBtnName, type: 'DI', isMomentary: true, spec: 'DC 24V', location: '操作面板', note: '常开' },
      { addr: 'I0.1', symbol: 'STOP_BTN', device: stopBtnName, type: 'DI', isMomentary: true, spec: 'DC 24V', location: '操作面板', note: '常闭' },
      { addr: 'Q0.0', symbol: 'OUT_DEV', device: deviceName, type: 'DO', isMomentary: false, spec: 'DC 24V / 2A', location: '电气柜', note: hasLighting ? 'LED驱动' : 'KM1' },
    ],
    stlCode: `// Qwen 模拟 STL\nA I0.0\nO M0.0\nAN I0.1\n= M0.0\nA M0.0\nAN I0.1\n= Q0.0`,
    ladCode: '// Qwen 模拟 LAD',
    sclCode: '// Qwen 模拟 SCL',
    hardware: [
      { name: 'PLC控制器', model: 'S7-200 SMART ST20', qty: 1, note: '主控制器', spec: 'DC 24V, 12DI/8DO', required: true },
      { name: startBtnName, model: 'LA39-11D', qty: 1, note: '绿色', spec: '常开，DC 24V', required: true },
      { name: stopBtnName, model: 'LA39-11D', qty: 1, note: '红色', spec: '常闭，DC 24V', required: true },
      { name: deviceName, model: hasLighting ? '24V DC LED灯' : 'LC1D09', qty: 1, note: hasLighting ? 'LED驱动' : 'KM1', spec: hasLighting ? 'DC 24V / 30W' : '220V AC', required: true },
      { name: '开关电源', model: 'S-100-24', qty: 1, note: '为PLC和外围供电', spec: '24V DC / 100W', required: true },
    ],
    logicConfig: {
      hasStartStop: true,
      hasInterlock: false,
      hasDelayOn: false,
      hasDoublePressStart: false,
      hasCounting: false,
      hasTrafficLight: false,
      hasSequencer: false,
      hasEmergency: false,
      hasLighting: false,
      hasMultiModeLighting: false,
      hasMotor: false,
      hasPump: false,
      hasStarDelta: false,
      hasGarageDoor: false,
      hasMixingTank: false,
      hasElevator: false,
      hasPID: false,
      scenarioType: 'general',
    },
  };
}
