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

test('ERAS tem as seis eras', () => {
  assert.deepEqual(ERAS, ['elementos', 'natureza', 'vida', 'tecnologia', 'cultura', 'ficcao']);
});
