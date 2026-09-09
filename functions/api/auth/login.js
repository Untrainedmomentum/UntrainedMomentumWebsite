import { json, readJson, errorMessage } from '../../_lib/http.js';
import { verifyPassword, createSession, sessionCookie, deleteExpiredSessions } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  try {
    if (!context.env.DB) return json({ error: 'Client portal database is not configured.' }, 503);
    const { email, password } = await readJson(context.request);
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) return json({ error: 'Email and password are required.' }, 400);

    await deleteExpiredSessions(context.env.DB);
    const user = await context.env.DB.prepare(
      'SELECT id, email, name, role, password_hash, disabled FROM users WHERE lower(email) = ? LIMIT 1'
    ).bind(normalizedEmail).first();

    const valid = user && !user.disabled && await verifyPassword(password, user.password_hash);
    if (!valid) return json({ error: 'Email or password is incorrect.' }, 401);

    const token = await createSession(context.env.DB, user.id);
    return json(
      { ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } },
      200,
      { 'set-cookie': sessionCookie(token) }
    );
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}
