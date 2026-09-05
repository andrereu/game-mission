// src/app.js
import { criarCatalogo } from './engine/catalogo.js';
import { carregar, criarAgendadorSalvar, saveInicial } from './engine/storage.js';
import { criarStore } from './engine/state.js';
import { criarCombinador } from './engine/combinar.js';
import { stubDesligado } from './ai/provider.js';
import { montarCanvas } from './ui/canvas.js';
import { montarDrawer } from './ui/drawer.js';
import { mostrarDescoberta } from './ui/descoberta.js';
import { montarArvore } from './ui/arvore.js';
import { T } from './data/textos.js';

async function iniciar() {
  const catalogo = criarCatalogo();
  let save;
  try {
    save = await carregar(catalogo);
  } catch (err) {
    console.error(err);
    save = saveInicial(catalogo); // boot com save novo em vez de página em branco
  }
  const store = criarStore(save);

  const agendarSalvar = criarAgendadorSalvar(() => store.getSave(), 400);
  store.on('estado:mudou', agendarSalvar);

  // Fase 1: provider é o stub. O gate segue o ajuste + rede (spec §5.2/§9);
  // como iaLigada nasce false, a IA continua desligada.
  const combinar = criarCombinador({
    catalogo,
    aiProvider: stubDesligado,
    estaOnline: () => store.getSave().ajustes.iaLigada === true && navigator.onLine,
  });

  const elCanvas = document.getElementById('canvas');
  const elDrawer = document.getElementById('drawer');
  const elLimpar = document.getElementById('limpar');
  const elArvore = document.getElementById('arvore');

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

  const arvore = montarArvore({
    raiz: document.getElementById('arvore-raiz'),
    store,
    catalogo,
    T,
  });
  elArvore.textContent = T.abrirArvore;
  elArvore.addEventListener('click', () => arvore.abrir());
}

iniciar().catch((err) => {
  console.error(err);
});

// PWA: registra o service worker (não bloqueia o jogo se falhar).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('service worker não registrou:', err);
    });
  });
}
