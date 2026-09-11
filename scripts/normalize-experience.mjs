import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '_site');

function normalize(source) {
  return source
    .replace(/more than two decades/gi, 'more than 10 years')
    .replace(/two decades/gi, '10+ years')
    .replace(/more than 20\+?\s*years/gi, 'more than 10 years')
    .replace(/20\+\s*years/gi, '10+ years')
    .replace(/20\+\s*yrs/gi, '10+ yrs')
    .replace(/href=(['"])\/?contact\.html\?service=(?:local|printer|wifi|senior-tech)\1/gi, 'href="/book-smart-home.html"')
    .replace(/>\s*Book a Call\s*</gi, '>Free Consultation<')
    .replace(/>\s*Book a Free 30-Minute Call\s*→?\s*</gi, '>Schedule a Free Consultation →<')
    .replace(/>\s*Schedule Smart-Home Help\s*→?\s*</gi, '>Schedule a Free Consultation →<')
    .replace(/>\s*Schedule Home Tech Help\s*→?\s*</gi, '>Schedule a Free Consultation →<')
    .replace(/>\s*Request Local Help\s*→?\s*</gi, '>Start with a Free Consultation →<')
    .replace(/>\s*Request On-Site Help\s*→?\s*</gi, '>Start with a Free Consultation →<')
    .replace(/>\s*Request Printer Help\s*→?\s*</gi, '>Start with a Free Consultation →<')
    .replace(/>\s*Request Wi-Fi Help\s*→?\s*</gi, '>Start with a Free Consultation →<')
    .replace(/>\s*Request Senior Tech Help\s*→?\s*</gi, '>Start with a Free Consultation →<')
    .replace(/>\s*Request an Appointment\s*</gi, '>Free Consultation<')
    .replace(/>\s*Choose a Time\s*→?\s*</gi, '>Start with a Free Consultation →<')
    .replace(/>\s*Schedule Help\s*</gi, '>Free Consultation<');
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

console.log(`Normalized generated HTML in ${changed} file(s).`);
