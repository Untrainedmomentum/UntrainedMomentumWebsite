function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeColor(value, fallback) {
  return /^#[0-9a-f]{3,8}$/i.test(String(value || '')) ? value : fallback;
}

function safeUrl(value = '') {
  const text = String(value).trim();
  if (!text) return '';
  if (/^(https?:\/\/|\/)/i.test(text)) return text.replace(/"/g, '%22');
  return '';
}

function sanitizeBuilderHtml(input = '') {
  return String(input)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<(?:iframe|object|embed)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed)>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
}

function renderImage(url, alt = '') {
  const safe = safeUrl(url);
  return safe ? `<img loading="lazy" src="${esc(safe)}" alt="${esc(alt)}">` : '';
}

function renderProjects(content) {
  const items = Array.isArray(content.projects) ? content.projects : [];
  if (!items.length) return '';
  return `<section class="um-section"><div class="um-shell"><h2>${esc(content.labels?.projects || 'Projects')}</h2><div class="um-grid">${items.map((item) => `<article class="um-card">${renderImage(item.image, item.title)}<div class="um-card-body"><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p></div></article>`).join('')}</div></div></section>`;
}

function renderGallery(content) {
  const items = Array.isArray(content.gallery) ? content.gallery : [];
  if (!items.length) return '';
  return `<section class="um-section"><div class="um-shell"><h2>${esc(content.labels?.gallery || 'Gallery')}</h2><div class="um-gallery">${items.map((item) => renderImage(item.url || item.image, item.alt || item.caption || 'Gallery image')).join('')}</div></div></section>`;
}

function renderServices(content) {
  const items = Array.isArray(content.services) ? content.services : [];
  if (!items.length) return '';
  return `<section class="um-section"><div class="um-shell"><h2>${esc(content.labels?.services || 'Services')}</h2><div class="um-grid">${items.map((item) => `<article class="um-card"><div class="um-card-body"><h3>${esc(item.name || item.title)}</h3><p>${esc(item.description)}</p>${item.price ? `<p class="um-price">${esc(item.price)}</p>` : ''}</div></article>`).join('')}</div></div></section>`;
}

function renderMenu(content) {
  const sections = Array.isArray(content.menu) ? content.menu : [];
  if (!sections.length) return '';
  return `<section class="um-section"><div class="um-shell"><h2>${esc(content.labels?.menu || 'Menu')}</h2>${sections.map((section) => `<div class="um-menu-section"><h3>${esc(section.name)}</h3>${(Array.isArray(section.items) ? section.items : []).map((item) => `<div class="um-menu-item"><div><strong>${esc(item.name)}</strong>${item.description ? `<span>${esc(item.description)}</span>` : ''}</div><b>${esc(item.price || '')}</b></div>`).join('')}</div>`).join('')}</div></section>`;
}

function renderProducts(content) {
  const products = (Array.isArray(content.products) ? content.products : []).filter((item) => item.active !== false);
  if (!products.length) return '';
  return `<section class="um-section"><div class="um-shell"><h2>${esc(content.labels?.products || 'Shop')}</h2><div class="um-grid">${products.map((item) => `<article class="um-card">${renderImage(item.image, item.name)}<div class="um-card-body"><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><div class="um-product-row"><span class="um-price">${esc(item.priceDisplay || (Number.isFinite(Number(item.priceCents)) ? `$${(Number(item.priceCents) / 100).toFixed(2)}` : ''))}</span><button class="um-button" type="button" data-um-add="${esc(item.id)}">Add to cart</button></div></div></article>`).join('')}</div><div class="um-cart-bar" hidden data-um-cart-bar><span data-um-cart-count>0 items</span><button class="um-button" type="button" data-um-checkout>Checkout</button></div></div></section>`;
}

function renderContact(content) {
  const contact = content.contact || {};
  if (!contact.email && !contact.phone && !contact.address) return '';
  return `<section class="um-section um-contact"><div class="um-shell"><h2>${esc(content.labels?.contact || 'Contact')}</h2><p>${esc(contact.address || '')}</p><p>${contact.phone ? `<a href="tel:${esc(String(contact.phone).replace(/[^+\d]/g, ''))}">${esc(contact.phone)}</a>` : ''}${contact.phone && contact.email ? ' · ' : ''}${contact.email ? `<a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>` : ''}</p></div></section>`;
}

