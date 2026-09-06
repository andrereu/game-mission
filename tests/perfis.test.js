import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { criarCatalogo } from '../src/engine/catalogo.js';
import { carregar, escreverChave, lerChave } from '../src/engine/storage.js';
import {
  carregarPerfis, criarPerfil, editarPerfil, definirAtivo, apagarPerfil, chaveSave,
} from '../src/engine/perfis.js';

function reset() {
  globalThis.indexedDB = new IDBFactory();
  globalThis.localStorage.clear();
}

test('sem nada gravado, começa sem perfis e sem ativo', async () => {
  reset();
  const p = await carregarPerfis();
  assert.deepEqual(p.lista, []);
  assert.equal(p.ativo, null);
});

test('criarPerfil grava e aparece no próximo carregamento, com id único', async () => {
  reset();
  const a = await criarPerfil('Ana', '#4aa3ff');
  const b = await criarPerfil('Beto', '#45c26b');
  assert.notEqual(a.id, b.id);
  const { lista } = await carregarPerfis();
  assert.deepEqual(lista.map((x) => x.nome), ['Ana', 'Beto']);
  assert.equal(lista[0].cor, '#4aa3ff');
});

test('criarPerfil guarda o modo, com padrão "medio"', async () => {
  reset();
  const a = await criarPerfil('Ana', '#4aa3ff');
  const b = await criarPerfil('Beto', '#45c26b', 'pequenos');
  const c = await criarPerfil('Caco', '#000', 'inventado');
  assert.equal(a.modo, 'medio');
  assert.equal(b.modo, 'pequenos');
  assert.equal(c.modo, 'medio', 'modo inválido cai no padrão');
  const { lista } = await carregarPerfis();
  assert.equal(lista.find((p) => p.id === b.id).modo, 'pequenos');
});

test('editarPerfil troca o modo (e nome/cor) e persiste', async () => {
  reset();
  const a = await criarPerfil('Ana', '#4aa3ff', 'pequenos');
  const atualizado = await editarPerfil(a.id, { modo: 'completo', nome: 'Aninha' });
  assert.equal(atualizado.modo, 'completo');
  assert.equal(atualizado.nome, 'Aninha');
  const { lista } = await carregarPerfis();
  assert.equal(lista[0].modo, 'completo');
  assert.equal(lista[0].nome, 'Aninha');
});

test('editarPerfil com id inexistente devolve null e não quebra', async () => {
  reset();
  await criarPerfil('Ana', '#4aa3ff');
  assert.equal(await editarPerfil('nao-existe', { modo: 'completo' }), null);
});

test('definirAtivo persiste e ignora id inexistente', async () => {
  reset();
  const a = await criarPerfil('Ana', '#4aa3ff');
  await definirAtivo(a.id);
  assert.equal((await carregarPerfis()).ativo, a.id);
  await definirAtivo('nao-existe');
  assert.equal((await carregarPerfis()).ativo, a.id);
});

test('apagarPerfil remove o perfil, o save dele e reaponta o ativo', async () => {
  reset();
  const cat = criarCatalogo();
  const a = await criarPerfil('Ana', '#4aa3ff');
  const b = await criarPerfil('Beto', '#45c26b');
  await escreverChave(chaveSave(a.id), { versao: 1, descobertos: { vapor: {} }, canvas: [], ajustes: {} });
  await definirAtivo(a.id);

  await apagarPerfil(a.id);

  const p = await carregarPerfis();
  assert.deepEqual(p.lista.map((x) => x.id), [b.id]);
  assert.equal(p.ativo, b.id, 'ativo passa para o que sobrou');
  assert.equal(await lerChave(chaveSave(a.id)), null, 'save do perfil apagado some');
  // o catálogo não quebra ao carregar o save inexistente
  const save = await carregar(cat, chaveSave(a.id));
  assert.ok(save.descobertos.agua);
});

test('apagar o último perfil deixa ativo nulo', async () => {
  reset();
  const a = await criarPerfil('Ana', '#4aa3ff');
  await definirAtivo(a.id);
  await apagarPerfil(a.id);
  const p = await carregarPerfis();
  assert.deepEqual(p.lista, []);
  assert.equal(p.ativo, null);
});

test('migra o save antigo "principal" para um perfil', async () => {
  reset();
  const cat = criarCatalogo();
  await escreverChave('principal', {
    versao: 1,
    descobertos: { agua: { em: 1, via: null, fonte: 'base' }, vapor: { em: 2, via: ['agua', 'fogo'], fonte: 'local' } },
    canvas: [{ uid: 'u1', id: 'agua', x: 5, y: 5 }],
    ajustes: { som: true, iaLigada: false },
  });

  const p = await carregarPerfis();
  assert.equal(p.lista.length, 1);
  assert.equal(p.ativo, p.lista[0].id);

  const save = await carregar(cat, chaveSave(p.ativo));
  assert.ok(save.descobertos.vapor, 'o progresso antigo veio junto');
  assert.deepEqual(save.canvas, [{ uid: 'u1', id: 'agua', x: 5, y: 5 }]);
});

test('não migra de novo se já existe um perfil', async () => {
  reset();
  await criarPerfil('Ana', '#4aa3ff');
  await escreverChave('principal', { versao: 1, descobertos: { lava: {} }, canvas: [], ajustes: {} });
  const p = await carregarPerfis();
  assert.equal(p.lista.length, 1);
  assert.equal(p.lista[0].nome, 'Ana');
});
