import { json } from '../../../_lib/http.js';

export async function onRequestGet(context) {
  if (!context.env.DB) return json({ error: 'Site service is unavailable.' }, 503, { 'access-control-allow-origin': '*' });
  const site = await context.env.DB.prepare(`
    SELECT slug, name, site_type, site_url, custom_domain, content_json, status
    FROM sites WHERE slug = ? AND status = 'active' LIMIT 1
  `).bind(context.params.slug).first();
  if (!site) return json({ error: 'Site not found.' }, 404, { 'access-control-allow-origin': '*' });
  let content = {};
  try { content = JSON.parse(site.content_json || '{}'); } catch { content = {}; }
  return json({
    site: { slug: site.slug, name: site.name, siteType: site.site_type, siteUrl: site.site_url, customDomain: site.custom_domain },
    content
  }, 200, {
    'cache-control': 'public, max-age=30, stale-while-revalidate=120',
    'access-control-allow-origin': '*'
  });
}
