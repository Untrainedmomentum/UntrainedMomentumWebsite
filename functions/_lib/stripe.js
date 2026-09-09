const encoder = new TextEncoder();

function append(params, key, value) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => append(params, `${key}[${index}]`, item));
    return;
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([childKey, childValue]) => append(params, key ? `${key}[${childKey}]` : childKey, childValue));
    return;
  }
  params.append(key, String(value));
}

function formBody(input = {}) {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => append(params, key, value));
  return params;
}

export async function stripeRequest(env, path, options = {}) {
  if (!env.STRIPE_SECRET_KEY) throw new Error('Stripe is not configured yet');
  const method = options.method || 'POST';
  const headers = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
  const apiVersion = options.apiVersion || env.STRIPE_API_VERSION;
  if (apiVersion) headers['Stripe-Version'] = apiVersion;
  if (options.connectedAccount) headers['Stripe-Account'] = options.connectedAccount;
  let body;
  if (method !== 'GET' && method !== 'HEAD') {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    body = formBody(options.params || {});
  }
  const response = await fetch(`https://api.stripe.com/v1${path}`, { method, headers, body });
  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || `Stripe request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.stripe = payload?.error;
    throw error;
  }
  return payload;
}

export function stripePost(env, path, params, connectedAccount = null) {
  return stripeRequest(env, path, { method: 'POST', params, connectedAccount });
}

export function stripePostVersioned(env, path, params, apiVersion, connectedAccount = null) {
  return stripeRequest(env, path, { method: 'POST', params, apiVersion, connectedAccount });
}

export function stripeGet(env, path, connectedAccount = null) {
  return stripeRequest(env, path, { method: 'GET', connectedAccount });
}

function hex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeHexEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyStripeWebhook(rawBody, signatureHeader, secret, toleranceSeconds = 300) {
  if (!secret) throw new Error('Stripe webhook secret is not configured');
  const pieces = String(signatureHeader || '').split(',');
  const timestamp = pieces.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = pieces.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!timestamp || !signatures.length) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = encoder.encode(`${timestamp}.${rawBody}`);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, signed));
  const expected = hex(digest);
  return signatures.some((signature) => timingSafeHexEqual(expected, signature));
}
