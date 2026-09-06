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

test('itens da IA aparecem sempre por último, mesmo descobertos antes e de era mais cedo', () => {
  const { cat, store, raiz } = ambiente();
  const item = cat.registrarItemIA({ nome: 'Coisa da IA', emoji: '✨', era: 'elementos' });
  // 'em: 0' descoberto antes de tudo: sem a regra da IA, viria primeiro na lista
  store.getSave().descobertos[item.id] = { em: 0, via: null, fonte: 'ia' };
  montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  const nomes = [...raiz.querySelectorAll('.drawer-card .card-nome')].map((n) => n.textContent);
  assert.deepEqual(nomes, ['Água', 'Fogo', 'Vapor', 'Coisa da IA']);
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

function ptr(tipo, x, y, id = 1) {
  const e = new window.Event(tipo, { bubbles: true, cancelable: true });
  e.pointerId = id;
  e.clientX = x;
  e.clientY = y;
  return e;
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

test('segurar e arrastar um card cria um fantasma e solta no ponto', async () => {
  const { cat, store, raiz } = ambiente();
  const solturas = [];
  montarDrawer({
    raiz, store, catalogo: cat, aoEscolherItem() {},
    aoSoltarItem: (id, x, y) => solturas.push([id, x, y]),
  });
  const card = raiz.querySelector('.drawer-card');
  card.dispatchEvent(ptr('pointerdown', 10, 10));
  await espera(220); // passa do tempo de "segurar"
  assert.ok(document.querySelector('.drawer-ghost'), 'fantasma no DOM');
  card.dispatchEvent(ptr('pointermove', 400, 300));
  card.dispatchEvent(ptr('pointerup', 400, 300));
  assert.equal(document.querySelector('.drawer-ghost'), null, 'fantasma sai ao soltar');
  assert.equal(solturas.length, 1);
  assert.deepEqual(solturas[0], [card.dataset.id, 400, 300]);
});

test('toque rápido no card não arrasta: continua sendo "escolher"', async () => {
  const { cat, store, raiz } = ambiente();
  const solturas = [];
  let escolhido = null;
  montarDrawer({
    raiz, store, catalogo: cat,
    aoEscolherItem: (id) => { escolhido = id; },
    aoSoltarItem: (...a) => solturas.push(a),
  });
  const card = raiz.querySelector('.drawer-card');
  card.dispatchEvent(ptr('pointerdown', 10, 10));
  card.dispatchEvent(ptr('pointerup', 11, 10)); // solta antes de segurar
  card.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await espera(220);
  assert.equal(document.querySelector('.drawer-ghost'), null);
  assert.equal(solturas.length, 0);
  assert.equal(escolhido, card.dataset.id);
});

test('mover antes de "segurar" vira scroll: não arrasta', async () => {
  const { cat, store, raiz } = ambiente();
  const solturas = [];
  montarDrawer({
    raiz, store, catalogo: cat, aoEscolherItem() {},
    aoSoltarItem: (...a) => solturas.push(a),
  });
  const card = raiz.querySelector('.drawer-card');
  card.dispatchEvent(ptr('pointerdown', 10, 10));
  card.dispatchEvent(ptr('pointermove', 10, 40)); // 30px antes do hold
  await espera(220);
  assert.equal(document.querySelector('.drawer-ghost'), null, 'não pegou o card');
  card.dispatchEvent(ptr('pointerup', 10, 40));
  assert.equal(solturas.length, 0);
});

test('adicionarCard insere um novo item', () => {
  const { cat, store, raiz } = ambiente();
  const api = montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  store.recordDiscovery('lava', ['fogo', 'terra'], 'local');
  api.adicionarCard('lava');
  const nomes = [...raiz.querySelectorAll('.drawer-card .card-nome')].map((n) => n.textContent);
  assert.ok(nomes.includes('Lava'));
});
