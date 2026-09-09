import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '_site');

function normalize(source) {
  return source
    .replace(/more than two decades/gi, 'more than 10 years')
    .replace(/two decades/gi, '10+ years')
    .replace(/more than 20\+?\s*years/gi, 'more than 10 years')
    .replace(/20\+\s*years/gi, '10+ years')
    .replace(/20\+\s*yrs/gi, '10+ yrs');
}

async function walk(dir) {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) files.push(full);
  }
  return files;
}

const htmlFiles = await walk(root);
let changed = 0;
for (const file of htmlFiles) {
  const before = await fs.readFile(file, 'utf8');
  const after = normalize(before);
  if (after !== before) {
    await fs.writeFile(file, after);
    changed += 1;
  }
}

console.log(`Normalized experience claims in ${changed} generated HTML file(s).`);
