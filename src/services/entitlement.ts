/**
 * 三档收费权益：免费档 / 基础版(9.9) / AI周卡(19.9)
 * 本地存储 key、免费可用场景索引、授权与 token 校验（占位接口）
 */

const STORAGE_BASIC = 'plc_tier_basic_license';
const STORAGE_AI_TOKEN = 'plc_tier_ai_token';
const STORAGE_AI_VALID_UNTIL = 'plc_tier_ai_valid_until';

/** 免费档可用的典型场景：按 SCENARIOS 的 title 匹配（启保停控制、延时启动） */
export const FREE_SCENARIO_TITLES = ['基础: 启保停控制', '基础: 延时启动'];

export function isFreeScenario(title: string): boolean {
  return FREE_SCENARIO_TITLES.includes(title);
}

export function getStoredBasicLicense(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_BASIC);
}

export function setStoredBasicLicense(licenseKey: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_BASIC, licenseKey);
}

export function clearStoredBasicLicense(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_BASIC);
}

export function getStoredAiValidUntil(): number | null {
  if (typeof window === 'undefined') return null;
  const s = localStorage.getItem(STORAGE_AI_VALID_UNTIL);
  if (!s) return null;
  const t = parseInt(s, 10);
  return Number.isFinite(t) ? t : null;
}

export function setStoredAiValidUntil(validUntilMs: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_AI_VALID_UNTIL, String(validUntilMs));
}

export function setStoredAiToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_AI_TOKEN, token);
}

export function clearStoredAi(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_AI_TOKEN);
  localStorage.removeItem(STORAGE_AI_VALID_UNTIL);
}

/** 是否已激活基础版（仅读本地；实际校验由后端决定） */
export function hasBasicLicense(): boolean {
  return !!getStoredBasicLicense();
}

/** AI 周卡是否在有效期内 */
export function hasValidAiToken(): boolean {
  const until = getStoredAiValidUntil();
  return until != null && until > Date.now();
}

/**
 * 激活基础版（占位：调后端 /api/license/activate，未接时本地模拟通过）
 */
export async function activateBasicLicense(licenseKey: string): Promise<{ ok: boolean; message?: string }> {
  const key = licenseKey.trim();
  if (!key) return { ok: false, message: '请输入授权码' };

  try {
    const env = typeof import.meta !== 'undefined' && (import.meta as any).env;
    const base = env?.VITE_APP_API_BASE || env?.VITE_API_BASE_URL;
    const url = base ? `${String(base).replace(/\/$/, '')}/api/license/activate` : '/api/license/activate';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: key }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data.success || data.valid)) {
      setStoredBasicLicense(key);
      return { ok: true };
    }
    return { ok: false, message: data.message || data.error || '授权码无效' };
  } catch {
    // 未接后端时：开发/演示用，任意非空授权码视为通过
    setStoredBasicLicense(key);
    return { ok: true };
  }
}

/**
 * 校验 AI 周卡 token（占位：调后端 /api/ai-token/validate，未接时本地模拟 7 天有效）
 */
export async function validateAiToken(token: string): Promise<{ valid: boolean; validUntil?: number; message?: string }> {
  const t = token.trim();
  if (!t) return { valid: false, message: '缺少 token' };

  try {
    const env = typeof import.meta !== 'undefined' && (import.meta as any).env;
    const base = env?.VITE_APP_API_BASE || env?.VITE_API_BASE_URL;
    const url = base ? `${String(base).replace(/\/$/, '')}/api/ai-token/validate` : '/api/ai-token/validate';
    const res = await fetch(`${url}?t=${encodeURIComponent(t)}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.valid) {
      const until = data.validUntil ? new Date(data.validUntil).getTime() : Date.now() + 7 * 24 * 60 * 60 * 1000;
      setStoredAiToken(t);
      setStoredAiValidUntil(until);
      return { valid: true, validUntil: until };
    }
    return { valid: false, message: data.message || data.error || '链接已失效' };
  } catch {
    // 未接后端：演示用，任意 token 给 7 天
    const until = Date.now() + 7 * 24 * 60 * 60 * 1000;
    setStoredAiToken(t);
    setStoredAiValidUntil(until);
    return { valid: true, validUntil: until };
  }
}
