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
import { erasReveladas } from '../engine/eras.js';
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
// Mobile: a folha temática tem título/decoração no topo (chega a ~23% do
// canvas do PNG, ~31% já renderizado com o overlay em escala 0.70) e mato na
// base. Este bloco desloca a grade toda para baixo do título e reduz o 3x3
// proporcionalmente para a 3ª linha ficar acima da decoração inferior —
// nenhuma mini-figurinha sob título, folhas ou mato, em nenhuma era.
const AREA_GRADE = {
  desktop: {
    left: 60, right: 13, top: 18, bottom: 18,
  },
  mobile: {
    left: 27, right: 27, top: 31, bottom: 29,
  },
};

const PROPORCAO = { desktop: 3344 / 1882, mobile: 2048 / 3072 };

// ESCALA GLOBAL DO OVERLAY — o overlay temático nunca é recortado: renderizamos
// o canvas transparente inteiro (3344×1882 / 2048×3072, proporção original) e
// só o reduzimos uniformemente, centralizado, até TODOS os pixels visíveis
// caberem dentro da superfície interna do livro (sem tocar moldura, lombada,
// cantoneiras ou abas). Um único valor para desktop e outro para mobile —
// jamais por era; todos os assets usam exatamente a mesma transformação e os
// PNGs não são alterados.
// A arte dos PNGs vai de borda a borda do canvas (bbox opaco ~0–100%); com o
// papel a ~8,7/10,4/4,9/9,9% (desktop) e ~13,8/13,2/9,3/12,9% (mobile) do
// canvas, a maior escala que ainda deixa a arte inteira dentro do papel
// (escala centrada) é ~0,79 no desktop e ~0,72 no mobile. Margem: 0,78 / 0,70.
const ESCALA_OVERLAY = { desktop: 0.78, mobile: 0.70 };

