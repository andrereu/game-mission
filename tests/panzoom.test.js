import test from 'node:test';
import assert from 'node:assert/strict';
import { ligarPanZoom } from '../src/ui/panzoom.js';

function alvoFake() {
  document.body.innerHTML = '<div id="alvo"></div>';
  return document.getElementById('alvo');
}

function ptr(tipo, id, x, y) {
  const e = new window.Event(tipo, { bubbles: true, cancelable: true });
  e.pointerId = id;
  e.clientX = x;
  e.clientY = y;
  return e;
}

function roda(deltaY, x = 0, y = 0) {
  const e = new window.Event('wheel', { bubbles: true, cancelable: true });
  e.deltaY = deltaY;
  e.clientX = x;
  e.clientY = y;
  return e;
}

function montar(extra = {}) {
  const alvo = alvoFake();
  const vista = { x: 0, y: 0, escala: 1 };
  let aplicou = 0;
  ligarPanZoom({
    alvo, vista, aplicar: () => { aplicou += 1; }, zoomMin: 0.5, zoomMax: 3, ...extra,
  });
  return { alvo, vista, aplicou: () => aplicou };
}

test('um ponteiro arrastando faz pan', () => {
  const { alvo, vista } = montar();
  alvo.dispatchEvent(ptr('pointerdown', 1, 100, 100));
  alvo.dispatchEvent(ptr('pointermove', 1, 130, 90));
  assert.deepEqual([vista.x, vista.y], [30, -10]);
  alvo.dispatchEvent(ptr('pointerup', 1, 130, 90));
  alvo.dispatchEvent(ptr('pointermove', 1, 200, 200));
  assert.deepEqual([vista.x, vista.y], [30, -10], 'depois de soltar não move mais');
});

test('scroll pra cima aproxima, com limite', () => {
  const { alvo, vista } = montar();
  alvo.dispatchEvent(roda(-100));
  assert.ok(vista.escala > 1);
  for (let i = 0; i < 40; i += 1) alvo.dispatchEvent(roda(-100));
  assert.equal(vista.escala, 3, 'trava no zoomMax');
});

test('scroll pra baixo afasta, com limite', () => {
  const { alvo, vista } = montar();
  for (let i = 0; i < 40; i += 1) alvo.dispatchEvent(roda(100));
  assert.equal(vista.escala, 0.5, 'trava no zoomMin');
});

test('dois dedos afastando aumentam a escala (pinça)', () => {
  const { alvo, vista } = montar();
  alvo.dispatchEvent(ptr('pointerdown', 1, 100, 100));
  alvo.dispatchEvent(ptr('pointerdown', 2, 200, 100)); // dist inicial 100
  alvo.dispatchEvent(ptr('pointermove', 2, 300, 100)); // dist 200 -> fator 2
  assert.ok(Math.abs(vista.escala - 2) < 1e-6, `escala ${vista.escala}`);
});

test('dois dedos juntando diminuem a escala', () => {
  const { alvo, vista } = montar();
  alvo.dispatchEvent(ptr('pointerdown', 1, 100, 100));
  alvo.dispatchEvent(ptr('pointerdown', 2, 300, 100)); // dist 200
  alvo.dispatchEvent(ptr('pointermove', 2, 200, 100)); // dist 100 -> fator 0.5
  assert.ok(Math.abs(vista.escala - 0.5) < 1e-6, `escala ${vista.escala}`);
});

test('permitePan falso ignora o gesto', () => {
  const { alvo, vista } = montar({ permitePan: () => false });
  alvo.dispatchEvent(ptr('pointerdown', 1, 0, 0));
  alvo.dispatchEvent(ptr('pointermove', 1, 50, 50));
  assert.deepEqual([vista.x, vista.y, vista.escala], [0, 0, 1]);
});
