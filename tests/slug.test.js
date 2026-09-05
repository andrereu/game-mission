import test from 'node:test';
import assert from 'node:assert/strict';
import { slug } from '../src/engine/slug.js';

test('minúsculas e espaços viram hífen', () => {
  assert.equal(slug('Homem Aranha'), 'homem-aranha');
});

test('remove acentos', () => {
  assert.equal(slug('Água'), 'agua');
  assert.equal(slug('Ação'), 'acao');
  assert.equal(slug('Pokémon'), 'pokemon');
});

test('colapsa separadores e apara as pontas', () => {
  assert.equal(slug('  Fogo +  Água  '), 'fogo-agua');
  assert.equal(slug('---teste---'), 'teste');
});

test('caracteres estranhos somem', () => {
  assert.equal(slug('C3PO!!! (robô)'), 'c3po-robo');
});

test('entrada não-string não quebra', () => {
  assert.equal(slug(123), '123');
});
