import test from 'node:test';
import assert from 'node:assert/strict';
import { montarAjustes } from '../src/ui/ajustes.js';
import { T } from '../src/data/textos.js';

function ambiente(valores) {
  document.body.innerHTML = '<div id="ajustes-raiz"></div>';
  const estado = { ...valores };
  const set = [];
  const api = montarAjustes({
    raiz: document.getElementById('ajustes-raiz'),
    T,
    get: (k) => estado[k],
    set: (k, v) => { estado[k] = v; set.push([k, v]); },
  });
  return { api, estado, set, raiz: document.getElementById('ajustes-raiz') };
}

const clique = () => new window.MouseEvent('click', { bubbles: true });

test('abrir mostra os interruptores refletindo o estado atual', () => {
  const { api, raiz } = ambiente({ som: true, iaLigada: false });
  api.abrir();
  const checks = raiz.querySelectorAll('input[type="checkbox"]');
  assert.equal(checks.length, 2);
  const som = raiz.querySelector('input[data-chave="som"]');
  const ia = raiz.querySelector('input[data-chave="iaLigada"]');
  assert.equal(som.checked, true);
  assert.equal(ia.checked, false);
});

test('ligar a IA chama set com o valor booleano', () => {
  const { api, set, raiz } = ambiente({ som: true, iaLigada: false });
  api.abrir();
  const ia = raiz.querySelector('input[data-chave="iaLigada"]');
  ia.checked = true;
  ia.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.deepEqual(set, [['iaLigada', true]]);
});

test('fechar tira o overlay', () => {
  const { api, raiz } = ambiente({ som: false, iaLigada: false });
  api.abrir();
  raiz.querySelector('.ajustes-fechar').dispatchEvent(clique());
  assert.equal(raiz.querySelector('.ajustes-overlay'), null);
});
