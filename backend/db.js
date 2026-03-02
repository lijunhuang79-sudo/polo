/**
 * Phase 2a: SQLite 数据库 — users, accounts, transactions
 */
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, 'data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
const dbPath = join(dataDir, 'plc.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS accounts (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance_points INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    ref_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);
`);

export function getUserByEmail(email) {
  const row = db.prepare('SELECT id, email, password_hash, created_at FROM users WHERE email = ?').get(String(email).trim().toLowerCase());
  return row || null;
}

export function getUserById(id) {
  const row = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(id);
  return row || null;
}

export function createUser(email, passwordHash) {
  const emailNorm = String(email).trim().toLowerCase();
  const id = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(emailNorm, passwordHash).lastInsertRowid;
  return id;
}

export function getAccount(userId) {
  const row = db.prepare('SELECT user_id, balance_points, updated_at FROM accounts WHERE user_id = ?').get(userId);
  return row || null;
}

export function createAccount(userId, initialPoints = 0) {
  db.prepare('INSERT INTO accounts (user_id, balance_points) VALUES (?, ?)').run(userId, initialPoints);
}

export function addPoints(userId, amount, type = 'grant', refId = null) {
  const now = new Date().toISOString();
  db.prepare('UPDATE accounts SET balance_points = balance_points + ?, updated_at = ? WHERE user_id = ?').run(amount, now, userId);
  db.prepare('INSERT INTO transactions (user_id, type, amount, ref_id) VALUES (?, ?, ?, ?)').run(userId, type, amount, refId);
  const row = db.prepare('SELECT balance_points FROM accounts WHERE user_id = ?').get(userId);
  return row.balance_points;
}

export function consumePoints(userId, amount) {
  const acc = getAccount(userId);
  if (!acc || acc.balance_points < amount) return { ok: false, balance: acc ? acc.balance_points : 0 };
  const now = new Date().toISOString();
  db.prepare('UPDATE accounts SET balance_points = balance_points - ?, updated_at = ? WHERE user_id = ?').run(amount, now, userId);
  db.prepare('INSERT INTO transactions (user_id, type, amount, ref_id) VALUES (?, ?, ?, ?)').run(userId, 'consume', -amount, null);
  const row = db.prepare('SELECT balance_points FROM accounts WHERE user_id = ?').get(userId);
  return { ok: true, balance: row.balance_points };
}

export default db;
