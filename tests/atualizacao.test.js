import test from 'node:test';
import assert from 'node:assert/strict';
import { mostrarAtualizacaoDisponivel } from '../src/ui/atualizacao.js';
import { T } from '../src/data/textos.js';

function raizLimpa(id) {
  document.body.innerHTML = `<div id="${id}"></div>`;
  return document.getElementById(id);
}

test('mostra o aviso com o texto do universo evoluído e chama aoAtualizar no clique', () => {
  const raiz = raizLimpa('overlay-raiz');
  let chamou = 0;
  mostrarAtualizacaoDisponivel({ T, aoAtualizar: () => { chamou += 1; } });

  const chip = raiz.querySelector('.atualizacao-chip');
  assert.ok(chip);
  assert.match(chip.textContent, /universo evoluiu/i);

  chip.querySelector('.atualizacao-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(chamou, 1);
  assert.equal(raiz.querySelector('.atualizacao-chip'), null);
});

test('fechar() remove o aviso sem chamar aoAtualizar', () => {
  const raiz = raizLimpa('overlay-raiz');
  let chamou = 0;
  const { fechar } = mostrarAtualizacaoDisponivel({ T, aoAtualizar: () => { chamou += 1; } });
  fechar();
  assert.equal(raiz.querySelector('.atualizacao-chip'), null);
  assert.equal(chamou, 0);
});
