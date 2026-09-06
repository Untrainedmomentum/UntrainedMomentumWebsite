import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const out = path.join(root, '_site');
const includes = path.join(root, 'src', '_includes');
const checkOnly = process.argv.includes('--check');
const canonicalHost = 'https://untrainedmomentum.com';

const [baseTemplate, header, footer] = await Promise.all([
  fs.readFile(path.join(includes, 'base.html'), 'utf8'),
  fs.readFile(path.join(includes, 'header.html'), 'utf8'),
  fs.readFile(path.join(includes, 'footer.html'), 'utf8')
]);

function normalizeCanonicalHost(value) {
  return value.replaceAll('https://www.untrainedmomentum.com', canonicalHost);
}

function extract(source, regex, fallback = '') {
  return source.match(regex)?.[1] ?? fallback;
}

function buildHead(source) {
  const head = extract(source, /<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!head) return '';

  // Base owns charset, viewport, and the shared stylesheet. Everything else is
  // deliberately carried forward so page-specific SEO/social/schema intent is preserved.
  return normalizeCanonicalHost(
    head
      .replace(/<meta\s+charset=[^>]*>\s*/gi, '')
      .replace(/<meta[^>]+name=["']viewport["'][^>]*>\s*/gi, '')
      .replace(/<link[^>]+href=["']\/?assets\/styles\.css["'][^>]*>\s*/gi, '')
      .replace(/<link[^>]+href=["']assets\/styles\.css["'][^>]*>\s*/gi, '')
      .trim()
  );
}

function splitHead(head) {
  const extras = [];
  let seo = head;

  // Inline styles and non-JSON scripts are page behavior/presentation, not SEO.
  seo = seo.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, (match) => {
    extras.push(match);
    return '';
  });
  seo = seo.replace(/<script(?![^>]*type=["']application\/ld\+json["'])\b[^>]*>[\s\S]*?<\/script>/gi, (match) => {
    extras.push(match);
    return '';
  });

  return { seo: seo.trim(), extras: extras.join('\n\n').trim() };
}

function extractMain(source) {
  const match = source.match(/(<main\b[^>]*>[\s\S]*?<\/main>)/i);
  return match?.[1] ?? '';
}

function extractPageScripts(source) {
  const afterMain = source.split(/<\/main>/i)[1] ?? '';
  const withoutFooter = afterMain.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/i, '');
  const scripts = [...withoutFooter.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)]
    .map((m) => m[0])
    .filter((s) => !/assets\/site\.js/i.test(s));
  return normalizeCanonicalHost(scripts.join('\n\n'));
}

function render(source) {
  const main = extractMain(source);
  if (!main) return normalizeCanonicalHost(source);

  const { seo, extras } = splitHead(buildHead(source));
  return normalizeCanonicalHost(
    baseTemplate
      .replace('{{SEO_HEAD}}', seo)
      .replace('{{HEAD_EXTRAS}}', extras)
      .replace('{{HEADER}}', header.trim())
      .replace('{{MAIN}}', main)
      .replace('{{FOOTER}}', footer.trim())
      .replace('{{PAGE_SCRIPTS}}', extractPageScripts(source))
  );
}

async function copyFile(from, to) {
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.copyFile(from, to);
}

async function copyDirectory(from, to) {
  await fs.mkdir(to, { recursive: true });
  for (const entry of await fs.readdir(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) await copyDirectory(src, dest);
    else await copyFile(src, dest);
  }
}

async function build() {
  if (!checkOnly) {
    await fs.rm(out, { recursive: true, force: true });
    await fs.mkdir(out, { recursive: true });
  }

  const rootEntries = await fs.readdir(root, { withFileTypes: true });
  const htmlFiles = rootEntries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
    .map((entry) => entry.name);

  const errors = [];
  const canonicals = new Set();

  for (const name of htmlFiles) {
    const source = await fs.readFile(path.join(root, name), 'utf8');
    const rendered = render(source);

    if (/<main\b/i.test(source)) {
      if (!/<header class="site-header">/i.test(rendered)) errors.push(`${name}: shared header missing`);
      if (!/<footer class="site-footer">/i.test(rendered)) errors.push(`${name}: shared footer missing`);
      if (!/assets\/site\.js/i.test(rendered)) errors.push(`${name}: shared site script missing`);
    }

    const canonical = rendered.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1];
    if (canonical) {
      if (canonical.includes('www.untrainedmomentum.com')) errors.push(`${name}: www canonical remains`);
      if (!canonical.startsWith(canonicalHost)) errors.push(`${name}: unexpected canonical ${canonical}`);
      if (canonicals.has(canonical) && !['Digital Presence.html', 'digital-presence.html', 'VOP.html', 'inquire.html', 'Intake.html'].includes(name)) {
        errors.push(`${name}: duplicate canonical ${canonical}`);
      }
      canonicals.add(canonical);
    }

    if (!checkOnly) await fs.writeFile(path.join(out, name), rendered);
  }

  // Cloudflare Pages control files and crawlability files must land at output root.
  const rootPassthrough = ['CNAME', '_headers', '_redirects', 'robots.txt', 'sitemap.xml', '.nojekyll'];
  for (const name of rootPassthrough) {
    try {
      if (!checkOnly) await copyFile(path.join(root, name), path.join(out, name));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  // Preserve root-level public media/downloads without copying build/config files.
  for (const entry of rootEntries) {
    if (!entry.isFile()) continue;
    if (!/\.(?:png|jpe?g|svg|pdf|zip)$/i.test(entry.name)) continue;
    if (!checkOnly) await copyFile(path.join(root, entry.name), path.join(out, entry.name));
  }

  try {
    if (!checkOnly) await copyDirectory(path.join(root, 'assets'), path.join(out, 'assets'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  // Guard the Cloudflare files that are easy to lose during a generator migration.
  for (const required of ['index.html', '404.html', '_redirects', '_headers', 'robots.txt', 'sitemap.xml']) {
    if (checkOnly) continue;
    try { await fs.access(path.join(out, required)); }
    catch { errors.push(`output missing ${required}`); }
  }

  if (errors.length) {
    console.error('Build validation failed:\n' + errors.map((e) => `- ${e}`).join('\n'));
    process.exitCode = 1;
    return;
  }

  console.log(`${checkOnly ? 'Validated' : 'Built'} ${htmlFiles.length} HTML files with shared templates.`);
  if (!checkOnly) console.log('Cloudflare Pages output: _site/');
}

await build();
