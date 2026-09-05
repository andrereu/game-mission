// src/app.js
import { criarCatalogo } from './engine/catalogo.js';
import { carregar, criarAgendadorSalvar } from './engine/storage.js';
import { criarStore } from './engine/state.js';
import { criarCombinador } from './engine/combinar.js';
import { stubDesligado } from './ai/provider.js';
import { montarCanvas } from './ui/canvas.js';
import { montarDrawer } from './ui/drawer.js';
import { mostrarDescoberta } from './ui/descoberta.js';
import { T } from './data/textos.js';

async function iniciar() {
  const catalogo = criarCatalogo();
  const save = await carregar(catalogo);
  const store = criarStore(save);

  const agendarSalvar = criarAgendadorSalvar(() => store.getSave(), 400);
  store.on('estado:mudou', agendarSalvar);

  // Nesta fase a IA fica desligada: stub + estaOnline sempre false.
  const combinar = criarCombinador({
    catalogo,
    aiProvider: stubDesligado,
    estaOnline: () => false,
  });

  const elCanvas = document.getElementById('canvas');
  const elDrawer = document.getElementById('drawer');
  const elLimpar = document.getElementById('limpar');

  let drawer;

  const canvas = montarCanvas({
    raiz: elCanvas,
    store,
    catalogo,
    combinar,
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
    aoEscolherItem: (id) => {
      const r = elCanvas.getBoundingClientRect();
      canvas.soltarItem(id, r.width / 2, r.height / 2);
    },
  });

  // soltar card no canvas via drag-and-drop nativo
  elCanvas.addEventListener('dragover', (ev) => ev.preventDefault());
  elCanvas.addEventListener('drop', (ev) => {
    ev.preventDefault();
    const id = ev.dataTransfer.getData('text/mistura-id');
    if (!id) return;
    const r = elCanvas.getBoundingClientRect();
    canvas.soltarItem(id, ev.clientX - r.left, ev.clientY - r.top);
  });

  elLimpar.textContent = T.limparCanvas;
  elLimpar.addEventListener('click', () => {
    if (window.confirm(T.confirmarLimpar)) {
      canvas.destruirTudo();
    }
  });

  canvas.render();
}

iniciar();
