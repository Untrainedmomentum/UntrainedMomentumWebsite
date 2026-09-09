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

function slugify(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function itemKey(item, index, fallback = 'item') {
  return String(item?.id || item?.slug || slugify(item?.title || item?.name) || `${fallback}-${index + 1}`);
}

function linkFor(options, pathname) {
  if (options?.previewBase) return `${options.previewBase}?path=${encodeURIComponent(pathname)}`;
  return pathname;
}

function renderImage(url, alt = '', className = '') {
  const safe = safeUrl(url);
  return safe ? `<img${className ? ` class="${esc(className)}"` : ''} loading="lazy" src="${esc(safe)}" alt="${esc(alt)}">` : '';
}

function renderProjects(content, options = {}) {
  const items = Array.isArray(content.projects) ? content.projects : [];
  if (!items.length) return '';
  return `<section class="um-section"><div class="um-shell"><div class="um-section-head"><h2>${esc(content.labels?.projects || 'Projects')}</h2>${options.standalone ? '' : `<a class="um-text-link" href="${esc(linkFor(options, '/projects'))}">View all projects</a>`}</div><div class="um-grid">${items.map((item, index) => {
    const href = linkFor(options, `/projects/${encodeURIComponent(itemKey(item, index, 'project'))}`);
    return `<article class="um-card">${item.image ? `<a href="${esc(href)}">${renderImage(item.image, item.title)}</a>` : ''}<div class="um-card-body"><h3><a class="um-card-link" href="${esc(href)}">${esc(item.title)}</a></h3><p>${esc(item.description)}</p><a class="um-text-link" href="${esc(href)}">View project</a></div></article>`;
  }).join('')}</div></div></section>`;
}

function renderProjectDetail(content, key, options = {}) {
  const items = Array.isArray(content.projects) ? content.projects : [];
  const normalized = decodeURIComponent(String(key || ''));
  const projectIndex = items.findIndex((item, index) => itemKey(item, index, 'project') === normalized || slugify(item.title) === slugify(normalized));
  if (projectIndex < 0) return null;
  const project = items[projectIndex];
  const images = [project.image, ...(Array.isArray(project.images) ? project.images : [])].filter(Boolean);
  const back = linkFor(options, '/projects');
  return `<main class="um-detail"><div class="um-shell"><p><a class="um-text-link" href="${esc(back)}">← Back to projects</a></p><header class="um-detail-head"><p class="um-eyebrow">Project</p><h1>${esc(project.title || 'Project')}</h1>${project.description ? `<p class="um-detail-lede">${esc(project.description)}</p>` : ''}</header>${images.length ? `<div class="um-detail-gallery">${images.map((image, index) => renderImage(image, `${project.title || 'Project'} image ${index + 1}`)).join('')}</div>` : ''}${project.details ? `<div class="um-prose"><p>${esc(project.details).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')}</p></div>` : ''}</div></main>`;
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

function productPrice(item) {
  return item.priceDisplay || (Number.isFinite(Number(item.priceCents)) ? `$${(Number(item.priceCents) / 100).toFixed(2)}` : '');
}

function renderProducts(content, options = {}) {
  const products = (Array.isArray(content.products) ? content.products : []).filter((item) => item.active !== false);
  if (!products.length) return '';
  return `<section class="um-section"><div class="um-shell"><div class="um-section-head"><h2>${esc(content.labels?.products || 'Shop')}</h2>${options.standalone ? '' : `<a class="um-text-link" href="${esc(linkFor(options, '/shop'))}">View shop</a>`}</div><div class="um-grid">${products.map((item, index) => {
    const href = linkFor(options, `/products/${encodeURIComponent(itemKey(item, index, 'product'))}`);
    return `<article class="um-card">${item.image ? `<a href="${esc(href)}">${renderImage(item.image, item.name)}</a>` : ''}<div class="um-card-body"><h3><a class="um-card-link" href="${esc(href)}">${esc(item.name)}</a></h3><p>${esc(item.description)}</p><div class="um-product-row"><span class="um-price">${esc(productPrice(item))}</span><button class="um-button" type="button" data-um-add="${esc(item.id || itemKey(item, index, 'product'))}">Add to cart</button></div></div></article>`;
  }).join('')}</div><div class="um-cart-bar" hidden data-um-cart-bar><span data-um-cart-count>0 items</span><button class="um-button" type="button" data-um-checkout>Checkout</button></div></div></section>`;
}

function renderProductDetail(content, key, options = {}) {
  const items = (Array.isArray(content.products) ? content.products : []).filter((item) => item.active !== false);
  const normalized = decodeURIComponent(String(key || ''));
  const index = items.findIndex((item, i) => itemKey(item, i, 'product') === normalized || slugify(item.name) === slugify(normalized));
  if (index < 0) return null;
  const product = items[index];
  const back = linkFor(options, '/shop');
  return `<main class="um-detail"><div class="um-shell"><p><a class="um-text-link" href="${esc(back)}">← Back to shop</a></p><div class="um-product-detail">${renderImage(product.image, product.name, 'um-product-detail-image')}<div><p class="um-eyebrow">Product</p><h1>${esc(product.name || 'Product')}</h1><p class="um-detail-lede">${esc(product.description || '')}</p><p class="um-product-detail-price">${esc(productPrice(product))}</p><button class="um-button" type="button" data-um-add="${esc(product.id || itemKey(product, index, 'product'))}">Add to cart</button></div></div><div class="um-cart-bar" hidden data-um-cart-bar><span data-um-cart-count>0 items</span><button class="um-button" type="button" data-um-checkout>Checkout</button></div></div></main>`;
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

function defaultBody(content, options = {}) {
  const hero = content.hero || {};
  return `
    <header class="um-hero"><div class="um-shell"><p class="um-eyebrow">${esc(hero.eyebrow || '')}</p><h1>${esc(hero.headline || content.businessName || 'Welcome')}</h1><p>${esc(hero.subheadline || '')}</p>${hero.ctaText && safeUrl(hero.ctaUrl) ? `<a class="um-button" href="${esc(safeUrl(hero.ctaUrl))}">${esc(hero.ctaText)}</a>` : ''}</div></header>
    ${renderServices(content)}
    ${renderProjects(content, options)}
    ${renderMenu(content)}
    ${renderProducts(content, options)}
    ${renderGallery(content)}
    ${renderContact(content)}
  `;
}

function routeBody(content, pathname, options = {}) {
  const path = String(pathname || '/').replace(/\/+$/, '') || '/';
  let match;
  if (path === '/') return { status: 200, body: null, titleSuffix: '' };
  if (path === '/projects') return { status: 200, body: renderProjects(content, { ...options, standalone: true }), titleSuffix: 'Projects' };
  if ((match = path.match(/^\/projects\/([^/]+)$/))) {
    const body = renderProjectDetail(content, match[1], options);
    return body ? { status: 200, body, titleSuffix: 'Project' } : { status: 404, body: null, titleSuffix: 'Not Found' };
  }
  if (path === '/shop' || path === '/products') return { status: 200, body: renderProducts(content, { ...options, standalone: true }), titleSuffix: 'Shop' };
  if ((match = path.match(/^\/products\/([^/]+)$/))) {
    const body = renderProductDetail(content, match[1], options);
    return body ? { status: 200, body, titleSuffix: 'Product' } : { status: 404, body: null, titleSuffix: 'Not Found' };
  }
  if (path === '/menu') return { status: 200, body: renderMenu(content), titleSuffix: 'Menu' };
  if (path === '/gallery') return { status: 200, body: renderGallery(content), titleSuffix: 'Gallery' };
  if (path === '/services') return { status: 200, body: renderServices(content), titleSuffix: 'Services' };
  if (path === '/contact') return { status: 200, body: renderContact(content), titleSuffix: 'Contact' };
  return { status: 404, body: null, titleSuffix: 'Not Found' };
}

function shell(site, content, body, options, status, titleSuffix = '') {
  const theme = content.theme || {};
  const primary = safeColor(theme.primary, '#b4232f');
  const ink = safeColor(theme.ink, '#171716');
  const background = safeColor(theme.background, '#ffffff');
  const accent = safeColor(theme.accent, '#f4f1eb');
  const customCss = String(content.builder?.css || '').replace(/<\/style/gi, '<\\/style');
  const baseTitle = content.seo?.title || content.businessName || site.name;
  const title = titleSuffix && titleSuffix !== 'Not Found' ? `${titleSuffix} | ${baseTitle}` : (status === 404 ? `Page Not Found | ${baseTitle}` : baseTitle);
  const description = content.seo?.description || content.hero?.subheadline || `${site.name} website`;
  const home = linkFor(options, '/');
  const notFoundBody = `<main class="um-detail"><div class="um-shell"><p class="um-eyebrow">404</p><h1>Page not found</h1><p>The page you requested does not exist.</p><a class="um-button" href="${esc(home)}">Back to home</a></div></main>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<style>
:root{--um-primary:${primary};--um-ink:${ink};--um-bg:${background};--um-accent:${accent}}*{box-sizing:border-box}body{margin:0;background:var(--um-bg);color:var(--um-ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.55}img{max-width:100%;display:block}.um-shell{width:min(1120px,calc(100% - 32px));margin:auto}.um-hero{padding:clamp(72px,10vw,140px) 0;background:var(--um-accent)}.um-hero h1,.um-detail h1{font-size:clamp(2.4rem,7vw,5.5rem);line-height:.98;margin:.15em 0}.um-eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.8rem;font-weight:800;color:var(--um-primary)}.um-section{padding:64px 0}.um-section-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:20px}.um-section-head h2{margin:0}.um-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:22px}.um-card{border:1px solid #ddd;border-radius:16px;overflow:hidden;background:#fff}.um-card img{width:100%;aspect-ratio:4/3;object-fit:cover}.um-card-body{padding:20px}.um-card h3{margin-top:0}.um-card-link,.um-text-link{color:inherit;text-decoration-thickness:1px;text-underline-offset:3px}.um-text-link{font-weight:750}.um-button{display:inline-flex;border:0;border-radius:999px;padding:11px 18px;background:var(--um-primary);color:#fff;text-decoration:none;font:inherit;font-weight:750;cursor:pointer}.um-price{font-weight:800}.um-product-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.um-menu-section{max-width:800px;margin:28px 0}.um-menu-item{display:flex;justify-content:space-between;gap:20px;padding:14px 0;border-bottom:1px solid #ddd}.um-menu-item span{display:block;font-size:.92rem;opacity:.75}.um-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.um-gallery img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px}.um-contact{background:var(--um-accent)}.um-cart-bar{position:fixed;z-index:20;left:50%;bottom:20px;transform:translateX(-50%);display:flex;align-items:center;gap:18px;background:var(--um-ink);color:#fff;padding:12px 16px;border-radius:999px;box-shadow:0 12px 30px #0003}.um-cart-bar[hidden]{display:none}.um-detail{padding:56px 0 90px}.um-detail-head{max-width:800px;padding:28px 0}.um-detail-lede{font-size:1.18rem;max-width:760px}.um-detail-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:28px 0}.um-detail-gallery img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:16px}.um-prose{max-width:780px;font-size:1.06rem}.um-product-detail{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.8fr);gap:40px;align-items:start;margin-top:28px}.um-product-detail-image{width:100%;border-radius:18px}.um-product-detail-price{font-size:1.5rem;font-weight:850}@media(max-width:760px){.um-section-head{align-items:start;flex-direction:column}.um-product-detail{grid-template-columns:1fr}}${customCss}
</style></head><body data-um-site="${esc(site.slug)}">${status === 404 ? notFoundBody : body}<script src="/assets/hosted-site.js" defer></script></body></html>`;
}

export function renderHostedRoute(site, options = {}) {
  let content = {};
  try { content = JSON.parse(site.content_json || '{}'); } catch { content = {}; }
  content.businessName ||= site.name;

  const route = routeBody(content, options.pathname || '/', options);
  let body = route.body;
  if (route.status === 200 && (options.pathname || '/') === '/') {
    body = sanitizeBuilderHtml(content.builder?.html || '');
    if (body) {
      body = replaceModule(body, 'services', renderServices(content));
      body = replaceModule(body, 'projects', renderProjects(content, options));
      body = replaceModule(body, 'menu', renderMenu(content));
      body = replaceModule(body, 'products', renderProducts(content, options));
      body = replaceModule(body, 'gallery', renderGallery(content));
      body = replaceModule(body, 'contact', renderContact(content));
    } else {
      body = defaultBody(content, options);
    }
  }

  return {
    status: route.status,
    html: shell(site, content, body || '', options, route.status, route.titleSuffix)
  };
}

export function renderHostedSite(site, options = {}) {
  return renderHostedRoute(site, options).html;
}
