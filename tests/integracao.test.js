// tests/integracao.test.js
// Costura o caminho real: canvas -> fusão -> overlay de descoberta -> drawer,
// com a mesma fiação que src/app.js usa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo } from '../src/engine/catalogo.js';
import { criarStore } from '../src/engine/state.js';
import { criarCombinador } from '../src/engine/combinar.js';
import { stubDesligado } from '../src/ai/provider.js';
import { montarCanvas } from '../src/ui/canvas.js';
import { montarDrawer } from '../src/ui/drawer.js';
import { mostrarDescoberta } from '../src/ui/descoberta.js';

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
      <div id="overlay-raiz"></div>`;

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
      // mesma fiação de app.js
      aoResultado: async (resultado, ctx) => {
        if (resultado.tipo === 'ok' && ctx.novo) {
          await mostrarDescoberta({
            item: resultado.item,
            combo: resultado.combo,
            catalogo,
            comSom: store.getSave().ajustes.som,
          });
          drawer.adicionarCard(resultado.item.id);
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

    const abriu = await ate(() => document.querySelector('.descoberta-overlay'));
    assert.ok(abriu, 'o overlay de descoberta não apareceu');
    assert.equal(document.querySelectorAll('.descoberta-overlay').length, 1);
    assert.ok(store.isDiscovered('vapor'));
    assert.equal(store.getInstance(a.uid), undefined);
    assert.equal(store.listInstances().map((i) => i.id).join(), 'vapor');

    // dispensa o overlay: o card só entra na drawer depois disso
    document.querySelector('.descoberta-overlay')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    const temCard = await ate(
      () => elDrawer.querySelector('.drawer-card[data-id="vapor"]'),
    );
    assert.ok(temCard, 'o card de vapor não entrou na drawer');
    assert.equal(document.querySelectorAll('.descoberta-overlay').length, 0);
  });
});
