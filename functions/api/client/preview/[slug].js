import { requireUser } from '../../../_lib/auth.js';
import { renderHostedSite } from '../../../_lib/render.js';

export async function onRequestGet(context) {
  const user = await requireUser(context);
  if (!user) return new Response('Not authorized.', { status: 401 });
  const site = await context.env.DB.prepare(`
    SELECT id, owner_user_id, slug, name, custom_domain, site_url, content_json, status
    FROM sites WHERE slug = ? LIMIT 1
  `).bind(context.params.slug).first();
  if (!site) return new Response('Site not found.', { status: 404 });
  if (user.role !== 'admin' && site.owner_user_id !== user.id) return new Response('Not authorized.', { status: 403 });
  return new Response(renderHostedSite(site), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
      'content-security-policy': "frame-ancestors 'self'"
    }
  });
}
