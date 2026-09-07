import test from 'node:test';
import assert from 'node:assert/strict';
import { mostrarEraNova } from '../src/ui/era-nova.js';
import { T } from '../src/data/textos.js';

function raizLimpa(id) {
  document.body.innerHTML = `<div id="${id}"></div>`;
  return document.getElementById(id);
}

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
