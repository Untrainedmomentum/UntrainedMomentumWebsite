import { api, escapeHtml, getSession } from '/assets/client.js';

const slug = new URL(location.href).searchParams.get('site');
if (!slug) location.href = '/client/index.html';
let site;
let content;
const tabs = ['Basics', 'Services', 'Projects', 'Menu', 'Products', 'Gallery', 'Images'];
const mount = document.querySelector('#editor-mount');
const status = document.querySelector('#editor-status');

function field(label, name, value = '', type = 'text', extra = '') {
  if (type === 'textarea') return `<label class="client-field"><span>${label}</span><textarea name="${name}" ${extra}>${escapeHtml(value)}</textarea></label>`;
  return `<label class="client-field"><span>${label}</span><input name="${name}" type="${type}" value="${escapeHtml(value)}" ${extra}></label>`;
}

function itemShell(type, index, body, label) {
  return `<div class="repeat-item" data-repeat-item data-type="${type}" data-index="${index}"><div class="repeat-item-head"><strong>${escapeHtml(label)} ${index + 1}</strong><button class="link-button" type="button" data-remove>Remove</button></div>${body}</div>`;
}

function basicsSection() {
  const theme = content.theme || {};
  const hero = content.hero || {};
  const contact = content.contact || {};
  const seo = content.seo || {};
  return `<section class="editor-section client-panel" data-section="Basics"><div class="client-panel-header"><h2>Business + homepage basics</h2></div><div class="client-form">
    ${field('Business name', 'businessName', content.businessName || site.name)}
    <div class="client-form-row">${field('Primary color', 'theme.primary', theme.primary || '#b4232f', 'color')}${field('Accent/background color', 'theme.accent', theme.accent || '#f4f1eb', 'color')}</div>
    ${field('Small headline / eyebrow', 'hero.eyebrow', hero.eyebrow || '')}
    ${field('Main headline', 'hero.headline', hero.headline || '')}
    ${field('Intro text', 'hero.subheadline', hero.subheadline || '', 'textarea')}
    <div class="client-form-row">${field('Button text', 'hero.ctaText', hero.ctaText || '')}${field('Button link', 'hero.ctaUrl', hero.ctaUrl || '')}</div>
    <h3>Contact</h3><div class="client-form-row">${field('Phone', 'contact.phone', contact.phone || '')}${field('Email', 'contact.email', contact.email || '', 'email')}</div>${field('Address / service area', 'contact.address', contact.address || '')}
    <h3>Search / sharing</h3>${field('SEO page title', 'seo.title', seo.title || '')}${field('SEO description', 'seo.description', seo.description || '', 'textarea')}
  </div></section>`;
}

function servicesSection() {
  const items = Array.isArray(content.services) ? content.services : [];
  return `<section class="editor-section client-panel" data-section="Services" hidden><div class="client-panel-header"><h2>Services</h2><button class="client-button secondary small" type="button" data-add="services">Add service</button></div><div class="repeat-list" data-list="services">${items.map((item, i) => itemShell('services', i, `${field('Service name', 'name', item.name || item.title || '')}${field('Description', 'description', item.description || '', 'textarea')}${field('Price / pricing note', 'price', item.price || '')}`, 'Service')).join('')}</div></section>`;
}

function projectsSection() {
  const items = Array.isArray(content.projects) ? content.projects : [];
  return `<section class="editor-section client-panel" data-section="Projects" hidden><div class="client-panel-header"><h2>Projects / portfolio</h2><button class="client-button secondary small" type="button" data-add="projects">Add project</button></div><div class="repeat-list" data-list="projects">${items.map((item, i) => itemShell('projects', i, `${field('Project title', 'title', item.title || '')}${field('Description', 'description', item.description || '', 'textarea')}${field('Image URL', 'image', item.image || '')}`, 'Project')).join('')}</div></section>`;
}

function menuText(section) {
  return (Array.isArray(section.items) ? section.items : []).map((item) => [item.name || '', item.description || '', item.price || ''].join(' | ')).join('\n');
}

