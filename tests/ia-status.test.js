import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/ia-status.js';

function faux(method = 'GET') {
  const res = {
    _status: null,
    _json: null,
    _headers: {},
    _ended: false,
    setHeader(k, v) { this._headers[k] = v; },
    status(c) { this._status = c; return this; },
    json(o) { this._json = o; return this; },
    end() { this._ended = true; return this; },
  };
  return [{ method }, res];
}

test('GET devolve 200 { disponivel: true } quando GEMINI_API_KEY existe, sem expor o valor', () => {
  const antes = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'chave-de-teste-nao-real';
  try {
    const [req, res] = faux('GET');
    handler(req, res);
    assert.equal(res._status, 200);
    assert.deepEqual(res._json, { disponivel: true });
    // nada de chave, nome de segredo ou detalhe interno no corpo
    const corpo = JSON.stringify(res._json);
    assert.equal(corpo.includes('chave-de-teste-nao-real'), false);
    assert.equal(corpo.includes('GEMINI'), false);
    assert.equal(res._headers['Cache-Control'], 'no-store');
  } finally {
    if (antes === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = antes;
  }
});

test('GET devolve { disponivel: false } quando a configuração está ausente', () => {
  const antes = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const [req, res] = faux('GET');
    handler(req, res);
    assert.equal(res._status, 200);
    assert.deepEqual(res._json, { disponivel: false });
  } finally {
    if (antes !== undefined) process.env.GEMINI_API_KEY = antes;
  }
});

test('método não-GET/HEAD => 405, nunca dispara geração', () => {
  const [req, res] = faux('POST');
  handler(req, res);
  assert.equal(res._status, 405);
  assert.equal(res._ended, true);
  assert.equal(res._json, null);
});
