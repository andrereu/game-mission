import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/combinar.js';

function faseRes() {
  const r = { code: null, corpo: undefined, terminou: false };
  r.status = (c) => { r.code = c; return r; };
  r.json = (x) => { r.corpo = x; r.terminou = true; return r; };
  r.end = () => { r.terminou = true; return r; };
  return r;
}

function comFetch(fn, corpo) {
  return async () => {
    const orig = globalThis.fetch;
    const origKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'chave-de-teste';
    globalThis.fetch = fn;
    try {
      const res = faseRes();
      await handler({ method: 'POST', body: corpo }, res);
      return res;
    } finally {
      globalThis.fetch = orig;
      if (origKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = origKey;
    }
  };
}

function respostaGemini(obj) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }],
    }),
  };
}

test('POST válido com sugestão limpa devolve 200 e a sugestão', async () => {
  const res = await comFetch(
    async () => respostaGemini({ resultadoNome: 'Gelo', emoji: '🧊', texto: 'Água no frio vira gelo.' }),
    { a: 'Água', b: 'Frio' },
  )();
  assert.equal(res.code, 200);
  assert.deepEqual(res.corpo, { resultadoNome: 'Gelo', emoji: '🧊', texto: 'Água no frio vira gelo.' });
});

test('sugestão que bate na lista de bloqueio vira 200 vazio', async () => {
  const res = await comFetch(
    async () => respostaGemini({ resultadoNome: 'Faca Afiada', emoji: '🔪', texto: 'Corta bem.' }),
    { a: 'Metal', b: 'Pedra' },
  )();
  assert.equal(res.code, 200);
  assert.deepEqual(res.corpo, {});
});

test('sem GEMINI_API_KEY responde 200 vazio', async () => {
  const orig = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const res = faseRes();
    await handler({ method: 'POST', body: { a: 'Água', b: 'Fogo' } }, res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.corpo, {});
  } finally {
    if (orig !== undefined) process.env.GEMINI_API_KEY = orig;
  }
});

test('método diferente de POST é 405', async () => {
  const res = faseRes();
  await handler({ method: 'GET' }, res);
  assert.equal(res.code, 405);
});

test('entrada inválida não chega a chamar o Gemini', async () => {
  let chamou = false;
  const res = await comFetch(async () => { chamou = true; return respostaGemini({}); }, { a: '', b: 'Fogo' })();
  assert.equal(chamou, false);
  assert.equal(res.code, 200);
  assert.deepEqual(res.corpo, {});
});

test('erro de rede no Gemini vira 200 vazio', async () => {
  const res = await comFetch(async () => { throw new Error('rede'); }, { a: 'Água', b: 'Fogo' })();
  assert.equal(res.code, 200);
  assert.deepEqual(res.corpo, {});
});
