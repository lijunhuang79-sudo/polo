/**
 * Phase 2a: 密码哈希与 JWT
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const SALT_ROUNDS = 10;

export async function hashPassword(password) {
  return bcrypt.hash(String(password), SALT_ROUNDS);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(String(password), hash);
}

export function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function getBearerToken(req) {
  const auth = req.headers?.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}
