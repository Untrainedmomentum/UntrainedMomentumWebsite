import { json, readJson, errorMessage } from '../../_lib/http.js';
import {
  verifyPassword,
  createSession,
  sessionCookie,
  deleteExpiredSessions,
  rateLimitKey,
  checkRateLimit,
  recordRateLimitFailure,
  clearRateLimit
} from '../../_lib/auth.js';

const DUMMY_PASSWORD_HASH = 'v1$210000$dW50cmFpbmVkbW9tZW50dQ$ZW-hLvJqceKgHBKFUAMAKhlKhjjZ2aLIHyNJGKoDonE';

export async function onRequestPost(context) {
  try {
    if (!context.env.DB) return json({ error: 'Client portal database is not configured.' }, 503);
    const { email, password } = await readJson(context.request);
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) return json({ error: 'Email and password are required.' }, 400);

    const throttleKey = await rateLimitKey('login', context.request, normalizedEmail);
    const throttle = await checkRateLimit(context.env.DB, throttleKey);
    if (throttle.blocked) {
      return json(
        { error: 'Too many sign-in attempts. Try again in a few minutes.' },
        429,
        { 'retry-after': String(throttle.retryAfter || 900) }
      );
    }

    await deleteExpiredSessions(context.env.DB);
    const user = await context.env.DB.prepare(
      'SELECT id, email, name, role, password_hash, disabled, must_change_password FROM users WHERE lower(email) = ? LIMIT 1'
    ).bind(normalizedEmail).first();

    const storedHash = user?.password_hash || DUMMY_PASSWORD_HASH;
    const passwordMatches = await verifyPassword(password, storedHash);
    const valid = Boolean(user && !user.disabled && passwordMatches);
    if (!valid) {
      await recordRateLimitFailure(context.env.DB, throttleKey);
      return json({ error: 'Email or password is incorrect.' }, 401);
    }

    await clearRateLimit(context.env.DB, throttleKey);
    await context.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();
    const token = await createSession(context.env.DB, user.id);
    return json(
      {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          must_change_password: Boolean(user.must_change_password)
        }
      },
      200,
      { 'set-cookie': sessionCookie(token) }
    );
  } catch (error) {
    console.error('Login failed:', error);
    return json({ error: errorMessage(error) }, 500);
  }
}
