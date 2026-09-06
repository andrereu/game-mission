import test from 'node:test';
import assert from 'node:assert/strict';
import { criarStore } from '../src/engine/state.js';

function saveVazio() {
  return { versao: 1, descobertos: { agua: { em: 1, via: null, fonte: 'base' } },
    canvas: [], ajustes: { som: true, iaLigada: false } };
}

test('addInstance cria com uid único e emite evento', () => {
  const store = criarStore(saveVazio());
  const vistos = [];
  store.on('instancia:criada', (i) => vistos.push(i));
  const a = store.addInstance('agua', 10, 20);
  const b = store.addInstance('agua', 30, 40);
  assert.notEqual(a.uid, b.uid);
  assert.equal(store.listInstances().length, 2);
  assert.equal(vistos.length, 2);
});

test('moveInstance e removeInstance', () => {
  const store = criarStore(saveVazio());
  const a = store.addInstance('agua', 0, 0);
  store.moveInstance(a.uid, 99, 88);
  assert.deepEqual(
    [store.getInstance(a.uid).x, store.getInstance(a.uid).y], [99, 88],
  );
  let removida = null;
  store.on('instancia:removida', (i) => { removida = i; });
  store.removeInstance(a.uid);
  assert.equal(store.getInstance(a.uid), undefined);
  assert.equal(removida.uid, a.uid);
});

test('recordDiscovery só conta a primeira vez', () => {
  const store = criarStore(saveVazio());
  const eventos = [];
  store.on('descoberta:nova', (d) => eventos.push(d));
  assert.equal(store.isDiscovered('vapor'), false);
  assert.equal(store.recordDiscovery('vapor', ['agua', 'fogo'], 'local'), true);
  assert.equal(store.isDiscovered('vapor'), true);
  assert.equal(store.recordDiscovery('vapor', ['agua', 'fogo'], 'local'), false);
  assert.equal(eventos.length, 1);
  assert.deepEqual(eventos[0], { id: 'vapor', via: ['agua', 'fogo'], fonte: 'local' });
});

test('clearInstances esvazia o canvas mas não as descobertas', () => {
  const store = criarStore(saveVazio());
  store.addInstance('agua', 1, 1);
  store.recordDiscovery('vapor', ['agua', 'fogo'], 'local');
  store.clearInstances();
  assert.equal(store.listInstances().length, 0);
  assert.equal(store.isDiscovered('vapor'), true);
});

test('todo evento também dispara estado:mudou', () => {
  const store = criarStore(saveVazio());
  let contador = 0;
  store.on('estado:mudou', () => { contador += 1; });
  store.addInstance('agua', 0, 0);
  store.setAjuste('som', false);
  assert.ok(contador >= 2);
  assert.equal(store.getSave().ajustes.som, false);
});

test('registrarItemIA grava no save (mesmo sem itensIA/combosIA prévios) e emite estado:mudou', () => {
  const store = criarStore(saveVazio());
  let mudou = 0;
  store.on('estado:mudou', () => { mudou += 1; });
  const item = { id: 'nuvem-quente', nome: 'Nuvem Quente', emoji: '🌫️', era: 'natureza' };
  const combo = {
    a: 'vapor', b: 'calor', resultado: 'nuvem-quente', texto: 'Vapor com calor.',
  };
  store.registrarItemIA(item, 'calor+vapor', combo);
  assert.deepEqual(store.getSave().itensIA['nuvem-quente'], {
    nome: 'Nuvem Quente', emoji: '🌫️', era: 'natureza',
  });
  assert.deepEqual(store.getSave().combosIA['calor+vapor'], combo);
  assert.ok(mudou >= 1);
});

test('on devolve função para desinscrever', () => {
  const store = criarStore(saveVazio());
  let n = 0;
  const off = store.on('instancia:criada', () => { n += 1; });
  store.addInstance('agua', 0, 0);
  off();
  store.addInstance('agua', 1, 1);
  assert.equal(n, 1);
});
