import { json, readJson, normalizeDomain, errorMessage } from '../../../_lib/http.js';
import { requireUser } from '../../../_lib/auth.js';

export async function onRequestPut(context) {
  try {
    const admin = await requireUser(context, 'admin');
    if (!admin) return json({ error: 'Not authorized.' }, 401);
    const slug = context.params.slug;
    const site = await context.env.DB.prepare('SELECT id FROM sites WHERE slug = ? LIMIT 1').bind(slug).first();
    if (!site) return json({ error: 'Site not found.' }, 404);
    const input = await readJson(context.request);
    const feePercent = Number(input.platformFeePercent ?? 0);
    if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent > 50) return json({ error: 'Platform fee must be between 0% and 50%.' }, 400);
    const status = ['active', 'paused', 'draft'].includes(input.status) ? input.status : 'active';
    const domain = normalizeDomain(input.customDomain || '');
    await context.env.DB.prepare(`
      UPDATE sites SET custom_domain = ?, site_url = ?, builder_enabled = ?, platform_fee_bps = ?, status = ?, updated_at = ? WHERE id = ?
    `).bind(domain || null, String(input.siteUrl || '').trim() || null, input.builderEnabled ? 1 : 0, Math.round(feePercent * 100), status, new Date().toISOString(), site.id).run();
    return json({ ok: true });
  } catch (error) {
    const message = errorMessage(error);
    return json({ error: /UNIQUE|constraint/i.test(message) ? 'That custom domain is already assigned to another site.' : message }, /UNIQUE|constraint/i.test(message) ? 409 : 500);
  }
}
