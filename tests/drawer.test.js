import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo } from '../src/engine/catalogo.js';
import { criarStore } from '../src/engine/state.js';
import { montarDrawer } from '../src/ui/drawer.js';

function ambiente() {
  document.body.innerHTML = '<aside id="drawer" class="drawer"></aside>';
  const cat = criarCatalogo();
  const store = criarStore({
    versao: 1,
    descobertos: {
      agua: { em: 1, via: null, fonte: 'base' },
      fogo: { em: 2, via: null, fonte: 'base' },
      vapor: { em: 3, via: ['agua', 'fogo'], fonte: 'local' },
    },
    canvas: [],
    ajustes: { som: false, iaLigada: false },
  });
  return { cat, store, raiz: document.getElementById('drawer') };
}

test('renderiza um card por item descoberto', () => {
  const { cat, store, raiz } = ambiente();
  montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  assert.equal(raiz.querySelectorAll('.drawer-card').length, 3);
  assert.match(raiz.querySelector('.drawer-contador').textContent, /3 \/ \d+ descobertos/);
});

test('busca filtra sem acento e sem caixa', () => {
  const { cat, store, raiz } = ambiente();
  montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  const busca = raiz.querySelector('.drawer-busca');
  busca.value = 'AGUA';
  busca.dispatchEvent(new window.Event('input', { bubbles: true }));
  const nomes = [...raiz.querySelectorAll('.drawer-card .card-nome')].map((n) => n.textContent);
  assert.deepEqual(nomes, ['Água']);
});

test('chip de era filtra', () => {
  const { cat, store, raiz } = ambiente();
  montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  const chipVida = [...raiz.querySelectorAll('.drawer-chip')]
    .find((c) => c.textContent === 'Vida');
  chipVida.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(raiz.querySelectorAll('.drawer-card').length, 0);
});

test('clique no card chama aoEscolherItem', () => {
  const { cat, store, raiz } = ambiente();
  let escolhido = null;
  montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem: (id) => { escolhido = id; } });
  raiz.querySelector('.drawer-card').dispatchEvent(
    new window.MouseEvent('click', { bubbles: true }),
  );
  assert.ok(escolhido);
});

test('adicionarCard insere um novo item', () => {
  const { cat, store, raiz } = ambiente();
  const api = montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  store.recordDiscovery('lava', ['fogo', 'terra'], 'local');
  api.adicionarCard('lava');
  const nomes = [...raiz.querySelectorAll('.drawer-card .card-nome')].map((n) => n.textContent);
  assert.ok(nomes.includes('Lava'));
});
