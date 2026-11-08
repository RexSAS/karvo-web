// Rewrites sw.js's FILES list from the files on disk and bumps VERSION, so every release refreshes the offline cache.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const skip = new Set(['docs', 'test', 'tools', 'relay', 'node_modules', '.git', '.superpowers', 'CNAME', 'package.json', 'sw.js', '.gitignore']);
const files = [];
const walk = dir => readdirSync(join(root, dir)).sort().forEach(f => {
  const p = dir ? `${dir}/${f}` : f;
  if (skip.has(p) || skip.has(f)) return;
  statSync(join(root, p)).isDirectory() ? walk(p) : files.push(p);
});
walk('');
let s = readFileSync(join(root, 'sw.js'), 'utf8');
s = s.replace(/const VERSION = (\d+);/, (_, v) => `const VERSION = ${Number(v) + 1};`)
  .replace(/const FILES = \[[\s\S]*?\];/, `const FILES = [\n  './',\n${files.map(f => `  '${f}',`).join('\n')}\n];`);
writeFileSync(join(root, 'sw.js'), s);
console.log(`sw.js: ${files.length} files, ${s.match(/const VERSION = \d+/)[0]}`);
