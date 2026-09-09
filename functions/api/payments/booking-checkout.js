import { json, requestOrigin, errorMessage } from '../../_lib/http.js';
import { stripePost } from '../../_lib/stripe.js';

export async function onRequestPost(context) {
  try {
    const origin = requestOrigin(context.request);
    const lineItem = context.env.STRIPE_BOOKING_PRICE_ID
      ? { price: context.env.STRIPE_BOOKING_PRICE_ID, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: 9900,
            product_data: {
              name: 'Local Tech Help — First On-Site Hour',
              description: 'First on-site hour with Untrained Momentum. Additional on-site time is $75/hour when approved.'
            }
          }
        };

    const session = await stripePost(context.env, '/checkout/sessions', {
      mode: 'payment',
      line_items: [lineItem],
      success_url: `${origin}/book-smart-home.html?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/book-smart-home.html?payment=cancelled`,
      customer_creation: 'always',
      metadata: { service: 'local-tech-first-hour', booking_amount: '9900' },
      payment_intent_data: { metadata: { service: 'local-tech-first-hour' } }
    });
    return json({ ok: true, url: session.url, sessionId: session.id });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}
