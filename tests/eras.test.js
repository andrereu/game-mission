import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo, ERAS } from '../src/engine/catalogo.js';
import { progressoPorEra, erasAlcancadas, eraMaisAvancada } from '../src/engine/eras.js';

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

test('eraMaisAvancada devolve a última alcançada na ordem', () => {
  assert.equal(eraMaisAvancada(new Set(['elementos', 'vida', 'natureza'])), 'vida');
  assert.equal(eraMaisAvancada(new Set(['ficcao', 'elementos'])), 'ficcao');
  assert.equal(eraMaisAvancada(new Set()), 'elementos');
  assert.equal(eraMaisAvancada(['tecnologia', 'elementos']), 'tecnologia'); // aceita array
});
