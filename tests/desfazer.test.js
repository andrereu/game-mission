import test from 'node:test';
import assert from 'node:assert/strict';
import { mostrarDesfazer } from '../src/ui/desfazer.js';
import { T } from '../src/data/textos.js';

function raizLimpa() {
  document.body.innerHTML = '<div id="r"></div>';
  return document.getElementById('r');
}
const espera = (ms) => new Promise((res) => setTimeout(res, ms));

test('mostra o chip e o clique em Desfazer chama aoDesfazer e some', () => {
  const raiz = raizLimpa();
  let feito = 0;
  mostrarDesfazer({ raiz, T, aoDesfazer: () => { feito += 1; }, ms: 5000 });
  const chip = raiz.querySelector('.desfazer-chip');
  assert.ok(chip);
  chip.querySelector('.desfazer-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(feito, 1);
  assert.equal(raiz.querySelector('.desfazer-chip'), null);
});

test('o chip some sozinho depois de ms', async () => {
  const raiz = raizLimpa();
  mostrarDesfazer({ raiz, T, aoDesfazer() {}, ms: 40 });
  assert.ok(raiz.querySelector('.desfazer-chip'));
  await espera(70);
  assert.equal(raiz.querySelector('.desfazer-chip'), null);
});

test('fechar() remove o chip antes do tempo', () => {
  const raiz = raizLimpa();
  const api = mostrarDesfazer({ raiz, T, aoDesfazer() {}, ms: 5000 });
  api.fechar();
  assert.equal(raiz.querySelector('.desfazer-chip'), null);
});
