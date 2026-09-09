import { json } from '../../_lib/http.js';
import { destroySession, clearSessionCookie } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  if (context.env.DB) await destroySession(context.env.DB, context.request);
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
}
