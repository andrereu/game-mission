import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo, ERAS } from '../src/engine/catalogo.js';
import {
  progressoPorEra, erasAlcancadas, eraMaisAvancada, eraHerdada,
} from '../src/engine/eras.js';

test('progressoPorEra conta descobertos e total por era, na ordem das eras', () => {
  const cat = criarCatalogo();
  const desc = { agua: {}, fogo: {}, terra: {}, ar: {}, vapor: {} };
  const p = progressoPorEra(desc, cat);
  assert.deepEqual(p.map((x) => x.era), ERAS);

  const elem = p.find((x) => x.era === 'elementos');
  assert.equal(elem.descobertos, 5);
  assert.ok(elem.total >= 20, `total de elementos: ${elem.total}`);
  assert.ok(elem.descobertos <= elem.total);

  assert.equal(p.find((x) => x.era === 'vida').descobertos, 0);
});

test('erasAlcancadas = eras com pelo menos um descoberto', () => {
  const cat = criarCatalogo();
  const alc = erasAlcancadas({ agua: {}, fogo: {}, vapor: {}, bicho: {} }, cat);
  assert.ok(alc.has('elementos'));
  assert.ok(alc.has('vida'));
  assert.ok(!alc.has('natureza'));
  assert.ok(!alc.has('ficcao'));
});

test('eraHerdada: iguais -> essa; diferentes -> a mais avançada', () => {
  assert.equal(eraHerdada('vida', 'vida'), 'vida');
  assert.equal(eraHerdada('elementos', 'ficcao'), 'ficcao');
  assert.equal(eraHerdada('cultura', 'vida'), 'cultura');
  assert.equal(eraHerdada('bobagem', 'natureza'), 'natureza');
  assert.equal(eraHerdada(null, null), 'ficcao');
});

test('progressoPorEra ignora itens da IA (não mexe no total nem na contagem)', () => {
  const cat = criarCatalogo();
  const antes = progressoPorEra({}, cat).find((p) => p.era === 'vida').total;
  const it = cat.registrarItemIA({ nome: 'Bicho Mágico', emoji: '✨', era: 'vida' });
  const depois = progressoPorEra({ [it.id]: { fonte: 'ia' } }, cat).find((p) => p.era === 'vida');
  assert.equal(depois.total, antes, 'total da era não muda');
  assert.equal(depois.descobertos, 0, 'item da IA não conta como progresso da era');
});

test('eraMaisAvancada devolve a última alcançada na ordem', () => {
  assert.equal(eraMaisAvancada(new Set(['elementos', 'vida', 'natureza'])), 'vida');
  assert.equal(eraMaisAvancada(new Set(['ficcao', 'elementos'])), 'ficcao');
  assert.equal(eraMaisAvancada(new Set()), 'elementos');
  assert.equal(eraMaisAvancada(['tecnologia', 'elementos']), 'tecnologia'); // aceita array
});
