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
// mobile: 4×5 (20/página) foi testado nesta rodada e deixou os cartões
// baixos demais pra caber ícone + nome com folga (~35px de altura); caiu
// pro fallback documentado (README) de 4×4 — cartões ~45% mais altos.
const DENSIDADE = {
  desktop: { colunas: 7, linhas: 4 },
  mobile: { colunas: 4, linhas: 4 },
};

// Área do miolo livre de decoração/título do overlay temático, em % da
// imagem inteira. Desktop é uma dupla página só (spine no meio: metade
// esquerda/direita); mobile é uma página única. Piloto visual — mesma nota
// do README: ajustar caso as artes aprovadas mudem ou a leitura piore.
//
// Esta é a fonte real de verdade do posicionamento: os valores viram
// variáveis CSS (--as-*) aplicadas em .album-pagina-moldura a cada render
// (ver aplicarAreaSegura), e styles/album.css só lê essas variáveis — não
// existe mais nenhum percentual de posicionamento hardcoded em paralelo no
// CSS. Cada coleção pode ter um ajuste próprio (chave = era, ou "ia"); na
// ausência de um específico, usa-se "default" da variante.
const AREA_SEGURA = {
  desktop: {
    default: {
      top: 29, bottom: 18, esquerda: { left: 12, right: 55 }, direita: { left: 55, right: 11 },
    },
  },
  mobile: {
    default: {
      top: 22, bottom: 36, esquerda: { left: 14, right: 13 },
    },
  },
};

function areaSeguraPara(variante, colecao) {
  const porVariante = AREA_SEGURA[variante];
  return porVariante[colecao] || porVariante.default;
}

function aplicarAreaSegura(moldura, variante, colecao) {
  const area = areaSeguraPara(variante, colecao);
  moldura.style.setProperty('--as-top', `${area.top}%`);
  moldura.style.setProperty('--as-bottom', `${area.bottom}%`);
  moldura.style.setProperty('--as-esq-left', `${area.esquerda.left}%`);
  moldura.style.setProperty('--as-esq-right', `${area.esquerda.right}%`);
  if (area.direita) {
    moldura.style.setProperty('--as-dir-left', `${area.direita.left}%`);
    moldura.style.setProperty('--as-dir-right', `${area.direita.right}%`);
  }
}

// Faixa (% da imagem) onde ficam as 6 abas físicas do livro, na borda
// externa direita — fora da área das páginas. Mesmo valor pras duas
// variantes porque a ilustração usa a mesma proporção de moldura ali.
const ABAS_FISICAS = { left: 89, right: 99.5, top: 14, bottom: 84 };

const LARGURA_DESKTOP = 860; // abaixo disso: miolo em página única (mobile)

function eraAsset(colecao, variante) {
  return `${ASSETS}${colecao}-${variante}.png`;
}

// Distribui `itens` em páginas de tamanho o mais equilibrado possível (nunca
// excedendo `capacidade`), em vez de simplesmente fatiar sequencialmente —
// evita últimas páginas quase vazias (ex.: 32 itens / capacidade 20 vira
// 16+16, não 20+12). Ordem determinística de `itens` é preservada.
function paginasBalanceadas(itens, capacidade) {
  const total = itens.length;
  if (total === 0) return [[]];
  const numPaginas = Math.max(1, Math.ceil(total / capacidade));
  const base = Math.floor(total / numPaginas);
  const resto = total % numPaginas;
  const paginas = [];
  let indice = 0;
  for (let p = 0; p < numPaginas; p += 1) {
    const tamanho = base + (p < resto ? 1 : 0);
    paginas.push(itens.slice(indice, indice + tamanho));
    indice += tamanho;
  }
  return paginas;
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
    return paginasBalanceadas(itensDaColecao(colecao), capacidadePorPagina()).length;
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
  // (ou espaços vazios) da fatia balanceada correspondente (ver
  // paginasBalanceadas) — os itens já vêm pré-distribuídos por página.
  function montarGradePagina(paginas, paginaFisica) {
    const fatia = paginas[paginaFisica] || [];
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

  // Substitui a antiga fileira de ícones circulares (duplicava as abas já
  // desenhadas na própria arte do livro): agora só posicionamos áreas de
  // toque acessíveis por cima das 6 abas físicas (uma por era canônica),
  // na borda direita da página. A IA não tem aba física no livro — ganha um
  // botão-selo próprio, discreto, só quando já existe alguma criação.
  function renderizarAbas(colecoes, colecao) {
    const cont = overlay.querySelector('.album-abas');
    cont.innerHTML = '';
    const alturaBanda = (ABAS_FISICAS.bottom - ABAS_FISICAS.top) / ERAS.length;
    ERAS.forEach((era, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'album-aba';
      btn.dataset.era = era;
      const rotulo = T.eras[era] || era;
      btn.title = rotulo;
      btn.setAttribute('aria-label', rotulo);
      if (era === colecao) btn.setAttribute('aria-current', 'true');
      btn.style.setProperty('--aba-left', `${ABAS_FISICAS.left}%`);
      btn.style.setProperty('--aba-right', `${100 - ABAS_FISICAS.right}%`);
      btn.style.setProperty('--aba-top', `${ABAS_FISICAS.top + idx * alturaBanda}%`);
      btn.style.setProperty('--aba-bottom', `${100 - (ABAS_FISICAS.top + (idx + 1) * alturaBanda)}%`);
      btn.addEventListener('click', () => irParaColecao(colecoes.indexOf(era)));
      cont.appendChild(btn);
    });
    if (colecoes.includes('ia')) {
      const btnIA = document.createElement('button');
      btnIA.type = 'button';
      btnIA.className = 'album-aba album-aba-ia';
      btnIA.dataset.era = 'ia';
      btnIA.textContent = '✨';
      btnIA.title = T.albumIATitulo;
      btnIA.setAttribute('aria-label', T.albumIATitulo);
      if (colecao === 'ia') btnIA.setAttribute('aria-current', 'true');
      btnIA.addEventListener('click', () => irParaColecao(colecoes.indexOf('ia')));
      cont.appendChild(btnIA);
    }
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
        <button type="button" class="album-fechar" aria-label="${T.fechar}" title="${T.fechar}">✕</button>
      </div>
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
            <div class="album-abas"></div>
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

    renderizarAbas(colecoes, colecao);

    const base = overlay.querySelector('.album-pagina-base');
    const overlayArt = overlay.querySelector('.album-pagina-overlay');
    base.src = eraAsset('base', variante);
    overlayArt.src = eraAsset(colecao, variante);

    const area = overlay.querySelector('.album-pagina-area');
    area.dataset.era = colecao;

    const moldura = overlay.querySelector('.album-pagina-moldura');
    aplicarAreaSegura(moldura, variante, colecao);

    const paginas = paginasBalanceadas(itens, capacidadePorPagina());
    const slotsEsquerda = overlay.querySelector('.album-pagina-slots-esquerda');
    slotsEsquerda.appendChild(montarGradePagina(paginas, paginaEsquerda));

    if (desktop) {
      const slotsDireita = overlay.querySelector('.album-pagina-slots-direita');
      if (temPaginaDireita) {
        slotsDireita.appendChild(montarGradePagina(paginas, paginaDireita));
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
      <button type="button" class="album-capa-fechar" aria-label="${T.fechar}" title="${T.fechar}">✕</button>
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
