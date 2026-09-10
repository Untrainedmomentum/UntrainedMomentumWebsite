import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_API_VERSION = '2026-08-26.preview';
const ALLOWED_ORIGINS = new Set([
  'https://untrainedmomentum.com',
  'https://www.untrainedmomentum.com',
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://untrainedmomentum.com';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

function getAdminKey() {
  const modern = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (modern) {
    const parsed = JSON.parse(modern);
    if (parsed.default) return parsed.default as string;
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

function getPublishableKey() {
  const modern = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (modern) {
    const parsed = JSON.parse(modern);
    if (parsed.default) return parsed.default as string;
  }
  return Deno.env.get('SUPABASE_ANON_KEY') ?? '';
}

async function stripeJson(path: string, secretKey: string, body: unknown) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      'Stripe-Version': STRIPE_API_VERSION,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Stripe request failed (${response.status})`);
  }
  return payload;
}

async function stripeForm(path: string, secretKey: string, body: URLSearchParams) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Stripe request failed (${response.status})`);
  }
  return payload;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed.' }, 405);

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
    const stripeMode = (Deno.env.get('STRIPE_MODE') ?? 'test').toLowerCase();

    // Hard safety guard: this endpoint must remain test-only until issue #4 is fully verified.
    if (!stripeKey) return json(req, { error: 'Stripe test mode is not configured yet.' }, 503);
    if (stripeMode !== 'test' || stripeKey.startsWith('sk_live_')) {
      return json(req, { error: 'Live-mode Stripe access is disabled for this pilot.' }, 503);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json(req, { error: 'Not authorized.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const publishableKey = getPublishableKey();
    const adminKey = getAdminKey();
    if (!supabaseUrl || !publishableKey || !adminKey) {
      return json(req, { error: 'Supabase function environment is incomplete.' }, 500);
    }

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = authHeader.slice('Bearer '.length);
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json(req, { error: 'Not authorized.' }, 401);

    const body = await req.json().catch(() => ({}));
    const siteSlug = String(body?.site_slug ?? '').trim();
    if (!siteSlug) return json(req, { error: 'site_slug is required.' }, 400);

    const admin = createClient(supabaseUrl, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, disabled')
      .eq('id', authData.user.id)
      .single();
    if (profileError || !profile || profile.disabled) return json(req, { error: 'Client access is disabled.' }, 403);

    const { data: site, error: siteError } = await admin
      .from('sites')
      .select('id, owner_user_id, slug, name, status, stripe_account_id')
      .eq('slug', siteSlug)
      .eq('owner_user_id', authData.user.id)
      .single();
    if (siteError || !site || site.status !== 'active') return json(req, { error: 'Active site not found.' }, 404);

    let accountId = site.stripe_account_id as string | null;
    if (!accountId) {
      // Accounts v2 + Full Stripe Dashboard + Stripe-owned fees/losses.
      // Country/entity type are intentionally not prefilled so Stripe onboarding can collect them.
      const account = await stripeJson('/v2/core/accounts', stripeKey, {
        contact_email: authData.user.email,
        display_name: site.name,
        dashboard: 'full',
        configuration: { merchant: {} },
        defaults: {
          currency: 'usd',
          responsibilities: {
            fees_collector: 'stripe',
            losses_collector: 'stripe',
          },
          locales: ['en-US'],
        },
        include: ['configuration.merchant', 'identity', 'requirements'],
      });
      accountId = account.id;
      if (!accountId) throw new Error('Stripe did not return a connected account ID.');

      const { error: updateError } = await admin
        .from('sites')
        .update({ stripe_account_id: accountId, updated_at: new Date().toISOString() })
        .eq('id', site.id)
        .eq('owner_user_id', authData.user.id);
      if (updateError) throw updateError;
    }

    const params = new URLSearchParams();
    params.set('account', accountId);
    params.set('components[account_onboarding][enabled]', 'true');
    const accountSession = await stripeForm('/v1/account_sessions', stripeKey, params);

    return json(req, {
      account_id: accountId,
      client_secret: accountSession.client_secret,
      expires_at: accountSession.expires_at ?? null,
      mode: 'test',
    });
  } catch (error) {
    console.error('connect-onboarding error', error);
    return json(req, { error: error instanceof Error ? error.message : 'Unexpected server error.' }, 500);
  }
});
