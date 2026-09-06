// src/ui/arvore.js
// Mapa navegável do que já foi descoberto, em faixas horizontais por era (a
// mais simples no topo). Nenhuma conexão aparece por padrão — com o catálogo
// crescendo, mostrar todas as arestas sempre virava uma teia ilegível. Tocar
// num nó foca nele e revela só as relações diretas (pais/filhos); o resto do
// mapa continua visível, só secundário. Segurar manda a peça pro canvas — a
// árvore é uma segunda forma de pegar itens, além da gaveta.
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
const CENTRALIZAR_MARGEM = 0.18; // % do palco: fora disso, centraliza suave no foco

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
  let centralizarTimer = null;
  const posicoes = new Map(); // id -> { x, y } no espaço do mundo
  const elos = new Map(); // id -> elemento .arvore-no
  const arestas = new Map(); // "pai>filho" -> elemento <line>
  const vista = { x: 0, y: 0, escala: 1 };

  function fechar() {
    if (!overlay) return;
    document.removeEventListener('keydown', aoTeclar);
    clearTimeout(centralizarTimer);
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
    for (const el of elos.values()) el.classList.remove('destaque', 'pai', 'filho', 'esmaecido');
    for (const linha of arestas.values()) {
      linha.classList.remove('ativa', 'aresta-pai', 'aresta-filho');
    }
    const legenda = overlay.querySelector('.arvore-legenda');
    legenda.textContent = T.arvoreDica;
  }

  // centraliza suavemente o nó focado só quando ele está perto da borda do
  // palco — evita um "salto" toda vez que já está bem visível
  function centralizarSeNecessario(id) {
    const pos = posicoes.get(id);
    if (!pos) return;
    const palco = overlay.querySelector('.arvore-palco');
    const rect = palco.getBoundingClientRect();
    const telaX = pos.x * vista.escala + vista.x;
    const telaY = pos.y * vista.escala + vista.y;
    const margemX = rect.width * CENTRALIZAR_MARGEM;
    const margemY = rect.height * CENTRALIZAR_MARGEM;
    const dentro = telaX > margemX && telaX < rect.width - margemX
      && telaY > margemY && telaY < rect.height - margemY;
    if (dentro) return;
    const mundo = overlay.querySelector('.arvore-mundo');
    vista.x = rect.width / 2 - (pos.x + NO_MEIA_LARG) * vista.escala;
    vista.y = rect.height / 2 - (pos.y + NO_ALT / 2) * vista.escala;
    mundo.style.transition = 'transform 240ms ease';
    aplicarVista();
    clearTimeout(centralizarTimer);
    centralizarTimer = setTimeout(() => { mundo.style.transition = ''; }, 260);
  }

  function realcar(id) {
    const descobertos = store.getSave().descobertos;
    selecionado = id;
    const pais = paisDescobertos(id, descobertos);
    const filhos = filhosDe(id, descobertos);
    const paisSet = new Set(pais);
    const filhosSet = new Set(filhos);

    for (const [outro, el] of elos) {
      el.classList.remove('destaque', 'pai', 'filho', 'esmaecido');
      if (outro === id) el.classList.add('destaque');
      else if (paisSet.has(outro)) el.classList.add('pai');
      else if (filhosSet.has(outro)) el.classList.add('filho');
      else el.classList.add('esmaecido');
    }
    // arestas só aparecem pras relações diretas do foco — pai e filho também
    // se diferenciam por seta/traço, não só pela cor
    for (const [chave, linha] of arestas) {
      const [de, para] = chave.split('>');
      const éPaiDoFoco = para === id;
      const éFilhoDoFoco = de === id;
      linha.classList.toggle('ativa', éPaiDoFoco || éFilhoDoFoco);
      linha.classList.toggle('aresta-pai', éPaiDoFoco);
      linha.classList.toggle('aresta-filho', éFilhoDoFoco);
    }

    const item = catalogo.getItem(id);
    const nome = item ? item.nome : id;
    const nomesPais = pais.length
      ? pais.map((p) => (catalogo.getItem(p) ? catalogo.getItem(p).nome : p)).join(' + ')
      : '—';
    const nomesFilhos = filhos.length
      ? filhos.map((f) => (catalogo.getItem(f) ? catalogo.getItem(f).nome : f)).join(', ')
      : T.arvoreNadaAinda;
    const legenda = overlay.querySelector('.arvore-legenda');
    legenda.innerHTML = `
      <span class="arvore-legenda-nome">${item ? icone(item) : ''} ${nome}</span>
      <span class="arvore-legenda-linha">${T.arvoreVeioDe(nomesPais)}</span>
      <span class="arvore-legenda-linha">${T.arvoreJaCriei(nomesFilhos)}</span>`;

    centralizarSeNecessario(id);
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
      // sem isso, focar o <button> pode fazer o navegador rolar sozinho o
      // palco (overflow:hidden) pra revelar o nó — some com o pan de verdade
      ev.preventDefault();
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
    const palco = overlay.querySelector('.arvore-palco');
    // o palco é overflow:hidden; um <button> focado (ao tocar num nó) pode
    // levar o navegador a rolar esse contêiner sozinho pra revelar o foco —
    // um scroll nativo que se soma por cima do nosso próprio pan via
    // transform. Zeramos aqui porque a "câmera" é só o `vista`, nunca o
    // scroll nativo.
    if (palco.scrollLeft || palco.scrollTop) {
      palco.scrollLeft = 0;
      palco.scrollTop = 0;
    }
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
    const defs = svg.querySelector('defs');
    svg.innerHTML = '';
    if (defs) svg.appendChild(defs); // preserva os <marker> das setas
    nos.innerHTML = '';
    elos.clear();
    arestas.clear();

    // arestas primeiro (ficam atrás dos nós). Nenhuma aparece por padrão —
    // só quando o pai ou o filho dela vira o foco (ver realcar()).
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
        arestas.set(`${pai}>${id}`, linha);
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
      const fonte = meta.fonte === 'ia' ? ' data-fonte="ia"' : '';
      el.innerHTML =
        `<span class="orbe orbe-arvore" data-era="${item ? item.era : ''}"${fonte}>${icone(item)}</span>` +
        `<span class="arvore-no-nome">${item ? item.nome : id}</span>`;
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
          <svg class="arvore-arestas" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <marker id="arvore-seta-pai" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L8,4 L0,8 Z" class="arvore-seta-pai-forma" />
              </marker>
              <marker id="arvore-seta-filho" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L8,4 L0,8 Z" class="arvore-seta-filho-forma" />
              </marker>
            </defs>
          </svg>
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
