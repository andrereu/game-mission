// src/ui/arvore.js
// "Universo das Descobertas": a história daquele perfil, não o catálogo
// inteiro — só o que ele já descobriu, do jeito que ele descobriu (via `via`
// real do save). Os quatro elementos primordiais ficam no núcleo; as demais
// descobertas se espalham em cinturões concêntricos por era (Natureza, Vida,
// Tecnologia, Cultura, Ficção) e, quando existem, criações da IA ganham uma
// órbita paralela própria. Layout 100% determinístico (sem Math.random):
// mesma "descobertos" sempre produz as mesmas posições.
//
// Nenhuma conexão aparece por padrão — tocar num nó foca nele e revela só as
// relações diretas (pais em dourado tracejado, filhos em ciano contínuo).
// Segurar manda a peça pro canvas, como sempre.
import { ligarPanZoom } from './panzoom.js';
import { ERAS } from '../engine/catalogo.js';
import { slug } from '../engine/slug.js';
import { ehAlemDoMapaVisivel, atributosOrbeAlemDoMapa } from './alemDoMapaUI.js';

const SVGNS = 'http://www.w3.org/2000/svg';

// ---- geometria do universo (tudo em px, espaço do "mundo") ----
const CENTRO = 3000; // offset fixo: mantém as coordenadas sempre positivas
const RAIO_NUCLEO = 60; // distância do centro aos 4 elementos primordiais
const GAP_NUCLEO_ANEL = 90; // do núcleo até o 1º sub-anel "extra" de Elementos
const GAP_ENTRE_ERAS = 90; // gap radial entre o fim de uma era e o início da próxima
const ANEL_GAP = 68; // distância radial entre sub-anéis dentro de uma mesma era
const ESPACO_ARCO = 62; // distância mínima entre nós vizinhos num mesmo sub-anel
const NUDGE_ALEM_MAPA = 40; // empurrão extra pros itens "além do mapa": borda exterior da região
const NO_TAM = 68; // largura nominal do nó (mesma área de toque de sempre)
const RAIO_ORBE = 24; // pra encurtar as arestas e não desenhar por baixo da orbe

const ZOOM_MIN = 0.28;
const ZOOM_MAX = 2.2;
const ESCALA_PADRAO = 0.9;
const LIMIAR_NOME = 0.55; // abaixo dessa escala, nomes escondem visualmente (rótulo acessível continua)
const SEGURAR_MS = 450; // tempo de toque-e-segure pra mandar a peça pro canvas
const CENTRALIZAR_MARGEM = 0.18; // % do palco: fora disso, centraliza suave no foco

const RARIDADE_LABEL = {
  comum: 'Comum', raro: 'Raro', epico: 'Épico', lendario: 'Lendário',
};

function reduzMovimento() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function icone(item) {
  if (item && item.svg) return `<img class="arvore-no-icone" src="${item.svg}" alt="" />`;
  return `<span class="arvore-no-icone">${item ? item.emoji : '❔'}</span>`;
}

