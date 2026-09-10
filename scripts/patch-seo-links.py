from pathlib import Path

local_path = Path('local-tech-help.html')
local = local_path.read_text(encoding='utf-8')
marker = '    <!-- PHOTO -->'
if 'Explore Focused Local Tech Help' not in local and marker in local:
    section = '''    <!-- FOCUSED LOCAL SERVICES -->
    <section class="section section-white">
      <div class="shell">
        <p class="eyebrow">Explore Focused Local Tech Help</p>
        <h2>Start with the problem you are actually trying to solve.</h2>
        <p class="lede">General computer help is available here, or choose a focused Big Rapids service page for the issue you are dealing with.</p>
        <div class="grid-3">
          <article class="service-card reveal"><h3>Printer setup &amp; troubleshooting</h3><p>Wireless printers, scanners, drivers, print queues, offline printers, and devices that cannot find the printer.</p><a class="text-link" href="printer-setup-big-rapids.html">Printer help in Big Rapids →</a></article>
          <article class="service-card reveal"><h3>Wi-Fi &amp; home network help</h3><p>Router setup, weak signal, dropped connections, new devices, printers, and smart-home connectivity.</p><a class="text-link" href="wifi-help-big-rapids.html">Wi-Fi help in Big Rapids →</a></article>
          <article class="service-card reveal"><h3>Senior tech help</h3><p>Patient one-on-one help with computers, phones, email, passwords, printers, streaming, and connected technology.</p><a class="text-link" href="senior-tech-help-big-rapids.html">Senior tech help in Big Rapids →</a></article>
        </div>
      </div>
    </section>

'''
    local_path.write_text(local.replace(marker, section + marker, 1), encoding='utf-8')

website_path = Path('small-business-website-setup.html')
website = website_path.read_text(encoding='utf-8')
website_marker = '    <!-- WHAT YOU GET -->'
if 'Website Design in Big Rapids &amp; Michigan' not in website and website_marker in website:
    section = '''    <!-- MICHIGAN WEBSITE DESIGN -->
    <section class="section section-white">
      <div class="shell split">
        <div><p class="eyebrow">Website Design in Big Rapids &amp; Michigan</p><h2>Need a local or Michigan-focused website?</h2></div>
        <div><p class="lede">Untrained Momentum is based in Big Rapids and builds practical websites for local service businesses, small businesses across Michigan, and remote clients elsewhere in the United States.</p><p>The local website-design page covers service-area SEO foundations, lead forms, domains, hosting, maintenance, Google presence, and how the website connects to the rest of the business.</p><a class="text-link" href="website-design-big-rapids-michigan.html">Website design for Big Rapids &amp; Michigan businesses →</a></div>
      </div>
    </section>

'''
    website_path.write_text(website.replace(website_marker, section + website_marker, 1), encoding='utf-8')

sitemap_path = Path('sitemap.xml')
sitemap = sitemap_path.read_text(encoding='utf-8')
sitemap = sitemap.replace(
    '<url><loc>https://untrainedmomentum.com/small-business-website-setup.html</loc><lastmod>2026-09-06</lastmod></url>',
    '<url><loc>https://untrainedmomentum.com/small-business-website-setup.html</loc><lastmod>2026-09-09</lastmod></url>'
)
sitemap_path.write_text(sitemap, encoding='utf-8')
