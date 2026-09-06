// tests/canvas.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo } from '../src/engine/catalogo.js';
import { criarStore } from '../src/engine/state.js';
import { criarCombinador } from '../src/engine/combinar.js';
import { stubDesligado } from '../src/ai/provider.js';
import { montarCanvas } from '../src/ui/canvas.js';
import { T } from '../src/data/textos.js';

function ponteiro(tipo, clientX, clientY) {
  return new window.MouseEvent(tipo, { clientX, clientY, bubbles: true });
}

function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function montarComMargem(margemFusao) {
  document.body.innerHTML = '<section id="canvas" class="canvas"></section>';
  const store = criarStore({
    versao: 1, descobertos: { agua: {}, fogo: {} }, canvas: [], ajustes: {},
  });
  const api = montarCanvas({
    raiz: document.getElementById('canvas'), store, catalogo: criarCatalogo(),
    combinar: async () => ({ tipo: 'nada' }), aoResultado() {}, margemFusao,
  });
  const alvo = api.soltarItem('fogo', 0, 0); // caixa 0..40
  const perto = api.soltarItem('agua', 0, 0);
  for (const el of document.querySelectorAll('.peca')) {
    Object.defineProperty(el, 'offsetWidth', { value: 40, configurable: true });
    Object.defineProperty(el, 'offsetHeight', { value: 40, configurable: true });
  }
  store.moveInstance(perto.uid, 50, 50); // centro de "perto" ~70,70
  return { api, alvo, perto };
}

test('sem margem, uma peça um pouco fora não encaixa', () => {
  const { api, perto } = montarComMargem(0);
  assert.equal(api._alvoSobParaTeste(perto.uid), null);
});

test('margemFusao infla a área de encaixe da peça-alvo', () => {
  const { api, alvo, perto } = montarComMargem(40);
  assert.equal(api._alvoSobParaTeste(perto.uid), alvo.uid);
});

test('mostra um "pensando" no canvas enquanto a combinação demora', async () => {
  document.body.innerHTML = '<section id="canvas" class="canvas"></section>';
  const cat = criarCatalogo();
  const store = criarStore({
    versao: 1, descobertos: { agua: {}, fogo: {} }, canvas: [], ajustes: { som: false },
  });
  const api = montarCanvas({
    raiz: document.getElementById('canvas'),
    store,
    catalogo: cat,
    combinar: async () => { await esperar(300); return { tipo: 'nada' }; },
    aoResultado: () => {},
  });
  const a = api.soltarItem('agua', 10, 10);
  const b = api.soltarItem('fogo', 12, 12);
  const p = api._fundirParaTeste(a.uid, b.uid, { x: 10, y: 10 });
  await esperar(280);
  assert.ok(document.querySelector('.peca-pensando'), 'apareceu o indicador de espera');
  await p;
  assert.equal(document.querySelector('.peca-pensando'), null, 'sumiu ao terminar');
});

test('combinação rápida não chega a mostrar o "pensando"', async () => {
  document.body.innerHTML = '<section id="canvas" class="canvas"></section>';
  const cat = criarCatalogo();
  const store = criarStore({
    versao: 1, descobertos: { agua: {}, fogo: {} }, canvas: [], ajustes: { som: false },
  });
  const api = montarCanvas({
    raiz: document.getElementById('canvas'),
    store,
    catalogo: cat,
    combinar: async () => ({ tipo: 'nada' }),
    aoResultado: () => {},
  });
  const a = api.soltarItem('agua', 10, 10);
  const b = api.soltarItem('fogo', 12, 12);
  await api._fundirParaTeste(a.uid, b.uid, { x: 10, y: 10 });
  await esperar(0);
  assert.equal(document.querySelector('.peca-pensando'), null);
});

function ambiente() {
  document.body.innerHTML = '<section id="canvas" class="canvas"></section>';
  const cat = criarCatalogo();
  const store = criarStore({
    versao: 1,
    descobertos: {
      agua: { em: 1, via: null, fonte: 'base' },
      fogo: { em: 1, via: null, fonte: 'base' },
    },
    canvas: [],
    ajustes: { som: false, iaLigada: false },
  });
  const combinar = criarCombinador({
    catalogo: cat, aiProvider: stubDesligado, estaOnline: () => false,
  });
  return { cat, store, combinar, raiz: document.getElementById('canvas') };
}