function replaceModule(markup, moduleName, rendered) {
  const pattern = new RegExp(`<([a-z0-9-]+)([^>]*data-um-${moduleName}[^>]*)>[\\s\\S]*?<\\/\\1>`, 'gi');
  if (pattern.test(markup)) return markup.replace(pattern, rendered || '');
  return markup;
}

function defaultBody(content) {
  const hero = content.hero || {};
  return `
    <header class="um-hero"><div class="um-shell"><p class="um-eyebrow">${esc(hero.eyebrow || '')}</p><h1>${esc(hero.headline || content.businessName || 'Welcome')}</h1><p>${esc(hero.subheadline || '')}</p>${hero.ctaText && safeUrl(hero.ctaUrl) ? `<a class="um-button" href="${esc(safeUrl(hero.ctaUrl))}">${esc(hero.ctaText)}</a>` : ''}</div></header>
    ${renderServices(content)}
    ${renderProjects(content)}
    ${renderMenu(content)}
    ${renderProducts(content)}
    ${renderGallery(content)}
    ${renderContact(content)}
  `;
}

export function renderHostedSite(site) {
  let content = {};
  try { content = JSON.parse(site.content_json || '{}'); } catch { content = {}; }
  content.businessName ||= site.name;
  const theme = content.theme || {};
  const primary = safeColor(theme.primary, '#b4232f');
  const ink = safeColor(theme.ink, '#171716');
  const background = safeColor(theme.background, '#ffffff');
  const accent = safeColor(theme.accent, '#f4f1eb');

  let body = sanitizeBuilderHtml(content.builder?.html || '');
  if (body) {
    body = replaceModule(body, 'services', renderServices(content));
    body = replaceModule(body, 'projects', renderProjects(content));
    body = replaceModule(body, 'menu', renderMenu(content));
    body = replaceModule(body, 'products', renderProducts(content));
    body = replaceModule(body, 'gallery', renderGallery(content));
    body = replaceModule(body, 'contact', renderContact(content));
  } else {
    body = defaultBody(content);
  }

  const customCss = String(content.builder?.css || '').replace(/<\/style/gi, '<\\/style');
  const title = content.seo?.title || content.businessName || site.name;
  const description = content.seo?.description || content.hero?.subheadline || `${site.name} website`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<style>
:root{--um-primary:${primary};--um-ink:${ink};--um-bg:${background};--um-accent:${accent}}*{box-sizing:border-box}body{margin:0;background:var(--um-bg);color:var(--um-ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.55}img{max-width:100%;display:block}.um-shell{width:min(1120px,calc(100% - 32px));margin:auto}.um-hero{padding:clamp(72px,10vw,140px) 0;background:var(--um-accent)}.um-hero h1{font-size:clamp(2.4rem,7vw,5.5rem);line-height:.98;margin:.15em 0}.um-eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.8rem;font-weight:800;color:var(--um-primary)}.um-section{padding:64px 0}.um-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:22px}.um-card{border:1px solid #ddd;border-radius:16px;overflow:hidden;background:#fff}.um-card img{width:100%;aspect-ratio:4/3;object-fit:cover}.um-card-body{padding:20px}.um-card h3{margin-top:0}.um-button{display:inline-flex;border:0;border-radius:999px;padding:11px 18px;background:var(--um-primary);color:#fff;text-decoration:none;font:inherit;font-weight:750;cursor:pointer}.um-price{font-weight:800}.um-product-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.um-menu-section{max-width:800px;margin:28px 0}.um-menu-item{display:flex;justify-content:space-between;gap:20px;padding:14px 0;border-bottom:1px solid #ddd}.um-menu-item span{display:block;font-size:.92rem;opacity:.75}.um-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.um-gallery img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px}.um-contact{background:var(--um-accent)}.um-cart-bar{position:fixed;z-index:20;left:50%;bottom:20px;transform:translateX(-50%);display:flex;align-items:center;gap:18px;background:var(--um-ink);color:#fff;padding:12px 16px;border-radius:999px;box-shadow:0 12px 30px #0003}.um-cart-bar[hidden]{display:none}${customCss}
</style></head><body data-um-site="${esc(site.slug)}">${body}<script src="/assets/hosted-site.js" defer></script></body></html>`;
}
