// src/app.js
import { criarCatalogo } from './engine/catalogo.js';
import {
  carregar, salvar, criarAgendadorSalvar, saveInicial,
} from './engine/storage.js';
import { criarStore } from './engine/state.js';
import { criarCombinador } from './engine/combinar.js';
import { criarProviderEndpoint } from './ai/provider.js';
import { montarCanvas } from './ui/canvas.js';
import { montarDrawer } from './ui/drawer.js';
import { mostrarDescoberta } from './ui/descoberta.js';
import { montarArvore } from './ui/arvore.js';
import { montarAjustes } from './ui/ajustes.js';
import { montarStatusRede } from './ui/rede.js';
import { montarLinhaDoTempo } from './ui/eras.js';
import { mostrarEraNova } from './ui/era-nova.js';
import { erasAlcancadas, eraMaisAvancada, progressoPorEra } from './engine/eras.js';
import {
  carregarPerfis, criarPerfil, editarPerfil, apagarPerfil, definirAtivo, salvarPerfis, chaveSave,
} from './engine/perfis.js';
import { configDoModo, MODO_PADRAO } from './data/modos.js';
import { montarSeletorPerfis } from './ui/perfis.js';
import {
  carregarSync, definirCodigo, desativar as desativarSync, gerarCodigo,
  sincronizar, empurrar,
} from './engine/sync.js';
import { T } from './data/textos.js';

