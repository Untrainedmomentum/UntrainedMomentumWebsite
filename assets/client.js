const SUPABASE_URL = 'https://tamyxenqhgstjorvsiym.supabase.co';
const SUPABASE_KEY = 'sb_publishable_OUNkMhrs4TN2N8m6ABiLuQ_0kFl0Esd';
const SESSION_KEY = 'um-client-supabase-session-v1';
const LOGIN_URL = '/client/login.html';

function parseJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function readStoredSession() {
  try { return parseJson(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}

function storeSession(payload) {
  if (!payload?.access_token || !payload?.refresh_token) return null;
  const session = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    token_type: payload.token_type || 'bearer',
    expires_at: Date.now() + Math.max(30, Number(payload.expires_in || 3600)) * 1000,
    user: payload.user || null
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function consumeAuthRedirect() {
  const hash = String(location.hash || '').replace(/^#/, '');
  if (!hash) return false;

  const params = new URLSearchParams(hash);
  const errorMessage = params.get('error_description') || params.get('error');
  if (errorMessage) {
    history.replaceState({}, document.title, `${location.pathname}${location.search}`);
    throw new Error(errorMessage);
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return false;

  storeSession({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: params.get('token_type') || 'bearer',
    expires_in: Number(params.get('expires_in') || 3600)
  });
  history.replaceState({}, document.title, `${location.pathname}${location.search}`);
  return true;
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

async function responseData(response) {
  const text = await response.text();
  const data = parseJson(text);
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data ?? text;
}

async function authRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  return responseData(response);
}

export async function signUpClient({ email, password, fullName = '' }) {
  const redirect = encodeURIComponent('https://untrainedmomentum.com/client/login.html?confirmed=1');
  const data = await authRequest(`/signup?redirect_to=${redirect}`, {
    method: 'POST',
    body: JSON.stringify({ email: String(email || '').trim(), password, data: { full_name: String(fullName || '').trim() } })
  });
  if (data?.access_token) storeSession(data);
  return data;
}

export async function signInClient(email, password) {
  const data = await authRequest('/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email: String(email || '').trim(), password })
  });
  storeSession(data);
  return data;
}

async function refreshSession() {
  const current = readStoredSession();
  if (!current?.refresh_token) throw Object.assign(new Error('Please sign in again.'), { status: 401 });
  try {
    const data = await authRequest('/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: current.refresh_token })
    });
    return storeSession(data);
  } catch (error) {
    clearSession();
    throw error;
  }
}

export async function getAccessToken() {
  let session = readStoredSession();
  if (!session?.access_token) throw Object.assign(new Error('Please sign in.'), { status: 401 });
  if (!session.expires_at || session.expires_at - Date.now() < 120000) session = await refreshSession();
  return session.access_token;
}

export async function signOutClient() {
  const session = readStoredSession();
  try {
    if (session?.access_token) {
      await authRequest('/logout', { method: 'POST', headers: { authorization: `Bearer ${session.access_token}` } });
    }
  } catch { /* local sign-out still succeeds */ }
  clearSession();
}

export async function supabaseRest(path, options = {}, retry = true) {
  const token = await getAccessToken();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${token}`,
      accept: 'application/json',
      ...(options.body && !(options.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  if (response.status === 401 && retry) {
    await refreshSession();
    return supabaseRest(path, options, false);
  }
  return responseData(response);
}

export async function publicSupabaseRest(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, accept: 'application/json' }
  });
  return responseData(response);
}

export async function uploadSiteImage(siteSlug, file) {
  if (!(file instanceof File)) throw new Error('Choose an image first.');
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
  if (!allowed.includes(file.type)) throw new Error('Please upload a JPG, PNG, WebP, GIF, or AVIF image.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Images must be 8 MB or smaller.');
  const session = await getSession();
  const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
  const objectPath = `${session.user.id}/${siteSlug}/${crypto.randomUUID()}.${ext}`;
  const token = await getAccessToken();
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/site-media/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${token}`,
      'content-type': file.type,
      'x-upsert': 'false'
    },
    body: file
  });
  await responseData(response);
  return `${SUPABASE_URL}/storage/v1/object/public/site-media/${objectPath}`;
}

