import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

// The offline cache must list every file the app loads, or the iPhone app breaks without signal.
test('the service worker precaches every shipped file', () => {
  const root = new URL('..', import.meta.url).pathname;
  const skip = new Set(['docs', 'test', 'tools', 'relay', 'node_modules', '.git', '.superpowers', 'CNAME', 'package.json', 'sw.js', '.gitignore']);
  const files = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).trim().split('\n')
    .filter(f => !skip.has(f) && !skip.has(f.split('/')[0]));
  const listed = JSON.parse(readFileSync(join(root, 'sw.js'), 'utf8').match(/const FILES = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*]/, ']'));
  assert.deepEqual(listed.filter(f => f !== './').sort(), files.sort());
});
