// Álbum de figurinhas: entra pela capa aprovada, abre num miolo com páginas
// temáticas por era (assets canônicos em assets/album/ — nunca redesenhados
// nem recriados em SVG/CSS). Cada página mostra as figurinhas já descobertas
// daquela era; os slots não descobertos ficam vazios/ocultos, sem spoiler.
// Tocar numa figurinha descoberta abre a carta completa já existente no jogo
// (ver carta.js) — o Álbum nunca duplica essa lógica nem amplia a miniatura.
import { ERAS } from '../engine/catalogo.js';
import { montarCartaOverlay, calcularDadosCarta, criarFigurinhaCompacta } from './carta.js';

const ASSETS = 'assets/album/';

// Densidade "piloto": centralizada aqui de propósito, pra ajustar sem tocar
// na lógica de paginação (ver assets/album/README.md — validar no jogo real
// antes de considerar definitiva).
const DENSIDADE = {
  desktop: { colunas: 7, linhas: 4 },
  mobile: { colunas: 4, linhas: 5 },
};

// Área do miolo livre de decoração/título do overlay temático, em % da
// imagem inteira. Desktop é uma dupla página só (spine no meio: metade
// esquerda/direita); mobile é uma página única. Piloto visual — mesma nota
// do README: ajustar caso as artes aprovadas mudem ou a leitura piore.
const AREA_SEGURA = {
  desktop: {
    top: 29, bottom: 82, esquerda: [12, 45], direita: [55, 89],
  },
  mobile: { top: 24, bottom: 58, esquerda: 14, direita: 87 },
};

const LARGURA_DESKTOP = 860; // abaixo disso: miolo em página única (mobile)

function eraAsset(colecao, variante) {
  return `${ASSETS}${colecao}-${variante}.png`;
}

