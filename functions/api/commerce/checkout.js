import { json, readJson, requestOrigin, errorMessage } from '../../_lib/http.js';
import { stripePost } from '../../_lib/stripe.js';

function siteBase(site, request) {
  if (site.custom_domain) return `https://${String(site.custom_domain).replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  if (/^https:\/\//i.test(site.site_url || '')) return String(site.site_url).replace(/\/$/, '');
  return requestOrigin(request);
}

function imageUrl(value, base) {
  const raw = String(value || '').trim();
  if (/^https:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${base}${raw}`;
  return null;
}

export async function onRequestPost(context) {
  try {
    if (!context.env.DB) return json({ error: 'Store service is unavailable.' }, 503);
    const input = await readJson(context.request);
    const slug = String(input.site || '').trim();
    const requestedItems = Array.isArray(input.items) ? input.items : [];
    if (!slug || !requestedItems.length) return json({ error: 'Your cart is empty.' }, 400);

    const site = await context.env.DB.prepare(`
      SELECT id, slug, name, site_url, custom_domain, content_json, stripe_account_id,
             stripe_charges_enabled, platform_fee_bps, status
      FROM sites WHERE slug = ? AND status = 'active' LIMIT 1
    `).bind(slug).first();
    if (!site) return json({ error: 'Store not found.' }, 404);
    if (!site.stripe_account_id || !site.stripe_charges_enabled) return json({ error: 'This store is not ready to accept payments yet.' }, 409);

    let content = {};
    try { content = JSON.parse(site.content_json || '{}'); } catch { content = {}; }
    const products = new Map((Array.isArray(content.products) ? content.products : []).map((product) => [String(product.id), product]));
    const currency = String(content.commerce?.currency || 'usd').toLowerCase();
    const base = siteBase(site, context.request);
    const lineItems = [];
    let subtotal = 0;

    for (const requested of requestedItems.slice(0, 50)) {
      const product = products.get(String(requested.id));
      if (!product || product.active === false) return json({ error: 'One of the products in your cart is no longer available.' }, 409);
      const quantity = Math.max(1, Math.min(25, Math.round(Number(requested.quantity || 1))));
      const unitAmount = Math.max(0, Math.round(Number(product.priceCents || 0)));
      if (!Number.isFinite(unitAmount)) return json({ error: 'A product has an invalid price.' }, 409);
      subtotal += unitAmount * quantity;
      const image = imageUrl(product.image, base);
      lineItems.push({
        quantity,
        price_data: {
          currency,
          unit_amount: unitAmount,
          product_data: {
            name: String(product.name || 'Product').slice(0, 160),
            description: String(product.description || '').slice(0, 500) || undefined,
            images: image ? [image] : undefined,
            metadata: { um_product_id: String(product.id) }
          }
        }
      });
    }

    if (subtotal <= 0) return json({ error: 'The cart total must be greater than zero.' }, 400);
    const feeBps = Math.max(0, Math.min(5000, Number(site.platform_fee_bps || 0)));
    const applicationFee = Math.min(subtotal - 1, Math.round(subtotal * feeBps / 10000));
    const metadata = {
      um_site_id: String(site.id),
      um_site_slug: String(site.slug),
      um_platform_fee_bps: String(feeBps),
      um_platform_fee_amount: String(Math.max(0, applicationFee))
    };
    const params = {
      mode: 'payment',
      line_items: lineItems,
      success_url: `${base}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?checkout=cancelled`,
      customer_creation: 'always',
      metadata,
      payment_intent_data: {
        metadata,
        ...(applicationFee > 0 ? { application_fee_amount: applicationFee } : {})
      }
    };

    if (content.commerce?.requiresShipping) {
      const allowed = Array.isArray(content.commerce.allowedCountries) && content.commerce.allowedCountries.length
        ? content.commerce.allowedCountries.slice(0, 20)
        : ['US'];
      params.shipping_address_collection = { allowed_countries: allowed };
    }

    const session = await stripePost(context.env, '/checkout/sessions', params, site.stripe_account_id);
    return json({ ok: true, url: session.url, sessionId: session.id });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}