// ---------------------------------------------------------------------
// Layout: só itens descobertos, 100% determinístico. Ordem de descoberta
// (`meta.em`) decide o índice de cada item dentro da sua região — assim,
// abrir de novo dá as mesmas posições, e uma nova descoberta só se acrescenta
// ao fim da sua região (não reembaralha o resto).
// ---------------------------------------------------------------------
function calcularLayout(descobertos, catalogo) {
  const ids = Object.keys(descobertos).filter((id) => catalogo.getItem(id));
  const porOrdem = (a, b) => (descobertos[a].em ?? 0) - (descobertos[b].em ?? 0);

  const primordiais = [];
  const porEra = new Map(ERAS.map((e) => [e, []]));
  const idsIA = [];

  for (const id of ids) {
    const item = catalogo.getItem(id);
    if (item.ia) { idsIA.push(id); continue; }
    if (item.base) { primordiais.push(id); continue; }
    const era = ERAS.includes(item.era) ? item.era : ERAS[ERAS.length - 1];
    porEra.get(era).push(id);
  }
  const ordemBase = catalogo.baseItems().map((it) => it.id);
  primordiais.sort((a, b) => ordemBase.indexOf(a) - ordemBase.indexOf(b));
  for (const lista of porEra.values()) lista.sort(porOrdem);
  idsIA.sort(porOrdem);

  const posicoes = new Map(); // id -> { x, y, era }
  const regioes = []; // { era, raioMax }, do núcleo pra fora

  // núcleo: os primordiais formam um pequeno diamante fixo em volta do centro
  const ANGULOS_NUCLEO = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  primordiais.forEach((id, i) => {
    const ang = ANGULOS_NUCLEO[i % ANGULOS_NUCLEO.length];
    posicoes.set(id, {
      x: CENTRO + Math.cos(ang) * RAIO_NUCLEO,
      y: CENTRO + Math.sin(ang) * RAIO_NUCLEO,
      era: 'elementos',
    });
  });

  // distribui uma lista de ids em sub-anéis concêntricos a partir de raioBase,
  // com capacidade por anel derivada da circunferência (evita sobreposição) —
  // sem simulação de força, sem aleatoriedade.
  function distribuirAnel(lista, raioBase, era) {
    let raioMax = raioBase;
    if (lista.length === 0) return raioMax;
    const capacidade = (ringIdx) => Math.max(
      6,
      Math.floor((2 * Math.PI * (raioBase + ringIdx * ANEL_GAP)) / ESPACO_ARCO),
    );
    let ringIdx = 0;
    let offset = 0;
    let cap = capacidade(0);
    for (let i = 0; i < lista.length; i += 1) {
      while (i >= offset + cap) {
        offset += cap;
        ringIdx += 1;
        cap = capacidade(ringIdx);
      }
      const posNoAnel = i - offset;
      const raio = raioBase + ringIdx * ANEL_GAP;
      // gira anéis alternados pra evitar que os nós fiquem todos alinhados
      // radialmente uns sobre os outros
      const rotacao = ringIdx % 2 === 1 ? Math.PI / cap : 0;
      const angulo = (posNoAnel / cap) * Math.PI * 2 + rotacao;
      const id = lista[i];
      const alem = catalogo.ehAlemDoMapa(id);
      const raioFinal = raio + (alem ? NUDGE_ALEM_MAPA : 0);
      posicoes.set(id, {
        x: CENTRO + Math.cos(angulo) * raioFinal,
        y: CENTRO + Math.sin(angulo) * raioFinal,
        era,
      });
      raioMax = Math.max(raioMax, raioFinal);
    }
    return raioMax;
  }

  let raioAtual = distribuirAnel(porEra.get('elementos'), RAIO_NUCLEO + GAP_NUCLEO_ANEL, 'elementos');
  regioes.push({ era: 'elementos', raioMax: raioAtual });

  for (const era of ERAS.slice(1)) {
    const lista = porEra.get(era);
    if (lista.length === 0) continue; // região vazia: não reserva espaço
    const raioBase = raioAtual + GAP_ENTRE_ERAS;
    raioAtual = distribuirAnel(lista, raioBase, era);
    regioes.push({ era, raioMax: raioAtual });
  }

  if (idsIA.length > 0) {
    const raioBase = raioAtual + GAP_ENTRE_ERAS;
    raioAtual = distribuirAnel(idsIA, raioBase, 'ia');
    regioes.push({ era: 'ia', raioMax: raioAtual });
  }

  return { posicoes, regioes };
}

