export async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: { ...(options.body && !(options.body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) }
  });
  let data;
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export async function getSession() {
  try { return await api('/api/auth/session'); }
  catch (error) {
    if (error.status === 401) location.href = '/client/login.html';
    throw error;
  }
}

function statusClass(site) {
  if (site.stripe_charges_enabled) return ['good', 'Payments ready'];
  if (site.stripe_account_id) return ['warn', 'Stripe setup incomplete'];
  return ['', 'Stripe not connected'];
}

function siteUrl(site) {
  if (site.custom_domain) return `https://${site.custom_domain}`;
  return site.site_url || `/api/public/site/${encodeURIComponent(site.slug)}`;
}

function renderSite(site) {
  const [status, label] = statusClass(site);
  return `<article class="client-card" data-site-card="${escapeHtml(site.slug)}">
    <p class="client-eyebrow">${escapeHtml(site.site_type || 'Website')}</p>
    <h2>${escapeHtml(site.name)}</h2>
    <p><span class="status-pill ${status}">${escapeHtml(label)}</span></p>
    <p class="client-muted">${site.custom_domain ? escapeHtml(site.custom_domain) : 'Custom domain not attached yet'}</p>
    <div class="client-card-actions">
      <a class="client-button small" href="/client/editor.html?site=${encodeURIComponent(site.slug)}">Edit content</a>
      ${site.builder_enabled ? `<a class="client-button secondary small" href="/client/builder.html?site=${encodeURIComponent(site.slug)}">Visual builder</a>` : ''}
      <a class="client-button secondary small" href="${escapeHtml(siteUrl(site))}" target="_blank" rel="noopener">View site</a>
      <button class="client-button dark small" type="button" data-stripe-connect="${escapeHtml(site.slug)}">${site.stripe_account_id ? 'Resume Stripe setup' : 'Connect Stripe'}</button>
    </div>
  </article>`;
}

async function connectStripe(slug, button) {
  button.disabled = true;
  const original = button.textContent;
  button.textContent = 'Opening Stripe…';
  try {
    const data = await api('/api/stripe/connect/start', { method: 'POST', body: JSON.stringify({ site: slug }) });
    location.href = data.url;
  } catch (error) {
    alert(error.message);
    button.disabled = false;
    button.textContent = original;
  }
}

async function refreshStripe(slug) {
  try { await api('/api/stripe/connect/status', { method: 'POST', body: JSON.stringify({ site: slug }) }); }
  catch (error) { console.warn(error); }
}

function adminPanel() {
  return `<section class="client-panel" id="admin-panel">
    <div class="client-panel-header"><div><p class="client-eyebrow">Admin</p><h2>Add a website client</h2></div></div>
    <form class="client-form" id="new-client-form">
      <div class="client-form-row"><label class="client-field"><span>Client name</span><input name="name" required></label><label class="client-field"><span>Client email</span><input name="email" type="email" required></label></div>
      <div class="client-form-row"><label class="client-field"><span>Business / site name</span><input name="siteName" required></label><label class="client-field"><span>Site type</span><select name="siteType"><option value="service">Service business</option><option value="ecommerce">Online store</option><option value="restaurant">Restaurant / menu</option><option value="portfolio">Portfolio</option><option value="other">Other</option></select></label></div>
      <div class="client-form-row"><label class="client-field"><span>Custom domain (optional)</span><input name="customDomain" placeholder="example.com"></label><label class="client-field"><span>Platform transaction fee %</span><input name="platformFeePercent" type="number" min="0" max="50" step="0.1" value="0"><small class="client-muted">This is your Untrained Momentum application fee, separate from Stripe's fee.</small></label></div>
      <label class="client-field"><span><input name="builderEnabled" type="checkbox"> Give this client the DIY visual builder</span></label>
      <button class="client-button" type="submit">Create client + site</button>
      <div id="new-client-result"></div>
    </form>
  </section>`;
}

async function createClient(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const result = document.querySelector('#new-client-result');
  button.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(form));
    values.builderEnabled = form.elements.builderEnabled.checked;
    const data = await api('/api/admin/clients', { method: 'POST', body: JSON.stringify(values) });
    result.innerHTML = `<div class="client-notice good"><strong>Client created.</strong><br>Email: ${escapeHtml(data.client.email)}${data.temporaryPassword ? `<br>Temporary password: <code>${escapeHtml(data.temporaryPassword)}</code><br><small>Copy this now. It is not stored in readable form.</small>` : ''}</div>`;
    form.reset();
    await loadDashboard();
  } catch (error) {
    result.innerHTML = `<div class="client-notice error">${escapeHtml(error.message)}</div>`;
  } finally { button.disabled = false; }
}

export async function loadDashboard() {
  const mount = document.querySelector('#site-list');
  if (!mount) return;
  const data = await api('/api/client/sites');
  document.querySelector('[data-user-name]').textContent = data.user.name;
  mount.innerHTML = data.sites.length ? data.sites.map(renderSite).join('') : '<div class="client-card"><h2>No sites yet</h2><p>Your websites will appear here.</p></div>';
  mount.querySelectorAll('[data-stripe-connect]').forEach((button) => button.addEventListener('click', () => connectStripe(button.dataset.stripeConnect, button)));
  const adminMount = document.querySelector('#admin-mount');
  if (data.user.role === 'admin' && adminMount && !document.querySelector('#admin-panel')) {
    adminMount.innerHTML = adminPanel();
    document.querySelector('#new-client-form').addEventListener('submit', createClient);
  }
}

async function initDashboard() {
  await getSession();
  const url = new URL(location.href);
  if (url.searchParams.get('stripe') === 'return' && url.searchParams.get('site')) await refreshStripe(url.searchParams.get('site'));
  await loadDashboard();
  document.querySelector('[data-logout]')?.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.href = '/client/login.html';
  });
}

if (document.body.dataset.clientPage === 'dashboard') initDashboard().catch((error) => {
  const mount = document.querySelector('#site-list');
  if (mount) mount.innerHTML = `<div class="client-notice error">${escapeHtml(error.message)}</div>`;
});
