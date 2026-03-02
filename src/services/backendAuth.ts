/**
 * Phase 2a: 后端鉴权 API（登录、注册、获取当前用户）
 */
const _env = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : {};
const API_BASE = String(_env.VITE_APP_API_BASE || '').replace(/\/$/, '') || 'https://api.plc-sim.com';

export interface AuthUser {
  id: number;
  email: string;
}

export interface LoginRegisterResponse {
  token: string;
  user: AuthUser;
  balance: number;
}

export async function login(email: string, password: string): Promise<LoginRegisterResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `登录失败 ${res.status}`);
  return data;
}

export async function register(email: string, password: string): Promise<LoginRegisterResponse> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `注册失败 ${res.status}`);
  return data;
}

export async function getMe(token: string): Promise<{ user: AuthUser; balance: number }> {
  const res = await fetch(`${API_BASE}/api/me`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `获取用户信息失败 ${res.status}`);
  return data;
}
