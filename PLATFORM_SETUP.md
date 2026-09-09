# Untrained Momentum Client Website Platform

This branch adds the foundation for Untrained Momentum to host and manage client websites without requiring Shopify, Wix, or Squarespace.

## What is included

- Client login and secure server-side sessions
- Admin client/site creation
- Structured client editor for business details, services, projects, menus, products, galleries, and images
- Optional branded DIY visual builder using GrapesJS
- Cloudflare D1 data storage
- Cloudflare R2 image storage
- Custom-domain host routing for client sites
- Custom product/cart checkout using Stripe Checkout
- Stripe Connect onboarding for client merchants
- Per-site Untrained Momentum application fees on connected-account transactions
- Order logging for connected stores
- $99 local-tech first-hour payment before the appointment calendar is revealed
- Stripe webhook validation and payment/account-status updates

## Cloudflare setup required before enabling production features

Create a D1 database for the platform and run `schema.sql` against it. Bind the database to the existing Cloudflare Pages project using the binding name `DB`.

Create an R2 bucket for client media and bind it to the same Pages project using the binding name `MEDIA`.

Add the following Pages environment variables/secrets:

| Name | Type | Purpose |
| --- | --- | --- |
| `BOOTSTRAP_TOKEN` | Secret | One-time protection for `/client/setup.html` before the first admin is created |
| `STRIPE_SECRET_KEY` | Secret | Untrained Momentum Stripe platform API secret |
| `STRIPE_WEBHOOK_SECRET` | Secret | Signing secret for the Stripe webhook endpoint |
| `LOCAL_TECH_CALENDAR_URL` | Variable/secret | Google appointment schedule URL revealed only after a verified $99 payment |
| `STRIPE_BOOKING_PRICE_ID` | Optional variable | Stripe Price ID for the $99 first-hour booking product; if omitted the server creates the Checkout line item from the fixed $99 amount |
| `STRIPE_API_VERSION` | Optional variable | Only set when intentionally pinning a Stripe API version |
| `CONNECT_DEFAULT_COUNTRY` | Variable | Default connected-account country; use `US` for the initial U.S. service |

Current local-tech calendar URL to use for `LOCAL_TECH_CALENDAR_URL`:

`https://calendar.google.com/calendar/appointments/schedules/AcZssZ2xQsIL1iYdfPe73afv1n9JkLJJA0WixbdMLWzZlGinBDGOLn-mO3w6ErmR3uqilIP47LQxWRVZ?gv=true`

Until `STRIPE_SECRET_KEY` and `LOCAL_TECH_CALENDAR_URL` are both configured, the booking page intentionally falls back to the existing calendar so a deployment cannot accidentally block current bookings.

## Initial administrator

After D1 and `BOOTSTRAP_TOKEN` are configured, open `/client/setup.html` once and create the Untrained Momentum administrator account. The bootstrap endpoint refuses to create another administrator after the first admin exists.

Clients then sign in at `/client/login.html` and use `/client/index.html` as their dashboard.

## Stripe platform setup

Use the Untrained Momentum Stripe account as the Connect platform. Client businesses connect their own Stripe accounts from their dashboard. The current implementation creates Express connected accounts and sends the client through Stripe-hosted onboarding.

Store checkout uses direct charges on the connected account. Product names and prices are loaded from D1 on the server, so a shopper cannot alter the authoritative price in browser JavaScript. When a site has a platform fee configured, checkout sets a Stripe Connect `application_fee_amount` on the PaymentIntent. This is the Untrained Momentum platform fee and should be described in client agreements as a platform/commerce fee rather than as a consumer credit-card surcharge.

The `$99` local-tech booking payment is different: it is a payment directly to the Untrained Momentum platform account, not to a connected client account.

### Stripe webhook

Create a webhook endpoint at:

`https://untrainedmomentum.com/api/stripe/webhook`

Subscribe to the events used by this code:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `account.updated`

Make sure connected-account events are enabled for the endpoint because client-store checkout occurs on connected accounts. Save the webhook signing secret as `STRIPE_WEBHOOK_SECRET` in Cloudflare.

## Client sites and domains

Each site record has a `custom_domain`. Add that hostname as a custom domain on the same Cloudflare Pages project and then save the same hostname in the site's admin settings. The root Pages middleware reads the request hostname and loads the matching client site from D1.

The client-facing editor does not expose GitHub, Cloudflare, or code. It edits only the content modules Untrained Momentum has chosen to expose. Sites built by Untrained Momentum can therefore remain custom HTML/CSS while still using the same structured content and commerce backend.

The optional visual builder is controlled per site by `builder_enabled`. Leave it off for clients receiving a custom-built site; enable it only for the DIY plan.

## Security design

Passwords are salted and hashed with PBKDF2-SHA256 using Web Crypto. Sessions use random server-side tokens stored only as hashes in D1 and are delivered in `HttpOnly`, `Secure`, `SameSite=Lax` cookies. Card numbers never pass through this application; Stripe Checkout handles payment collection. Product prices used for checkout are read again on the server from D1. Uploaded media is type-limited and size-limited before being stored in R2.

Do not put Stripe secret keys, webhook secrets, or the bootstrap token in GitHub. Configure them only as Cloudflare secrets/environment variables.

## Production checklist

1. Deploy this branch to a Cloudflare preview and run the existing static-site build checks.
2. Create D1, apply `schema.sql`, and bind it as `DB`.
3. Create R2 and bind it as `MEDIA`.
4. Add the Cloudflare environment variables/secrets above.
5. Configure Stripe Connect and the webhook endpoint.
6. Create the first admin at `/client/setup.html`.
7. Test client login, content editing, image upload, and a Stripe test-mode connected account.
8. Test a full cart checkout and verify an order appears in D1.
9. Test the $99 local-tech booking in Stripe test mode and confirm the calendar is inaccessible until the Checkout Session is server-verified.
10. Move Stripe keys/webhook configuration to live mode only after the complete test-mode flow passes.
