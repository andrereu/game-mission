import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularProfundidadesCatalogo,
  calcularRaridadesCatalogo,
  calcularRaridadeIA,
  classificarPontuacao,
  pontuacaoRaridade,
  NIVEIS_RARIDADE,
} from '../src/engine/raridade.js';
import { itens } from '../src/data/itens.js';
import { combos } from '../src/data/combos.js';

test('itens base têm profundidade 0', () => {
  const prof = calcularProfundidadesCatalogo(itens, combos);
  for (const it of itens.filter((i) => i.base)) {
    assert.equal(prof.get(it.id), 0, `${it.id} deveria ter profundidade 0`);
  }
});

test('profundidade de um item combinado é 1 + a maior dos dois ingredientes', () => {
  const prof = calcularProfundidadesCatalogo(itens, combos);
  // vapor = água(0) + fogo(0)
  assert.equal(prof.get('vapor'), 1);
});

test('é determinística: mesmo catálogo produz sempre o mesmo resultado', () => {
  const r1 = calcularRaridadesCatalogo(itens, combos);
  const r2 = calcularRaridadesCatalogo(itens, combos);
  for (const it of itens) assert.equal(r1.get(it.id), r2.get(it.id));
});

test('item com `ref` é sempre lendário, não entra na fórmula', () => {
  const rar = calcularRaridadesCatalogo(itens, combos);
  for (const it of itens.filter((i) => i.ref)) {
    assert.equal(rar.get(it.id), 'lendario', `${it.id} tem ref e devia ser lendário`);
  }
});

test('itens base (profundidade 0, era elementos) são comuns', () => {
  const rar = calcularRaridadesCatalogo(itens, combos);
  assert.equal(rar.get('agua'), 'comum');
  assert.equal(rar.get('terra'), 'comum');
});

test('classificarPontuacao cobre os 4 níveis em ordem crescente', () => {
  assert.equal(classificarPontuacao(0), 'comum');
  assert.equal(classificarPontuacao(9), 'raro');
  assert.equal(classificarPontuacao(11), 'epico');
  assert.equal(classificarPontuacao(99), 'lendario');
});

test('pontuacaoRaridade soma índice da era com a profundidade', () => {
  assert.equal(pontuacaoRaridade('elementos', 3), 3);
  assert.equal(pontuacaoRaridade('ficcao', 2), 7);
  assert.equal(pontuacaoRaridade('era-desconhecida', 2), 2);
});

test('calcularRaridadeIA usa a maior profundidade dos dois pais + 1', () => {
  // dois itens base (profundidade 0) combinados => profundidade 1
  const r = calcularRaridadeIA('elementos', 0, 0);
  assert.equal(r, classificarPontuacao(pontuacaoRaridade('elementos', 1)));
});

test('a distribuição de raridade do catálogo forma uma pirâmide (comum é a mais comum)', () => {
  const rar = calcularRaridadesCatalogo(itens, combos);
  const contagem = Object.fromEntries(NIVEIS_RARIDADE.map((n) => [n, 0]));
  for (const r of rar.values()) contagem[r] += 1;
  assert.ok(contagem.comum > contagem.raro);
  assert.ok(contagem.raro > contagem.epico || contagem.raro > contagem.lendario);
  assert.ok(contagem.comum > contagem.lendario);
});
