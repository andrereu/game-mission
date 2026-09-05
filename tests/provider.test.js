import test from 'node:test';
import assert from 'node:assert/strict';
import { stubDesligado, criarProviderEndpoint } from '../src/ai/provider.js';

test('stub desligado sempre devolve null', async () => {
  assert.equal(await stubDesligado.sugerirCombo({ nome: 'A' }, { nome: 'B' }), null);
});

test('provider de endpoint normaliza a resposta', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ resultadoNome: 'Gelo', emoji: '🧊', texto: 'Ar frio congela.' }),
  });
  try {
    const p = criarProviderEndpoint('/api/combinar');
    const r = await p.sugerirCombo({ nome: 'Água' }, { nome: 'Ar' });
    assert.deepEqual(r, { resultadoNome: 'Gelo', emoji: '🧊', texto: 'Ar frio congela.' });
  } finally {
    globalThis.fetch = orig;
  }
});

test('provider de endpoint devolve null em resposta ruim', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
  try {
    const p = criarProviderEndpoint('/api/combinar');
    assert.equal(await p.sugerirCombo({ nome: 'A' }, { nome: 'B' }), null);
  } finally {
    globalThis.fetch = orig;
  }
});

test('provider de endpoint devolve null quando fetch falha', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('rede'); };
  try {
    const p = criarProviderEndpoint('/api/combinar');
    assert.equal(await p.sugerirCombo({ nome: 'A' }, { nome: 'B' }), null);
  } finally {
    globalThis.fetch = orig;
  }
});
