import { json } from '../../_lib/http.js';

export async function onRequestGet(context) {
  return json({
    enabled: Boolean(context.env.STRIPE_SECRET_KEY && context.env.LOCAL_TECH_CALENDAR_URL),
    calendarUrl: context.env.LOCAL_TECH_CALENDAR_URL || null,
    currency: 'usd',
    services: {
      remote: { amount: 6000, label: '$60 remote deposit', included: 'First remote hour', additionalRate: '$60/hour' },
      onsite: { amount: 9900, label: '$99 on-site deposit', included: 'First on-site hour', additionalRate: '$75/hour' }
    }
  });
}
