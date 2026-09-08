import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mostrarEraNova } from '../src/ui/era-nova.js';
import { T } from '../src/data/textos.js';

const cartaCss = readFileSync(fileURLToPath(new URL('../styles/carta.css', import.meta.url)), 'utf8');

function cenario() {
  document.body.innerHTML = `
    <style>${cartaCss}</style>
    <main id="jogo">
      <section id="canvas"></section>
      <aside id="drawer"></aside>
    </main>
    <div id="overlay-raiz"></div>`;
  return {
    canvas: document.getElementById('canvas'),
    drawer: document.getElementById('drawer'),
    overlayRaiz: document.getElementById('overlay-raiz'),
  };
}

function snapshot(el) {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height, altura: el.offsetHeight };
}

test('mostra o nome/selo da era nova, com role de status e mascote feliz', async () => {
  cenario();
  const p = mostrarEraNova({ era: 'vida', progresso: [{ era: 'elementos', descobertos: 4 }], ms: 20 });
  const over = document.querySelector('.era-nova-overlay');
  assert.ok(over);
  assert.equal(over.getAttribute('role'), 'status');
  assert.match(over.textContent, new RegExp(T.eras.vida));
  assert.match(over.textContent, new RegExp(T.eraNovaSelo));
  assert.ok(over.querySelector('.era-nova-mascote'));
  await p;
  assert.equal(document.querySelector('.era-nova-overlay'), null);
});

test('SEM layout shift: overlay é fixo, fora do fluxo (#jogo intacto), backdrop não bloqueia', async () => {
  const { canvas, drawer, overlayRaiz } = cenario();
  const antesCanvas = snapshot(canvas);
  const antesDrawer = snapshot(drawer);
  const alturaJogoAntes = document.getElementById('jogo').offsetHeight;

  const p = mostrarEraNova({ era: 'cultura', progresso: [], ms: 40 });
  const over = document.querySelector('.era-nova-overlay');

  // renderizado FORA de #jogo (não entra no fluxo do Canvas/drawer)
  assert.equal(over.parentElement, overlayRaiz);
  assert.equal(over.closest('#jogo'), null);

  const cs = window.getComputedStyle(over);
  assert.equal(cs.position, 'fixed', 'overlay é position: fixed');
  assert.equal(cs.pointerEvents, 'none', 'backdrop não bloqueia a interação por baixo');
  const csCartao = window.getComputedStyle(over.querySelector('.era-nova-cartao'));
  assert.equal(csCartao.pointerEvents, 'auto', 'o cartão aceita o toque para antecipar o fechamento');

  // durante: Canvas/drawer com as MESMAS dimensões e posição, #jogo mesma altura
  assert.deepEqual(snapshot(canvas), antesCanvas, 'Canvas não mexeu durante');
  assert.deepEqual(snapshot(drawer), antesDrawer, 'drawer não mexeu durante');
  assert.equal(document.getElementById('jogo').offsetHeight, alturaJogoAntes);

  await p;

  // depois: idem
  assert.deepEqual(snapshot(canvas), antesCanvas, 'Canvas não mexeu depois');
  assert.deepEqual(snapshot(drawer), antesDrawer, 'drawer não mexeu depois');
  assert.equal(document.querySelector('.era-nova-overlay'), null, 'sem overlay órfão');
});

test('fecha sozinho após ~ms', async () => {
  cenario();
  const inicio = Date.now();
  await mostrarEraNova({ era: 'vida', progresso: [], ms: 30 });
  assert.ok(Date.now() - inicio >= 25);
  assert.equal(document.querySelector('.era-nova-overlay'), null);
});

test('um toque no cartão antecipa o fechamento (antes do ms)', async () => {
  cenario();
  const inicio = Date.now();
  const p = mostrarEraNova({ era: 'vida', progresso: [], ms: 5000 });
  document.querySelector('.era-nova-cartao')
    .dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
  await p;
  assert.ok(Date.now() - inicio < 1000, 'não esperou os 5s');
  assert.equal(document.querySelector('.era-nova-overlay'), null);
});

test('descobertas consecutivas não empilham mascotes nem deixam overlay órfão', async () => {
  cenario();
  const p1 = mostrarEraNova({ era: 'vida', progresso: [], ms: 5000 });
  mostrarEraNova({ era: 'cultura', progresso: [], ms: 20 });
  // a primeira foi dispensada ao surgir a segunda
  assert.equal(document.querySelectorAll('.era-nova-overlay').length, 1);
  await p1; // a promise da primeira resolve (foi limpa)
  assert.equal(document.querySelectorAll('.era-nova-overlay').length, 1);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(document.querySelector('.era-nova-overlay'), null, 'nenhum overlay órfão no fim');
});

test('respeita prefers-reduced-motion (sem animação de entrada)', async () => {
  cenario();
  const antes = window.matchMedia;
  window.matchMedia = (q) => ({ matches: /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {} });
  try {
    const p = mostrarEraNova({ era: 'vida', progresso: [], ms: 20 });
    const over = document.querySelector('.era-nova-overlay');
    assert.ok('semAnimacao' in over.dataset);
    await p;
  } finally {
    window.matchMedia = antes;
  }
});
