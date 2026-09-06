// src/ui/arvore.js
// Tela cheia: o mapa do que já foi descoberto, em faixas horizontais por era
// (a mais simples no topo). Nós = ids em save.descobertos. Arestas = de cada
// pai em `via` para o filho. Tocar num nó realça pais/filhos; segurar manda
// a peça pro canvas — a árvore virou uma segunda forma de pegar itens, além
// da gaveta.
import { ligarPanZoom } from './panzoom.js';
import { ERAS } from '../engine/catalogo.js';

const NO_LARG = 110; // passo horizontal entre nós da mesma faixa
const NIVEL_ALT = 130; // altura de cada faixa de era
const PAD = 40; // margem do mundo
const NO_MEIA_LARG = 34; // metade da largura nominal do nó, p/ ancorar arestas
const NO_ALT = 60; // altura nominal do nó, p/ ancorar arestas
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2;
const SEGURAR_MS = 450; // tempo de toque-e-segure pra mandar a peça pro canvas

function icone(item) {
  if (item && item.svg) return `<img class="arvore-no-icone" src="${item.svg}" alt="" />`;
  return `<span class="arvore-no-icone">${item ? item.emoji : '❔'}</span>`;
}

function calcularNiveis(descobertos) {
  const ids = Object.keys(descobertos);
  const nivel = new Map();

  const paisDe = (id) => {
    const via = descobertos[id] && descobertos[id].via;
    return Array.isArray(via) ? via.filter((p) => descobertos[p]) : [];
  };

  for (const id of ids) {
    if (paisDe(id).length === 0) nivel.set(id, 0);
  }

  let mudou = true;
  let voltas = 0;
  while (mudou && voltas <= ids.length) {
    mudou = false;
    voltas += 1;
    for (const id of ids) {
      if (nivel.has(id)) continue;
      const pais = paisDe(id);
      if (pais.every((p) => nivel.has(p))) {
        nivel.set(id, 1 + Math.max(...pais.map((p) => nivel.get(p))));
        mudou = true;
      }
    }
  }

  // cadeia estranha (ciclo em `via`, dado inconsistente): ancora na raiz
  for (const id of ids) if (!nivel.has(id)) nivel.set(id, 0);
  return nivel;
}

