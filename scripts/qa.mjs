import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(process.argv[2] || '_site');
const errors = [];

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function listHtml(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listHtml(full));
    else if (entry.name.toLowerCase().endsWith('.html')) files.push(full);
  }
  return files;
}

function count(source, regex) {
  return [...source.matchAll(regex)].length;
}

function stripQueryAndHash(value) {
  return value.split('#')[0].split('?')[0];
}

function isExternal(value) {
  return /^(?:https?:|mailto:|tel:|sms:|data:|javascript:)/i.test(value) || value.startsWith('//');
}

function htmlName(file) {
  return path.relative(root, file).replaceAll('\\', '/');
}

async function checkInternalTarget(pageFile, rawValue) {
  const value = rawValue.trim();
  if (!value || value === '#' || value.startsWith('#') || isExternal(value)) return;

  let clean = stripQueryAndHash(value);
  try { clean = decodeURIComponent(clean); } catch { /* keep original */ }
  if (!clean) return;

  let target;
  if (clean === '/') {
    target = path.join(root, 'index.html');
  } else if (clean.startsWith('/')) {
    target = path.join(root, clean.slice(1));
  } else {
    target = path.resolve(path.dirname(pageFile), clean);
  }

  if (target.endsWith(path.sep)) target = path.join(target, 'index.html');
  if (!path.extname(target)) {
    if (await exists(`${target}.html`)) target = `${target}.html`;
    else target = path.join(target, 'index.html');
  }

  if (!await exists(target)) {
    errors.push(`${htmlName(pageFile)}: broken internal target "${value}"`);
  }
}

if (!await exists(root)) {
  console.error(`QA output directory does not exist: ${root}`);
  process.exit(1);
}

const htmlFiles = await listHtml(root);

for (const file of htmlFiles) {
  const source = await fs.readFile(file, 'utf8');
  const name = htmlName(file);
  const hasMain = /<main\b/i.test(source);
  const noIndex = /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(source) ||
    /<meta\b[^>]*content=["'][^"']*noindex[^"']*["'][^>]*name=["']robots["']/i.test(source);

  if (/<a\b[^>]*href=["']#["']/i.test(source)) {
    errors.push(`${name}: placeholder href="#" found`);
  }

  if (/http:\/\//i.test(source)) {
    errors.push(`${name}: insecure http:// reference found`);
  }

  for (const match of source.matchAll(/<(?:a|link)\b[^>]*href=["']([^"']+)["']/gi)) {
    await checkInternalTarget(file, match[1]);
  }
  for (const match of source.matchAll(/<(?:img|script)\b[^>]*src=["']([^"']+)["']/gi)) {
    await checkInternalTarget(file, match[1]);
  }

  for (const match of source.matchAll(/<img\b([^>]*)>/gi)) {
    if (!/\balt=["'][^"']*["']/i.test(match[1])) {
      errors.push(`${name}: image missing alt attribute`);
    }
  }

  if (!hasMain) continue;

  if (!/<html\b[^>]*lang=["']en["']/i.test(source)) errors.push(`${name}: missing html lang="en"`);
  if (!/<meta\b[^>]*name=["']viewport["']/i.test(source)) errors.push(`${name}: missing viewport meta`);
  if (!/<title>[^<]+<\/title>/i.test(source)) errors.push(`${name}: missing non-empty title`);

  const hasDescription = /<meta\b[^>]*name=["']description["'][^>]*content=["'][^"']+/i.test(source) ||
    /<meta\b[^>]*content=["'][^"']+[^>]*name=["']description["']/i.test(source);
  if (!noIndex && !hasDescription) errors.push(`${name}: missing meta description`);

  const h1Count = count(source, /<h1\b/gi);
  if (h1Count !== 1) errors.push(`${name}: expected exactly one h1, found ${h1Count}`);

  if (!/<header class=["']site-header["']>/i.test(source)) errors.push(`${name}: shared header missing`);
  if (!/<footer class=["']site-footer["']>/i.test(source)) errors.push(`${name}: shared footer missing`);
  if (!/assets\/styles\.css\?v=/i.test(source)) errors.push(`${name}: versioned shared stylesheet missing`);
  if (!/assets\/mobile-nav\.css\?v=/i.test(source)) errors.push(`${name}: hardened mobile nav stylesheet missing`);
  if (!/assets\/site\.js\?v=/i.test(source)) errors.push(`${name}: versioned shared script missing`);
}

const localTechPath = path.join(root, 'local-tech-help.html');
if (await exists(localTechPath)) {
  const local = await fs.readFile(localTechPath, 'utf8');
  if (local.includes('$99')) errors.push('local-tech-help.html: stale $99 on-site price found');
  if (!local.includes('$75') || !local.includes('$50')) errors.push('local-tech-help.html: expected current $75/$50 on-site pricing');
  if (!/15 miles of Big Rapids/i.test(local)) errors.push('local-tech-help.html: 15-mile included travel area is not stated');
}

const termsPath = path.join(root, 'terms.html');
if (await exists(termsPath)) {
  const terms = await fs.readFile(termsPath, 'utf8');
  if (terms.includes('$99 for the first hour of on-site technology help')) {
    errors.push('terms.html: stale local on-site price found');
  }
  if (!terms.includes('$75 for the first hour of on-site technology help') ||
      !terms.includes('$50 per hour for additional on-site time')) {
    errors.push('terms.html: local pricing does not match current $75/$50 rates');
  }
}

for (const required of [
  'index.html',
  '404.html',
  '_headers',
  '_redirects',
  'robots.txt',
  'sitemap.xml',
  'assets/styles.css',
  'assets/mobile-nav.css',
  'assets/site.js'
]) {
  if (!await exists(path.join(root, required))) errors.push(`output missing ${required}`);
}

if (errors.length) {
  console.error(`Site QA failed with ${errors.length} issue(s):\n${errors.map((e) => `- ${e}`).join('\n')}`);
  process.exit(1);
}

console.log(`Site QA passed for ${htmlFiles.length} HTML files.`);
