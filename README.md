# Untrained Momentum website

Static, accessible marketing website deployed on **Cloudflare Pages** at `https://untrainedmomentum.com`.

## Architecture

The public site remains fully static HTML, but shared site chrome is now generated from central templates instead of being maintained independently on every page.

- `src/_includes/base.html` — shared HTML document shell
- `src/_includes/header.html` — main navigation / site header
- `src/_includes/footer.html` — site footer, service links, contact links, social links
- `scripts/build.mjs` — dependency-free static build and validation
- existing root `*.html` files — page content/SEO sources; the build extracts each page's `<main>`, page-specific SEO/social/schema markup, inline head extras, and page-specific scripts, then renders them through the shared templates
- `_site/` — generated Cloudflare Pages output (not source-controlled)

This intentionally avoids a client-side navigation injector and avoids adding a framework or template-engine dependency. Cloudflare still serves normal crawlable HTML files at the existing public URLs.

## Build locally

Node 20+ is recommended.

```bash
npm run build
```

Generated output is written to `_site/`.

The build also checks canonical-host consistency and verifies that important Cloudflare/crawlability files are present in the output.

## Cloudflare Pages configuration

This repository is deployed with Cloudflare Pages, **not GitHub Pages**.

Use:

- **Build command:** `npm run build`
- **Build output directory:** `_site`
- **Root directory:** repository root

`wrangler.jsonc` also points static assets at `./_site` for compatible Wrangler-based preview/deploy workflows.

The build preserves these Cloudflare/public files at the output root:

- `_redirects` — legacy Wix and historical URL redirects
- `_headers` — security and cache headers
- `404.html` — custom not-found page
- `robots.txt`
- `sitemap.xml`
- `CNAME` — retained for domain continuity/documentation even though production hosting is Cloudflare Pages

Canonical URLs use the non-www production host: `https://untrainedmomentum.com`.

Both `untrainedmomentum.com` and `www.untrainedmomentum.com` should remain attached to the Cloudflare Pages project, with `www` routed/redirected to the canonical non-www host at Cloudflare.

## Current production status

- Cloudflare Pages is the production host.
- The Formspree contact endpoint is connected (`https://formspree.io/f/mljebgda`).
- Local home-tech pricing is defined on the site.
- Current navigation, forms, phone/email links, page URLs, metadata intent, structured data, styles, scripts, and legacy redirects are preserved by the build.

## Remaining operational checks

These are deployment/marketing checks rather than missing site architecture:

- Confirm the Cloudflare Pages project is configured with build command `npm run build` and output directory `_site` before merging/deploying this refactor.
- Confirm both apex and `www` custom domains remain active in Cloudflare and `www` redirects to the non-www canonical host while preserving paths.
- Continue maintaining the Wix/historical URL inventory in `_redirects` as newly discovered legacy URLs appear.
- Validate structured data periodically after content changes and keep `sitemap.xml` submitted in Google Search Console.

## Editing guidance

For site-wide navigation/footer changes, edit the shared include once. Page-specific body content remains in the corresponding HTML source. Page-specific title, description, canonical, Open Graph/Twitter tags, JSON-LD, inline styles, and page scripts are carried into the generated page automatically.
