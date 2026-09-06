import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import {
  gerarCodigo, carregarSync, definirCodigo, desativar,
  mesclarDescobertos, mesclarPerfis, puxar, empurrar, sincronizar,
} from '../src/engine/sync.js';

function reset() {
  globalThis.indexedDB = new IDBFactory();
  globalThis.localStorage.clear();
}

test('gerarCodigo tem pelo menos 8 caracteres e um hífen no meio', () => {
  for (let i = 0; i < 20; i += 1) {
    const c = gerarCodigo();
    assert.ok(c.length >= 8, c);
    assert.match(c, /^[A-Z0-9]+-[A-Z0-9]+$/);
    assert.doesNotMatch(c, /[O0I1]/, 'evita caracteres ambíguos');
  }
});

test('definirCodigo normaliza e persiste; desativar limpa', async () => {
  reset();
  await definirCodigo('  melo-4kx9 ');
  assert.equal((await carregarSync()).codigo, 'MELO-4KX9');
  await desativar();
  assert.equal((await carregarSync()).codigo, null);
});

test('mesclarDescobertos faz união e mantém o "em" mais antigo', () => {
  const a = {
    agua: { em: 1, via: null, fonte: 'base' },
    vapor: { em: 50, via: ['agua', 'fogo'], fonte: 'local' },
  };
  const b = {
    agua: { em: 1, via: null, fonte: 'base' },
    lava: { em: 30, via: ['fogo', 'terra'], fonte: 'local' },
    vapor: { em: 90, via: ['agua', 'fogo'], fonte: 'local' },
  };
  const m = mesclarDescobertos(a, b);
  assert.deepEqual(Object.keys(m).sort(), ['agua', 'lava', 'vapor']);
  assert.equal(m.vapor.em, 50, 'fica com o registro mais antigo');
  assert.equal(m.lava.em, 30);
});

test('mesclarPerfis une por id, mantendo o local em caso de conflito', () => {
  const a = [{ id: 'x', nome: 'Ana', cor: '#4aa3ff' }];
  const b = [{ id: 'x', nome: 'Ana2', cor: '#000' }, { id: 'y', nome: 'Beto', cor: '#45c26b' }];
  const m = mesclarPerfis(a, b);
  assert.deepEqual(m.map((p) => p.id), ['x', 'y']);
  assert.equal(m[0].nome, 'Ana', 'conflito: fica com o local');
});

test('puxar faz GET no caminho certo e devolve o JSON', async () => {
  const orig = globalThis.fetch;
  let urlPedida = null;
  globalThis.fetch = async (url) => {
    urlPedida = url;
    return { ok: true, json: async () => ({ descobertos: { agua: { em: 1 } } }) };
  };
  try {
    const dados = await puxar('MELO-4KX9', 'p_1');
    assert.match(urlPedida, /\/family_saves\/MELO-4KX9\/p_1\.json$/);
    assert.deepEqual(dados, { descobertos: { agua: { em: 1 } } });
  } finally {
    globalThis.fetch = orig;
  }
});

test('puxar devolve null quando não há nada ou dá erro', async () => {
  const orig = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => null });
    assert.equal(await puxar('MELO-4KX9', '_perfis'), null);
    globalThis.fetch = async () => { throw new Error('rede'); };
    assert.equal(await puxar('MELO-4KX9', '_perfis'), null);
  } finally {
    globalThis.fetch = orig;
  }
});

test('empurrar faz PUT com o corpo JSON e diz se deu certo', async () => {
  const orig = globalThis.fetch;
  let req = null;
  globalThis.fetch = async (url, opcoes) => {
    req = { url, opcoes };
    return { ok: true };
  };
  try {
    const ok = await empurrar('MELO-4KX9', 'p_1', { descobertos: { agua: { em: 1 } } });
    assert.equal(ok, true);
    assert.match(req.url, /\/family_saves\/MELO-4KX9\/p_1\.json$/);
    assert.equal(req.opcoes.method, 'PUT');
    assert.deepEqual(JSON.parse(req.opcoes.body), { descobertos: { agua: { em: 1 } } });
  } finally {
    globalThis.fetch = orig;
  }
});

test('empurrar devolve false em erro de rede', async () => {
  const orig = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error('rede'); };
    assert.equal(await empurrar('MELO-4KX9', 'p_1', {}), false);
  } finally {
    globalThis.fetch = orig;
  }
});

test('sincronizar mescla perfis e descobertas nos dois sentidos', async () => {
  const orig = globalThis.fetch;
  const remoto = {
    '_perfis': [{ id: 'x', nome: 'Ana' }, { id: 'z', nome: 'Zeca' }],
    x: { descobertos: { agua: { em: 1 }, gelo: { em: 20 } } },
  };
  const enviados = {};
  globalThis.fetch = async (u, opc) => {
    const chave = u.match(/family_saves\/COD-1234\/(.+)\.json$/)[1];
    if (!opc || opc.method !== 'PUT') {
      return { ok: true, json: async () => remoto[chave] ?? null };
    }
    enviados[chave] = JSON.parse(opc.body);
    return { ok: true };
  };

  let perfisSalvos = null;
  const savesSalvos = {};
  const perfisLocais = { lista: [{ id: 'x', nome: 'Ana' }], ativo: 'x' };
  const saveLocal = { versao: 1, descobertos: { agua: { em: 1 }, vapor: { em: 5 } }, canvas: [], ajustes: {} };

  try {
    const r = await sincronizar('COD-1234', {
      carregarPerfis: async () => perfisLocais,
      salvarPerfis: async (e) => { perfisSalvos = e; },
      carregarSave: async () => saveLocal,
      salvarSave: async (id, s) => { savesSalvos[id] = s; },
      ativo: 'x',
    });

    assert.deepEqual(r.perfis.map((p) => p.id), ['x', 'z'], 'perfil remoto entrou');
    assert.deepEqual(perfisSalvos.lista.map((p) => p.id), ['x', 'z'], 'lista mesclada salva local');
    assert.deepEqual(enviados['_perfis'].map((p) => p.id), ['x', 'z'], 'lista mesclada empurrada');

    assert.deepEqual(
      Object.keys(savesSalvos.x.descobertos).sort(), ['agua', 'gelo', 'vapor'],
      'descobertas locais + remotas',
    );
    assert.deepEqual(Object.keys(enviados.x.descobertos).sort(), ['agua', 'gelo', 'vapor']);
  } finally {
    globalThis.fetch = orig;
  }
});
