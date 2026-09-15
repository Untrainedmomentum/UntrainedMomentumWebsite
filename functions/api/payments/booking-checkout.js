import { json, readJson, requestOrigin, errorMessage } from '../../_lib/http.js';
import { stripePost } from '../../_lib/stripe.js';

const SERVICES = {
  remote: {
    amount: 6000,
    name: 'Remote Tech Help — First Hour',
    description: 'Includes the first remote hour. Additional remote time is $60/hour.',
    metadataService: 'remote-tech-first-hour'
  },
  onsite: {
    amount: 9900,
    name: 'On-Site Tech Help — First Hour',
    description: 'Includes the first on-site hour. Additional on-site time is $75/hour. Travel over 30 miles may cost more.',
    metadataService: 'onsite-tech-first-hour'
  }
};

export async function onRequestPost(context) {
  try {
    const input = await readJson(context.request);
    const serviceKey = String(input.service || '').toLowerCase();
    const service = SERVICES[serviceKey];
    if (!service) return json({ error: 'Choose remote or on-site service.' }, 400);
    if (input.accepted !== true) return json({ error: 'Pricing and payment authorization must be accepted before checkout.' }, 400);

    const origin = requestOrigin(context.request);
    const lineItem = {
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: service.amount,
        product_data: {
          name: service.name,
          description: service.description
        }
      }
    };

    const termsVersion = 'direct-tech-booking-2026-09-15-v2';
    const session = await stripePost(context.env, '/checkout/sessions', {
      mode: 'payment',
      integration_identifier: 'umdirect',
      line_items: [lineItem],
      success_url: `${origin}/book-tech-help.html?paid=1&service=${serviceKey}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/book-tech-help.html?payment=cancelled&service=${serviceKey}`,
      customer_creation: 'always',
      payment_intent_data: {
        setup_future_usage: 'off_session',
        metadata: { service: service.metadataService, terms_version: termsVersion }
      },
      metadata: {
        service: service.metadataService,
        service_key: serviceKey,
        booking_amount: String(service.amount),
        pricing_authorized: 'true',
        calendar_time_selected: 'true',
        terms_version: termsVersion
      },
      custom_text: {
        submit: {
          message: `Deposit includes the first hour. The remaining balance is charged when service is completed or within 24 hours at ${serviceKey === 'remote' ? '$60/hour' : '$75/hour'} under the authorization accepted on the booking page.${serviceKey === 'onsite' ? ' Travel over 30 miles may cost more.' : ''}`
        }
      }
    });
    return json({ ok: true, url: session.url, sessionId: session.id });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}
