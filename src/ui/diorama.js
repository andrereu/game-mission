// Diorama V0 — "Meu Mundo": o cenário-maquete que cresce sozinho a partir
// das descobertas do perfil. Nunca um city-builder: só observa, nunca
// constrói/arrasta/administra (ver briefing §9).
//
// Estado 100% derivado (src/engine/diorama.js); esta camada só desenha e
// reproduz a fila de acontecimentos pendentes em sequência curta — nunca
// decide sozinha o que é "novo", só pergunta pro motor e marca como visto
// depois de mostrar.
import {
  FAMILIAS, resolverEstadoDiorama, calcularAcontecimentosPendentes, proximoProgressoVisto,
} from '../engine/diorama.js';

// ícone/placeholder por família e nível (0..4) — SVG/CSS/emoji própria da
// V0, nunca uma descoberta específica: é o agregado da família (briefing
// §1: "não precisamos representar cada descoberta literalmente").
const ICONES = {
  terreno: ['◌', '⛰️', '⛰️⛰️', '🏔️⛰️', '🏔️⛰️🪨'],
  agua: ['', '💧', '🏞️', '🌊', '🌊🌊'],
  vegetacao: ['', '🌱', '🌿', '🌳', '🌳🌳🌳'],
  vida: ['', '🐛', '🐦🐛', '🦋🐦🐟', '🦁🦋🐦🐟'],
  civilizacao: ['', '🔥', '🏠', '🏘️', '🏰'],
  tecnologia: ['', '🔨', '⚙️', '🤖', '🚀'],
  cosmico: ['', '⭐', '⭐⭐', '🌌', '🪐✨'],
};

function reduzMovimento() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function esperar(ms) {
  if (reduzMovimento()) return Promise.resolve();
  return new Promise((r) => setTimeout(r, ms));
}

