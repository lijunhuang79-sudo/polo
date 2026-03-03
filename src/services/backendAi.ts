/**
 * 后端 AI 代理服务
 * Phase 1：前端调用自有后端 /api/ai/generate，不传 API Key，Key 仅存于服务端
 */
import type { GeneratedSolution } from '../types';
import type { LogicConfig } from '../types';

const _env = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : {};
const API_BASE = String(_env.VITE_APP_API_BASE || '').replace(/\/$/, '') || 'https://api.plc-sim.com';

export interface BackendGenerateParams {
  model: 'deepseek' | 'gemini' | 'codex';
  prompt: string;
  logicHints?: Partial<LogicConfig>;
}

/**
 * 调用后端 /api/ai/generate，不传 API Key
 */
export async function backendGenerate(params: BackendGenerateParams): Promise<GeneratedSolution> {
  const { model, prompt, logicHints } = params;
  const url = `${API_BASE}/api/ai/generate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      logicHints: logicHints || undefined,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `请求失败 ${res.status}`;
    throw new Error(msg);
  }
  return data as GeneratedSolution;
}

/**
 * 测试后端 AI 连通性（可选，用于 UI 显示「平台 AI 可用」）
 */
export async function backendTestConnection(model: 'deepseek' | 'gemini' | 'codex'): Promise<boolean> {
  try {
    const url = `${API_BASE}/api/ai/test?model=${encodeURIComponent(model)}`;
    const res = await fetch(url, { method: 'GET' });
    const data = await res.json().catch(() => ({}));
    return !!data?.ok;
  } catch {
    return false;
  }
}
