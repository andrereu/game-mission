import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo } from '../src/engine/catalogo.js';
import { criarStore } from '../src/engine/state.js';
import { montarDrawer } from '../src/ui/drawer.js';

function ambiente(extras = {}) {
  document.body.innerHTML = '<aside id="drawer" class="drawer"></aside>';
  const cat = criarCatalogo();
  const store = criarStore({
    versao: 1,
    descobertos: {
      agua: { em: 1, via: null, fonte: 'base' },
      fogo: { em: 2, via: null, fonte: 'base' },
      vapor: { em: 3, via: ['agua', 'fogo'], fonte: 'local' },
      ...extras,
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
  const { cat, store, raiz } = ambiente({ vida: { em: 4, via: null, fonte: 'local' } });
  montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  const chipVida = raiz.querySelector('.drawer-chip[data-era="vida"]');
  chipVida.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(raiz.querySelectorAll('.drawer-card').length, 1);
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

test('chip "Todos" limpa os filtros de era ativos', () => {
  const { cat, store, raiz } = ambiente({ vida: { em: 4, via: null, fonte: 'local' } });
  montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  const chipVida = raiz.querySelector('.drawer-chip[data-era="vida"]');
  chipVida.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(raiz.querySelectorAll('.drawer-card').length, 1);
  assert.equal(chipVida.getAttribute('aria-pressed'), 'true');

  const chipTodos = [...raiz.querySelectorAll('.drawer-chip')]
    .find((c) => !c.dataset.era);
  assert.equal(chipTodos.getAttribute('aria-pressed'), 'false', 'Todos desativa quando há filtro de era');
  chipTodos.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(raiz.querySelectorAll('.drawer-card').length, 4, 'volta a mostrar tudo');
  assert.equal(chipVida.getAttribute('aria-pressed'), 'false');
  assert.equal(chipTodos.getAttribute('aria-pressed'), 'true');
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

test('botão "Ver todos" chama aoAbrirAlbum', () => {
  const { cat, store, raiz } = ambiente();
  let abriu = false;
  montarDrawer({
    raiz, store, catalogo: cat, aoEscolherItem() {}, aoAbrirAlbum: () => { abriu = true; },
  });
  raiz.querySelector('.drawer-ver-todos').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.ok(abriu);
});

test('a barra de progresso reflete a proporção de descobertos', () => {
  const { cat, store, raiz } = ambiente();
  montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  const barra = raiz.querySelector('.drawer-progresso-barra');
  const total = cat.allItems().length;
  const esperado = (3 / total) * 100;
  assert.equal(barra.style.width, `${esperado}%`);
});

test('contagem canônica aparece separada da quantidade de itens inventados', () => {
  const { cat, store, raiz } = ambiente();
  const item = cat.registrarItemIA({ nome: 'Coisa da IA', emoji: '✨', era: 'elementos' });
  store.getSave().descobertos[item.id] = { em: 4, via: null, fonte: 'ia' };
  montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  const totalCanonico = cat.allItems().filter((it) => !it.ia).length;
  assert.equal(raiz.querySelector('.drawer-contador').textContent, `3 / ${totalCanonico} descobertos`);
  assert.equal(raiz.querySelector('.drawer-contador-ia').textContent, '✨ 1 inventada');
});

test('filtro "IA" mostra somente itens da IA', () => {
  const { cat, store, raiz } = ambiente();
  const item = cat.registrarItemIA({ nome: 'Coisa da IA', emoji: '✨', era: 'elementos' });
  store.getSave().descobertos[item.id] = { em: 4, via: null, fonte: 'ia' };
  montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  const chipIA = raiz.querySelector('.drawer-chip-ia');
  chipIA.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const nomes = [...raiz.querySelectorAll('.drawer-card .card-nome')].map((n) => n.textContent);
  assert.deepEqual(nomes, ['Coisa da IA']);
  assert.equal(chipIA.getAttribute('aria-pressed'), 'true');
});

test('filtros de era excluem itens da IA mesmo quando a era herdada bate', () => {
  const { cat, store, raiz } = ambiente();
  const item = cat.registrarItemIA({ nome: 'Coisa da IA', emoji: '✨', era: 'elementos' });
  store.getSave().descobertos[item.id] = { em: 4, via: null, fonte: 'ia' };
  montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  const chipElementos = raiz.querySelector('.drawer-chip[data-era="elementos"]');
  chipElementos.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const nomes = [...raiz.querySelectorAll('.drawer-card .card-nome')].map((n) => n.textContent);
  assert.deepEqual(nomes, ['Água', 'Fogo', 'Vapor']);
});

test('"Todos" reúne itens canônicos e criações da IA', () => {
  const { cat, store, raiz } = ambiente();
  const item = cat.registrarItemIA({ nome: 'Coisa da IA', emoji: '✨', era: 'elementos' });
  store.getSave().descobertos[item.id] = { em: 4, via: null, fonte: 'ia' };
  montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  const nomes = [...raiz.querySelectorAll('.drawer-card .card-nome')].map((n) => n.textContent);
  assert.deepEqual(nomes, ['Água', 'Fogo', 'Vapor', 'Coisa da IA']);
});

test('busca funciona junto com o filtro "IA"', () => {
  const { cat, store, raiz } = ambiente();
  const item = cat.registrarItemIA({ nome: 'Gelo Mágico', emoji: '✨', era: 'elementos' });
  store.getSave().descobertos[item.id] = { em: 4, via: null, fonte: 'ia' };
  montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  raiz.querySelector('.drawer-chip-ia').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const busca = raiz.querySelector('.drawer-busca');
  busca.value = 'gelo';
  busca.dispatchEvent(new window.Event('input', { bubbles: true }));
  const nomes = [...raiz.querySelectorAll('.drawer-card .card-nome')].map((n) => n.textContent);
  assert.deepEqual(nomes, ['Gelo Mágico']);
});

test('clicar num chip de era desativa o filtro "IA" ativo', () => {
  const { cat, store, raiz } = ambiente({ vida: { em: 4, via: null, fonte: 'local' } });
  const item = cat.registrarItemIA({ nome: 'Coisa da IA', emoji: '✨', era: 'elementos' });
  store.getSave().descobertos[item.id] = { em: 4, via: null, fonte: 'ia' };
  montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  const chipIA = raiz.querySelector('.drawer-chip-ia');
  chipIA.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  raiz.querySelector('.drawer-chip[data-era="vida"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(chipIA.getAttribute('aria-pressed'), 'false');
});

test('chips revelam eras progressivamente e IA só após a primeira criação descoberta', () => {
  const { cat, store, raiz } = ambiente();
  const api = montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  assert.deepEqual(
    [...raiz.querySelectorAll('.drawer-chip[data-era]')].map((chip) => chip.dataset.era),
    ['elementos'],
  );
  assert.equal(raiz.querySelector('.drawer-chip-ia'), null);

  store.recordDiscovery('pedra', ['lava', 'ar'], 'local');
  api.adicionarCard('pedra');
  assert.deepEqual(
    [...raiz.querySelectorAll('.drawer-chip[data-era]')].map((chip) => chip.dataset.era),
    ['elementos', 'natureza'],
  );

  const item = cat.registrarItemIA({ nome: 'Brilho Lunar', emoji: '✨', era: 'ficcao' });
  store.getSave().descobertos[item.id] = { em: 6, via: ['agua'], fonte: 'ia' };
  api.adicionarCard(item.id);
  assert.ok(raiz.querySelector('.drawer-chip-ia'));
  assert.equal(raiz.querySelector('.drawer-chip[data-era="ficcao"]'), null, 'IA não revela era herdada');
});

test('adicionarCard insere um novo item', () => {
  const { cat, store, raiz } = ambiente();
  const api = montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  store.recordDiscovery('lava', ['fogo', 'terra'], 'local');
  api.adicionarCard('lava');
  const nomes = [...raiz.querySelectorAll('.drawer-card .card-nome')].map((n) => n.textContent);
  assert.ok(nomes.includes('Lava'));
});
