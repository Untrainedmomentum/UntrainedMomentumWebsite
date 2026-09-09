import { json, readJson, errorMessage } from '../../../_lib/http.js';
import { requireUser } from '../../../_lib/auth.js';

async function getSite(db, slug) {
  return db.prepare(`
    SELECT id, owner_user_id, slug, name, site_type, site_url, custom_domain, content_json,
           builder_enabled, platform_fee_bps, stripe_account_id, stripe_details_submitted,
           stripe_charges_enabled, status, updated_at
    FROM sites WHERE slug = ? LIMIT 1
  `).bind(slug).first();
}

function allowed(user, site) {
  return user?.role === 'admin' || (user && site && user.id === site.owner_user_id);
}

function cleanContent(input, site) {
  const content = typeof input === 'object' && input ? structuredClone(input) : {};
  const limitArray = (name, max) => {
    if (!Array.isArray(content[name])) content[name] = [];
    content[name] = content[name].slice(0, max);
  };
  limitArray('services', 100);
  limitArray('projects', 100);
  limitArray('menu', 50);
  limitArray('products', 250);
  limitArray('gallery', 200);
  content.businessName = String(content.businessName || site.name).slice(0, 150);
  content.builder ||= { html: '', css: '' };
  content.builder.html = String(content.builder.html || '').slice(0, 500000);
  content.builder.css = String(content.builder.css || '').slice(0, 150000);
  for (const product of content.products) {
    product.id = String(product.id || crypto.randomUUID()).slice(0, 100);
    product.name = String(product.name || 'Product').slice(0, 160);
    product.priceCents = Math.max(0, Math.round(Number(product.priceCents || 0)));
    product.active = product.active !== false;
  }
  return content;
}

export async function onRequestGet(context) {
  const user = await requireUser(context);
  if (!user) return json({ error: 'Not authorized.' }, 401);
  const slug = context.params.slug;
  const site = await getSite(context.env.DB, slug);
  if (!site) return json({ error: 'Site not found.' }, 404);
  if (!allowed(user, site)) return json({ error: 'Not authorized.' }, 403);
  let content = {};
  try { content = JSON.parse(site.content_json || '{}'); } catch { content = {}; }
  delete site.content_json;
  return json({ site, content });
}

export async function onRequestPut(context) {
  try {
    const user = await requireUser(context);
    if (!user) return json({ error: 'Not authorized.' }, 401);
    const slug = context.params.slug;
    const site = await getSite(context.env.DB, slug);
    if (!site) return json({ error: 'Site not found.' }, 404);
    if (!allowed(user, site)) return json({ error: 'Not authorized.' }, 403);
    const body = await readJson(context.request);
    const rawContent = body.content ?? body;
    const content = cleanContent(rawContent, site);
    const serialized = JSON.stringify(content);
    if (serialized.length > 900000) return json({ error: 'Site content is too large. Upload images instead of embedding them.' }, 413);
    const now = new Date().toISOString();
    await context.env.DB.prepare('UPDATE sites SET content_json = ?, updated_at = ? WHERE id = ?')
      .bind(serialized, now, site.id).run();
    return json({ ok: true, updatedAt: now, content });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}
