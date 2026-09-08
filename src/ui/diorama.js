// Diorama V1 — "Meu Mundo": o cenário-maquete que cresce sozinho a partir
// das descobertas do perfil. Nunca um city-builder: só observa, nunca
// constrói/arrasta/administra (ver briefing §9).
//
// Estado 100% derivado (src/engine/diorama.js); esta camada só desenha e
// reproduz a fila de acontecimentos pendentes em sequência curta — nunca
// decide sozinha o que é "novo", só pergunta pro motor e marca como visto
// depois de mostrar.
//
// A composição visual (geografia fixa + âncoras + tabela estado->objeto)
// mora em ./diorama-mundo.js — este arquivo só orquestra abrir/fechar,
// fila de eventos e a ponte entre estado derivado e a engine de
// composição. Nenhuma posição/escala fica hardcoded aqui.
import {
  FAMILIAS, resolverEstadoDiorama, calcularAcontecimentosPendentes, proximoProgressoVisto,
} from '../engine/diorama.js';
import {
  ELEMENTOS, GEOGRAFIA_SVG, NIVEL_CAMINHO_CIVILIZACAO, elementosDaFamilia, posicaoDoObjeto,
} from './diorama-mundo.js';

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
  let svgMundo = null;
  let camadaObjetos = null;
  let objetosMontados = new Map(); // chave "familia:anchor:elemento" -> nó DOM
  let niveisRenderizados = null; // último niveis realmente desenhado na tela
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
    svgMundo = null;
    camadaObjetos = null;
    objetosMontados = new Map();
    niveisRenderizados = null;
  }

  function aoTeclar(ev) {
    if (ev.key === 'Escape') fechar();
  }

  function legenda(texto) {
    const el = overlay?.querySelector('.diorama-legenda');
    if (el) el.textContent = texto;
  }

  // ---- ponte estado -> geografia (a mesma geografia fixa muda de "roupa",
  // nunca de forma — §1/§7 do briefing) --------------------------------
  function aplicarNivelAgua(nivel) {
    if (svgMundo) svgMundo.dataset.nivelAgua = String(nivel);
  }
  function aplicarNivelVegetacao(nivel) {
    if (svgMundo) svgMundo.dataset.nivelVegetacao = String(nivel);
  }
  function aplicarCaminho(nivelCivilizacao) {
    svgMundo?.classList.toggle('mundo-tem-caminho', nivelCivilizacao >= NIVEL_CAMINHO_CIVILIZACAO);
  }

  function chaveObjeto(familia, item) {
    return `${familia}:${item.anchor}:${item.elemento}`;
  }

  function construirObjeto(familia, item, animarEntrada) {
    const def = ELEMENTOS[item.elemento];
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'diorama-objeto';
    if (animarEntrada && def?.anim) el.classList.add(`diorama-objeto-anim-${def.anim}`);
    el.dataset.familia = familia;
    el.dataset.elemento = item.elemento;
    el.innerHTML = '<span class="diorama-objeto-icone" aria-hidden="true"></span>';
    el.querySelector('.diorama-objeto-icone').textContent = def?.conteudo || '';
    el.setAttribute('aria-label', T.dioramaFamilias[familia]);
    const estilo = posicaoDoObjeto(familia, item.anchor);
    if (estilo) {
      el.style.left = estilo.left;
      el.style.top = estilo.top;
      el.style.zIndex = String(estilo.zIndex);
    }
    el.style.setProperty('--diorama-escala', String(item.escala ?? 1));
    return el;
  }

  // sincroniza o DOM de objetos com o estado desejado — estado -> âncora ->
  // asset, nunca o contrário: nenhum elemento "sabe" onde mora, só a tabela
  // COMPOSICAO (diorama-mundo.js) sabe. `destacarFamilia` anima só os
  // objetos novos daquela família (usado durante a fila de marcos); fora
  // da fila (montagem inicial / resync final) tudo entra sem animação.
  function sincronizarObjetos(niveis, destacarFamilia) {
    if (!camadaObjetos) return;
    const desejado = new Map();
    for (const familia of FAMILIAS) {
      for (const item of elementosDaFamilia(familia, niveis[familia])) {
        desejado.set(chaveObjeto(familia, item), { familia, item });
      }
    }
    for (const [chave, el] of objetosMontados) {
      if (!desejado.has(chave)) { el.remove(); objetosMontados.delete(chave); }
    }
    for (const [chave, { familia, item }] of desejado) {
      if (objetosMontados.has(chave)) continue;
      const el = construirObjeto(familia, item, familia === destacarFamilia);
      camadaObjetos.appendChild(el);
      objetosMontados.set(chave, el);
    }
  }

  async function tocarEventoMarco(evento) {
    legenda(`${T.dioramaFamilias[evento.familia]}: ${T.dioramaEstagios[evento.familia][evento.para]}`);
    const niveis = { ...niveisRenderizados, [evento.familia]: evento.para };
    if (evento.familia === 'agua') {
      svgMundo?.classList.add('mundo-pulso-agua');
      aplicarNivelAgua(evento.para);
    }
    if (evento.familia === 'vegetacao') {
      svgMundo?.classList.add('mundo-pulso-vegetacao');
      aplicarNivelVegetacao(evento.para);
    }
    if (evento.familia === 'civilizacao') aplicarCaminho(evento.para);
    sincronizarObjetos(niveis, evento.familia);
    niveisRenderizados = niveis;
    await esperar(760); // cobre a maior animação de entrada (crescer/montar)
    svgMundo?.classList.remove('mundo-pulso-agua', 'mundo-pulso-vegetacao');
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
    aplicarNivelAgua(estado.niveis.agua);
    aplicarNivelVegetacao(estado.niveis.vegetacao);
    aplicarCaminho(estado.niveis.civilizacao);
    sincronizarObjetos(estado.niveis, null);
    niveisRenderizados = { ...estado.niveis };
    const totalNiveis = FAMILIAS.reduce((soma, f) => soma + estado.niveis[f], 0);
    legenda(totalNiveis === 0 ? T.dioramaVazio : '');
    const portalIA = overlay?.querySelector('.diorama-ia-portal');
    if (portalIA) portalIA.hidden = !estado.temCriacoesIA;
  }

  function aoTocarObjeto(ev) {
    const el = ev.target.closest('[data-familia]');
    if (!el || !camadaObjetos?.contains(el)) return;
    const familia = el.dataset.familia;
    const nivel = estadoAtual().niveis[familia];
    el.classList.add('diorama-objeto-toque');
    setTimeout(() => el.classList.remove('diorama-objeto-toque'), 260);
    const rotulo = T.dioramaEstagios[familia][nivel];
    legenda(`${T.dioramaFamilias[familia]}: ${rotulo}`);
    falar(rotulo);
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
          ${GEOGRAFIA_SVG}
          <div class="diorama-objetos"></div>
        </div>
        <button type="button" class="diorama-ia-portal" aria-label="${T.dioramaIaPortalRotulo}" hidden>
          <span aria-hidden="true">✨</span>
        </button>
      </div>
      <p class="diorama-legenda" aria-live="polite"></p>`;

    svgMundo = overlay.querySelector('.diorama-mundo-svg');
    camadaObjetos = overlay.querySelector('.diorama-objetos');
    camadaObjetos.addEventListener('click', aoTocarObjeto);

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
