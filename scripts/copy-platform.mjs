import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, '_site');

async function copyDirectory(from, to) {
  try { await fs.access(from); } catch { return; }
  await fs.mkdir(to, { recursive: true });
  for (const entry of await fs.readdir(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) await copyDirectory(src, dest);
    else await fs.copyFile(src, dest);
  }
}

await copyDirectory(path.join(root, 'client'), path.join(out, 'client'));
console.log('Copied client portal pages into _site/client/.');
