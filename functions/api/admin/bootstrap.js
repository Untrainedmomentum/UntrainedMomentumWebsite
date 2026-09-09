import { json, readJson, errorMessage } from '../../_lib/http.js';
import { hashPassword } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  try {
    if (!context.env.DB) return json({ error: 'D1 database is not configured.' }, 503);
    if (!context.env.BOOTSTRAP_TOKEN) return json({ error: 'BOOTSTRAP_TOKEN is not configured.' }, 503);
    if (context.request.headers.get('x-bootstrap-token') !== context.env.BOOTSTRAP_TOKEN) {
      return json({ error: 'Not authorized.' }, 403);
    }

    const existing = await context.env.DB.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").first();
    if (existing) return json({ error: 'An administrator already exists. Bootstrap is disabled.' }, 409);

    const { email, name, password } = await readJson(context.request);
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !name || !password) return json({ error: 'Name, email and password are required.' }, 400);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    await context.env.DB.prepare(`
      INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'admin', ?, ?)
    `).bind(id, normalizedEmail, String(name).trim(), passwordHash, now, now).run();
    return json({ ok: true, adminId: id });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}
