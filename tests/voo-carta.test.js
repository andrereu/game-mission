import test from 'node:test';
import assert from 'node:assert/strict';
import { animarVooParaDestino } from '../src/ui/voo-carta.js';

// cada teste começa com o DOM limpo — a animação deixa o destino "pulsando"
// por até ~550ms mesmo depois do teste seguir em frente, e isso não pode
// vazar pro próximo teste (por isso o innerHTML='' antes de cada um).
function elementoNaTela() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

// jsdom não implementa Element.animate (Web Animations API) nem
// window.matchMedia — o próprio código de produção detecta isso e cai no
// fallback de fade, que é exatamente o comportamento também exigido por
// prefers-reduced-motion. Então estes testes cobrem os dois de uma vez.

test('sem destino: recolhe a origem e chama aoTerminar, sem lançar erro', async () => {
  document.body.innerHTML = '';
  const origem = elementoNaTela();
  let terminou = false;
  animarVooParaDestino({ origemEl: origem, destinoEl: null, aoTerminar: () => { terminou = true; } });
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(terminou);
  assert.equal(document.body.contains(origem), false, 'a origem foi removida do DOM');
});

test('sem origem: só chama aoTerminar (nada pra animar)', () => {
  document.body.innerHTML = '';
  let terminou = false;
  animarVooParaDestino({ origemEl: null, destinoEl: elementoNaTela(), aoTerminar: () => { terminou = true; } });
  assert.ok(terminou);
});

test('com destino (fallback sem WAAPI/jsdom): remove a origem e pulsa o destino', async () => {
  document.body.innerHTML = '';
  const origem = elementoNaTela();
  const destino = elementoNaTela();
  let terminou = false;
  animarVooParaDestino({ origemEl: origem, destinoEl: destino, aoTerminar: () => { terminou = true; } });

  await new Promise((r) => setTimeout(r, 300));
  assert.equal(document.body.contains(origem), false, 'a origem some ao final');
  assert.ok(terminou, 'aoTerminar foi chamado');
  assert.ok(destino.classList.contains('recebendo-carta'), 'o destino pulsa ao receber');

  await new Promise((r) => setTimeout(r, 700));
  assert.ok(!destino.classList.contains('recebendo-carta'), 'o pulso é passageiro, não fica permanente');
});

test('prefers-reduced-motion: nunca chama Element.animate, mesmo quando ela existe', async () => {
  document.body.innerHTML = '';
  const origem = elementoNaTela();
  const destino = elementoNaTela();

  let chamouAnimate = false;
  origem.animate = () => { chamouAnimate = true; return { onfinish: null, oncancel: null }; };

  const antesMatchMedia = window.matchMedia;
  window.matchMedia = (query) => ({ matches: query.includes('reduce'), media: query });

  let terminou = false;
  try {
    animarVooParaDestino({ origemEl: origem, destinoEl: destino, aoTerminar: () => { terminou = true; } });
    await new Promise((r) => setTimeout(r, 300));
  } finally {
    window.matchMedia = antesMatchMedia;
  }

  assert.equal(chamouAnimate, false, 'com movimento reduzido, nunca deveria chamar animate()');
  assert.ok(terminou);
  assert.equal(document.body.contains(origem), false);
  assert.ok(destino.classList.contains('recebendo-carta'));
});

test('nunca deixa mais de uma origem acumulada: cada chamada remove a sua própria', async () => {
  document.body.innerHTML = '';
  const destino = elementoNaTela();
  const origem1 = elementoNaTela();
  const origem2 = elementoNaTela();
  animarVooParaDestino({ origemEl: origem1, destinoEl: destino, aoTerminar() {} });
  animarVooParaDestino({ origemEl: origem2, destinoEl: destino, aoTerminar() {} });
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(document.body.contains(origem1), false);
  assert.equal(document.body.contains(origem2), false);
  assert.equal(document.querySelectorAll('.recebendo-carta').length, 1, 'ainda é o mesmo destino, sem duplicar nada nele');
});