function menuSection() {
  const items = Array.isArray(content.menu) ? content.menu : [];
  return `<section class="editor-section client-panel" data-section="Menu" hidden><div class="client-panel-header"><div><h2>Menu</h2><p class="client-muted">One item per line: Name | Description | Price</p></div><button class="client-button secondary small" type="button" data-add="menu">Add menu section</button></div><div class="repeat-list" data-list="menu">${items.map((item, i) => itemShell('menu', i, `${field('Section name', 'name', item.name || '')}${field('Menu items', 'itemsText', menuText(item), 'textarea', 'placeholder="Burger | Lettuce, tomato, house sauce | $12"')}`, 'Menu section')).join('')}</div></section>`;
}

function productsSection() {
  const items = Array.isArray(content.products) ? content.products : [];
  return `<section class="editor-section client-panel" data-section="Products" hidden><div class="client-panel-header"><div><h2>Products + cart</h2><p class="client-muted">Prices are validated on the server before Stripe checkout, so shoppers cannot change them in the browser.</p></div><button class="client-button secondary small" type="button" data-add="products">Add product</button></div><div class="repeat-list" data-list="products">${items.map((item, i) => itemShell('products', i, `${field('Product name', 'name', item.name || '')}${field('Description', 'description', item.description || '', 'textarea')}<div class="client-form-row">${field('Price ($)', 'priceDollars', (Number(item.priceCents || 0) / 100).toFixed(2), 'number', 'min="0" step="0.01"')}${field('Image URL', 'image', item.image || '')}</div><label class="client-field"><span><input type="checkbox" name="active" ${item.active === false ? '' : 'checked'}> Available for sale</span></label><input type="hidden" name="id" value="${escapeHtml(item.id || crypto.randomUUID())}">`, 'Product')).join('')}</div></section>`;
}

function gallerySection() {
  const items = Array.isArray(content.gallery) ? content.gallery : [];
  return `<section class="editor-section client-panel" data-section="Gallery" hidden><div class="client-panel-header"><h2>Photo gallery</h2><button class="client-button secondary small" type="button" data-add="gallery">Add photo</button></div><div class="repeat-list" data-list="gallery">${items.map((item, i) => itemShell('gallery', i, `${field('Image URL', 'url', item.url || item.image || '')}${field('Alt text / description', 'alt', item.alt || item.caption || '')}`, 'Photo')).join('')}</div></section>`;
}

function imagesSection() {
  return `<section class="editor-section client-panel" data-section="Images" hidden><div class="client-panel-header"><div><h2>Upload an image</h2><p class="client-muted">Upload once, then paste the returned image URL into a project, product, gallery, or visual-builder image field.</p></div></div><form class="client-form" id="image-upload-form"><label class="client-field"><span>Choose image</span><input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" required></label><button class="client-button" type="submit">Upload image</button><div id="image-upload-result"></div></form></section>`;
}

function render() {
  mount.innerHTML = basicsSection() + servicesSection() + projectsSection() + menuSection() + productsSection() + gallerySection() + imagesSection();
  document.querySelector('#editor-tabs').innerHTML = tabs.map((tab, i) => `<button class="editor-tab" type="button" role="tab" aria-selected="${i === 0}" data-tab="${tab}">${tab}</button>`).join('');
  wireEditor();
}

function showTab(name) {
  document.querySelectorAll('.editor-tab').forEach((button) => button.setAttribute('aria-selected', String(button.dataset.tab === name)));
  document.querySelectorAll('.editor-section').forEach((section) => { section.hidden = section.dataset.section !== name; });
}

function blankItem(type) {
  const map = {
    services: { name: '', description: '', price: '' },
    projects: { title: '', description: '', image: '' },
    menu: { name: '', items: [] },
    products: { id: crypto.randomUUID(), name: '', description: '', priceCents: 0, image: '', active: true },
    gallery: { url: '', alt: '' }
  };
  return map[type];
}

