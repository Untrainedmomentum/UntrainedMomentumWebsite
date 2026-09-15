import { json, errorMessage } from '../../_lib/http.js';
import { stripeGet } from '../../_lib/stripe.js';

const SERVICES = {
  'remote-tech-first-hour': { amount: 6000, key: 'remote' },
  'onsite-tech-first-hour': { amount: 9900, key: 'onsite' }
};

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const sessionId = String(url.searchParams.get('session_id') || '');
    if (!/^cs_/.test(sessionId)) return json({ paid: false, error: 'Invalid checkout session.' }, 400);
    const session = await stripeGet(context.env, `/checkout/sessions/${encodeURIComponent(sessionId)}`);
    const service = SERVICES[session.metadata?.service];
    const paid = Boolean(service) && session.payment_status === 'paid' && Number(session.amount_total) === service.amount;
    if (!paid) return json({ paid: false }, 402);
    if (context.env.DB) {
      const now = new Date().toISOString();
      const email = session.customer_details?.email || session.customer_email || null;
      await context.env.DB.prepare(`
        INSERT INTO booking_payments (id, stripe_checkout_session_id, service, customer_email, amount_total, currency, payment_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'paid', ?, ?)
        ON CONFLICT(stripe_checkout_session_id) DO UPDATE SET customer_email=excluded.customer_email, payment_status='paid', updated_at=excluded.updated_at
      `).bind(crypto.randomUUID(), session.id, session.metadata.service, email, session.amount_total, session.currency || 'usd', now, now).run();
    }

    return json({ paid: true, service: service.key });
  } catch (error) {
    return json({ paid: false, error: errorMessage(error) }, 500);
  }
}
