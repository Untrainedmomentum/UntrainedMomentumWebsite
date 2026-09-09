import { json } from '../../_lib/http.js';
import { getUser } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  if (!context.env.DB) return json({ authenticated: false, error: 'Client portal database is not configured.' }, 503);
  const user = await getUser(context.env.DB, context.request);
  if (!user) return json({ authenticated: false }, 401);
  return json({ authenticated: true, user });
}