export function montarDiorama({
  raiz, store, catalogo, T, audio,
}) {
  const falar = audio?.falarSelecao ? (nome) => audio.falarSelecao(nome) : () => {};
  let overlay = null;
  let camadas = null;
  let reproduzindo = false;

  function estadoAtual() {
    const save = store.getSave();
    return resolverEstadoDiorama({
      descobertos: save.descobertos, catalogo, itensIA: save.itensIA,
    });
  }

  // O que já foi exibido. `undefined` = save nunca abriu o Diorama (save
  // novo OU antigo, tanto faz) — bootstrap silencioso: vira o baseline atual
  // sem reproduzir nada, pra nunca inundar um save veterano com dezenas de
  // marcos "pendentes" que na real já existiam antes do Diorama existir.
  function progressoVisto() {
    return store.getSave().diorama || null;
  }

  function garantirBootstrap() {
    if (progressoVisto()) return;
    store.setDiorama(proximoProgressoVisto(estadoAtual()));
  }

  function pendentes() {
    const visto = progressoVisto();
    if (!visto) return []; // bootstrap ainda não rodou (chamado no boot do app) — nunca "pendente" antes disso
    return calcularAcontecimentosPendentes(estadoAtual(), visto);
  }

  function fechar() {
    if (!overlay) return;
    document.removeEventListener('keydown', aoTeclar);
    overlay.remove();
    overlay = null;
    camadas = null;
  }

  function aoTeclar(ev) {
    if (ev.key === 'Escape') fechar();
  }

  function atualizarCamada(familia, nivel) {
    const el = camadas?.[familia];
    if (!el) return;
    const icone = ICONES[familia]?.[nivel] ?? '';
    el.querySelector('.diorama-icone').textContent = icone;
    el.dataset.nivel = String(nivel);
    el.classList.toggle('diorama-camada-vazia', nivel === 0);
  }

  function legenda(texto) {
    const el = overlay?.querySelector('.diorama-legenda');
    if (el) el.textContent = texto;
  }

  async function tocarEventoMarco(evento, estadoFinal) {
    const el = camadas?.[evento.familia];
    legenda(`${T.dioramaFamilias[evento.familia]}: ${T.dioramaEstagios[evento.familia][evento.para]}`);
    if (el) {
      el.classList.add('diorama-camada-transformando');
      await esperar(260);
    }
    atualizarCamada(evento.familia, evento.para);
    if (el) {
      await esperar(420);
      el.classList.remove('diorama-camada-transformando');
    }
    void estadoFinal;
  }

  async function tocarEventoEra(evento) {
    const ilha = overlay?.querySelector('.diorama-ilha');
    legenda(T.dioramaEraTitulo(T.eras[evento.era] || evento.era));
    if (ilha) {
      ilha.classList.add('diorama-ilha-era-nova');
      await esperar(900);
      ilha.classList.remove('diorama-ilha-era-nova');
    }
  }

  // colapsa uma sequência longa (save que ficou muito tempo sem visitar o
  // Diorama) num único "beat" por família — a criança ainda vê a vegetação
  // virar bosque, só que numa transformação só, não N delas em fila. Mantém
  // a "sequência curta" do briefing §6 mesmo com dezenas de marcos pendentes.
  function agruparMarcosPorFamilia(fila) {
    const agrupados = [];
    const ultimoIndicePorFamilia = new Map();
    for (const evento of fila) {
      if (evento.tipo !== 'marco') { agrupados.push(evento); continue; }
      const idx = ultimoIndicePorFamilia.get(evento.familia);
      if (idx != null && agrupados[idx].tipo === 'marco') {
        agrupados[idx] = { ...agrupados[idx], para: evento.para };
      } else {
        ultimoIndicePorFamilia.set(evento.familia, agrupados.length);
        agrupados.push({ ...evento });
      }
    }
    return agrupados;
  }

  // reproduz a fila em sequência curta (briefing §6) — idempotente: só
  // avança `visto` depois de mostrar tudo, e cada chamada nova recalcula a
  // fila a partir do que está persistido (nunca reabre o que já foi visto).
  async function reproduzirPendentes() {
    if (reproduzindo) return;
    const fila = agruparMarcosPorFamilia(pendentes());
    if (!fila.length) return;
    reproduzindo = true;
    try {
      for (const evento of fila) {
        if (!overlay) break; // fechou no meio da sequência
        // eslint-disable-next-line no-await-in-loop
        if (evento.tipo === 'era') await tocarEventoEra(evento);
        // eslint-disable-next-line no-await-in-loop
        else await tocarEventoMarco(evento);
      }
    } finally {
      reproduzindo = false;
      store.setDiorama(proximoProgressoVisto(estadoAtual()));
    }
  }

  function renderEstadoFinal(estado) {
    for (const familia of FAMILIAS) atualizarCamada(familia, estado.niveis[familia]);
    const totalNiveis = FAMILIAS.reduce((soma, f) => soma + estado.niveis[f], 0);
    legenda(totalNiveis === 0 ? T.dioramaVazio : '');
    const portalIA = overlay?.querySelector('.diorama-ia-portal');
    if (portalIA) portalIA.hidden = !estado.temCriacoesIA;
  }

  function construirCamada(familia) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `diorama-camada diorama-camada-${familia}`;
    el.dataset.familia = familia;
    el.innerHTML = '<span class="diorama-icone" aria-hidden="true"></span>';
    el.setAttribute('aria-label', T.dioramaFamilias[familia]);
    el.addEventListener('click', () => {
      const nivel = Number(el.dataset.nivel || 0);
      el.classList.add('diorama-camada-toque');
      setTimeout(() => el.classList.remove('diorama-camada-toque'), 260);
      const rotulo = T.dioramaEstagios[familia][nivel];
      legenda(`${T.dioramaFamilias[familia]}: ${rotulo}`);
      falar(rotulo);
    });
    return el;
  }

  function abrir() {
    fechar();
    garantirBootstrap();

    overlay = document.createElement('div');
    overlay.className = 'diorama-overlay fundo-cosmico';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', T.dioramaTitulo);
    overlay.innerHTML = `
      <div class="diorama-cabecalho">
        <div class="diorama-cabecalho-texto">
          <h2 class="diorama-titulo">${T.dioramaTitulo}</h2>
          <p class="diorama-subtitulo">${T.dioramaSubtitulo}</p>
        </div>
        <button type="button" class="diorama-fechar">${T.dioramaFechar}</button>
      </div>
      <div class="diorama-cena">
        <div class="diorama-ilha">
          <div class="diorama-camadas"></div>
        </div>
        <button type="button" class="diorama-ia-portal" aria-label="${T.dioramaIaPortalRotulo}" hidden>
          <span aria-hidden="true">✨</span>
        </button>
      </div>
      <p class="diorama-legenda" aria-live="polite"></p>`;

    const elCamadas = overlay.querySelector('.diorama-camadas');
    camadas = {};
    for (const familia of FAMILIAS) {
      const el = construirCamada(familia);
      camadas[familia] = el;
      elCamadas.appendChild(el);
    }

    overlay.querySelector('.diorama-fechar').addEventListener('click', fechar);
    overlay.querySelector('.diorama-ia-portal').addEventListener('click', () => {
      legenda(T.dioramaIaPortalTexto);
    });
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) fechar(); });
    document.addEventListener('keydown', aoTeclar);

    (raiz || document.body).appendChild(overlay);

    // mostra o estado JÁ visto primeiro (nunca um flash do estado final
    // antes da animação), depois reproduz o que faltar.
    const visto = progressoVisto();
    const estadoBase = visto
      ? { niveis: visto.niveis, temCriacoesIA: estadoAtual().temCriacoesIA }
      : estadoAtual();
    renderEstadoFinal(estadoBase);
    reproduzirPendentes().then(() => renderEstadoFinal(estadoAtual()));
  }

  return {
    abrir,
    fechar,
    // chamado uma vez no boot do app (ver app.js) — idempotente: uma vez que
    // save.diorama existe, vira um no-op em todas as chamadas seguintes.
    garantirBootstrap,
    // pro indicador discreto no HUD (ver app.js) — nunca abre nada sozinho.
    temPendentes: () => pendentes().length > 0,
    _paraTeste: {
      estadoAtual, progressoVisto, pendentes,
    },
  };
}
