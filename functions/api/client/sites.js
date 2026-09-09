import { json } from '../../_lib/http.js';
import { requireUser } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  const user = await requireUser(context);
  if (!user) return json({ error: 'Not authorized.' }, 401);
  const query = user.role === 'admin'
    ? context.env.DB.prepare(`SELECT id, slug, name, site_type, site_url, custom_domain, builder_enabled, platform_fee_bps, stripe_account_id, stripe_details_submitted, stripe_charges_enabled, status, updated_at FROM sites ORDER BY name`)
    : context.env.DB.prepare(`SELECT id, slug, name, site_type, site_url, custom_domain, builder_enabled, platform_fee_bps, stripe_account_id, stripe_details_submitted, stripe_charges_enabled, status, updated_at FROM sites WHERE owner_user_id = ? ORDER BY name`).bind(user.id);
  const result = await query.all();
  return json({ user, sites: result.results || [] });
}