export function montarAlbum({
  raiz, store, catalogo, T,
}) {
  let overlay = null;
  let modo = 'capa'; // 'capa' | 'aberto'
  let colecaoIdx = 0;
  let pagina = 0; // índice da "tela" (spread no desktop, página única no mobile)
  const carta = montarCartaOverlay({
    raiz, store, catalogo, T,
  });
  const matchDesktop = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(`(min-width: ${LARGURA_DESKTOP}px)`)
    : { matches: true, addEventListener() {}, removeEventListener() {} };

  function fechar() {
    carta.fechar();
    if (!overlay) return;
    document.removeEventListener('keydown', aoTeclar);
    matchDesktop.removeEventListener?.('change', aoMudarBreakpoint);
    window.removeEventListener?.('resize', ajustarMoldura);
    overlay.remove();
    overlay = null;
    modo = 'capa';
  }

  function aoTeclar(ev) {
    if (ev.key === 'Escape') fechar();
  }

  function aoMudarBreakpoint() {
    if (modo === 'aberto') { pagina = 0; renderizarMiolo(); }
  }

  // Só as criações da IA já descobertas — nunca espaços ocultos "???" pra
  // possíveis criações futuras (a coleção não tem tamanho conhecido de antemão).
  function itensIADescobertos() {
    const descobertos = store.getSave().descobertos;
    return catalogo.allItems()
      .filter((it) => it.ia && descobertos[it.id])
      .sort((a, b) => (descobertos[a.id]?.em ?? 0) - (descobertos[b.id]?.em ?? 0));
  }

  function itensDaEra(era) {
    return catalogo.allItems()
      .filter((it) => it.era === era && !it.ia)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  // Ordem determinística das coleções: as 6 eras canônicas + IA por último,
  // só quando já existe alguma criação descoberta.
  function colecoesDisponiveis() {
    const lista = [...ERAS];
    if (itensIADescobertos().length > 0) lista.push('ia');
    return lista;
  }

  function itensDaColecao(colecao) {
    return colecao === 'ia' ? itensIADescobertos() : itensDaEra(colecao);
  }

  function capacidadePorPagina() {
    const d = matchDesktop.matches ? DENSIDADE.desktop : DENSIDADE.mobile;
    return d.colunas * d.linhas;
  }

  function totalPaginasFisicas(colecao) {
    return Math.max(1, Math.ceil(itensDaColecao(colecao).length / capacidadePorPagina()));
  }

  function totalTelas(colecao) {
    const paginasFisicas = totalPaginasFisicas(colecao);
    return matchDesktop.matches ? Math.ceil(paginasFisicas / 2) : paginasFisicas;
  }

  function proximaTela() {
    const colecoes = colecoesDisponiveis();
    const colecao = colecoes[colecaoIdx];
    if (pagina + 1 < totalTelas(colecao)) {
      pagina += 1;
    } else if (colecaoIdx + 1 < colecoes.length) {
      colecaoIdx += 1;
      pagina = 0;
    } else {
      return; // já é a última página da última coleção
    }
    renderizarMiolo();
  }

  function telaAnterior() {
    if (pagina > 0) {
      pagina -= 1;
    } else if (colecaoIdx > 0) {
      colecaoIdx -= 1;
      pagina = totalTelas(colecoesDisponiveis()[colecaoIdx]) - 1;
    } else {
      return; // já é a primeira página da primeira coleção
    }
    renderizarMiolo();
  }

  function irParaColecao(idx) {
    colecaoIdx = idx;
    pagina = 0;
    renderizarMiolo();
  }

  function celulaVazia() {
    const div = document.createElement('div');
    div.className = 'figurinha-vazia';
    div.setAttribute('aria-hidden', 'true');
    div.innerHTML = '<span class="figurinha-vazia-marca">?</span>';
    return div;
  }

  function montarFigurinha(id) {
    const dados = calcularDadosCarta(id, { store, catalogo });
    if (!dados) return celulaVazia();
    const el = criarFigurinhaCompacta(dados, { T });
    el.addEventListener('click', () => carta.abrir(id));
    return el;
  }

  // Preenche uma página física (grade fixa colunas×linhas) com as figurinhas
  // (ou espaços vazios) dos itens no intervalo [inicio, inicio+capacidade).
  function montarGradePagina(itens, paginaFisica) {
    const capacidade = capacidadePorPagina();
    const inicio = paginaFisica * capacidade;
    const fatia = itens.slice(inicio, inicio + capacidade);
    const grade = document.createElement('div');
    grade.className = 'album-slots';
    const d = matchDesktop.matches ? DENSIDADE.desktop : DENSIDADE.mobile;
    // minmax(0, 1fr): sem isso, o tamanho mínimo de conteúdo (auto) da
    // figurinha pode forçar a trilha a crescer além da área segura da
    // página, empurrando slots pra fora da grade e quebrando os cliques.
    grade.style.gridTemplateColumns = `repeat(${d.colunas}, minmax(0, 1fr))`;
    grade.style.gridTemplateRows = `repeat(${d.linhas}, minmax(0, 1fr))`;
    for (const item of fatia) grade.appendChild(montarFigurinha(item.id));
    return grade;
  }

  // pré-carrega (sem bloquear) a arte da próxima coleção em tempo ocioso —
  // puramente opcional, nunca atrasa a página atual.
  function prefetchProximaColecao(colecoes) {
    if (typeof Image === 'undefined') return; // sem DOM de imagem real (ex.: testes)
    const proxima = colecoes[colecaoIdx + 1];
    if (!proxima) return;
    const variante = matchDesktop.matches ? 'desktop' : 'mobile';
    const agendar = typeof window !== 'undefined' && window.requestIdleCallback
      ? window.requestIdleCallback
      : (fn) => setTimeout(fn, 300);
    agendar(() => {
      new Image().src = eraAsset(proxima, variante);
    });
  }

  function renderizarAtalhos(colecoes, colecao) {
    const cont = overlay.querySelector('.album-atalhos');
    cont.innerHTML = '';
    colecoes.forEach((c, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'album-atalho';
      btn.dataset.era = c;
      btn.innerHTML = c === 'ia' ? '✨' : (T.erasIcone[c] || '✨');
      const rotulo = c === 'ia' ? T.albumIATitulo : (T.eras[c] || c);
      btn.title = rotulo;
      btn.setAttribute('aria-label', rotulo);
      if (c === colecao) btn.setAttribute('aria-current', 'true');
      btn.addEventListener('click', () => irParaColecao(idx));
      cont.appendChild(btn);
    });
  }

  function renderizarMiolo() {
    const descobertos = store.getSave().descobertos;
    const colecoes = colecoesDisponiveis();
    if (colecaoIdx >= colecoes.length) colecaoIdx = colecoes.length - 1;
    const colecao = colecoes[colecaoIdx];
    const itens = itensDaColecao(colecao);
    const desktop = matchDesktop.matches;
    const variante = desktop ? 'desktop' : 'mobile';
    const paginasFisicas = totalPaginasFisicas(colecao);
    const telas = totalTelas(colecao);
    if (pagina >= telas) pagina = telas - 1;

    const paginaEsquerda = desktop ? pagina * 2 : pagina;
    const paginaDireita = desktop ? pagina * 2 + 1 : null;
    const temPaginaDireita = paginaDireita !== null && paginaDireita < paginasFisicas;

    const feitos = itens.filter((it) => descobertos[it.id]).length;
    const completa = colecao !== 'ia' && itens.length > 0 && feitos === itens.length;

    overlay.innerHTML = `
      <div class="album-cabecalho">
        <div class="album-cabecalho-estrelas" aria-hidden="true"></div>
        <img class="album-cabecalho-logo" src="assets/cartas/logo-header.png" alt="" aria-hidden="true" />
        <div class="album-cabecalho-titulo">
          <h2>${T.albumTitulo}</h2>
          <span class="album-cabecalho-contagem"></span>
        </div>
        <button type="button" class="album-fechar">${T.fechar}</button>
      </div>
      <div class="album-atalhos"></div>
      <div class="album-colecao-info">
        <span class="album-colecao-contagem">${colecao === 'ia' ? T.albumIAContagem(itens.length) : `${feitos} / ${itens.length}`}</span>
        ${completa ? `<span class="album-selo">${T.albumSeloCompleto}</span>` : ''}
      </div>
      <div class="album-miolo" data-modo="${variante}">
        <button type="button" class="album-nav album-nav-anterior" aria-label="${T.albumAnterior}">‹</button>
        <div class="album-pagina-area">
          <div class="album-pagina-moldura">
            <img class="album-pagina-base" alt="" aria-hidden="true" />
            <img class="album-pagina-overlay" alt="" aria-hidden="true" />
            <div class="album-pagina-slots album-pagina-slots-esquerda"></div>
            ${desktop ? '<div class="album-pagina-slots album-pagina-slots-direita"></div>' : ''}
          </div>
        </div>
        <button type="button" class="album-nav album-nav-proxima" aria-label="${T.albumProxima}">›</button>
      </div>
      <div class="album-rodape">${T.albumPaginaDe(pagina + 1, telas)}</div>`;

    const totalCanonico = catalogo.allItems().filter((it) => !it.ia).length;
    const feitosCanonico = Object.keys(descobertos)
      .filter((id) => catalogo.getItem(id) && !catalogo.getItem(id).ia).length;
    const iaTotal = itensIADescobertos().length;
    overlay.querySelector('.album-cabecalho-contagem').textContent =
      T.albumContagemGeral(feitosCanonico, totalCanonico, iaTotal);

    renderizarAtalhos(colecoes, colecao);

    const base = overlay.querySelector('.album-pagina-base');
    const overlayArt = overlay.querySelector('.album-pagina-overlay');
    base.src = eraAsset('base', variante);
    overlayArt.src = eraAsset(colecao, variante);

    const area = overlay.querySelector('.album-pagina-area');
    area.dataset.era = colecao;

    const slotsEsquerda = overlay.querySelector('.album-pagina-slots-esquerda');
    slotsEsquerda.appendChild(montarGradePagina(itens, paginaEsquerda));

    if (desktop) {
      const slotsDireita = overlay.querySelector('.album-pagina-slots-direita');
      if (temPaginaDireita) {
        slotsDireita.appendChild(montarGradePagina(itens, paginaDireita));
      } else {
        const fim = document.createElement('p');
        fim.className = 'album-fim-colecao';
        fim.textContent = T.albumFimDaColecao;
        slotsDireita.appendChild(fim);
      }
    }

    overlay.querySelector('.album-fechar').addEventListener('click', fechar);
    overlay.querySelector('.album-nav-anterior').addEventListener('click', telaAnterior);
    overlay.querySelector('.album-nav-proxima').addEventListener('click', proximaTela);

    ajustarMoldura();
    prefetchProximaColecao(colecoes);
  }

  // A moldura (base + overlay + slots) precisa ter exatamente a proporção
  // da arte (3344×1882 no desktop, 2048×3072 no mobile) — do contrário,
  // "object-fit: contain" faz a imagem aparecer com barras dentro de uma
  // caixa maior, e os slots (posicionados em % da caixa) saem alinhados
  // com a caixa, não com a arte visível. Calculamos aqui, em JS, o maior
  // retângulo com essa proporção que cabe na área disponível — o mesmo
  // resultado de "contain", mas aplicado à caixa inteira (arte + slots).
  function ajustarMoldura() {
    if (!overlay) return;
    const area = overlay.querySelector('.album-pagina-area');
    const moldura = overlay.querySelector('.album-pagina-moldura');
    if (!area || !moldura) return;
    const desktop = matchDesktop.matches;
    const proporcao = desktop ? 3344 / 1882 : 2048 / 3072;
    const rect = area.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    let largura = rect.width;
    let altura = largura / proporcao;
    if (altura > rect.height) {
      altura = rect.height;
      largura = altura * proporcao;
    }
    moldura.style.width = `${largura}px`;
    moldura.style.height = `${altura}px`;
  }

  function renderizarCapa() {
    overlay.innerHTML = `
      <img class="album-capa-fundo" src="${ASSETS}fundo-cosmico.png" alt="" aria-hidden="true" />
      <button type="button" class="album-capa-fechar" aria-label="${T.fechar}">${T.fechar}</button>
      <button type="button" class="album-capa-botao">
        <img class="album-capa-imagem" src="${ASSETS}capa.png" alt="${T.albumTitulo}" />
        <span class="album-capa-dica">${T.albumTocarParaAbrir}</span>
      </button>`;
    overlay.querySelector('.album-capa-fechar').addEventListener('click', fechar);
    overlay.querySelector('.album-capa-botao').addEventListener('click', () => {
      modo = 'aberto';
      colecaoIdx = 0;
      pagina = 0;
      renderizarMiolo();
    });
  }

  function abrir() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'album-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', T.albumTitulo);
    document.addEventListener('keydown', aoTeclar);
    matchDesktop.addEventListener?.('change', aoMudarBreakpoint);
    window.addEventListener?.('resize', ajustarMoldura);
    (raiz || document.body).appendChild(overlay);
    modo = 'capa';
    renderizarCapa();
  }

  return { abrir, fechar };
}
