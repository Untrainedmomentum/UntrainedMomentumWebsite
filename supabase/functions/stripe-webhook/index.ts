import Stripe from 'npm:stripe';
import { createClient } from 'npm:@supabase/supabase-js@2';

function getAdminKey() {
  const modern = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (modern) {
    const parsed = JSON.parse(modern);
    if (parsed.default) return parsed.default as string;
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

function paymentIntentId(value: unknown) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && 'id' in value) return String((value as { id?: unknown }).id ?? '') || null;
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
  const stripeMode = (Deno.env.get('STRIPE_MODE') ?? 'test').toLowerCase();

  // Hard pilot guard: never process live events until issue #4 is fully verified.
  if (!stripeKey || !webhookSecret) return new Response('Stripe test webhook is not configured', { status: 503 });
  if (stripeMode !== 'test' || stripeKey.startsWith('sk_live_')) {
    return new Response('Live-mode Stripe access is disabled for this pilot', { status: 503 });
  }

  const signature = req.headers.get('stripe-signature') ?? '';
  const rawBody = await req.text();
  const stripe = new Stripe(stripeKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error('Invalid Stripe webhook signature', error);
    return new Response('Invalid signature', { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const adminKey = getAdminKey();
  if (!supabaseUrl || !adminKey) return new Response('Supabase function environment is incomplete', { status: 500 });
  const admin = createClient(supabaseUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded' ||
      event.type === 'checkout.session.async_payment_failed' ||
      event.type === 'checkout.session.expired'
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata ?? {};
      const connectedAccountId = (event as Stripe.Event & { account?: string }).account ?? null;
      const kind = metadata.kind ?? 'client_order';

      if (kind === 'local_tech_first_hour') {
        // Guard against accidental pricing drift: only the verified $99 first-hour flow belongs here.
        if (session.amount_total !== 9900) {
          console.error('Rejected unexpected local-tech amount', session.id, session.amount_total);
          return new Response('Unexpected local-tech amount', { status: 400 });
        }

        const { error } = await admin.from('booking_payments').upsert({
          stripe_checkout_session_id: session.id,
          service: 'local_tech_first_hour',
          customer_email: session.customer_details?.email ?? session.customer_email ?? null,
          amount_total: session.amount_total,
          currency: session.currency ?? 'usd',
          payment_status: session.payment_status ?? event.type,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'stripe_checkout_session_id' });
        if (error) throw error;
      } else {
        let siteId = metadata.site_id ?? null;
        if (!siteId && connectedAccountId) {
          const { data: site } = await admin
            .from('sites')
            .select('id')
            .eq('stripe_account_id', connectedAccountId)
            .maybeSingle();
          siteId = site?.id ?? null;
        }

        if (!siteId) {
          console.error('Checkout session has no resolvable site', session.id, connectedAccountId);
          return new Response('Unresolved site', { status: 400 });
        }

        const platformFeeAmount = metadata.platform_fee_amount
          ? Number.parseInt(metadata.platform_fee_amount, 10)
          : null;

        const { error } = await admin.from('orders').upsert({
          site_id: siteId,
          stripe_account_id: connectedAccountId,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: paymentIntentId(session.payment_intent),
          customer_email: session.customer_details?.email ?? session.customer_email ?? null,
          amount_total: session.amount_total,
          currency: session.currency,
          platform_fee_amount: Number.isFinite(platformFeeAmount) ? platformFeeAmount : null,
          status: session.payment_status ?? event.type,
          payload: {
            event_id: event.id,
            event_type: event.type,
            mode: 'test',
          },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'stripe_checkout_session_id' });
        if (error) throw error;
      }
    }

    return Response.json({ received: true, mode: 'test' });
  } catch (error) {
    console.error('Stripe webhook processing error', event.id, error);
    return new Response('Webhook processing failed', { status: 500 });
  }
});