test('soltarItem cria uma peça no DOM e no store', () => {
  const { cat, store, combinar, raiz } = ambiente();
  const api = montarCanvas({ raiz, store, catalogo: cat, combinar, aoResultado() {} });
  api.soltarItem('agua', 100, 100);
  assert.equal(store.listInstances().length, 1);
  assert.equal(raiz.querySelectorAll('.peca').length, 1);
});

test('fundir duas peças sobrepostas gera o resultado e a descoberta', async () => {
  const { cat, store, combinar, raiz } = ambiente();
  const resultados = [];
  const api = montarCanvas({
    raiz, store, catalogo: cat, combinar,
    aoResultado: (r, ctx) => resultados.push({ r, ctx }),
  });
  const a = api.soltarItem('agua', 100, 100);
  const b = api.soltarItem('fogo', 100, 100); // mesma posição = sobreposto
  await api._fundirParaTeste(a.uid, b.uid);
  assert.ok(store.isDiscovered('vapor'));
  const ids = store.listInstances().map((i) => i.id);
  assert.deepEqual(ids, ['vapor']);
  assert.equal(resultados.at(-1).r.item.id, 'vapor');
  assert.equal(resultados.at(-1).ctx.novo, true);
});

test('soltarItem converte coordenadas de tela para o mundo (pan + zoom)', () => {
  const { cat, store, combinar, raiz } = ambiente();
  const api = montarCanvas({ raiz, store, catalogo: cat, combinar, aoResultado() {} });
  api._setVistaParaTeste({ x: 50, y: -30, escala: 2 });
  const inst = api.soltarItem('agua', 150, 70);
  // mundo = (tela - vista) / escala
  assert.equal(store.getInstance(inst.uid).x, 50);
  assert.equal(store.getInstance(inst.uid).y, 50);
});

test('soltarItem ignora id que o catálogo não conhece', () => {
  const { cat, store, combinar, raiz } = ambiente();
  const api = montarCanvas({ raiz, store, catalogo: cat, combinar, aoResultado() {} });
  assert.equal(api.soltarItem('item-fantasma', 10, 10), null);
  assert.equal(store.listInstances().length, 0);
  assert.equal(raiz.querySelectorAll('.peca').length, 0);
});

test('render ignora instâncias salvas com id desconhecido', () => {
  const { cat, store, combinar, raiz } = ambiente();
  store.getSave().canvas.push({ uid: 'u_x', id: 'item-fantasma', x: 0, y: 0 });
  store.getSave().canvas.push({ uid: 'u_y', id: 'agua', x: 5, y: 5 });
  const api = montarCanvas({ raiz, store, catalogo: cat, combinar, aoResultado() {} });
  api.render();
  assert.equal(raiz.querySelectorAll('.peca').length, 1);
});

test('fusão sem resultado devolve a peça arrastada para a posição inicial', async () => {
  const { cat, store, raiz } = ambiente();
  const combinar = async () => ({ tipo: 'nada' }); // isola do catálogo
  const resultados = [];
  const api = montarCanvas({
    raiz, store, catalogo: cat, combinar,
    aoResultado: (r, ctx) => resultados.push({ r, ctx }),
  });
  const a = api.soltarItem('agua', 10, 20); // posição de partida
  const b = api.soltarItem('ar', 300, 300);
  // simula que "a" foi arrastada até "b" antes de tentar a fusão
  store.moveInstance(a.uid, 300, 300);
  await api._fundirParaTeste(a.uid, b.uid, { x: 10, y: 20 });

  const r = resultados.at(-1);
  assert.equal(r.r.tipo, 'nada');
  const dep = store.getInstance(a.uid);
  assert.equal(dep.x, 10);
  assert.equal(dep.y, 20);
  assert.equal(r.ctx.x, 10);
  assert.equal(r.ctx.y, 20);
  const el = raiz.querySelector(`.peca[data-uid="${a.uid}"]`);
  assert.equal(el.style.left, '10px');
  assert.equal(el.style.top, '20px');
  assert.ok(el.classList.contains('quique'));
  // as duas peças continuam no canvas
  assert.equal(store.listInstances().length, 2);
});

