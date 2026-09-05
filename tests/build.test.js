import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));

test('build monta dist/ com o runtime e sem lixo', () => {
  execFileSync('node', ['scripts/build.mjs'], { cwd: raiz });

  for (const rel of [
    'dist/index.html',
    'dist/manifest.webmanifest',
    'dist/sw.js',
    'dist/src/app.js',
    'dist/styles/base.css',
    'dist/assets/icons/icon-192.png',
    'dist/assets/svg/pikachu.svg',
  ]) {
    assert.ok(existsSync(raiz + rel), `dist deve ter ${rel}`);
  }

  for (const rel of ['dist/tests', 'dist/package.json', 'dist/node_modules', 'dist/scripts']) {
    assert.ok(!existsSync(raiz + rel), `dist NÃO deve ter ${rel}`);
  }
});
