// Álbum de figurinhas V2 — entra pela capa aprovada e abre num livro físico
// (base-*.png: moldura azul/dourada + lombada + tabs) com os overlays temáticos
// canônicos de assets/album/v2/ por cima. Nunca redesenhar essas artes em
// SVG/CSS: aqui só compomos camadas (base -> grade de figurinhas -> overlay) e
// cuidamos de paginação, navegação e responsividade.
//
// Composição (ver docs/ALBUM_V2_IMPLEMENTATION_SPEC.md):
//  - Desktop: dupla página real. Esquerda = abertura artística fixa da era
//    (já embutida no overlay). Direita = uma grade 3x3 (nove itens) que troca
//    a cada página, mantendo a esquerda intacta.
//  - Mobile: primeira tela = abertura (sem grade). Telas seguintes = folha
//    temática + grade 3x3.
// Tocar numa figurinha descoberta abre a carta completa já existente (carta.js)
// — o Álbum nunca duplica essa lógica nem amplia a miniatura.
import { ERAS } from '../engine/catalogo.js';
import { montarCartaOverlay, calcularDadosCarta, criarFigurinhaCompacta } from './carta.js';

const ASSETS = 'assets/album/';
const V2 = 'assets/album/v2/';

// Grade 3x3, capacidade fixa de nove itens por tela.
const CAPACIDADE = 9;

// Gap da grade em % da própria caixa da grade — único por variante responsiva,
// nunca por era (spec §1 "Grade comum").
const GRID_GAP_PCT = 2;

// FONTE DE VERDADE GLOBAL da geometria da grade (spec §1). Percentuais
// relativos ao canvas inteiro do asset (3344x1882 no desktop, 2048x3072 no
// mobile). Se a validação física exigir ajuste, ajustar este bloco inteiro —
// jamais criar áreas seguras diferentes por coleção.
const AREA_GRADE = {
  desktop: {
    left: 60, right: 13, top: 18, bottom: 18,
  },
  mobile: {
    left: 20, right: 20, top: 22, bottom: 25,
  },
};

const PROPORCAO = { desktop: 3344 / 1882, mobile: 2048 / 3072 };

// Tabs físicas do livro, já desenhadas na base-*.png: seis retângulos na borda
// direita, um por era na ordem de ERAS (de cima para baixo). Aqui só definimos
// as áreas clicáveis/acessíveis sobre o bitmap — a arte da tab não é
// redesenhada. Percentuais do canvas; ajustar em conjunto se a base mudar.
const TABS = {
  desktop: {
    left: 92, largura: 8, top: 12, alturaItem: 10.5, gap: 1.6,
  },
  mobile: {
    left: 89.5, largura: 10.5, top: 17.5, alturaItem: 8.6, gap: 1.2,
  },
};

const LARGURA_DESKTOP = 860; // abaixo disso: livro em página única (mobile)

function overlayAsset(colecao, variante) {
  // variante: 'desktop-overlay-3344x1882' | 'mobile-abertura-2048x3072' | 'mobile-folha-2048x3072'
  return `${V2}${colecao}-${variante}.png`;
}

