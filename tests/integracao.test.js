// tests/integracao.test.js
// Costura o caminho real: canvas -> fusão -> carta de recompensa -> voo até
// o Álbum -> drawer, com a mesma fiação que src/app.js usa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo } from '../src/engine/catalogo.js';
import { criarStore } from '../src/engine/state.js';
import { criarCombinador } from '../src/engine/combinar.js';
import { stubDesligado } from '../src/ai/provider.js';
import { montarCanvas } from '../src/ui/canvas.js';
import { montarDrawer } from '../src/ui/drawer.js';
import { mostrarRecompensaDescoberta } from '../src/ui/descoberta-carta.js';
import { T } from '../src/data/textos.js';

function ponteiro(tipo, clientX, clientY) {
  return new window.MouseEvent(tipo, { clientX, clientY, bubbles: true });
}

async function ate(cond, tentativas = 100) {
  for (let i = 0; i < tentativas; i += 1) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, 0));
  }
  return false;
}

function comLayoutFalso(fn) {
  const proto = HTMLElement.prototype;
  const antesW = Object.getOwnPropertyDescriptor(proto, 'offsetWidth');
  const antesH = Object.getOwnPropertyDescriptor(proto, 'offsetHeight');
  Object.defineProperty(proto, 'offsetWidth', { configurable: true, get() { return 60; } });
  Object.defineProperty(proto, 'offsetHeight', { configurable: true, get() { return 60; } });
  const restaurar = () => {
    if (antesW) Object.defineProperty(proto, 'offsetWidth', antesW);
    else delete proto.offsetWidth;
    if (antesH) Object.defineProperty(proto, 'offsetHeight', antesH);
    else delete proto.offsetHeight;
  };
  return Promise.resolve(fn()).finally(restaurar);
}

test('fusão real no canvas abre o overlay e o card entra na drawer', async () => {
  await comLayoutFalso(async () => {
    document.body.innerHTML = `
      <section id="canvas" class="canvas"></section>
      <aside id="drawer" class="drawer"></aside>
      <button id="eras">Álbum</button>
      <div id="overlay-raiz"></div>`;
    const elEras = document.getElementById('eras');

    const catalogo = criarCatalogo();
    const store = criarStore({
      versao: 1,
      descobertos: {
        agua: { em: 1, via: null, fonte: 'base' },
        fogo: { em: 1, via: null, fonte: 'base' },
      },
      canvas: [],
      ajustes: { som: false, iaLigada: false },
    });
    const combinar = criarCombinador({
      catalogo, aiProvider: stubDesligado, estaOnline: () => false,
    });

    const elCanvas = document.getElementById('canvas');
    const elDrawer = document.getElementById('drawer');

    let drawer;
    const canvas = montarCanvas({
      raiz: elCanvas,
      store,
      catalogo,
      combinar,
      // mesma fiação de app.js: o card já entra na drawer antes da
      // animação de recompensa (não depende dela pra existir)
      aoResultado: async (resultado, ctx) => {
        if (resultado.tipo === 'ok' && ctx.novo) {
          drawer.adicionarCard(resultado.item.id);
          await mostrarRecompensaDescoberta({
            id: resultado.item.id,
            store,
            catalogo,
            T,
            destinoEl: elEras,
            comSom: store.getSave().ajustes.som,
            ms: 20,
          });
        }
      },
    });

    drawer = montarDrawer({
      raiz: elDrawer,
      store,
      catalogo,
      aoEscolherItem: (id) => canvas.soltarItem(id, 0, 0),
    });

    assert.equal(elDrawer.querySelectorAll('.drawer-card[data-id="vapor"]').length, 0);

    const a = canvas.soltarItem('agua', 100, 100);
    const b = canvas.soltarItem('fogo', 100, 100); // sobreposto
    const elB = elCanvas.querySelector(`.peca[data-uid="${b.uid}"]`);
    assert.ok(elB);

    // caminho real de ponteiro: pressiona e solta em cima da outra peça
    elB.dispatchEvent(ponteiro('pointerdown', 130, 130));
    elB.dispatchEvent(ponteiro('pointerup', 130, 130));

    const abriu = await ate(() => document.querySelector('.descoberta-carta-overlay'));
    assert.ok(abriu, 'a carta de recompensa não apareceu');
    assert.equal(document.querySelectorAll('.descoberta-carta-overlay').length, 1);
    assert.ok(document.querySelector('.descoberta-carta-overlay .carta'), 'reaproveita o mesmo componente de carta');
    assert.ok(store.isDiscovered('vapor'));
    assert.equal(store.getInstance(a.uid), undefined);
    assert.equal(store.listInstances().map((i) => i.id).join(), 'vapor');

    // o card já está na drawer mesmo com a carta de recompensa ainda na tela
    // (não espera a animação terminar pra existir)
    assert.ok(
      elDrawer.querySelector('.drawer-card[data-id="vapor"]'),
      'o card de vapor devia estar na drawer imediatamente, sem esperar a animação',
    );

    // dispensa a carta no toque: dispara o voo até o Álbum
    document.querySelector('.descoberta-carta-overlay')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    const sumiu = await ate(() => !document.querySelector('.descoberta-carta-overlay'), 400);
    assert.ok(sumiu, 'a carta de recompensa devia sumir ao terminar o voo');
    const pulsou = await ate(() => elEras.classList.contains('recebendo-carta'), 400);
    assert.ok(pulsou, 'o botão do Álbum devia pulsar ao receber a carta');
  });
});
