import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const ler = (rel) => readFileSync(raiz + rel, 'utf8');

test('manifest.webmanifest é JSON válido com as chaves exigidas', () => {
  const m = JSON.parse(ler('manifest.webmanifest'));
  assert.equal(m.name, 'Mistura!');
  assert.ok(m.short_name);
  assert.equal(m.start_url, './');
  assert.equal(m.display, 'standalone');
  assert.match(m.theme_color, /^#[0-9a-fA-F]{6}$/);
  assert.match(m.background_color, /^#[0-9a-fA-F]{6}$/);
  assert.ok(Array.isArray(m.icons) && m.icons.length >= 2, 'pelo menos 2 ícones');
  for (const ic of m.icons) {
    assert.ok(ic.src && ic.sizes && ic.type, 'ícone com src/sizes/type');
    assert.ok(existsSync(raiz + ic.src), `arquivo do ícone existe: ${ic.src}`);
  }
  assert.ok(
    m.icons.some((ic) => String(ic.purpose || '').includes('maskable')),
    'tem um ícone maskable',
  );
});

test('index.html referencia o manifest e a meta theme-color', () => {
  const html = ler('index.html');
  assert.match(html, /<link[^>]+rel="manifest"[^>]+href="manifest\.webmanifest"/);
  assert.match(html, /<meta[^>]+name="theme-color"/);
});

test('app.js registra o service worker atrás do guard de suporte', () => {
  const app = ler('src/app.js');
  assert.match(app, /'serviceWorker' in navigator/);
  assert.match(app, /serviceWorker\.register\(\s*['"]sw\.js['"]/);
});

function listarArquivos(dir, prefixo, acc) {
  for (const nome of readdirSync(raiz + dir, { withFileTypes: true })) {
    const rel = `${prefixo}${nome.name}`;
    if (nome.isDirectory()) listarArquivos(`${dir}${nome.name}/`, `${rel}/`, acc);
    else acc.push(rel);
  }
  return acc;
}

test('a lista de precache do sw.js cobre todo módulo de src/ e todo CSS ligado', async () => {
  const sw = ler('sw.js');
  // extrai o array PRECACHE = [ ... ] literal do sw.js
  const bloco = sw.match(/PRECACHE\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(bloco, 'sw.js expõe um array PRECACHE');
  const precache = [...bloco[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);

  const emCache = new Set(precache.map((p) => p.replace(/^\.?\//, '')));

  // todo .js sob src/
  const modulos = listarArquivos('src/', 'src/', []).filter((f) => f.endsWith('.js'));
  for (const mod of modulos) {
    assert.ok(emCache.has(mod), `sw.js precisa pré-cachear ${mod}`);
  }

  // todo CSS ligado no index.html
  const html = ler('index.html');
  const csss = [...html.matchAll(/href="(styles\/[^"]+\.css)"/g)].map((m) => m[1]);
  for (const css of csss) {
    assert.ok(emCache.has(css), `sw.js precisa pré-cachear ${css}`);
  }

  // o próprio shell
  for (const base of ['index.html', 'manifest.webmanifest']) {
    assert.ok(emCache.has(base), `sw.js precisa pré-cachear ${base}`);
  }

  // todo SVG declarado em itens.js
  const { itens } = await import('../src/data/itens.js');
  for (const it of itens) {
    if (it.svg) assert.ok(emCache.has(it.svg), `sw.js precisa pré-cachear ${it.svg}`);
  }
});
