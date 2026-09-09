import { json } from '../../_lib/http.js';
import { requireUser } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  const user = await requireUser(context);
  if (!user) return json({ error: 'Not authorized.' }, 401);
  const url = new URL(context.request.url);
  const slug = String(url.searchParams.get('site') || '').trim();
  if (!slug) return json({ error: 'Site is required.' }, 400);
  const site = await context.env.DB.prepare('SELECT id, owner_user_id, name FROM sites WHERE slug = ? LIMIT 1').bind(slug).first();
  if (!site) return json({ error: 'Site not found.' }, 404);
  if (user.role !== 'admin' && site.owner_user_id !== user.id) return json({ error: 'Not authorized.' }, 403);

  const result = await context.env.DB.prepare(`
    SELECT id, stripe_checkout_session_id, stripe_payment_intent_id, customer_email,
           amount_total, currency, platform_fee_amount, status, created_at, updated_at
    FROM orders
    WHERE site_id = ?
    ORDER BY created_at DESC
    LIMIT 200
  `).bind(site.id).all();
  return json({ site: { slug, name: site.name }, orders: result.results || [] });
}
