import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo, comboKey, ERAS } from '../src/engine/catalogo.js';

test('comboKey é simétrica', () => {
  assert.equal(comboKey('fogo', 'agua'), comboKey('agua', 'fogo'));
  assert.equal(comboKey('agua', 'fogo'), 'agua+fogo');
});

test('registrarItemIA marca o item como ia e respeita a era passada', () => {
  const cat = criarCatalogo();
  const a = cat.registrarItemIA({ nome: 'Nuvem Doce', emoji: '☁️', era: 'natureza' });
  assert.equal(a.ia, true);
  assert.equal(a.era, 'natureza');
  const b = cat.registrarItemIA({ nome: 'Coisa', emoji: '✨', era: 'inventada' });
  assert.equal(b.era, 'ficcao', 'era inválida cai em ficcao');
});

test('getItem e baseItems', () => {
  const cat = criarCatalogo();
  assert.equal(cat.getItem('agua').nome, 'Água');
  assert.equal(cat.getItem('nao-existe'), undefined);
  assert.ok(cat.baseItems().every((it) => it.base === true));
  assert.ok(cat.baseItems().length >= 4);
});

test('findCombo acha nos dois sentidos', () => {
  const cat = criarCatalogo();
  assert.equal(cat.findCombo('agua', 'fogo').resultado, 'vapor');
  assert.equal(cat.findCombo('fogo', 'agua').resultado, 'vapor');
  assert.equal(cat.findCombo('agua', 'agua').resultado, 'oceano');
  assert.equal(cat.findCombo('agua', 'robo'), undefined);
});

test('registrarItemIA cria e não duplica', () => {
  const cat = criarCatalogo();
  const a = cat.registrarItemIA({ nome: 'Dragão de Gelo', emoji: '🐉' });
  assert.equal(a.id, 'dragao-de-gelo');
  assert.equal(a.era, 'ficcao');
  assert.equal(a.base, false);
  const b = cat.registrarItemIA({ nome: 'Dragão de Gelo', emoji: '❄️' });
  assert.equal(b, a);
  assert.equal(cat.getItem('dragao-de-gelo'), a);
});

test('registrarItemIA sem emoji e era inválida', () => {
  const cat = criarCatalogo();
  const it = cat.registrarItemIA({ nome: 'Coisa', era: 'inventada' });
  assert.equal(it.emoji, '✨');
  assert.equal(it.era, 'ficcao');
});

test('registrarComboIA fica disponível em findCombo', () => {
  const cat = criarCatalogo();
  cat.registrarItemIA({ nome: 'Gelo', emoji: '🧊' });
  cat.registrarComboIA('agua', 'ar', 'gelo', 'Ar muito frio congela a água.');
  assert.equal(cat.findCombo('ar', 'agua').resultado, 'gelo');
});

test('hidratarIA repõe itens e combos da IA num catálogo novo (troca de sessão)', () => {
  const original = criarCatalogo();
  const item = original.registrarItemIA({ nome: 'Nuvem Quente', emoji: '🌫️', era: 'natureza' });
  original.registrarComboIA('vapor', 'calor', item.id, 'Vapor com calor vira nuvem quente.');

  // simula um novo boot: catálogo recriado do zero, só com os dados base
  const novo = criarCatalogo();
  assert.equal(novo.getItem(item.id), undefined);
  assert.equal(novo.findCombo('vapor', 'calor'), undefined);

  novo.hidratarIA(
    { [item.id]: { nome: item.nome, emoji: item.emoji, era: item.era } },
    { [comboKey('vapor', 'calor')]: { a: 'vapor', b: 'calor', resultado: item.id, texto: 'x' } },
  );

  const repos = novo.getItem(item.id);
  assert.ok(repos, 'item da IA devia voltar depois de hidratar');
  assert.equal(repos.ia, true);
  assert.equal(repos.emoji, '🌫️');
  assert.equal(novo.findCombo('vapor', 'calor').resultado, item.id);
});

test('hidratarIA não sobrescreve itens/combos já existentes', () => {
  const cat = criarCatalogo();
  const item = cat.registrarItemIA({ nome: 'Coisa', emoji: '✨' });
  cat.hidratarIA({ [item.id]: { nome: 'Outro nome', emoji: '❓' } }, {});
  assert.equal(cat.getItem(item.id).nome, 'Coisa');
});

test('ERAS tem as seis eras', () => {
  assert.deepEqual(ERAS, ['elementos', 'natureza', 'vida', 'tecnologia', 'cultura', 'ficcao']);
});

test('getRaridade: item com ref é sempre lendário', () => {
  const cat = criarCatalogo();
  assert.equal(cat.getRaridade('homem-aranha'), 'lendario');
  assert.equal(cat.getRaridade('pikachu'), 'lendario');
});

test('getRaridade: item base é comum', () => {
  const cat = criarCatalogo();
  assert.equal(cat.getRaridade('agua'), 'comum');
});

test('getRaridade: item da IA usa a raridade calculada na criação (registrarItemIA)', () => {
  const cat = criarCatalogo();
  const item = cat.registrarItemIA({
    nome: 'Nuvem Quente', emoji: '☁️', era: 'elementos', idA: 'agua', idB: 'fogo',
  });
  assert.equal(cat.getRaridade(item.id), item.raridade);
});

test('getRaridade: item da IA hidratado usa a raridade persistida, não recalcula', () => {
  const cat = criarCatalogo();
  cat.hidratarIA({
    forjado: {
      nome: 'Forjado', emoji: '✨', era: 'elementos', raridade: 'lendario', profundidade: 0,
    },
  }, {});
  // se recalculasse pela fórmula, um item de era "elementos" e profundidade 0
  // teria saído "comum" — a raridade persistida tem que prevalecer.
  assert.equal(cat.getRaridade('forjado'), 'lendario');
});

test('getDescricao: item base tem descrição genérica; item combinado usa o texto do combo', () => {
  const cat = criarCatalogo();
  assert.equal(cat.getDescricao('agua').length > 0, true);
  const combo = cat.findCombo('agua', 'fogo');
  assert.equal(cat.getDescricao('vapor'), combo.texto);
});

test('getComboDoResultado acha a receita que gera um item', () => {
  const cat = criarCatalogo();
  const combo = cat.getComboDoResultado('vapor');
  assert.deepEqual([combo.a, combo.b].sort(), ['agua', 'fogo']);
});
