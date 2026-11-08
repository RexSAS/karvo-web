// Rewrites sw.js's FILES list from the files on disk and bumps VERSION, so every release refreshes the offline cache.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
const root = new URL('..', import.meta.url).pathname;
const skip = new Set(['docs', 'test', 'tools', 'relay', 'node_modules', '.git', '.superpowers', 'CNAME', 'package.json', 'sw.js', '.gitignore']);
// git's list, not the disk: local scratch files (fake-phone.json…) must never end up in the offline cache.
const files = execSync('git ls-files --cached --others --exclude-standard', { cwd: root, encoding: 'utf8' }).trim().split('\n')
  .filter(f => !skip.has(f) && !skip.has(f.split('/')[0])).sort();
let s = readFileSync(join(root, 'sw.js'), 'utf8');
s = s.replace(/const VERSION = (\d+);/, (_, v) => `const VERSION = ${Number(v) + 1};`)
  .replace(/const FILES = \[[\s\S]*?\];/, `const FILES = [\n  './',\n${files.map(f => `  '${f}',`).join('\n')}\n];`);
writeFileSync(join(root, 'sw.js'), s);
console.log(`sw.js: ${files.length} files, ${s.match(/const VERSION = \d+/)[0]}`);
