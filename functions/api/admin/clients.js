import { json, readJson, safeSlug, normalizeDomain, errorMessage } from '../../_lib/http.js';
import { requireUser, hashPassword } from '../../_lib/auth.js';

function randomPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
}

function initialContent(siteName, siteType) {
  return {
    businessName: siteName,
    theme: { primary: '#b4232f', ink: '#171716', background: '#ffffff', accent: '#f4f1eb' },
    seo: { title: siteName, description: '' },
    hero: { eyebrow: '', headline: siteName, subheadline: '', ctaText: 'Contact Us', ctaUrl: '#contact' },
    contact: { phone: '', email: '', address: '' },
    labels: { services: 'Services', projects: 'Projects', menu: 'Menu', products: 'Shop', gallery: 'Gallery', contact: 'Contact' },
    services: [],
    projects: [],
    menu: [],
    products: [],
    gallery: [],
    commerce: { currency: 'usd', requiresShipping: siteType === 'ecommerce' },
    builder: { html: '', css: '' }
  };
}

export async function onRequestGet(context) {
  const admin = await requireUser(context, 'admin');
  if (!admin) return json({ error: 'Not authorized.' }, 401);
  const result = await context.env.DB.prepare(`
    SELECT s.id, s.slug, s.name, s.site_type, s.site_url, s.custom_domain, s.status,
           s.builder_enabled, s.platform_fee_bps, s.stripe_account_id,
           s.stripe_details_submitted, s.stripe_charges_enabled, s.updated_at,
           u.id AS owner_id, u.name AS owner_name, u.email AS owner_email
    FROM sites s JOIN users u ON u.id = s.owner_user_id
    ORDER BY s.created_at DESC
  `).all();
  return json({ sites: result.results || [] });
}

export async function onRequestPost(context) {
  try {
    const admin = await requireUser(context, 'admin');
    if (!admin) return json({ error: 'Not authorized.' }, 401);
    const input = await readJson(context.request);
    const email = String(input.email || '').trim().toLowerCase();
    const ownerName = String(input.name || input.ownerName || '').trim();
    const siteName = String(input.siteName || '').trim();
    const slug = safeSlug(input.slug || siteName);
    if (!email || !ownerName || !siteName || !slug) return json({ error: 'Owner name, email and site name are required.' }, 400);

    const generatedPassword = !input.password;
    const password = String(input.password || randomPassword());
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const siteId = crypto.randomUUID();
    const feePercent = Number(input.platformFeePercent || 0);
    if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent > 50) return json({ error: 'Platform fee must be between 0% and 50%.' }, 400);
    const feeBps = Math.round(feePercent * 100);
    const domain = normalizeDomain(input.customDomain || input.domain || '');
    const siteType = ['service', 'restaurant', 'portfolio', 'ecommerce', 'other'].includes(input.siteType) ? input.siteType : 'service';
    const content = initialContent(siteName, siteType);

    await context.env.DB.batch([
      context.env.DB.prepare(`
        INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'client', ?, ?)
      `).bind(userId, email, ownerName, passwordHash, now, now),
      context.env.DB.prepare(`
        INSERT INTO sites (id, owner_user_id, slug, name, site_type, site_url, custom_domain, content_json,
          platform_fee_bps, builder_enabled, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
      `).bind(siteId, userId, slug, siteName, siteType, String(input.siteUrl || '').trim(), domain || null,
        JSON.stringify(content), feeBps, input.builderEnabled ? 1 : 0, now, now)
    ]);

    return json({
      ok: true,
      client: { id: userId, name: ownerName, email },
      site: { id: siteId, slug, name: siteName, customDomain: domain || null },
      temporaryPassword: generatedPassword ? password : undefined
    }, 201);
  } catch (error) {
    const message = errorMessage(error);
    const status = /UNIQUE|constraint/i.test(message) ? 409 : 500;
    return json({ error: status === 409 ? 'That email, site slug, or domain is already in use.' : message }, status);
  }
}
