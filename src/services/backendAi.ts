/**
 * 后端 AI 代理服务
 * Phase 1：无 Key；Phase 2a：带 Token 鉴权，返回余额
 */
import type { GeneratedSolution } from '../types';
import type { LogicConfig } from '../types';

const _env = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : {};
const API_BASE = String(_env.VITE_APP_API_BASE || '').replace(/\/$/, '') || 'https://api.plc-sim.com';

export interface BackendGenerateParams {
  model: 'deepseek' | 'gemini' | 'codex';
  prompt: string;
  logicHints?: Partial<LogicConfig>;
  token?: string | null;
}

export interface BackendGenerateResult extends GeneratedSolution {
  balance_after?: number;
}

/**
 * 调用后端 /api/ai/generate；Phase 2a 需传 token
 */
export async function backendGenerate(params: BackendGenerateParams): Promise<BackendGenerateResult> {
  const { model, prompt, logicHints, token } = params;
  const url = `${API_BASE}/api/ai/generate`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      prompt,
      logicHints: logicHints || undefined,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `请求失败 ${res.status}`;
    const err = new Error(msg) as Error & { code?: string; balance?: number };
    if (res.status === 401) err.code = 'AUTH_REQUIRED';
    if (res.status === 402) {
      err.code = 'INSUFFICIENT_BALANCE';
      err.balance = data?.balance;
    }
    throw err;
  }
  return data as BackendGenerateResult;
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
