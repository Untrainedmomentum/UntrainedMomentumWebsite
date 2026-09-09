import { json } from '../../_lib/http.js';

export async function onRequestGet(context) {
  return json({
    enabled: Boolean(context.env.STRIPE_SECRET_KEY && context.env.LOCAL_TECH_CALENDAR_URL),
    amount: 9900,
    currency: 'usd',
    label: '$99 first on-site hour'
  });
}