export function montarArvore({
  raiz, store, catalogo, T, aoEnviarPraCanvas,
}) {
  let overlay = null;
  let selecionado = null;
  const posicoes = new Map(); // id -> { x, y } no espaço do mundo
  const elos = new Map(); // id -> elemento .arvore-no
  const vista = { x: 0, y: 0, escala: 1 };

  function fechar() {
    if (!overlay) return;
    document.removeEventListener('keydown', aoTeclar);
    overlay.remove();
    overlay = null;
    selecionado = null;
  }

  function aoTeclar(ev) {
    if (ev.key === 'Escape') fechar();
  }

  function filhosDe(id, descobertos) {
    return Object.keys(descobertos).filter((outro) => {
      const via = descobertos[outro].via;
      return Array.isArray(via) && via.includes(id);
    });
  }

  function paisDescobertos(id, descobertos) {
    const via = descobertos[id] && descobertos[id].via;
    return Array.isArray(via) ? via.filter((p) => descobertos[p]) : [];
  }

  function limparRealce() {
    selecionado = null;
    for (const el of elos.values()) el.classList.remove('destaque', 'esmaecido');
    const legenda = overlay.querySelector('.arvore-legenda');
    legenda.textContent = T.arvoreDica;
  }

  function realcar(id) {
    const descobertos = store.getSave().descobertos;
    selecionado = id;
    const relacionados = new Set([
      id,
      ...paisDescobertos(id, descobertos),
      ...filhosDe(id, descobertos),
    ]);
    for (const [outro, el] of elos) {
      const dentro = relacionados.has(outro);
      el.classList.toggle('destaque', dentro);
      el.classList.toggle('esmaecido', !dentro);
    }
    const item = catalogo.getItem(id);
    const pais = paisDescobertos(id, descobertos);
    const combo = pais.length === 2 ? catalogo.findCombo(pais[0], pais[1]) : null;
    const legenda = overlay.querySelector('.arvore-legenda');
    const nome = item ? item.nome : id;
    legenda.textContent = combo && combo.texto ? `${nome}: ${combo.texto}` : nome;
  }

  // toque curto = realça pais/filhos (como sempre); segurar = manda a peça
  // pro canvas, como escolher um card na gaveta.
  function ligarToqueNo(el, id) {
    let timer = null;
    let segurou = false;

    function cancelar() {
      clearTimeout(timer);
      timer = null;
      el.classList.remove('segurando');
    }

    el.addEventListener('pointerdown', (ev) => {
      if (ev.button != null && ev.button !== 0) return;
      segurou = false;
      clearTimeout(timer);
      timer = setTimeout(() => {
        segurou = true;
        el.classList.add('segurando');
      }, SEGURAR_MS);
    });
    el.addEventListener('pointerup', (ev) => {
      cancelar();
      if (segurou) {
        ev.stopPropagation();
        aoEnviarPraCanvas?.(id);
      }
    });
    el.addEventListener('pointercancel', cancelar);
    el.addEventListener('pointerleave', cancelar);
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (segurou) { segurou = false; return; } // já tratado no pointerup
      realcar(id);
    });
  }

  function aplicarVista() {
    const mundo = overlay.querySelector('.arvore-mundo');
    mundo.style.transform =
      `translate(${vista.x}px, ${vista.y}px) scale(${vista.escala})`;
  }

  function ligarGestos() {
    const palco = overlay.querySelector('.arvore-palco');
    ligarPanZoom({
      alvo: palco,
      vista,
      aplicar: aplicarVista,
      permitePan: (ev) => !ev.target.closest('.arvore-no'),
      zoomMin: ZOOM_MIN,
      zoomMax: ZOOM_MAX,
    });

    // clicar no vazio limpa o realce — mas não logo depois de arrastar
    let baixouEm = null;
    palco.addEventListener('pointerdown', (ev) => {
      baixouEm = { x: ev.clientX, y: ev.clientY };
    });
    palco.addEventListener('click', (ev) => {
      if (ev.target.closest('.arvore-no')) return;
      const arrastou = baixouEm
        && Math.hypot(ev.clientX - baixouEm.x, ev.clientY - baixouEm.y) > 6;
      if (!arrastou) limparRealce();
    });
  }

  function eraDoId(id) {
    const item = catalogo.getItem(id);
    return (item && ERAS.includes(item.era)) ? item.era : ERAS[ERAS.length - 1];
  }

  function desenhar() {
    const descobertos = store.getSave().descobertos;
    const nivel = calcularNiveis(descobertos); // só pra metadado (dataset.nivel)

    // faixa = era (a mais simples no topo); dentro da faixa, ordem de descoberta
    const porFaixa = new Map(ERAS.map((era) => [era, []]));
    for (const id of Object.keys(descobertos)) {
      porFaixa.get(eraDoId(id)).push(id);
    }
    posicoes.clear();
    let maiorFaixa = 1;
    ERAS.forEach((era, faixaIdx) => {
      const ids = porFaixa.get(era);
      ids.sort((a, b) => descobertos[a].em - descobertos[b].em);
      maiorFaixa = Math.max(maiorFaixa, ids.length);
      ids.forEach((id, i) => {
        posicoes.set(id, { x: PAD + i * NO_LARG, y: PAD + faixaIdx * NIVEL_ALT });
      });
    });

    const faixas = overlay.querySelector('.arvore-faixas');
    const larguraMundo = PAD * 2 + maiorFaixa * NO_LARG;
    faixas.innerHTML = '';
    ERAS.forEach((era, faixaIdx) => {
      const banda = document.createElement('div');
      banda.className = 'arvore-faixa';
      banda.dataset.era = era;
      banda.style.top = `${faixaIdx * NIVEL_ALT}px`;
      banda.style.height = `${NIVEL_ALT}px`;
      banda.style.width = `${larguraMundo}px`;
      banda.innerHTML =
        `<span class="arvore-faixa-rotulo">${T.erasIcone[era] || ''} ${T.eras[era] || era}</span>`;
      faixas.appendChild(banda);
    });

    const nos = overlay.querySelector('.arvore-nos');
    const svg = overlay.querySelector('.arvore-arestas');
    nos.innerHTML = '';
    svg.innerHTML = '';
    elos.clear();

    // arestas primeiro (ficam atrás dos nós)
    for (const id of Object.keys(descobertos)) {
      const alvo = posicoes.get(id);
      for (const pai of paisDescobertos(id, descobertos)) {
        const origem = posicoes.get(pai);
        if (!origem || !alvo) continue;
        const linha = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        linha.setAttribute('x1', String(origem.x + NO_MEIA_LARG));
        linha.setAttribute('y1', String(origem.y + NO_ALT));
        linha.setAttribute('x2', String(alvo.x + NO_MEIA_LARG));
        linha.setAttribute('y2', String(alvo.y));
        linha.setAttribute('class', 'arvore-aresta');
        svg.appendChild(linha);
      }
    }

    for (const id of Object.keys(descobertos)) {
      const meta = descobertos[id];
      const item = catalogo.getItem(id);
      const pos = posicoes.get(id);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'arvore-no';
      el.dataset.id = id;
      el.dataset.era = item ? item.era : '';
      el.dataset.fonte = meta.fonte;
      el.dataset.nivel = String(nivel.get(id));
      el.style.left = `${pos.x}px`;
      el.style.top = `${pos.y}px`;
      el.innerHTML = `${icone(item)}<span class="arvore-no-nome">${item ? item.nome : id}</span>`;
      ligarToqueNo(el, id);
      nos.appendChild(el);
      elos.set(id, el);
    }
  }

  function abrir() {
    if (overlay) {
      desenhar();
      return;
    }
    overlay = document.createElement('div');
    overlay.className = 'arvore-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', T.arvoreTitulo);
    overlay.innerHTML = `
      <div class="arvore-cabecalho">
        <h2 class="arvore-titulo">${T.arvoreTitulo}</h2>
        <button type="button" class="arvore-fechar">${T.fechar}</button>
      </div>
      <div class="arvore-palco">
        <div class="arvore-mundo">
          <div class="arvore-faixas"></div>
          <svg class="arvore-arestas" xmlns="http://www.w3.org/2000/svg"></svg>
          <div class="arvore-nos"></div>
        </div>
      </div>
      <p class="arvore-legenda">${T.arvoreDica}</p>`;

    overlay.querySelector('.arvore-fechar').addEventListener('click', fechar);
    document.addEventListener('keydown', aoTeclar);
    (raiz || document.body).appendChild(overlay);

    vista.x = 0;
    vista.y = 0;
    vista.escala = 1;
    ligarGestos();
    desenhar();
    aplicarVista();
  }

  return { abrir, fechar, destruir: fechar };
}