async function iniciar() {
  const catalogo = criarCatalogo();

  const seletor = montarSeletorPerfis({
    raiz: document.getElementById('perfis-raiz'),
    T,
    aoEscolher: async (id) => { await definirAtivo(id); location.reload(); },
    aoCriar: async (nome, cor, modo) => { await criarPerfil(nome, cor, modo); return carregarPerfis(); },
    aoEditar: async (id, campos) => { await editarPerfil(id, campos); return carregarPerfis(); },
    aoApagar: async (id) => { await apagarPerfil(id); return carregarPerfis(); },
  });

  let perfis = await carregarPerfis();

  // Sincronização entre aparelhos (se ativa + online): puxa e mescla ANTES de
  // decidir o perfil ativo e de carregar o save.
  const sync = await carregarSync();
  if (sync.codigo && navigator.onLine) {
    try {
      await sincronizar(sync.codigo, {
        carregarPerfis,
        salvarPerfis,
        carregarSave: (id) => carregar(catalogo, chaveSave(id)),
        salvarSave: (id, s) => salvar(s, chaveSave(id)),
        ativo: perfis.ativo,
      });
      perfis = await carregarPerfis();
    } catch (err) {
      console.warn('sync falhou:', err);
    }
  }

  if (!perfis.ativo) {
    // Primeira vez (ou todos apagados): não inicia o jogo até escolher.
    // aoEscolher recarrega a página, então o boot recomeça já com um ativo.
    seletor.abrir(perfis);
    return;
  }

  const perfilAtivo = perfis.lista.find((p) => p.id === perfis.ativo);
  const modo = (perfilAtivo && perfilAtivo.modo) || MODO_PADRAO;
  document.body.dataset.modo = modo; // o resto do "modo" é CSS

  const chaveDoSave = chaveSave(perfis.ativo);
  let save;
  try {
    save = await carregar(catalogo, chaveDoSave);
  } catch (err) {
    console.error(err);
    save = saveInicial(catalogo); // boot com save novo em vez de página em branco
  }
  const store = criarStore(save);

  const agendarSalvar = criarAgendadorSalvar(() => store.getSave(), 400, chaveDoSave);
  store.on('estado:mudou', agendarSalvar);

  // Progressão de eras: snapshot das eras já alcançadas + pinta o fundo.
  const erasVistas = erasAlcancadas(store.getSave().descobertos, catalogo);
  document.body.dataset.era = eraMaisAvancada(erasVistas);

  // A IA só é tentada quando o perfil ligou `iaLigada` E há rede (spec §5.2/§9).
  // Nasce desligada; o painel de ajustes liga.
  const combinar = criarCombinador({
    catalogo,
    aiProvider: criarProviderEndpoint('/api/combinar'),
    estaOnline: () => store.getSave().ajustes.iaLigada === true && navigator.onLine,
  });

  const elCanvas = document.getElementById('canvas');
  const elDrawer = document.getElementById('drawer');
  const elLimpar = document.getElementById('limpar');
  const elArvore = document.getElementById('arvore');
  const elAjustes = document.getElementById('ajustes');

  let drawer;

  const canvas = montarCanvas({
    raiz: elCanvas,
    store,
    catalogo,
    combinar,
    margemFusao: configDoModo(modo).margemFusao,
    aoResultado: async (resultado, ctx) => {
      if (resultado.tipo === 'ok' && ctx.novo) {
        const comSom = store.getSave().ajustes.som;
        await mostrarDescoberta({
          item: resultado.item,
          combo: resultado.combo,
          catalogo,
          comSom,
        });
        drawer.adicionarCard(resultado.item.id);

        // primeira descoberta de uma era ainda não vista: comemora e repinta
        const eraNova = resultado.item.era;
        if (eraNova && !erasVistas.has(eraNova)) {
          erasVistas.add(eraNova);
          document.body.dataset.era = eraMaisAvancada(erasVistas);
          await mostrarEraNova({
            era: eraNova,
            progresso: progressoPorEra(store.getSave().descobertos, catalogo),
            comSom,
          });
        }
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
    // arrastar o card (ponteiro: toque + mouse) e soltar em cima do canvas
    aoSoltarItem: (id, clientX, clientY) => {
      const r = elCanvas.getBoundingClientRect();
      const dentro = clientX >= r.left && clientX <= r.right
        && clientY >= r.top && clientY <= r.bottom;
      if (!dentro) return; // soltou fora do tabuleiro: ignora
      canvas.soltarItem(id, clientX - r.left, clientY - r.top);
    },
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

  const linhaDoTempo = montarLinhaDoTempo({
    raiz: document.getElementById('eras-raiz'),
    store,
    catalogo,
    T,
  });
  const elEras = document.getElementById('eras');
  elEras.textContent = T.abrirEras;
  elEras.addEventListener('click', () => linhaDoTempo.abrir());

  const ajustes = montarAjustes({
    raiz: document.getElementById('ajustes-raiz'),
    T,
    get: (chave) => store.getSave().ajustes[chave],
    set: (chave, valor) => store.setAjuste(chave, valor),
    sync: {
      carregar: carregarSync,
      ativar: async () => { await definirCodigo(gerarCodigo()); return carregarSync(); },
      usar: async (c) => { await definirCodigo(c); location.reload(); },
      desativar: async () => { await desativarSync(); return carregarSync(); },
      agora: () => location.reload(),
    },
  });
  elAjustes.addEventListener('click', () => ajustes.abrir());

  // com sync ativo, empurra as descobertas do perfil ativo pouco depois de cada nova
  if (sync.codigo) {
    let tPush = null;
    store.on('descoberta:nova', () => {
      clearTimeout(tPush);
      tPush = setTimeout(() => {
        if (!navigator.onLine) return;
        empurrar(sync.codigo, perfis.ativo, { descobertos: store.getSave().descobertos })
          .catch(() => {});
      }, 2000);
    });
  }

  // botão de trocar de perfil, com nome e cor do perfil ativo
  const elPerfil = document.getElementById('perfil');
  elPerfil.textContent = perfilAtivo ? perfilAtivo.nome : T.trocarPerfil;
  if (perfilAtivo) elPerfil.style.borderColor = perfilAtivo.cor;
  elPerfil.addEventListener('click', async () => {
    seletor.abrir(await carregarPerfis());
  });

  montarStatusRede({ el: document.getElementById('rede'), T });
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
