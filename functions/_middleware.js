import { renderHostedSite } from './_lib/render.js';

const PRIMARY_HOSTS = new Set(['untrainedmomentum.com', 'www.untrainedmomentum.com']);

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const host = url.hostname.toLowerCase();
  const isPrimary = PRIMARY_HOSTS.has(host) || host.endsWith('.pages.dev') || host === 'localhost';
  if (isPrimary) return context.next();

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/assets/')) {
    return context.next();
  }

  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!context.env.DB) {
    return new Response('Website hosting is not configured yet.', { status: 503 });
  }

  const normalized = host.replace(/^www\./, '');
  const site = await context.env.DB.prepare(`
    SELECT id, slug, name, custom_domain, site_url, content_json
    FROM sites
    WHERE lower(custom_domain) = ? AND status = 'active'
    LIMIT 1
  `).bind(normalized).first();

  if (!site) return new Response('Website not found', { status: 404 });

  const markup = renderHostedSite(site);
  return new Response(context.request.method === 'HEAD' ? null : markup, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=30, must-revalidate',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin'
    }
  });
}
