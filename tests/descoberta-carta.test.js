import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo } from '../src/engine/catalogo.js';
import { criarStore } from '../src/engine/state.js';
import { mostrarRecompensaDescoberta } from '../src/ui/descoberta-carta.js';
import { T } from '../src/data/textos.js';

function raizLimpa() {
  document.body.innerHTML = '<div id="overlay-raiz"></div><button id="eras"></button>';
  return {
    overlayRaiz: document.getElementById('overlay-raiz'),
    elEras: document.getElementById('eras'),
  };
}

test('mostra a mesma cartinha (componente .carta) e a faixa de nova descoberta', async () => {
  const { elEras } = raizLimpa();
  const catalogo = criarCatalogo();
  const store = criarStore({
    versao: 1, descobertos: { agua: { em: 1 } }, canvas: [], ajustes: {},
  });

  const p = mostrarRecompensaDescoberta({
    id: 'agua', store, catalogo, T, destinoEl: elEras, ms: 20,
  });

  const overlay = document.querySelector('.descoberta-carta-overlay');
  assert.ok(overlay, 'a carta de recompensa apareceu');
  assert.ok(overlay.querySelector('.carta'), 'reaproveita o mesmo componente de carta');
  assert.match(overlay.textContent, /Nova descoberta/i);
  assert.match(overlay.textContent, /Água/);

  await p;
  assert.equal(document.querySelector('.descoberta-carta-overlay'), null, 'some sozinha depois do voo');
});

test('o toque da criança dispensa a carta antes do tempo padrão', async () => {
  const { elEras } = raizLimpa();
  const catalogo = criarCatalogo();
  const store = criarStore({
    versao: 1, descobertos: { agua: { em: 1 } }, canvas: [], ajustes: {},
  });

  const inicio = Date.now();
  const p = mostrarRecompensaDescoberta({
    id: 'agua', store, catalogo, T, destinoEl: elEras, ms: 5000,
  });
  document.querySelector('.descoberta-carta-overlay')
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await p;
  assert.ok(Date.now() - inicio < 1000, 'não devia esperar os 5s configurados');
});

test('id não descobertos ou inexistentes: resolve sem mostrar nada (sem spoiler)', async () => {
  const { elEras } = raizLimpa();
  const catalogo = criarCatalogo();
  const store = criarStore({
    versao: 1, descobertos: {}, canvas: [], ajustes: {},
  });
  await mostrarRecompensaDescoberta({
    id: 'agua', store, catalogo, T, destinoEl: elEras, ms: 20,
  });
  assert.equal(document.querySelector('.descoberta-carta-overlay'), null);
});

test('destino oculto (Modo Pequenos): usa o cabeçalho do inventário como alvo do voo, sem travar', async () => {
  document.body.innerHTML = `
    <div id="overlay-raiz"></div>
    <div class="drawer-cabecalho"></div>`;
  const cabecalho = document.querySelector('.drawer-cabecalho');
  const catalogo = criarCatalogo();
  const store = criarStore({
    versao: 1, descobertos: { agua: { em: 1 } }, canvas: [], ajustes: {},
  });

  await mostrarRecompensaDescoberta({
    id: 'agua', store, catalogo, T, destinoEl: cabecalho, ms: 20,
  });
  assert.equal(document.querySelector('.descoberta-carta-overlay'), null);
  assert.ok(cabecalho.classList.contains('recebendo-carta'), 'o cabeçalho do inventário pulsa no lugar do Álbum');
});

test('destino nulo (não achou nem Álbum nem cabeçalho): ainda assim termina e não quebra', async () => {
  const catalogo = criarCatalogo();
  const store = criarStore({
    versao: 1, descobertos: { agua: { em: 1 } }, canvas: [], ajustes: {},
  });
  document.body.innerHTML = '<div id="overlay-raiz"></div>';
  await assert.doesNotReject(mostrarRecompensaDescoberta({
    id: 'agua', store, catalogo, T, destinoEl: null, ms: 20,
  }));
  assert.equal(document.querySelector('.descoberta-carta-overlay'), null);
});

test('o registro da descoberta já aconteceu antes de a animação sequer começar', async () => {
  // recordDiscovery roda em canvas.js ANTES de chamar aoResultado — aqui só
  // confirmamos que a função de recompensa não depende de nada além do que
  // já está no save pra funcionar (não registra nada ela mesma).
  const { elEras } = raizLimpa();
  const catalogo = criarCatalogo();
  const store = criarStore({
    versao: 1,
    descobertos: { agua: { em: 1 }, fogo: { em: 1 }, vapor: { em: 2, via: ['agua', 'fogo'] } },
    canvas: [],
    ajustes: {},
  });
  assert.ok(store.isDiscovered('vapor'), 'já estava registrado antes de chamar a recompensa');
  await mostrarRecompensaDescoberta({
    id: 'vapor', store, catalogo, T, destinoEl: elEras, ms: 20,
  });
  assert.ok(store.isDiscovered('vapor'), 'continua registrado depois');
});