export function montarAlbum({
  raiz, store, catalogo, T,
}) {
  let overlay = null;
  let modo = 'capa'; // 'capa' | 'aberto'
  let colecaoIdx = 0;
  let tela = 0; // índice da tela dentro da coleção atual
  const carta = montarCartaOverlay({
    raiz, store, catalogo, T,
  });
  const matchDesktop = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(`(min-width: ${LARGURA_DESKTOP}px)`)
    : {
      matches: true, addEventListener() {}, removeEventListener() {},
    };

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
    if (modo === 'aberto') { tela = 0; renderizarMiolo(); }
  }

  // Só as criações da IA já descobertas — nunca espaços ocultos para criações
  // futuras (a coleção não tem tamanho conhecido de antemão).
  function itensIADescobertos() {
    const descobertos = store.getSave().descobertos;
    return catalogo.allItems()
      .filter((it) => it.ia && descobertos[it.id])
      .sort((a, b) => (descobertos[a.id]?.em ?? 0) - (descobertos[b.id]?.em ?? 0));
  }

  // Lista canônica completa e ordenada da era: posição estável mesmo para
  // itens ainda não descobertos (spec §1).
  function itensDaEra(era) {
    return catalogo.allItems()
      .filter((it) => it.era === era && !it.ia)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  // Ordem determinística das coleções: as 6 eras canônicas + IA por último,
  // e a IA só quando já existe alguma criação descoberta.
  function colecoesDisponiveis() {
    const lista = [...ERAS];
    if (itensIADescobertos().length > 0) lista.push('ia');
    return lista;
  }

  function itensDaColecao(colecao) {
    return colecao === 'ia' ? itensIADescobertos() : itensDaEra(colecao);
  }

  // Páginas de grade da coleção (spec §1): max(1, ceil(total / 9)).
  function paginasDeGrade(colecao) {
    return Math.max(1, Math.ceil(itensDaColecao(colecao).length / CAPACIDADE));
  }

  // Total de telas. Desktop: uma tela por página de grade (a esquerda é fixa).
  // Mobile: 1 (abertura) + páginas de grade.
  function totalTelas(colecao) {
    const grades = paginasDeGrade(colecao);
    return matchDesktop.matches ? grades : 1 + grades;
  }

  function proximaTela() {
    const colecoes = colecoesDisponiveis();
    const colecao = colecoes[colecaoIdx];
    if (tela + 1 < totalTelas(colecao)) {
      tela += 1;
    } else if (colecaoIdx + 1 < colecoes.length) {
      colecaoIdx += 1;
      tela = 0;
    } else {
      return;
    }
    renderizarMiolo();
  }

  function telaAnterior() {
    if (tela > 0) {
      tela -= 1;
    } else if (colecaoIdx > 0) {
      colecaoIdx -= 1;
      tela = totalTelas(colecoesDisponiveis()[colecaoIdx]) - 1;
    } else {
      return;
    }
    renderizarMiolo();
  }

  function irParaColecao(idx) {
    colecaoIdx = idx;
    tela = 0;
    renderizarMiolo();
  }

  // Slot vertical tracejado (3:4) de um item canônico ainda não descoberto.
  // Sem spoiler: nenhum id/nome/imagem/raridade no DOM (spec §4).
  function slotVazio() {
    const div = document.createElement('div');
    div.className = 'album-slot-vazio';
    div.setAttribute('aria-hidden', 'true');
    div.innerHTML = '<span class="album-slot-vazio-marca">?</span>';
    return div;
  }

  function montarFigurinha(id) {
    const dados = calcularDadosCarta(id, { store, catalogo });
    if (!dados) return slotVazio();
    const el = criarFigurinhaCompacta(dados, { T });
    el.addEventListener('click', () => carta.abrir(id));
    return el;
  }

  // Preenche uma grade 3x3 com o bloco determinístico [inicio, inicio+9) da
  // lista da coleção. Canônico não descoberto -> slot tracejado na posição
  // estável. IA -> só descobertos, sem células futuras.
  function montarGrade(itens, paginaGrade, colecao) {
    const descobertos = store.getSave().descobertos;
    const inicio = paginaGrade * CAPACIDADE;
    const grade = document.createElement('div');
    grade.className = 'album-grade';
    for (let i = 0; i < CAPACIDADE; i += 1) {
      const item = itens[inicio + i];
      if (!item) {
        if (colecao === 'ia') break; // IA nunca ganha slot futuro
        grade.appendChild(slotVazio());
      } else if (colecao === 'ia' || descobertos[item.id]) {
        grade.appendChild(montarFigurinha(item.id));
      } else {
        grade.appendChild(slotVazio());
      }
    }
    return grade;
  }

  // Pré-carrega (sem bloquear) o overlay da próxima coleção em tempo ocioso.
  function prefetchProximaColecao(colecoes) {
    if (typeof Image === 'undefined') return;
    const proxima = colecoes[colecaoIdx + 1];
    if (!proxima) return;
    const variante = matchDesktop.matches ? 'desktop-overlay-3344x1882' : 'mobile-folha-2048x3072';
    const agendar = typeof window !== 'undefined' && window.requestIdleCallback
      ? window.requestIdleCallback
      : (fn) => setTimeout(fn, 300);
    agendar(() => { new Image().src = overlayAsset(proxima, variante); });
  }

  // Tabs físicas do livro como navegação acessível (spec §5). Uma área por era
  // na ordem de ERAS; a IA, quando existe, ganha um botão próprio logo abaixo,
  // nunca uma 7ª tab física.
  function renderizarTabs(colecoes, colecao) {
    const cont = overlay.querySelector('.album-tabs');
    cont.innerHTML = '';
    const geo = matchDesktop.matches ? TABS.desktop : TABS.mobile;
    ERAS.forEach((era, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'album-tab';
      btn.dataset.era = era;
      const rotulo = T.eras[era] || era;
      btn.title = rotulo;
      btn.setAttribute('aria-label', rotulo);
      btn.style.left = `${geo.left}%`;
      btn.style.width = `${geo.largura}%`;
      btn.style.top = `${geo.top + i * (geo.alturaItem + geo.gap)}%`;
      btn.style.height = `${geo.alturaItem}%`;
      if (era === colecao) btn.setAttribute('aria-current', 'true');
      btn.addEventListener('click', () => irParaColecao(i));
      cont.appendChild(btn);
    });
    if (colecoes.includes('ia')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'album-tab album-tab-ia';
      btn.dataset.era = 'ia';
      btn.textContent = '✨';
      btn.title = T.albumIATitulo;
      btn.setAttribute('aria-label', T.albumIATitulo);
      btn.style.left = `${geo.left}%`;
      btn.style.width = `${geo.largura}%`;
      btn.style.top = `${geo.top + ERAS.length * (geo.alturaItem + geo.gap)}%`;
      btn.style.height = `${geo.alturaItem}%`;
      if (colecao === 'ia') btn.setAttribute('aria-current', 'true');
      btn.addEventListener('click', () => irParaColecao(colecoes.indexOf('ia')));
      cont.appendChild(btn);
    }
  }

  function renderizarMiolo() {
    const descobertos = store.getSave().descobertos;
    const colecoes = colecoesDisponiveis();
    if (colecaoIdx >= colecoes.length) colecaoIdx = colecoes.length - 1;
    const colecao = colecoes[colecaoIdx];
    const itens = itensDaColecao(colecao);
    const desktop = matchDesktop.matches;
    const telas = totalTelas(colecao);
    if (tela >= telas) tela = telas - 1;

    // Mapa tela -> página de grade. Desktop: 1:1. Mobile: tela 0 = abertura.
    const ehAbertura = !desktop && tela === 0;
    const paginaGrade = desktop ? tela : tela - 1;

    const feitos = itens.filter((it) => descobertos[it.id]).length;
    const completa = colecao !== 'ia' && itens.length > 0 && feitos === itens.length;

    let overlaySrc;
    if (desktop) overlaySrc = overlayAsset(colecao, 'desktop-overlay-3344x1882');
    else if (ehAbertura) overlaySrc = overlayAsset(colecao, 'mobile-abertura-2048x3072');
    else overlaySrc = overlayAsset(colecao, 'mobile-folha-2048x3072');

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
      <div class="album-colecao-info">
        <span class="album-colecao-nome">${colecao === 'ia' ? T.albumIATitulo : (T.eras[colecao] || colecao)}</span>
        <span class="album-colecao-contagem">${colecao === 'ia' ? T.albumIAContagem(itens.length) : `${feitos} / ${itens.length}`}</span>
        ${completa ? `<span class="album-selo">${T.albumSeloCompleto}</span>` : ''}
      </div>
      <div class="album-miolo" data-modo="${desktop ? 'desktop' : 'mobile'}">
        <button type="button" class="album-nav album-nav-anterior" aria-label="${T.albumAnterior}">‹</button>
        <div class="album-pagina-area" data-era="${colecao}">
          <div class="album-pagina-moldura">
            <img class="album-pagina-base" alt="" aria-hidden="true" />
            <div class="album-tabs"></div>
            ${desktop || !ehAbertura ? '<div class="album-grade-area"></div>' : ''}
            <img class="album-pagina-overlay" alt="" aria-hidden="true" />
          </div>
        </div>
        <button type="button" class="album-nav album-nav-proxima" aria-label="${T.albumProxima}">›</button>
      </div>
      <div class="album-rodape">${T.albumPaginaDe(tela + 1, telas)}</div>`;

    const totalCanonico = catalogo.allItems().filter((it) => !it.ia).length;
    const feitosCanonico = Object.keys(descobertos)
      .filter((id) => catalogo.getItem(id) && !catalogo.getItem(id).ia).length;
    const iaTotal = itensIADescobertos().length;
    overlay.querySelector('.album-cabecalho-contagem').textContent =
      T.albumContagemGeral(feitosCanonico, totalCanonico, iaTotal);

    const base = overlay.querySelector('.album-pagina-base');
    const overlayArt = overlay.querySelector('.album-pagina-overlay');
    base.src = `${ASSETS}base-${desktop ? 'desktop' : 'mobile'}.png`;
    overlayArt.src = overlaySrc;

    renderizarTabs(colecoes, colecao);

    const gradeArea = overlay.querySelector('.album-grade-area');
    if (gradeArea) {
      const geo = AREA_GRADE[desktop ? 'desktop' : 'mobile'];
      gradeArea.style.left = `${geo.left}%`;
      gradeArea.style.right = `${geo.right}%`;
      gradeArea.style.top = `${geo.top}%`;
      gradeArea.style.bottom = `${geo.bottom}%`;
      gradeArea.style.setProperty('--album-grid-gap', `${GRID_GAP_PCT}%`);
      gradeArea.appendChild(montarGrade(itens, paginaGrade, colecao));
    }

    overlay.querySelector('.album-fechar').addEventListener('click', fechar);
    overlay.querySelector('.album-nav-anterior').addEventListener('click', telaAnterior);
    overlay.querySelector('.album-nav-proxima').addEventListener('click', proximaTela);

    ajustarMoldura();
    prefetchProximaColecao(colecoes);
  }

  // A moldura (base + overlay + grade) precisa ter exatamente a proporção da
  // arte (3344x1882 no desktop, 2048x3072 no mobile). Calculamos aqui o maior
  // retângulo com essa proporção que cabe na área — mesmo resultado de
  // "object-fit: contain", mas aplicado à caixa inteira, para que a grade
  // (posicionada em % dessa caixa) fique sempre alinhada à arte visível.
  function ajustarMoldura() {
    if (!overlay) return;
    const area = overlay.querySelector('.album-pagina-area');
    const moldura = overlay.querySelector('.album-pagina-moldura');
    if (!area || !moldura) return;
    const proporcao = matchDesktop.matches ? PROPORCAO.desktop : PROPORCAO.mobile;
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
      tela = 0;
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
