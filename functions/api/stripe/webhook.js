import { json, errorMessage } from '../../_lib/http.js';
import { verifyStripeWebhook } from '../../_lib/stripe.js';

export async function onRequestPost(context) {
  try {
    const rawBody = await context.request.text();
    const signature = context.request.headers.get('stripe-signature');
    const valid = await verifyStripeWebhook(rawBody, signature, context.env.STRIPE_WEBHOOK_SECRET);
    if (!valid) return json({ error: 'Invalid Stripe signature.' }, 400);
    const event = JSON.parse(rawBody);
    const object = event.data?.object || {};
    const now = new Date().toISOString();

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      if (object.metadata?.service === 'local-tech-first-hour' && context.env.DB) {
        await context.env.DB.prepare(`
          INSERT INTO booking_payments (id, stripe_checkout_session_id, service, customer_email, amount_total, currency, payment_status, created_at, updated_at)
          VALUES (?, ?, 'local-tech-first-hour', ?, ?, ?, ?, ?, ?)
          ON CONFLICT(stripe_checkout_session_id) DO UPDATE SET payment_status=excluded.payment_status, customer_email=excluded.customer_email, updated_at=excluded.updated_at
        `).bind(
          crypto.randomUUID(), object.id, object.customer_details?.email || object.customer_email || null,
          Number(object.amount_total || 0), object.currency || 'usd', object.payment_status || 'paid', now, now
        ).run();
      }

      if (event.account && context.env.DB) {
        const site = await context.env.DB.prepare('SELECT id, platform_fee_bps FROM sites WHERE stripe_account_id = ? LIMIT 1')
          .bind(event.account).first();
        if (site) {
          const amount = Number(object.amount_total || 0);
          const storedFee = Number(object.metadata?.um_platform_fee_amount);
          const fee = Number.isFinite(storedFee)
            ? Math.max(0, Math.round(storedFee))
            : Math.max(0, Math.round(amount * Number(site.platform_fee_bps || 0) / 10000));
          await context.env.DB.prepare(`
            INSERT INTO orders (id, site_id, stripe_account_id, stripe_checkout_session_id, stripe_payment_intent_id,
              customer_email, amount_total, currency, platform_fee_amount, status, payload_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(stripe_checkout_session_id) DO UPDATE SET status=excluded.status, platform_fee_amount=excluded.platform_fee_amount, payload_json=excluded.payload_json, updated_at=excluded.updated_at
          `).bind(
            crypto.randomUUID(), site.id, event.account, object.id, object.payment_intent || null,
            object.customer_details?.email || object.customer_email || null, amount, object.currency || 'usd', fee,
            object.payment_status || 'paid', JSON.stringify({ eventId: event.id, mode: object.mode }), now, now
          ).run();
        }
      }
    }

    if (event.type === 'account.updated' && context.env.DB && object.id) {
      await context.env.DB.prepare(`
        UPDATE sites SET stripe_charges_enabled = ?, stripe_details_submitted = ?, updated_at = ? WHERE stripe_account_id = ?
      `).bind(object.charges_enabled ? 1 : 0, object.details_submitted ? 1 : 0, now, object.id).run();
    }

    return json({ received: true });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}
