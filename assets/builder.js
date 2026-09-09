import { api, escapeHtml, getSession } from '/assets/client.js';

const slug = new URL(location.href).searchParams.get('site');
if (!slug) location.href = '/client/index.html';
await getSession();
const status = document.querySelector('#builder-status');

try {
  const data = await api(`/api/client/site/${encodeURIComponent(slug)}`);
  const { site } = data;
  const content = data.content || {};
  if (!site.builder_enabled) throw new Error('The visual builder is not enabled for this website.');
  document.querySelector('#site-name').textContent = site.name;
  document.querySelector('#structured-editor').href = `/client/editor.html?site=${encodeURIComponent(slug)}`;
  document.querySelector('#view-site').href = site.custom_domain ? `https://${site.custom_domain}` : (site.site_url || `/api/public/site/${encodeURIComponent(slug)}`);

  if (!window.grapesjs) throw new Error('The visual builder could not load.');
  const editor = window.grapesjs.init({
    container: '#gjs', height: '72vh', storageManager: false,
    fromElement: false,
    components: content.builder?.html || `<main><section style="padding:80px 24px;background:#f4f1eb"><div style="max-width:1100px;margin:auto"><p style="text-transform:uppercase;letter-spacing:.12em;font-weight:700">Welcome</p><h1 style="font-size:clamp(42px,8vw,88px);line-height:1;margin:12px 0">${escapeHtml(content.businessName || site.name)}</h1><p style="font-size:20px;max-width:700px">Click this text to replace it, or drag sections in from the Blocks panel.</p></div></section><div data-um-services="true"><p style="padding:30px;text-align:center">Services module — populated from Content Editor</p></div><div data-um-contact="true"><p style="padding:30px;text-align:center">Contact module — populated from Content Editor</p></div></main>`,
    style: content.builder?.css || '',
    blockManager: { appendTo: undefined },
    canvas: { styles: ['https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap'] }
  });

  const blocks = editor.BlockManager;
  blocks.add('um-hero', { label: 'Hero', category: 'Sections', content: '<section style="padding:90px 24px;background:#f4f1eb"><div style="max-width:1100px;margin:auto"><p style="text-transform:uppercase;letter-spacing:.12em;font-weight:700">Small headline</p><h1 style="font-size:clamp(44px,8vw,92px);line-height:1;margin:12px 0">Your main message</h1><p style="font-size:20px;max-width:720px">Explain what you do and who you help.</p><a href="#contact" style="display:inline-block;margin-top:18px;padding:12px 20px;border-radius:999px;background:#171716;color:#fff;text-decoration:none">Contact us</a></div></section>' });
  blocks.add('um-text', { label: 'Text section', category: 'Sections', content: '<section style="padding:60px 24px"><div style="max-width:900px;margin:auto"><h2>Section heading</h2><p>Add your text here.</p></div></section>' });
  blocks.add('um-columns', { label: '2 columns', category: 'Sections', content: '<section style="padding:60px 24px"><div style="max-width:1100px;margin:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:30px"><div><h2>Left column</h2><p>Add text here.</p></div><div><h2>Right column</h2><p>Add text here.</p></div></div></section>' });
  blocks.add('um-image', { label: 'Image', category: 'Basic', content: '<img src="https://placehold.co/1200x700?text=Replace+Image" alt="Replace this image" style="width:100%;height:auto">' });
  blocks.add('um-button', { label: 'Button', category: 'Basic', content: '<a href="#" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#171716;color:#fff;text-decoration:none">Button text</a>' });
  blocks.add('um-services', { label: 'Services', category: 'Live content', content: '<div data-um-services="true" style="padding:30px;text-align:center;border:2px dashed #bbb">Services — managed in Content Editor</div>' });
  blocks.add('um-projects', { label: 'Projects', category: 'Live content', content: '<div data-um-projects="true" style="padding:30px;text-align:center;border:2px dashed #bbb">Projects — managed in Content Editor</div>' });
  blocks.add('um-menu', { label: 'Menu', category: 'Live content', content: '<div data-um-menu="true" style="padding:30px;text-align:center;border:2px dashed #bbb">Menu — managed in Content Editor</div>' });
  blocks.add('um-products', { label: 'Products + cart', category: 'Live content', content: '<div data-um-products="true" style="padding:30px;text-align:center;border:2px dashed #bbb">Products + cart — managed in Content Editor</div>' });
  blocks.add('um-gallery', { label: 'Gallery', category: 'Live content', content: '<div data-um-gallery="true" style="padding:30px;text-align:center;border:2px dashed #bbb">Gallery — managed in Content Editor</div>' });
  blocks.add('um-contact', { label: 'Contact', category: 'Live content', content: '<div data-um-contact="true" style="padding:30px;text-align:center;border:2px dashed #bbb">Contact — managed in Content Editor</div>' });

  document.querySelector('#save-builder').addEventListener('click', async () => {
    const button = document.querySelector('#save-builder'); button.disabled = true; status.textContent = '';
    try {
      content.builder = { html: editor.getHtml(), css: editor.getCss() };
      await api(`/api/client/site/${encodeURIComponent(slug)}`, { method: 'PUT', body: JSON.stringify({ content }) });
      status.innerHTML = '<div class="client-notice good">Saved and published.</div>';
    } catch (error) { status.innerHTML = `<div class="client-notice error">${escapeHtml(error.message)}</div>`; }
    finally { button.disabled = false; }
  });
} catch (error) {
  document.querySelector('#gjs').innerHTML = `<div class="client-notice error">${escapeHtml(error.message)}</div>`;
}
