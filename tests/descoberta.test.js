import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo } from '../src/engine/catalogo.js';
import { mostrarDescoberta } from '../src/ui/descoberta.js';

function limparRaiz() {
  document.body.innerHTML = '<div id="overlay-raiz"></div>';
}

test('mostra o overlay com nome, selo e origem', async () => {
  limparRaiz();
  const cat = criarCatalogo();
  const p = mostrarDescoberta({
    item: cat.getItem('vapor'),
    combo: cat.findCombo('agua', 'fogo'),
    catalogo: cat,
    comSom: false,
  });
  const over = document.querySelector('.descoberta-overlay');
  assert.ok(over, 'overlay no DOM');
  assert.match(over.textContent, /Vapor/);
  assert.match(over.textContent, /NOVO!/);
  assert.match(over.textContent, /Água/);
  assert.match(over.textContent, /Fogo/);
  // fecha com clique e resolve
  over.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await p;
  assert.equal(document.querySelector('.descoberta-overlay'), null);
});

test('fecha com tecla', async () => {
  limparRaiz();
  const cat = criarCatalogo();
  const p = mostrarDescoberta({
    item: cat.getItem('lava'), combo: cat.findCombo('fogo', 'terra'),
    catalogo: cat, comSom: true,
  });
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));
  await p;
  assert.equal(document.querySelector('.descoberta-overlay'), null);
});
