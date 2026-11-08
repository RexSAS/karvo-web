import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The offline cache must list every file the app loads, or the iPhone app breaks without signal.
test('the service worker precaches every shipped file', () => {
  const root = new URL('..', import.meta.url).pathname;
  const skip = new Set(['docs', 'test', 'tools', 'relay', 'node_modules', '.git', '.superpowers', 'CNAME', 'package.json', 'sw.js', '.gitignore']);
  const files = [];
  const walk = dir => readdirSync(join(root, dir)).forEach(f => {
    const p = dir ? `${dir}/${f}` : f;
    if (skip.has(p) || skip.has(f)) return;
    statSync(join(root, p)).isDirectory() ? walk(p) : files.push(p);
  });
  walk('');
  const listed = JSON.parse(readFileSync(join(root, 'sw.js'), 'utf8').match(/const FILES = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*]/, ']'));
  assert.deepEqual(listed.filter(f => f !== './').sort(), files.sort());
});
