import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularAlemDoMapa } from '../src/engine/alemDoMapa.js';
import { criarCatalogo } from '../src/engine/catalogo.js';

test('item que nunca é ingrediente é além do mapa', () => {
  const itens = [{ id: 'a', base: true }, { id: 'b', base: false }];
  const combos = [{ a: 'a', b: 'a', resultado: 'b' }];
  const set = calcularAlemDoMapa(itens, combos);
  assert.ok(set.has('b'), 'b nunca é ingrediente: além do mapa');
  assert.ok(!set.has('a'), 'a produz b: não é além do mapa');
});

test('combo self+self=self não conta como "produz outro item"', () => {
  const itens = [{ id: 'x', base: true }];
  const combos = [{ a: 'x', b: 'x', resultado: 'x' }];
  const set = calcularAlemDoMapa(itens, combos);
  assert.ok(set.has('x'), 'x só reproduz a si mesmo: continua além do mapa');
});

test('participar de UMA combinação que produz outro item já basta pra não ser além do mapa', () => {
  const itens = [{ id: 'x', base: true }, { id: 'y', base: false }, { id: 'z', base: false }];
  // x aparece em duas combinações: uma que só reproduz z, outra que produz y
  const combos = [
    { a: 'x', b: 'z', resultado: 'z' },
    { a: 'x', b: 'y', resultado: 'y' },
  ];
  const set = calcularAlemDoMapa(itens, combos);
  assert.ok(!set.has('x'));
});

test('resultado da IA nunca conta pro cálculo (mesmo se registrado no catálogo em runtime)', () => {
  const cat = criarCatalogo();
  const antes = cat.allItems().filter((it) => cat.ehAlemDoMapa(it.id)).map((it) => it.id).sort();

  // registra uma criação de IA usando dois itens curados quaisquer
  const base = cat.baseItems()[0];
  const outroBase = cat.baseItems()[1];
  const novo = cat.registrarItemIA({
    nome: 'Coisa Inventada', emoji: '✨', era: 'ficcao', idA: base.id, idB: outroBase.id,
  });
  cat.registrarComboIA(base.id, outroBase.id, novo.id, 'teste');

  // a classificação não deve ter mudado nem incluir o item novo da IA
  const depois = cat.allItems().filter((it) => cat.ehAlemDoMapa(it.id)).map((it) => it.id).sort();
  assert.deepEqual(depois, antes);
  assert.equal(cat.ehAlemDoMapa(novo.id), false);
});

test('catálogo real: itens-base bem conectados não são além do mapa; folhas terminais são', () => {
  const cat = criarCatalogo();
  assert.equal(cat.ehAlemDoMapa('agua'), false);
  assert.equal(cat.ehAlemDoMapa('fogo'), false);
  // "lua" só aparece como resultado (ceu+pedra), nunca como ingrediente de
  // uma combinação curada que produza algo diferente dela
  assert.equal(cat.ehAlemDoMapa('lua'), true);
});

test('item inexistente não quebra a checagem (retorna false, não é spoiler nem erro)', () => {
  const cat = criarCatalogo();
  assert.equal(cat.ehAlemDoMapa('id-que-nao-existe'), false);
});
