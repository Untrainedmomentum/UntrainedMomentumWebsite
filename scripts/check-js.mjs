import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const roots = ['assets', 'functions', 'scripts'];
const files = [];

async function walk(dir) {
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (/\.(?:js|mjs)$/i.test(entry.name)) files.push(full);
  }
}

for (const dir of roots) await walk(path.join(root, dir));

const failures = [];
for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${path.relative(root, file)}\n${result.stderr || result.stdout}`);
}

if (failures.length) {
  console.error(`JavaScript syntax validation failed for ${failures.length} file(s):\n\n${failures.join('\n\n')}`);
  process.exit(1);
}

console.log(`JavaScript syntax validation passed for ${files.length} files.`);
