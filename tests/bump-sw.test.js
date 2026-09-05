import test from 'node:test';
import assert from 'node:assert/strict';
import { proximaVersao } from '../scripts/bump-sw.mjs';

test('incrementa mistura-v1 para mistura-v2', () => {
  const antes = "const VERSAO = 'mistura-v1';\nself.addEventListener('install', () => {});\n";
  const { texto, de, para } = proximaVersao(antes);
  assert.equal(de, 'mistura-v1');
  assert.equal(para, 'mistura-v2');
  assert.match(texto, /const VERSAO = 'mistura-v2';/);
  assert.doesNotMatch(texto, /mistura-v1/);
});

test('vai de v9 para v10', () => {
  const { para } = proximaVersao("const VERSAO = 'mistura-v9';");
  assert.equal(para, 'mistura-v10');
});

test('não mexe no resto do arquivo', () => {
  const antes = "// topo\nconst VERSAO = 'mistura-v3';\nconst PRECACHE = ['index.html'];\n";
  const { texto } = proximaVersao(antes);
  assert.match(texto, /\/\/ topo/);
  assert.match(texto, /const PRECACHE = \['index\.html'\];/);
});

test('erro claro quando não acha a linha da versão', () => {
  assert.throws(() => proximaVersao('sem versao aqui'), /VERSAO/);
});
