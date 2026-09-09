import { api, escapeHtml, getSession } from '/assets/client.js';

const slug = new URL(location.href).searchParams.get('site');
if (!slug) location.href = '/client/index.html';
const session = await getSession();
if (session.user.role !== 'admin') location.href = '/client/index.html';
const form = document.querySelector('#settings-form');
const status = document.querySelector('#settings-status');
document.querySelector('#edit-site').href = `/client/editor.html?site=${encodeURIComponent(slug)}`;

try {
  const data = await api(`/api/client/site/${encodeURIComponent(slug)}`);
  const site = data.site;
  document.querySelector('#site-name').textContent = `${site.name} settings`;
  form.elements.customDomain.value = site.custom_domain || '';
  form.elements.siteUrl.value = site.site_url || '';
  form.elements.platformFeePercent.value = (Number(site.platform_fee_bps || 0) / 100).toFixed(1);
  form.elements.status.value = site.status || 'active';
  form.elements.builderEnabled.checked = Boolean(site.builder_enabled);
} catch (error) {
  status.innerHTML = `<div class="client-notice error">${escapeHtml(error.message)}</div>`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  status.textContent = '';
  try {
    const values = Object.fromEntries(new FormData(form));
    values.builderEnabled = form.elements.builderEnabled.checked;
    await api(`/api/admin/site/${encodeURIComponent(slug)}`, { method: 'PUT', body: JSON.stringify(values) });
    status.innerHTML = '<div class="client-notice good">Settings saved.</div>';
  } catch (error) {
    status.innerHTML = `<div class="client-notice error">${escapeHtml(error.message)}</div>`;
  } finally {
    button.disabled = false;
  }
});
