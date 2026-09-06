import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo, ERAS } from '../src/engine/catalogo.js';
import { criarStore } from '../src/engine/state.js';
import { montarLinhaDoTempo } from '../src/ui/eras.js';
import { mostrarEraNova } from '../src/ui/era-nova.js';
import { T } from '../src/data/textos.js';

function raizLimpa(id) {
  document.body.innerHTML = `<div id="${id}"></div>`;
  return document.getElementById(id);
}

test('linha do tempo mostra as 6 eras com progresso e marca as alcançadas', () => {
  const raiz = raizLimpa('eras-raiz');
  const cat = criarCatalogo();
  const store = criarStore({
    versao: 1,
    descobertos: { agua: {}, fogo: {}, terra: {}, ar: {}, vapor: {}, bicho: {} },
    canvas: [],
    ajustes: {},
  });
  const lt = montarLinhaDoTempo({ raiz, store, catalogo: cat, T });
  lt.abrir();

  const linhas = raiz.querySelectorAll('.era-linha');
  assert.equal(linhas.length, 6);
  assert.deepEqual([...linhas].map((l) => l.dataset.era), ERAS);

  const elem = raiz.querySelector('.era-linha[data-era="elementos"]');
  assert.ok(elem.classList.contains('alcancada'));
  assert.match(elem.textContent, /5\s*\/\s*\d+/); // 5 descobertos em elementos

  const vida = raiz.querySelector('.era-linha[data-era="vida"]');
  assert.ok(vida.classList.contains('alcancada'));

  const nat = raiz.querySelector('.era-linha[data-era="natureza"]');
  assert.ok(!nat.classList.contains('alcancada'));

  lt.fechar();
  assert.equal(raiz.querySelector('.eras-overlay'), null);
});

test('mostrarEraNova mostra o nome da era e fecha no clique', async () => {
  raizLimpa('overlay-raiz');
  const p = mostrarEraNova({
    era: 'vida',
    progresso: [{ era: 'elementos', descobertos: 4, total: 30 }],
    T,
  });
  const over = document.querySelector('.era-nova-overlay');
  assert.ok(over);
  assert.match(over.textContent, new RegExp(T.eras.vida));
  over.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await p;
  assert.equal(document.querySelector('.era-nova-overlay'), null);
});