test('fusão sem resultado com som ligado não quebra', async () => {
  const { cat, store, raiz } = ambiente();
  const combinar = async () => ({ tipo: 'nada' }); // isola do catálogo
  store.getSave().ajustes.som = true;
  const api = montarCanvas({ raiz, store, catalogo: cat, combinar, aoResultado() {} });
  const a = api.soltarItem('agua', 0, 0);
  const b = api.soltarItem('ar', 0, 0);
  await api._fundirParaTeste(a.uid, b.uid, { x: 0, y: 0 });
  assert.equal(store.listInstances().length, 2);
  assert.equal(raiz.querySelector('.canvas-aviso').textContent, T.nadaAconteceu);
});

test('toque longo remove a peça quando o ponteiro fica parado', async () => {
  const { cat, store, combinar, raiz } = ambiente();
  const api = montarCanvas({ raiz, store, catalogo: cat, combinar, aoResultado() {} });
  const a = api.soltarItem('agua', 0, 0);
  const el = raiz.querySelector(`.peca[data-uid="${a.uid}"]`);
  el.dispatchEvent(ponteiro('pointerdown', 100, 100));
  el.dispatchEvent(ponteiro('pointermove', 102, 101)); // < 6px: ainda é toque longo
  await esperar(600);
  assert.equal(store.getInstance(a.uid), undefined);
});

test('mover além do limiar cancela o toque longo', async () => {
  const { cat, store, combinar, raiz } = ambiente();
  const api = montarCanvas({ raiz, store, catalogo: cat, combinar, aoResultado() {} });
  const a = api.soltarItem('agua', 0, 0);
  const el = raiz.querySelector(`.peca[data-uid="${a.uid}"]`);
  el.dispatchEvent(ponteiro('pointerdown', 100, 100));
  el.dispatchEvent(ponteiro('pointermove', 140, 140)); // arrasto de verdade
  await esperar(600);
  assert.ok(store.getInstance(a.uid), 'a peça não devia ter sido apagada');
});

test('pointercancel e lostpointercapture cancelam o toque longo', async () => {
  const { cat, store, combinar, raiz } = ambiente();
  const api = montarCanvas({ raiz, store, catalogo: cat, combinar, aoResultado() {} });
  const a = api.soltarItem('agua', 0, 0);
  const b = api.soltarItem('ar', 500, 500);
  const elA = raiz.querySelector(`.peca[data-uid="${a.uid}"]`);
  const elB = raiz.querySelector(`.peca[data-uid="${b.uid}"]`);
  elA.dispatchEvent(ponteiro('pointerdown', 10, 10));
  elA.dispatchEvent(ponteiro('pointercancel', 10, 10));
  elB.dispatchEvent(ponteiro('pointerdown', 10, 10));
  elB.dispatchEvent(ponteiro('lostpointercapture', 10, 10));
  await esperar(600);
  assert.ok(store.getInstance(a.uid), 'pointercancel devia ter cancelado');
  assert.ok(store.getInstance(b.uid), 'lostpointercapture devia ter cancelado');
});

test('destruirTudo limpa o canvas mas não as descobertas', async () => {
  const { cat, store, combinar, raiz } = ambiente();
  const api = montarCanvas({ raiz, store, catalogo: cat, combinar, aoResultado() {} });
  const a = api.soltarItem('agua', 10, 10);
  const b = api.soltarItem('fogo', 10, 10);
  await api._fundirParaTeste(a.uid, b.uid);
  api.soltarItem('agua', 200, 200);
  api.destruirTudo();
  assert.equal(store.listInstances().length, 0);
  assert.equal(raiz.querySelectorAll('.peca').length, 0);
  assert.ok(store.isDiscovered('vapor'));
});
