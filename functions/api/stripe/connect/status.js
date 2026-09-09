import { json, readJson, errorMessage } from '../../../_lib/http.js';
import { requireUser } from '../../../_lib/auth.js';
import { stripeGet } from '../../../_lib/stripe.js';

export async function onRequestPost(context) {
  try {
    const user = await requireUser(context);
    if (!user) return json({ error: 'Not authorized.' }, 401);
    const input = await readJson(context.request);
    const slug = String(input.site || input.slug || '').trim();
    const site = await context.env.DB.prepare('SELECT * FROM sites WHERE slug = ? LIMIT 1').bind(slug).first();
    if (!site) return json({ error: 'Site not found.' }, 404);
    if (user.role !== 'admin' && site.owner_user_id !== user.id) return json({ error: 'Not authorized.' }, 403);
    if (!site.stripe_account_id) return json({ connected: false, chargesEnabled: false, detailsSubmitted: false });

    const account = await stripeGet(context.env, `/accounts/${encodeURIComponent(site.stripe_account_id)}`);
    const chargesEnabled = account.charges_enabled ? 1 : 0;
    const detailsSubmitted = account.details_submitted ? 1 : 0;
    await context.env.DB.prepare(`
      UPDATE sites SET stripe_charges_enabled = ?, stripe_details_submitted = ?, updated_at = ? WHERE id = ?
    `).bind(chargesEnabled, detailsSubmitted, new Date().toISOString(), site.id).run();

    return json({
      connected: true,
      accountId: account.id,
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
      requirements: account.requirements || null
    });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}
