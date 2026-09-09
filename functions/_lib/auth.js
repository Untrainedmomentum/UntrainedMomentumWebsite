const encoder = new TextEncoder();
const SESSION_COOKIE = '__Host-um_session';
const SESSION_MAX_AGE = 12 * 60 * 60;
const PBKDF2_ITERATIONS = 210000;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

function b64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromB64url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sha256(value) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

async function pbkdf2(password, salt, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(password) {
  const value = String(password || '');
  if (value.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  if (value.length > MAX_PASSWORD_LENGTH) throw new Error(`Password must be ${MAX_PASSWORD_LENGTH} characters or fewer`);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(value, salt);
  return `v1$${PBKDF2_ITERATIONS}$${b64url(salt)}$${b64url(hash)}`;
}

export async function verifyPassword(password, stored) {
  try {
    const value = String(password || '');
    if (value.length > MAX_PASSWORD_LENGTH) return false;
    const [version, rounds, saltValue, hashValue] = String(stored || '').split('$');
    if (version !== 'v1') return false;
    const iterations = Number(rounds);
    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) return false;
    const salt = fromB64url(saltValue);
    const expected = fromB64url(hashValue);
    const actual = await pbkdf2(value, salt, iterations);
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
}

function parseCookies(request) {
  const output = {};
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) output[key] = decodeURIComponent(value);
  }
  return output;
}

export function sessionCookie(token, maxAge = SESSION_MAX_AGE) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function createSession(db, userId) {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const token = b64url(raw);
  const tokenHash = b64url(await sha256(token));
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();
  await db.prepare(
    'INSERT INTO sessions (id, token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, tokenHash, userId, expiresAt, new Date().toISOString()).run();
  return token;
}

export async function destroySession(db, request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return;
  const tokenHash = b64url(await sha256(token));
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
}

export async function getUser(db, request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = b64url(await sha256(token));
  const now = new Date().toISOString();
  const row = await db.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.must_change_password, u.created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.disabled = 0
  `).bind(tokenHash, now).first();
  return row || null;
}

export async function requireUser(context, role = null) {
  if (!context.env.DB) return null;
  const user = await getUser(context.env.DB, context.request);
  if (!user) return null;
  if (role && user.role !== role) return null;
  return user;
}

export async function deleteExpiredSessions(db) {
  await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(new Date().toISOString()).run();
}

export async function rateLimitKey(scope, request, identity = '') {
  const ip = String(request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  return `${scope}:${b64url(await sha256(`${scope}|${ip}|${String(identity).toLowerCase()}`))}`;
}

export async function checkRateLimit(db, key) {
  const now = Date.now();
  const row = await db.prepare('SELECT failures, window_started_at, blocked_until FROM auth_rate_limits WHERE key = ? LIMIT 1').bind(key).first();
  if (!row) return { blocked: false };
  const blockedUntil = row.blocked_until ? Date.parse(row.blocked_until) : 0;
  if (blockedUntil > now) return { blocked: true, retryAfter: Math.max(1, Math.ceil((blockedUntil - now) / 1000)) };
  const windowStarted = Date.parse(row.window_started_at || '');
  if (!Number.isFinite(windowStarted) || now - windowStarted > 15 * 60 * 1000) {
    await db.prepare('DELETE FROM auth_rate_limits WHERE key = ?').bind(key).run();
  }
  return { blocked: false };
}

export async function recordRateLimitFailure(db, key) {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const row = await db.prepare('SELECT failures, window_started_at FROM auth_rate_limits WHERE key = ? LIMIT 1').bind(key).first();
  const windowStarted = row ? Date.parse(row.window_started_at || '') : NaN;
  const withinWindow = Number.isFinite(windowStarted) && now - windowStarted <= 15 * 60 * 1000;
  const failures = withinWindow ? Number(row.failures || 0) + 1 : 1;
  const start = withinWindow ? row.window_started_at : nowIso;
  const blockedUntil = failures >= 5 ? new Date(now + 15 * 60 * 1000).toISOString() : null;
  await db.prepare(`
    INSERT INTO auth_rate_limits (key, failures, window_started_at, blocked_until, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET failures=excluded.failures, window_started_at=excluded.window_started_at,
      blocked_until=excluded.blocked_until, updated_at=excluded.updated_at
  `).bind(key, failures, start, blockedUntil, nowIso).run();
}

export async function clearRateLimit(db, key) {
  await db.prepare('DELETE FROM auth_rate_limits WHERE key = ?').bind(key).run();
}