export function montarArvore({
  raiz, store, catalogo, T, aoEnviarPraCanvas,
}) {
  let overlay = null;
  let selecionado = null;
  let centralizarTimer = null;
  const posicoes = new Map(); // id -> { x, y, era } no espaço do mundo
  const elos = new Map(); // id -> elemento .arvore-no
  const arestas = new Map(); // "pai>filho" -> elemento <line>
  const vista = { x: 0, y: 0, escala: ESCALA_PADRAO };

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

  function limparBandeja() {
    const dica = overlay.querySelector('.arvore-bandeja-dica');
    const conteudo = overlay.querySelector('.arvore-bandeja-conteudo');
    dica.hidden = false;
    conteudo.hidden = true;
    conteudo.innerHTML = '';
  }

  function miniOrbeHTML(id) {
    const item = catalogo.getItem(id);
    if (!item) return '';
    const meta = store.getSave().descobertos[id];
    const alem = ehAlemDoMapaVisivel(catalogo, store, id);
    const fonte = meta && meta.fonte === 'ia' ? ' data-fonte="ia"' : '';
    const eraOrbe = item.ia ? 'ia' : item.era;
    return `<button type="button" class="arvore-mini-orbe" data-id="${id}" aria-label="${item.nome}">
      <span class="orbe orbe-arvore-mini" data-era="${eraOrbe}"${fonte}${atributosOrbeAlemDoMapa(alem, T)}>${icone(item)}</span>
      <span class="arvore-mini-orbe-nome">${item.nome}</span>
    </button>`;
  }

  function atualizarBandeja(id) {
    const descobertos = store.getSave().descobertos;
    const item = catalogo.getItem(id);
    if (!item) return;
    const pais = paisDescobertos(id, descobertos);
    const filhos = filhosDe(id, descobertos);
    const raridade = catalogo.getRaridade(id);
    const alem = ehAlemDoMapaVisivel(catalogo, store, id);
    const meta = descobertos[id];
    const eraOrbe = item.ia ? 'ia' : item.era;

    const dica = overlay.querySelector('.arvore-bandeja-dica');
    const conteudo = overlay.querySelector('.arvore-bandeja-conteudo');
    dica.hidden = true;
    conteudo.hidden = false;
    conteudo.innerHTML = `
      <div class="arvore-bandeja-item">
        <span class="orbe orbe-arvore-mini" data-era="${eraOrbe}"${meta && meta.fonte === 'ia' ? ' data-fonte="ia"' : ''}${atributosOrbeAlemDoMapa(alem, T)}>${icone(item)}</span>
        <div class="arvore-bandeja-info">
          <strong class="arvore-bandeja-nome">${item.nome}</strong>
          <span class="arvore-bandeja-raridade" data-raridade="${raridade}">${RARIDADE_LABEL[raridade] || raridade}</span>
        </div>
      </div>
      <div class="arvore-bandeja-secao">
        <h4>${T.arvoreVimDisso}</h4>
        ${pais.length
    ? `<div class="arvore-bandeja-mini-orbes">${pais.map(miniOrbeHTML).join('')}</div>`
    : `<p class="arvore-bandeja-vazio">${T.arvoreOrigemBase}</p>`}
      </div>
      <div class="arvore-bandeja-secao">
        <h4>${T.arvoreAjudeiCriar}</h4>
        ${filhos.length
    ? `<div class="arvore-bandeja-mini-orbes">${filhos.map(miniOrbeHTML).join('')}</div>`
    : `<p class="arvore-bandeja-vazio">${T.arvoreNadaAinda}</p>`}
      </div>`;

    for (const btn of conteudo.querySelectorAll('.arvore-mini-orbe')) {
      btn.addEventListener('click', () => focar(btn.dataset.id, { forcarCentralizar: true }));
    }
  }

  function limparRealce() {
    selecionado = null;
    for (const el of elos.values()) el.classList.remove('destaque', 'pai', 'filho', 'esmaecido');
    for (const linha of arestas.values()) {
      linha.classList.remove('ativa', 'aresta-pai', 'aresta-filho');
    }
    limparBandeja();
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
    // se diferenciam por estilo/seta, não só pela cor
    for (const [chave, linha] of arestas) {
      const [de, para] = chave.split('>');
      const éPaiDoFoco = para === id;
      const éFilhoDoFoco = de === id;
      linha.classList.toggle('ativa', éPaiDoFoco || éFilhoDoFoco);
      linha.classList.toggle('aresta-pai', éPaiDoFoco);
      linha.classList.toggle('aresta-filho', éFilhoDoFoco);
    }

    atualizarBandeja(id);
  }

  // centraliza a câmera num ponto do mundo; sem transição quando o usuário
  // pediu menos movimento
  function moverCameraPara(x, y, escalaAlvo = vista.escala) {
    const palco = overlay.querySelector('.arvore-palco');
    const rect = palco.getBoundingClientRect();
    const mundo = overlay.querySelector('.arvore-mundo');
    vista.escala = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, escalaAlvo));
    vista.x = rect.width / 2 - x * vista.escala;
    vista.y = rect.height / 2 - y * vista.escala;
    if (!reduzMovimento()) {
      mundo.style.transition = 'transform 240ms ease';
      clearTimeout(centralizarTimer);
      centralizarTimer = setTimeout(() => { mundo.style.transition = ''; }, 260);
    }
    aplicarVista();
  }

  // centraliza suavemente o nó focado só quando ele está perto da borda do
  // palco — evita um "salto" toda vez que já está bem visível
  function centralizarSeNecessario(id, { forcar = false } = {}) {
    const pos = posicoes.get(id);
    if (!pos) return;
    if (!forcar) {
      const palco = overlay.querySelector('.arvore-palco');
      const rect = palco.getBoundingClientRect();
      const telaX = pos.x * vista.escala + vista.x;
      const telaY = pos.y * vista.escala + vista.y;
      const margemX = rect.width * CENTRALIZAR_MARGEM;
      const margemY = rect.height * CENTRALIZAR_MARGEM;
      const dentro = telaX > margemX && telaX < rect.width - margemX
        && telaY > margemY && telaY < rect.height - margemY;
      if (dentro) return;
    }
    moverCameraPara(pos.x, pos.y, vista.escala);
  }

  function focar(id, { forcarCentralizar = false } = {}) {
    if (!elos.has(id)) return;
    realcar(id);
    centralizarSeNecessario(id, { forcar: forcarCentralizar });
  }

  // toque curto = foca (pais/filhos + bandeja); segurar = manda a peça pro
  // canvas, como escolher um card na gaveta.
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
      focar(id);
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
    overlay.classList.toggle('arvore-zoom-longe', vista.escala < LIMIAR_NOME);
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

    // clicar no vazio limpa o foco — mas não logo depois de arrastar
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

  // reenquadra a câmera pra mostrar tudo que já foi descoberto
  function verTudo() {
    if (posicoes.size === 0) return;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const { x, y } of posicoes.values()) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const margem = 100;
    const larguraMundo = Math.max(1, maxX - minX + margem * 2);
    const alturaMundo = Math.max(1, maxY - minY + margem * 2);
    const palco = overlay.querySelector('.arvore-palco');
    const rect = palco.getBoundingClientRect();
    const larguraPalco = rect.width || 1;
    const alturaPalco = rect.height || 1;
    const escala = Math.min(
      ZOOM_MAX,
      Math.max(ZOOM_MIN, Math.min(larguraPalco / larguraMundo, alturaPalco / alturaMundo)),
    );
    moverCameraPara((minX + maxX) / 2, (minY + maxY) / 2, escala);
  }

  // leva a câmera até o centro de massa de uma região (era ou "ia")
  function irParaEra(era) {
    let sx = 0; let sy = 0; let n = 0;
    for (const pos of posicoes.values()) {
      if (pos.era === era) { sx += pos.x; sy += pos.y; n += 1; }
    }
    if (n === 0) return;
    moverCameraPara(sx / n, sy / n, Math.max(vista.escala, ESCALA_PADRAO));
  }

  function buscar(termoBruto) {
    const termo = slug(termoBruto || '');
    if (!termo) return;
    const descobertos = store.getSave().descobertos;
    const candidatos = Object.keys(descobertos)
      .filter((id) => catalogo.getItem(id))
      .sort((a, b) => (descobertos[a].em ?? 0) - (descobertos[b].em ?? 0));
    const encontrado = candidatos.find((id) => slug(catalogo.getItem(id).nome).includes(termo));
    if (encontrado) focar(encontrado, { forcarCentralizar: true });
  }

  function desenharAtalhos(regioes) {
    const cont = overlay.querySelector('.arvore-atalhos');
    cont.innerHTML = '';
    for (const { era } of regioes) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'arvore-atalho';
      btn.dataset.era = era;
      const rotulo = era === 'ia' ? T.arvoreIAFaixa : `${T.erasIcone[era] || ''} ${T.eras[era] || era}`;
      btn.innerHTML = era === 'ia' ? '✨' : (T.erasIcone[era] || '✨');
      btn.title = rotulo;
      btn.setAttribute('aria-label', rotulo);
      btn.addEventListener('click', () => irParaEra(era));
      cont.appendChild(btn);
    }
  }

  function desenhar() {
    const descobertos = store.getSave().descobertos;
    const { posicoes: novasPosicoes, regioes } = calcularLayout(descobertos, catalogo);
    posicoes.clear();
    for (const [id, pos] of novasPosicoes) posicoes.set(id, pos);

    // fundo: regiões concêntricas — a mais externa primeiro (fica embaixo),
    // a mais interna por último (fica em cima), formando os "cinturões"
    const elRegioes = overlay.querySelector('.arvore-regioes');
    elRegioes.innerHTML = '';
    for (const { era, raioMax } of [...regioes].reverse()) {
      const div = document.createElement('div');
      div.className = 'arvore-regiao';
      div.dataset.era = era;
      const diametro = raioMax * 2;
      div.style.width = `${diametro}px`;
      div.style.height = `${diametro}px`;
      div.style.left = `${CENTRO - raioMax}px`;
      div.style.top = `${CENTRO - raioMax}px`;
      elRegioes.appendChild(div);
    }
    desenharAtalhos(regioes);

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
      if (!alvo) continue;
      for (const pai of paisDescobertos(id, descobertos)) {
        const origem = posicoes.get(pai);
        if (!origem) continue;
        const dx = alvo.x - origem.x;
        const dy = alvo.y - origem.y;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;
        const linha = document.createElementNS(SVGNS, 'line');
        linha.setAttribute('x1', String(origem.x + ux * RAIO_ORBE));
        linha.setAttribute('y1', String(origem.y + uy * RAIO_ORBE));
        linha.setAttribute('x2', String(alvo.x - ux * RAIO_ORBE));
        linha.setAttribute('y2', String(alvo.y - uy * RAIO_ORBE));
        linha.setAttribute('class', 'arvore-aresta');
        svg.appendChild(linha);
        arestas.set(`${pai}>${id}`, linha);
      }
    }

    for (const id of Object.keys(descobertos)) {
      const meta = descobertos[id];
      const item = catalogo.getItem(id);
      const pos = posicoes.get(id);
      if (!pos) continue; // item some do catálogo entre versões: não quebra o universo
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'arvore-no';
      el.dataset.id = id;
      el.dataset.era = pos.era;
      el.dataset.fonte = meta.fonte;
      el.style.left = `${pos.x - NO_TAM / 2}px`;
      el.style.top = `${pos.y - NO_TAM / 2}px`;
      el.setAttribute('aria-label', item ? item.nome : id);
      const fonte = meta.fonte === 'ia' ? ' data-fonte="ia"' : '';
      const alem = ehAlemDoMapaVisivel(catalogo, store, id);
      const raridade = catalogo.getRaridade(id);
      if (raridade === 'lendario' || alem) el.classList.add('arvore-no-grande');
      el.innerHTML =
        `<span class="orbe orbe-arvore" data-era="${pos.era}"${fonte}${atributosOrbeAlemDoMapa(alem, T)}>${icone(item)}</span>` +
        `<span class="arvore-no-nome" aria-hidden="true">${item ? item.nome : id}</span>`;
      ligarToqueNo(el, id);
      nos.appendChild(el);
      elos.set(id, el);
    }

    if (selecionado && elos.has(selecionado)) realcar(selecionado);
  }

  function centrarNoNucleo() {
    const palco = overlay.querySelector('.arvore-palco');
    const rect = palco.getBoundingClientRect();
    vista.escala = ESCALA_PADRAO;
    vista.x = rect.width / 2 - CENTRO * vista.escala;
    vista.y = rect.height / 2 - CENTRO * vista.escala;
    aplicarVista();
  }

  function abrir() {
    if (overlay) {
      desenhar();
      centrarNoNucleo();
      return;
    }
    overlay = document.createElement('div');
    overlay.className = 'arvore-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', T.arvoreTitulo);
    overlay.innerHTML = `
      <div class="arvore-cabecalho">
        <div class="arvore-cabecalho-estrelas" aria-hidden="true"></div>
        <div class="arvore-cabecalho-topo">
          <img class="arvore-cabecalho-logo" src="assets/cartas/logo-header.png" alt="" aria-hidden="true" />
          <div class="arvore-cabecalho-titulo">
            <h2 class="arvore-titulo">${T.arvoreTitulo}</h2>
            <p class="arvore-subtitulo">${T.arvoreSubtitulo}</p>
          </div>
          <button type="button" class="arvore-fechar">${T.fechar}</button>
        </div>
        <div class="arvore-ferramentas">
          <div class="arvore-busca-caixa">
            <span class="arvore-busca-icone" aria-hidden="true">🔭</span>
            <input class="arvore-busca" type="search" placeholder="${T.buscar}" aria-label="${T.buscar}" />
          </div>
          <button type="button" class="arvore-ver-tudo"><span class="arvore-ver-tudo-icone" aria-hidden="true">✨</span><span class="arvore-ver-tudo-texto">${T.arvoreVerTudo}</span></button>
          <div class="arvore-atalhos-scroll"><div class="arvore-atalhos"></div></div>
        </div>
      </div>
      <div class="arvore-palco">
        <div class="arvore-mundo">
          <div class="arvore-regioes"></div>
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
      <div class="arvore-bandeja">
        <div class="arvore-bandeja-estrelas" aria-hidden="true"></div>
        <img class="arvore-bandeja-mascote" src="assets/cartas/mascote-feliz.png" alt="" aria-hidden="true" />
        <p class="arvore-bandeja-dica">${T.arvoreDica}</p>
        <div class="arvore-bandeja-conteudo" hidden></div>
      </div>`;

    overlay.querySelector('.arvore-fechar').addEventListener('click', fechar);
    overlay.querySelector('.arvore-ver-tudo').addEventListener('click', verTudo);
    overlay.querySelector('.arvore-busca').addEventListener('input', (ev) => buscar(ev.target.value));
    document.addEventListener('keydown', aoTeclar);
    (raiz || document.body).appendChild(overlay);

    ligarGestos();
    desenhar();
    centrarNoNucleo();
  }

  return { abrir, fechar, destruir: fechar };
}
