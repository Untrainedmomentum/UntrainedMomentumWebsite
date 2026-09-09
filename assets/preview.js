import { escapeHtml, publicSupabaseRest } from '/assets/client.js';

const slug = new URL(location.href).searchParams.get('site');
const mount = document.querySelector('#preview-root');

function safeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
}

function safeUrl(value, fallback = '#') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (raw.startsWith('#') || /^mailto:|^tel:/i.test(raw)) return raw;
  try {
    const url = new URL(raw, location.origin);
    if (url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost')) return url.href;
  } catch { /* invalid */ }
  return fallback;
}

function render(site) {
  const content = site.content || {};
  const hero = content.hero || {};
  const contact = content.contact || {};
  const services = Array.isArray(content.services) ? content.services : [];
  const gallery = Array.isArray(content.gallery) ? content.gallery : [];
  const primary = safeColor(content.theme?.primary, '#b53a2a');
  const accent = safeColor(content.theme?.accent, '#f3f0e9');
  const businessName = content.businessName || site.name;
  const cta = safeUrl(hero.ctaUrl || '#contact');

  document.documentElement.style.setProperty('--preview-primary', primary);
  document.documentElement.style.setProperty('--preview-accent', accent);
  document.title = `${businessName} | Preview`;

  mount.innerHTML = `
    <header class="preview-bar"><strong>${escapeHtml(businessName)}</strong><span>Client preview</span></header>
    <main>
      <section class="preview-hero">
        <div class="preview-shell">
          <p class="preview-eyebrow">${escapeHtml(hero.eyebrow || site.site_type || 'Website')}</p>
          <h1>${escapeHtml(hero.headline || businessName)}</h1>
          ${hero.subheadline ? `<p class="preview-lede">${escapeHtml(hero.subheadline)}</p>` : ''}
          ${hero.ctaText ? `<a class="preview-button" href="${escapeHtml(cta)}">${escapeHtml(hero.ctaText)}</a>` : ''}
        </div>
      </section>
      ${services.length ? `<section class="preview-section"><div class="preview-shell"><p class="preview-eyebrow">Services</p><h2>What we do</h2><div class="preview-grid">${services.map((service) => `<article><h3>${escapeHtml(service.name || service.title || 'Service')}</h3>${service.description ? `<p>${escapeHtml(service.description)}</p>` : ''}${service.price ? `<strong>${escapeHtml(service.price)}</strong>` : ''}</article>`).join('')}</div></div></section>` : ''}
      ${gallery.length ? `<section class="preview-section alt"><div class="preview-shell"><p class="preview-eyebrow">Gallery</p><h2>Recent work</h2><div class="preview-gallery">${gallery.map((item) => { const src = safeUrl(item.url || item.image, ''); return src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(item.alt || item.caption || '')}" loading="lazy">` : ''; }).join('')}</div></div></section>` : ''}
      <section class="preview-section" id="contact"><div class="preview-shell"><p class="preview-eyebrow">Contact</p><h2>Get in touch</h2><div class="preview-contact">${contact.phone ? `<p><strong>Phone:</strong> ${escapeHtml(contact.phone)}</p>` : ''}${contact.email ? `<p><strong>Email:</strong> ${escapeHtml(contact.email)}</p>` : ''}${contact.address ? `<p><strong>Service area:</strong> ${escapeHtml(contact.address)}</p>` : ''}</div></div></section>
    </main>`;
}

if (!slug) {
  mount.innerHTML = '<main class="preview-error"><h1>Preview unavailable</h1><p>No website was selected.</p></main>';
} else {
  try {
    const rows = await publicSupabaseRest(`site_publications?slug=eq.${encodeURIComponent(slug)}&select=slug,name,site_type,site_url,custom_domain,content,updated_at`);
    const site = Array.isArray(rows) ? rows[0] : null;
    if (!site) throw new Error('This website does not have a published preview yet.');
    render(site);
  } catch (error) {
    mount.innerHTML = `<main class="preview-error"><h1>Preview unavailable</h1><p>${escapeHtml(error.message)}</p></main>`;
  }
}
