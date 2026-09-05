import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { criarCatalogo } from '../src/engine/catalogo.js';
import {
  saveInicial, carregar, salvar, criarAgendadorSalvar, VERSAO_ATUAL,
} from '../src/engine/storage.js';

function resetDB() {
  globalThis.indexedDB = new IDBFactory();
  globalThis.localStorage.clear();
}

test('saveInicial marca todos os itens base como descobertos', () => {
  const cat = criarCatalogo();
  const s = saveInicial(cat);
  assert.equal(s.versao, VERSAO_ATUAL);
  assert.deepEqual(s.canvas, []);
  assert.equal(s.ajustes.som, true);
  assert.equal(s.ajustes.iaLigada, false);
  for (const it of cat.baseItems()) {
    assert.ok(s.descobertos[it.id], `base não descoberto: ${it.id}`);
    assert.equal(s.descobertos[it.id].via, null);
    assert.equal(s.descobertos[it.id].fonte, 'base');
  }
});

test('carregar sem save devolve o inicial', async () => {
  resetDB();
  const cat = criarCatalogo();
  const s = await carregar(cat);
  assert.ok(s.descobertos.agua);
});

test('salvar e carregar preservam o estado (IndexedDB)', async () => {
  resetDB();
  const cat = criarCatalogo();
  const s = saveInicial(cat);
  s.descobertos.vapor = { em: 123, via: ['agua', 'fogo'], fonte: 'local' };
  s.canvas.push({ uid: 'u_1', id: 'agua', x: 10, y: 20 });
  await salvar(s);
  const lido = await carregar(cat);
  assert.deepEqual(lido.descobertos.vapor, { em: 123, via: ['agua', 'fogo'], fonte: 'local' });
  assert.deepEqual(lido.canvas, [{ uid: 'u_1', id: 'agua', x: 10, y: 20 }]);
});

test('fallback para localStorage quando não há indexedDB', async () => {
  resetDB();
  const semIDB = globalThis.indexedDB;
  globalThis.indexedDB = undefined;
  try {
    const cat = criarCatalogo();
    const s = saveInicial(cat);
    s.descobertos.lama = { em: 9, via: ['agua', 'terra'], fonte: 'local' };
    await salvar(s);
    const lido = await carregar(cat);
    assert.ok(lido.descobertos.lama);
  } finally {
    globalThis.indexedDB = semIDB;
  }
});

test('carregar aplica migração de versão antiga', async () => {
  resetDB();
  const cat = criarCatalogo();
  const antigo = { versao: 0, descobertos: {}, canvas: [], ajustes: {} };
  const semIDB = globalThis.indexedDB;
  try {
    globalThis.indexedDB = undefined;
    await salvar(antigo);
    const lido = await carregar(cat);
    assert.equal(lido.versao, VERSAO_ATUAL);
  } finally {
    globalThis.indexedDB = new IDBFactory();
    globalThis.localStorage.clear();
  }
});

test('carregar resolve mesmo se indexedDB.open explodir', async () => {
  resetDB();
  const orig = globalThis.indexedDB;
  try {
    globalThis.indexedDB = {
      open() { throw new Error('storage bloqueado'); },
    };
    const cat = criarCatalogo();
    const s = await carregar(cat);
    assert.ok(s.descobertos.agua, 'devia cair no save inicial');
    assert.equal(s.versao, VERSAO_ATUAL);
  } finally {
    globalThis.indexedDB = orig;
    globalThis.localStorage.clear();
  }
});

test('carregar resolve quando a abertura do indexedDB rejeita', async () => {
  resetDB();
  const orig = globalThis.indexedDB;
  try {
    globalThis.indexedDB = {
      open() {
        const req = { result: null, error: new Error('cota') };
        setTimeout(() => req.onerror && req.onerror(), 0);
        return req;
      },
    };
    const cat = criarCatalogo();
    const s = await carregar(cat);
    assert.ok(s.descobertos.agua);
  } finally {
    globalThis.indexedDB = orig;
    globalThis.localStorage.clear();
  }
});

test('localStorage corrompido vira save inicial', async () => {
  resetDB();
  const orig = globalThis.indexedDB;
  try {
    globalThis.indexedDB = undefined;
    globalThis.localStorage.setItem('mistura', '{isso não é json');
    const cat = criarCatalogo();
    const s = await carregar(cat);
    assert.ok(s.descobertos.agua);
    assert.deepEqual(s.canvas, []);
  } finally {
    globalThis.indexedDB = orig;
    globalThis.localStorage.clear();
  }
});

test('abrir reutiliza a mesma conexão IndexedDB', async () => {
  resetDB();
  const real = globalThis.indexedDB;
  let aberturas = 0;
  try {
    globalThis.indexedDB = {
      open(...args) {
        aberturas += 1;
        return real.open(...args);
      },
    };
    const cat = criarCatalogo();
    const s = saveInicial(cat);
    await salvar(s);
    await carregar(cat);
    await salvar(s);
    assert.equal(aberturas, 1, `abriu ${aberturas} conexões`);
  } finally {
    globalThis.indexedDB = real;
    globalThis.localStorage.clear();
  }
});

test('agendador de salvar faz debounce', async () => {
  resetDB();
  let chamadas = 0;
  const orig = globalThis.indexedDB;
  try {
    globalThis.indexedDB = undefined;
    const save = { versao: VERSAO_ATUAL, descobertos: {}, canvas: [], ajustes: {} };
    const agendar = criarAgendadorSalvar(() => {
      chamadas += 1;
      return save;
    }, 50);
    agendar(); agendar(); agendar();
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(chamadas, 1);
  } finally {
    globalThis.indexedDB = new IDBFactory();
    globalThis.localStorage.clear();
  }
});
