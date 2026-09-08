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
  terreno: ['', '⛰️', '⛰️⛰️', '🏔️⛰️', '🏔️⛰️🪨'],
  agua: ['', '💧', '🏞️', '🌊', '🌊🌊'],
  vegetacao: ['', '🌱', '🌿', '🌳', '🌳🌳🌳'],
  vida: ['', '🐛', '🐦🐛', '🦋🐦🐟', '🦁🦋🐦🐟'],
  civilizacao: ['', '🔥', '🏠', '🏘️', '🏰'],
  tecnologia: ['', '🔨', '⚙️', '🤖', '🚀'],
  cosmico: ['', '⭐', '⭐⭐', '🌌', '🪐✨'],
};

// posição de cada família sobre a maquete (% dentro de .diorama-ilha) —
// espacial, nunca em slot/grade: cada família mora numa zona física
// coerente do mundinho (monte alto / planície / borda d'água / céu).
const POSICOES = {
  terreno: { left: '27%', top: '32%' },
  vegetacao: { left: '41%', top: '38%' },
  vida: { left: '56%', top: '50%' },
  civilizacao: { left: '32%', top: '66%' },
  tecnologia: { left: '60%', top: '70%' },
  agua: { left: '74%', top: '62%' },
  cosmico: { left: '50%', top: '9%' },
};

// a maquete em si — sempre presente, mesmo no "Mundo Primordial" com zero
// descobertas: rocha nua, um pouco de terra e uma poça d'água já existem
// antes de qualquer marco. As camadas (família) só ganham vida POR CIMA
// dela; o Diorama nunca começa como uma tela vazia.
const MUNDO_SVG = `
<svg class="diorama-mundo-svg" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
  <defs>
    <linearGradient id="diorama-grad-solo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5a4128" />
      <stop offset="100%" stop-color="#2c1e10" />
    </linearGradient>
    <linearGradient id="diorama-grad-topo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3a6b3f" />
      <stop offset="55%" stop-color="#22492a" />
      <stop offset="100%" stop-color="#173620" />
    </linearGradient>
    <linearGradient id="diorama-grad-monte" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4c7d4a" />
      <stop offset="100%" stop-color="#2b5231" />
    </linearGradient>
    <linearGradient id="diorama-grad-agua" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7fd4e6" />
      <stop offset="100%" stop-color="#2f8fc2" />
    </linearGradient>
  </defs>
  <path class="diorama-mundo-lateral" d="M40,142 C20,112 40,77 90,67 C130,42 200,37 250,57 C300,42 360,67 370,107 C385,137 365,162 330,167 C350,187 320,207 270,202 C240,222 180,227 140,212 C90,222 50,197 45,172 C20,172 25,152 40,142 Z" fill="url(#diorama-grad-solo)" />
  <path class="diorama-mundo-agua" d="M255,150 C288,136 333,144 356,168 C374,187 362,212 332,220 C300,230 264,220 246,200 C232,183 233,163 255,150 Z" fill="url(#diorama-grad-agua)" />
  <path class="diorama-mundo-topo" d="M40,120 C20,90 40,55 90,45 C130,20 200,15 250,35 C300,20 360,45 370,85 C385,115 365,140 330,145 C350,165 320,185 270,180 C240,200 180,205 140,190 C90,200 50,175 45,150 C20,150 25,130 40,120 Z" fill="url(#diorama-grad-topo)" />
  <path class="diorama-mundo-monte" d="M115,88 C105,58 148,36 190,46 C222,54 228,83 206,99 C184,116 136,116 115,88 Z" fill="url(#diorama-grad-monte)" />
  <ellipse class="diorama-mundo-rocha" cx="88" cy="118" rx="10" ry="6" fill="#4a3a2a" opacity="0.7" />
  <ellipse class="diorama-mundo-rocha" cx="300" cy="112" rx="8" ry="5" fill="#4a3a2a" opacity="0.55" />
  <ellipse class="diorama-mundo-brilho" cx="190" cy="60" rx="140" ry="30" fill="#ffffff" opacity="0.05" />
</svg>`;

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
    const pos = POSICOES[familia];
    if (pos) { el.style.left = pos.left; el.style.top = pos.top; }
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
          ${MUNDO_SVG}
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