// Tabs físicas do livro, já desenhadas na base-*.png: seis retângulos na borda
// direita, um por era na ordem de ERAS (de cima para baixo). Aqui só definimos
// as áreas clicáveis/acessíveis sobre o bitmap — a arte da tab não é
// redesenhada. Percentuais do canvas; ajustar em conjunto se a base mudar.
const TABS = {
  desktop: {
    left: 92, largura: 7.5, top: 12.5, alturaItem: 10.5, gap: 1.7,
  },
  mobile: {
    left: 89, largura: 9, top: 18, alturaItem: 7.5, gap: 2,
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
    // limpa o conteúdo visual antes de destruir o nó, para que nenhum resquício
    // (era selecionada, grade meio montada) possa reaparecer na próxima abertura.
    const conteudo = overlay.querySelector('.album-conteudo');
    if (conteudo) conteudo.innerHTML = '';
    overlay.remove();
    overlay = null;
    modo = 'capa';
    colecaoIdx = 0;
    tela = 0;
  }

  // decode() só existe em navegador real; em jsdom (testes) revelamos de forma
  // síncrona. Quando existe, seguramos o conteúdo escondido até a arte crítica
  // estar decodificada e revelamos atomicamente no próximo requestAnimationFrame.
  function podeDecodificar() {
    return typeof Image === 'function' && typeof Image.prototype.decode === 'function';
  }

  function decodificar(...srcs) {
    if (!podeDecodificar()) return Promise.resolve();
    return Promise.all(srcs.filter(Boolean).map((src) => {
      const img = new Image();
      img.src = src;
      return img.decode().catch(() => {});
    }));
  }

  function esconderConteudo() {
    if (!overlay || !podeDecodificar()) return;
    overlay.classList.add('album-carregando');
    const conteudo = overlay.querySelector('.album-conteudo');
    if (conteudo) conteudo.hidden = true;
    if (!overlay.querySelector('.album-loader')) {
      const loader = document.createElement('div');
      loader.className = 'album-loader';
      loader.setAttribute('role', 'status');
      loader.setAttribute('aria-live', 'polite');
      loader.textContent = T.albumCarregando;
      overlay.insertBefore(loader, conteudo);
    }
  }

  function revelarJa() {
    if (!overlay) return;
    overlay.classList.remove('album-carregando');
    overlay.querySelector('.album-loader')?.remove();
    const conteudo = overlay.querySelector('.album-conteudo');
    if (conteudo) conteudo.hidden = false;
    ajustarMoldura();
  }

  // Espera a decodificação das imagens críticas e revela o Álbum pronto num
  // único frame. Sem suporte a decode (testes): revela na hora.
  function aguardarErevelar(...srcs) {
    if (!podeDecodificar()) { revelarJa(); return; }
    // rede de segurança: se o rAF não disparar (ex.: aba em segundo plano) ou
    // o decode travar, revela mesmo assim. revelarJa é idempotente.
    const rede = setTimeout(revelarJa, 2000);
    decodificar(...srcs).then(() => {
      clearTimeout(rede);
      if (!overlay) return;
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(revelarJa);
      else revelarJa();
    });
  }

  function aoTeclar(ev) {
    if (ev.key === 'Escape') { fechar(); return; }
    if (modo !== 'aberto') return;
    if (ev.key === 'ArrowRight') { ev.preventDefault(); proximaTela(); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); telaAnterior(); }
  }

  // Swipe horizontal é navegação SECUNDÁRIA no mobile — o paginador continua
  // sendo o método principal e sempre disponível. Não arma quando o toque
  // começa sobre uma mini-figurinha, slot, tab, botão ou outro controle, para
  // não roubar o clique que abre a carta grande.
  function armarSwipe(area) {
    if (!area || matchDesktop.matches) return;
    const alvoInterativo = (el) => el
      && el.closest('.figurinha-mini, .album-slot-vazio, .album-tab, button, a, input, textarea, select, [role="button"]');
    let x0 = 0;
    let y0 = 0;
    let ativo = false;
    let armado = false;
    area.addEventListener('touchstart', (ev) => {
      const t = ev.touches && ev.touches[0];
      if (!t || alvoInterativo(ev.target)) { ativo = false; return; }
      ativo = true;
      armado = false;
      x0 = t.clientX;
      y0 = t.clientY;
    }, { passive: true });
    area.addEventListener('touchmove', (ev) => {
      if (!ativo) return;
      const t = ev.touches && ev.touches[0];
      if (!t) return;
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      // só considera swipe após deslocamento horizontal intencional; ignora
      // gestos predominantemente verticais (rolagem).
      if (!armado && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) armado = true;
      if (armado && ev.cancelable) ev.preventDefault();
    }, { passive: false });
    area.addEventListener('touchend', (ev) => {
      const estava = ativo && armado;
      ativo = false;
      armado = false;
      if (!estava) return;
      const t = ev.changedTouches && ev.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - x0;
      if (Math.abs(dx) < 40) return; // gesto curto: não vira página
      // no máximo uma página por gesto; proximaTela/telaAnterior já respeitam
      // os limites da coleção.
      if (dx < 0) proximaTela();
      else telaAnterior();
    });
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

  // Ordem determinística das coleções já reveladas: Elementos sempre; cada
  // outra era após a primeira descoberta canônica; IA por último após a
  // primeira criação descoberta.
  function colecoesDisponiveis() {
    return erasReveladas(store.getSave().descobertos, catalogo);
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

  // O paginador é sempre relativo à coleção ativa: nunca pula de era (isso é
  // papel das tabs). Nas pontas fica sem efeito — o botão correspondente é
  // renderizado desabilitado.
  function proximaTela() {
    const colecao = colecoesDisponiveis()[colecaoIdx];
    if (tela + 1 >= totalTelas(colecao)) return;
    tela += 1;
    renderizarMiolo();
  }

  function telaAnterior() {
    if (tela <= 0) return;
    tela -= 1;
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
    div.style.pointerEvents = 'none'; // não interativo: nunca intercepta clique
    div.innerHTML = '<span class="album-slot-vazio-marca">?</span>';
    return div;
  }

  function montarFigurinha(id) {
    const dados = calcularDadosCarta(id, { store, catalogo });
    if (!dados) return slotVazio();
    const el = criarFigurinhaCompacta(dados, { T });
    // clique simples -> abre imediatamente a carta grande já existente.
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
    // o container cobre a moldura só para posicionar os hitboxes em %; ele
    // nunca pode interceptar clique (senão engole os toques na grade).
    cont.style.pointerEvents = 'none';
    const geo = matchDesktop.matches ? TABS.desktop : TABS.mobile;
    const posicionar = (btn, topo) => {
      btn.style.pointerEvents = 'auto';
      btn.style.minWidth = '44px';
      btn.style.minHeight = '44px';
      btn.style.left = `${geo.left}%`;
      btn.style.width = `${geo.largura}%`;
      btn.style.top = `${topo}%`;
      btn.style.height = `${geo.alturaItem}%`;
    };
    colecoes.filter((item) => item !== 'ia').forEach((era) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'album-tab';
      btn.dataset.era = era;
      const rotulo = T.eras[era] || era;
      btn.title = rotulo;
      btn.setAttribute('aria-label', rotulo);
      // Mesmo com eras ocultas, cada hitbox continua sobre a posição física
      // original da sua tab no livro.
      const posicaoFisica = ERAS.indexOf(era);
      posicionar(btn, geo.top + posicaoFisica * (geo.alturaItem + geo.gap));
      if (era === colecao) btn.setAttribute('aria-current', 'true');
      btn.addEventListener('click', () => irParaColecao(colecoes.indexOf(era)));
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
      posicionar(btn, geo.top + ERAS.length * (geo.alturaItem + geo.gap));
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

    const alvo = overlay.querySelector('.album-conteudo');
    alvo.innerHTML = `
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
        <div class="album-pagina-area" data-era="${colecao}">
          <div class="album-pagina-moldura">
            <img class="album-pagina-base" alt="" aria-hidden="true" />
            <div class="album-tabs"></div>
            ${desktop || !ehAbertura ? '<div class="album-grade-area"></div>' : ''}
            <img class="album-pagina-overlay" alt="" aria-hidden="true" />
          </div>
        </div>
      </div>
      <nav class="album-paginador" aria-label="${T.albumPaginacao}">
        <button type="button" class="album-pag-btn album-pag-voltar" aria-label="${T.albumVoltar}"${tela <= 0 ? ' disabled' : ''}>
          <span aria-hidden="true">←</span> ${T.albumVoltar}
        </button>
        <span class="album-pag-status" aria-live="polite">${T.albumPaginaDe(tela + 1, telas)}</span>
        <button type="button" class="album-pag-btn album-pag-avancar" aria-label="${T.albumAvancar}"${tela >= telas - 1 ? ' disabled' : ''}>
          ${T.albumAvancar} <span aria-hidden="true">→</span>
        </button>
      </nav>`;

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
    overlayArt.style.pointerEvents = 'none'; // camada decorativa: nunca captura clique
    // canvas transparente completo, sem crop: só reduz uniformemente (contain +
    // scale global, mesma transformação para todas as eras) até a arte caber
    // dentro do papel. object-fit/position vêm do CSS.
    const escala = ESCALA_OVERLAY[desktop ? 'desktop' : 'mobile'];
    overlayArt.style.transform = `scale(${escala})`;
    overlayArt.dataset.escalaOverlay = String(escala);

    renderizarTabs(colecoes, colecao);

    const gradeArea = overlay.querySelector('.album-grade-area');
    if (gradeArea) {
      // acima do overlay decorativo (z-index 3) — as mini-figurinhas (botões
      // reais) recebem o clique antes de qualquer camada não interativa.
      gradeArea.style.zIndex = '5';
      const geo = AREA_GRADE[desktop ? 'desktop' : 'mobile'];
      gradeArea.style.left = `${geo.left}%`;
      gradeArea.style.right = `${geo.right}%`;
      gradeArea.style.top = `${geo.top}%`;
      gradeArea.style.bottom = `${geo.bottom}%`;
      gradeArea.style.setProperty('--album-grid-gap', `${GRID_GAP_PCT}%`);
      gradeArea.appendChild(montarGrade(itens, paginaGrade, colecao));
    }

    overlay.querySelector('.album-fechar').addEventListener('click', fechar);
    overlay.querySelector('.album-pag-voltar').addEventListener('click', telaAnterior);
    overlay.querySelector('.album-pag-avancar').addEventListener('click', proximaTela);
    armarSwipe(overlay.querySelector('.album-pagina-area'));

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
    const alvo = overlay.querySelector('.album-conteudo');
    alvo.innerHTML = `
      <button type="button" class="album-capa-fechar" aria-label="${T.fechar}">${T.fechar}</button>
      <button type="button" class="album-capa-botao">
        <img class="album-capa-imagem" src="${ASSETS}capa.png" alt="${T.albumTitulo}" />
        <span class="album-capa-dica">${T.albumTocarParaAbrir}</span>
      </button>`;
    alvo.querySelector('.album-capa-fechar').addEventListener('click', fechar);
    alvo.querySelector('.album-capa-botao').addEventListener('click', () => {
      modo = 'aberto';
      colecaoIdx = 0;
      tela = 0;
      // troca capa -> miolo também sem flash: esconde, monta fora da vista,
      // decodifica base + overlay ativo e revela pronto no próximo frame.
      esconderConteudo();
      renderizarMiolo();
      aguardarErevelar(
        overlay.querySelector('.album-pagina-base')?.src,
        overlay.querySelector('.album-pagina-overlay')?.src,
      );
    });
  }

  function abrir() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'album-overlay album-carregando';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', T.albumTitulo);
    // Durante a inicialização só aparece o fundo cósmico + um loading neutro;
    // o conteúdo é montado dentro de .album-conteudo escondido e só é revelado
    // atomicamente depois que a arte crítica está decodificada. Nenhum frame
    // pode mostrar a implementação anterior, a era antes selecionada ou uma
    // montagem parcial.
    overlay.innerHTML = `
      <img class="album-capa-fundo" src="${ASSETS}fundo-cosmico.png" alt="" aria-hidden="true" />
      <div class="album-loader" role="status" aria-live="polite">${T.albumCarregando}</div>
      <div class="album-conteudo"${podeDecodificar() ? ' hidden' : ''}></div>`;
    document.addEventListener('keydown', aoTeclar);
    matchDesktop.addEventListener?.('change', aoMudarBreakpoint);
    window.addEventListener?.('resize', ajustarMoldura);
    (raiz || document.body).appendChild(overlay);
    modo = 'capa';
    colecaoIdx = 0;
    tela = 0;
    renderizarCapa();
    aguardarErevelar(`${ASSETS}fundo-cosmico.png`, `${ASSETS}capa.png`);
  }

  return { abrir, fechar };
}