// Kept for platform endpoints that are still Cloudflare-backed (Stripe, booking, etc.).
export async function api(path, options = {}) {
  const headers = { ...(options.body && !(options.body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) };
  try {
    const token = await getAccessToken();
    headers.authorization ||= `Bearer ${token}`;
  } catch { /* public endpoint or signed-out request */ }
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
  return responseData(response);
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export async function getSession() {
  try {
    const token = await getAccessToken();
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${token}` }
    });
    const authUser = await responseData(authResponse);
    const profiles = await supabaseRest(`profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,email,full_name,role,disabled`);
    const profile = Array.isArray(profiles) ? profiles[0] : null;
    if (!profile || profile.disabled) {
      await signOutClient();
      throw Object.assign(new Error('This email does not have an active Untrained Momentum client invitation.'), { status: 403 });
    }
    return {
      authUser,
      user: {
        id: profile.id,
        email: profile.email || authUser.email,
        name: profile.full_name || authUser.email?.split('@')[0] || 'Client',
        role: profile.role,
        disabled: profile.disabled
      }
    };
  } catch (error) {
    if (error.status === 401) clearSession();
    throw error;
  }
}

function statusClass(site) {
  if (site.stripe_charges_enabled) return ['good', 'Payments ready'];
  if (site.stripe_account_id) return ['warn', 'Stripe setup incomplete'];
  return ['', site.site_type === 'ecommerce' ? 'Payments not connected' : 'Website active'];
}

function siteUrl(site) {
  if (site.custom_domain) return `https://${site.custom_domain}`;
  return site.site_url || `/client/preview.html?site=${encodeURIComponent(site.slug)}`;
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
      <a class="client-button secondary small" href="/client/preview.html?site=${encodeURIComponent(site.slug)}" target="_blank" rel="noopener">Preview content</a>
      <a class="client-button secondary small" href="${escapeHtml(siteUrl(site))}" target="_blank" rel="noopener">View live site</a>
    </div>
  </article>`;
}

export async function loadDashboard() {
  const mount = document.querySelector('#site-list');
  if (!mount) return;
  const session = await getSession();
  document.querySelector('[data-user-name]').textContent = session.user.name;
  if (session.user.role === 'admin') {
    const adminMount = document.querySelector('#admin-mount');
    if (adminMount) adminMount.innerHTML = '<section class="client-card admin-launch-card"><div><p class="client-eyebrow">Owner workspace</p><h2>Customer & work tracker</h2><p>Manage customers, requests, hours, billing, and every hosted website.</p></div><a class="client-button dark" href="/client/admin.html">Open tracker</a></section>';
    document.querySelector('[data-client-requests]')?.setAttribute('href', '/client/admin.html');
  }
  const siteFilter = session.user.role === 'admin' ? '' : `owner_user_id=eq.${encodeURIComponent(session.user.id)}&`;
  const sites = await supabaseRest(`sites?${siteFilter}select=id,slug,name,site_type,site_url,custom_domain,stripe_account_id,stripe_details_submitted,stripe_charges_enabled,builder_enabled,status,updated_at&order=created_at.asc`);
  mount.innerHTML = sites.length ? sites.map(renderSite).join('') : '<div class="client-card"><h2>No sites yet</h2><p>Your websites will appear here after Untrained Momentum assigns one to your account.</p></div>';
}

async function initDashboard() {
  await loadDashboard();
  document.querySelector('[data-logout]')?.addEventListener('click', async () => {
    await signOutClient();
    location.href = LOGIN_URL;
  });
}

if (document.body.dataset.clientPage === 'dashboard') initDashboard().catch((error) => {
  if (error.status === 401) {
    location.href = LOGIN_URL;
    return;
  }
  const mount = document.querySelector('#site-list');
  if (mount) mount.innerHTML = `<div class="client-notice error">${escapeHtml(error.message)}</div>`;
});