function wireEditor() {
  document.querySelectorAll('.editor-tab').forEach((button) => button.addEventListener('click', () => showTab(button.dataset.tab)));
  document.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', () => {
    collectAll();
    content[button.dataset.add].push(blankItem(button.dataset.add));
    render();
    const sectionName = button.dataset.add === 'menu' ? 'Menu' : button.dataset.add[0].toUpperCase() + button.dataset.add.slice(1);
    showTab(sectionName);
  }));
  document.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => {
    collectAll();
    const item = button.closest('[data-repeat-item]');
    content[item.dataset.type].splice(Number(item.dataset.index), 1);
    const current = item.dataset.type === 'menu' ? 'Menu' : item.dataset.type[0].toUpperCase() + item.dataset.type.slice(1);
    render(); showTab(current);
  }));
  document.querySelector('#image-upload-form')?.addEventListener('submit', uploadImage);
}

function nestedSet(target, path, value) {
  const parts = path.split('.'); let cursor = target;
  while (parts.length > 1) { const part = parts.shift(); cursor[part] ||= {}; cursor = cursor[part]; }
  cursor[parts[0]] = value;
}

function readRepeat(type) {
  return [...document.querySelectorAll(`[data-type="${type}"]`)].map((item) => {
    if (type === 'products') {
      return {
        id: item.querySelector('[name="id"]').value || crypto.randomUUID(),
        name: item.querySelector('[name="name"]').value,
        description: item.querySelector('[name="description"]').value,
        priceCents: Math.max(0, Math.round(Number(item.querySelector('[name="priceDollars"]').value || 0) * 100)),
        image: item.querySelector('[name="image"]').value,
        active: item.querySelector('[name="active"]').checked
      };
    }
    if (type === 'menu') {
      const text = item.querySelector('[name="itemsText"]').value;
      return {
        name: item.querySelector('[name="name"]').value,
        items: text.split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => {
          const [name = '', description = '', price = ''] = line.split('|').map((part) => part.trim());
          return { name, description, price };
        })
      };
    }
    const out = {};
    item.querySelectorAll('input:not([type="checkbox"]),textarea').forEach((input) => { out[input.name] = input.value; });
    return out;
  });
}

function collectAll() {
  document.querySelector('[data-section="Basics"]')?.querySelectorAll('input,textarea').forEach((input) => nestedSet(content, input.name, input.value));
  content.services = readRepeat('services');
  content.projects = readRepeat('projects');
  content.menu = readRepeat('menu');
  content.products = readRepeat('products');
  content.gallery = readRepeat('gallery');
}

async function save() {
  const button = document.querySelector('#save-site'); button.disabled = true; status.textContent = '';
  try {
    collectAll();
    await api(`/api/client/site/${encodeURIComponent(slug)}`, { method: 'PUT', body: JSON.stringify({ content }) });
    status.innerHTML = '<div class="client-notice good">Saved. Your hosted site will use the new content immediately.</div>';
  } catch (error) {
    status.innerHTML = `<div class="client-notice error">${escapeHtml(error.message)}</div>`;
  } finally { button.disabled = false; }
}

async function uploadImage(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const result = document.querySelector('#image-upload-result');
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    const data = new FormData(form);
    data.set('site', slug);
    const response = await api('/api/client/upload', { method: 'POST', body: data });
    result.innerHTML = `<div class="client-notice good"><strong>Uploaded.</strong><div class="code-box">${escapeHtml(response.url)}</div><button class="client-button secondary small" type="button" data-copy-url>Copy URL</button></div>`;
    result.querySelector('[data-copy-url]').addEventListener('click', () => navigator.clipboard.writeText(response.url));
    form.reset();
  } catch (error) {
    result.innerHTML = `<div class="client-notice error">${escapeHtml(error.message)}</div>`;
  } finally { button.disabled = false; }
}

await getSession();
try {
  const data = await api(`/api/client/site/${encodeURIComponent(slug)}`);
  site = data.site;
  content = data.content || {};
  document.querySelector('#site-name').textContent = site.name;
  const view = document.querySelector('#view-site');
  view.href = site.custom_domain ? `https://${site.custom_domain}` : (site.site_url || `/api/public/site/${encodeURIComponent(site.slug)}`);
  render();
  document.querySelector('#save-site').addEventListener('click', save);
} catch (error) {
  mount.innerHTML = `<div class="client-notice error">${escapeHtml(error.message)}</div>`;
}
