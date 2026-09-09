import { json, readJson, requestOrigin, errorMessage } from '../../../_lib/http.js';
import { requireUser } from '../../../_lib/auth.js';
import { stripePost } from '../../../_lib/stripe.js';

export async function onRequestPost(context) {
  try {
    const user = await requireUser(context);
    if (!user) return json({ error: 'Not authorized.' }, 401);
    const input = await readJson(context.request);
    const slug = String(input.site || input.slug || '').trim();
    const site = await context.env.DB.prepare('SELECT * FROM sites WHERE slug = ? LIMIT 1').bind(slug).first();
    if (!site) return json({ error: 'Site not found.' }, 404);
    if (user.role !== 'admin' && site.owner_user_id !== user.id) return json({ error: 'Not authorized.' }, 403);

    let accountId = site.stripe_account_id;
    if (!accountId) {
      const account = await stripePost(context.env, '/accounts', {
        type: 'express',
        country: context.env.CONNECT_DEFAULT_COUNTRY || 'US',
        email: user.email,
        business_profile: { product_description: `${site.name} sales processed through its Untrained Momentum hosted website` },
        metadata: { um_site_id: site.id, um_site_slug: site.slug }
      });
      accountId = account.id;
      await context.env.DB.prepare('UPDATE sites SET stripe_account_id = ?, updated_at = ? WHERE id = ?')
        .bind(accountId, new Date().toISOString(), site.id).run();
    }

    const origin = requestOrigin(context.request);
    const accountLink = await stripePost(context.env, '/account_links', {
      account: accountId,
      refresh_url: `${origin}/client/index.html?stripe=refresh&site=${encodeURIComponent(site.slug)}`,
      return_url: `${origin}/client/index.html?stripe=return&site=${encodeURIComponent(site.slug)}`,
      type: 'account_onboarding'
    });
    return json({ ok: true, url: accountLink.url, accountId });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}
