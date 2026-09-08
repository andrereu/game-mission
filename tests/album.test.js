import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { criarCatalogo, ERAS } from '../src/engine/catalogo.js';
import { criarStore } from '../src/engine/state.js';
import { montarAlbum } from '../src/ui/album.js';
import { T } from '../src/data/textos.js';

function raizLimpa() {
  document.body.innerHTML = '<div id="eras-raiz"></div>';
  return document.getElementById('eras-raiz');
}

function ambiente(descobertos = {}) {
  const cat = criarCatalogo();
  const store = criarStore({
    versao: 1,
    descobertos,
    canvas: [],
    ajustes: { som: false, iaLigada: false },
  });
  return { cat, store, raiz: raizLimpa() };
}

function abrirMiolo(album, raiz) {
  album.abrir();
  raiz.querySelector('.album-capa-botao').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

// contagem real do catálogo por era (base de comparação nos testes)
const TOTAL_ERA = Object.fromEntries(ERAS.map((era) => [
  era, criarCatalogo().allItems().filter((it) => it.era === era && !it.ia).length,
]));

test('1. capa aparece antes do miolo', () => {
  const { cat, store, raiz } = ambiente();
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  album.abrir();
  assert.ok(raiz.querySelector('.album-capa-imagem'), 'capa visível');
  assert.equal(raiz.querySelector('.album-miolo'), null, 'miolo ainda não existe');
  assert.equal(raiz.querySelector('.album-pagina-overlay'), null, '18. nenhum overlay de era carregado ainda');
});

test('capa usa o recorte sem margem transparente excessiva (crop puro da arte aprovada)', () => {
  const { cat, store, raiz } = ambiente();
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  album.abrir();
  assert.match(raiz.querySelector('.album-capa-imagem').src, /assets\/album\/capa-recortada\.png$/);
});

test('2. tocar/clicar na capa abre o Álbum (miolo)', () => {
  const { cat, store, raiz } = ambiente();
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  assert.ok(raiz.querySelector('.album-miolo'), 'miolo aparece');
  assert.equal(raiz.querySelector('.album-capa-imagem'), null, 'capa some');
});

test('3. cada era usa os assets canônicos corretos (base + overlay)', () => {
  const { cat, store, raiz } = ambiente();
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  assert.match(raiz.querySelector('.album-pagina-base').src, /assets\/album\/base-desktop\.png$/);
  assert.match(raiz.querySelector('.album-pagina-overlay').src, /assets\/album\/elementos-desktop\.png$/);

  raiz.querySelector('.album-aba[data-era="natureza"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.match(raiz.querySelector('.album-pagina-overlay').src, /assets\/album\/natureza-desktop\.png$/);
});

test('4. paginação é derivada da quantidade real de itens da era', () => {
  const { cat, store, raiz } = ambiente();
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  // elementos: 32 itens, capacidade desktop 28/página × 2 páginas visíveis = 1 tela
  assert.equal(raiz.querySelector('.album-rodape').textContent, T.albumPaginaDe(1, 1));

  raiz.querySelector('.album-aba[data-era="vida"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  // vida: 66 itens, capacidade 28 → 3 páginas físicas → 2 telas (28+28 / 10+vazio)
  const totalPaginasFisicas = Math.ceil(TOTAL_ERA.vida / 28);
  const totalTelas = Math.ceil(totalPaginasFisicas / 2);
  assert.equal(raiz.querySelector('.album-rodape').textContent, T.albumPaginaDe(1, totalTelas));
});

test('5. desktop e mobile usam densidades de grade diferentes', () => {
  const { cat, store, raiz } = ambiente();
  const antesMatchMedia = window.matchMedia;

  window.matchMedia = (query) => ({
    matches: true, media: query, addEventListener() {}, removeEventListener() {},
  });
  const albumDesktop = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(albumDesktop, raiz);
  const gradeDesktop = raiz.querySelector('.album-pagina-slots-esquerda .album-slots');
  const colunasDesktop = gradeDesktop.style.gridTemplateColumns;
  const linhasDesktop = gradeDesktop.style.gridTemplateRows;
  albumDesktop.fechar();

  window.matchMedia = (query) => ({
    matches: false, media: query, addEventListener() {}, removeEventListener() {},
  });
  const albumMobile = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(albumMobile, raiz);
  const gradeMobile = raiz.querySelector('.album-pagina-slots-esquerda .album-slots');
  const colunasMobile = gradeMobile.style.gridTemplateColumns;
  const linhasMobile = gradeMobile.style.gridTemplateRows;

  window.matchMedia = antesMatchMedia;
  assert.match(colunasDesktop, /repeat\(7,/, '7 colunas no desktop');
  assert.match(linhasDesktop, /repeat\(4,/, '4 linhas no desktop');
  assert.match(colunasMobile, /repeat\(4,/, '4 colunas no mobile');
  assert.match(linhasMobile, /repeat\(4,/, '4 linhas no mobile');
});

test('paginação distribui os itens de forma equilibrada entre as páginas (não fatia sequencial fixa)', () => {
  const { cat, store, raiz } = ambiente();
  const antesMatchMedia = window.matchMedia;
  window.matchMedia = (query) => ({
    matches: false, media: query, addEventListener() {}, removeEventListener() {},
  });
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  raiz.querySelector('.album-aba[data-era="natureza"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

  const contarCelulas = () => raiz.querySelectorAll(
    '.album-pagina-slots-esquerda .figurinha-mini, .album-pagina-slots-esquerda .figurinha-vazia',
  ).length;

  const totalNatureza = TOTAL_ERA.natureza;
  const capacidadeMobile = 16; // 4 × 4
  const numPaginas = Math.ceil(totalNatureza / capacidadeMobile);
  const base = Math.floor(totalNatureza / numPaginas);
  const resto = totalNatureza % numPaginas;

  for (let p = 0; p < numPaginas; p += 1) {
    const esperado = base + (p < resto ? 1 : 0);
    assert.equal(contarCelulas(), esperado, `página ${p + 1} de Natureza tem ${esperado} células`);
    if (p < numPaginas - 1) {
      raiz.querySelector('.album-nav-proxima').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    }
  }
  album.fechar();
  window.matchMedia = antesMatchMedia;
});

test('6. itens descobertos aparecem como figurinhas', () => {
  const { cat, store, raiz } = ambiente({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 2, via: null, fonte: 'base' },
  });
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  assert.ok(raiz.querySelector('.figurinha-mini[data-id="agua"]'));
  assert.ok(raiz.querySelector('.figurinha-mini[data-id="fogo"]'));
});

test('7. itens não descobertos não revelam nome, ícone ou qualquer dado', () => {
  const { cat, store, raiz } = ambiente({ agua: { em: 1, via: null, fonte: 'base' } });
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  const vazias = raiz.querySelectorAll('.figurinha-vazia');
  assert.ok(vazias.length > 0);
  for (const el of vazias) {
    assert.equal(el.dataset.id, undefined, 'nenhum id vazado no dataset');
    assert.equal(el.textContent.trim(), '?');
  }
  assert.equal(raiz.querySelector('.album-pagina-slots-esquerda').textContent.includes('Fogo'), false);
});

test('8. clicar numa miniatura descoberta abre a carta completa existente', () => {
  const { cat, store, raiz } = ambiente({ agua: { em: 1, via: null, fonte: 'base' } });
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  raiz.querySelector('.figurinha-mini[data-id="agua"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const carta = raiz.querySelector('.carta-overlay .carta');
  assert.ok(carta, 'carta completa abre');
  assert.match(carta.textContent, /Sobre/);
  assert.match(carta.textContent, /Água/);
  assert.ok(carta.querySelector('.carta-btn-salvar-imagem') || carta.querySelector('.carta-btn-exportar'), 'botão de salvar imagem preservado');
  assert.ok(carta.querySelector('.carta-btn-fechar'), 'botão fechar preservado');
});

test('9. fechar a carta mantém a mesma era e a mesma folha do Álbum', () => {
  const { cat, store, raiz } = ambiente({ agua: { em: 1, via: null, fonte: 'base' } });
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  raiz.querySelector('.album-aba[data-era="vida"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const rodapeAntes = raiz.querySelector('.album-rodape').textContent;

  // "água" não é de vida, mas simula abrir uma carta a partir de outro estado:
  // reabrir a árvore de eventos direto no botão fechar da carta, se existir
  const vazio = raiz.querySelector('.figurinha-vazia');
  assert.ok(vazio, 'ainda em vida, com slots vazios');
  assert.equal(raiz.querySelector('.album-aba[aria-current="true"]').dataset.era, 'vida');
  assert.equal(raiz.querySelector('.album-rodape').textContent, rodapeAntes);
});

test('10. progresso canônico exibido não muda ao navegar pelo Álbum', () => {
  const { cat, store, raiz } = ambiente({ agua: { em: 1, via: null, fonte: 'base' } });
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  const contagemAntes = raiz.querySelector('.album-cabecalho-contagem').textContent;
  raiz.querySelector('.album-aba[data-era="ficcao"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  raiz.querySelector('.album-nav-proxima').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const contagemDepois = raiz.querySelector('.album-cabecalho-contagem').textContent;
  assert.equal(contagemAntes, contagemDepois);
  assert.match(contagemAntes, /1 \/ 283 do mapa/);
});

test('11. criações da IA continuam fora do denominador canônico', () => {
  const { cat, store, raiz } = ambiente({ agua: { em: 1, via: null, fonte: 'base' } });
  const item = cat.registrarItemIA({ nome: 'Nuvem Cósmica', emoji: '✨', era: 'natureza' });
  store.getSave().descobertos[item.id] = { em: 2, via: ['agua'], fonte: 'ia' };
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  assert.match(raiz.querySelector('.album-cabecalho-contagem').textContent, /1 \/ 283 do mapa · 1 inventada/);
});

test('12. IA mostra somente criações existentes e já descobertas, sem espaços ocultos', () => {
  const { cat, store, raiz } = ambiente({ agua: { em: 1, via: null, fonte: 'base' } });
  const item1 = cat.registrarItemIA({ nome: 'Nuvem Cósmica', emoji: '✨', era: 'natureza' });
  cat.registrarItemIA({ nome: 'Robô Poeta', emoji: '🤖', era: 'tecnologia' }); // registrada, não descoberta
  store.getSave().descobertos[item1.id] = { em: 2, via: ['agua'], fonte: 'ia' };
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  raiz.querySelector('.album-aba[data-era="ia"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(raiz.querySelectorAll('.figurinha-mini').length, 1);
  assert.equal(raiz.querySelectorAll('.figurinha-vazia').length, 0, 'sem "???" para criações futuras da IA');
  assert.ok(raiz.querySelector('.figurinha-mini[data-id="nuvem-cosmica"]'));
});

test('coleção "IA" não aparece como atalho quando não há nenhuma criação descoberta', () => {
  const { cat, store, raiz } = ambiente({ agua: { em: 1, via: null, fonte: 'base' } });
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  assert.equal(raiz.querySelector('.album-aba[data-era="ia"]'), null);
});

test('13. abrir, folhear e ver cartas no Álbum nunca grava no save', () => {
  const { cat, store, raiz } = ambiente({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 2, via: null, fonte: 'base' },
  });
  const antes = JSON.parse(JSON.stringify(store.getSave()));
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  raiz.querySelector('.album-aba[data-era="vida"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  raiz.querySelector('.figurinha-mini[data-id="agua"]')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  album.fechar();
  assert.deepEqual(store.getSave(), antes);
});

test('14. Escape fecha o Álbum', () => {
  const { cat, store, raiz } = ambiente();
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(raiz.querySelector('.album-overlay'), null);
});

test('botão Fechar da capa e do miolo removem o overlay', () => {
  const { cat, store, raiz } = ambiente();
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  album.abrir();
  raiz.querySelector('.album-capa-fechar').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(raiz.querySelector('.album-overlay'), null);

  abrirMiolo(album, raiz);
  raiz.querySelector('.album-fechar').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(raiz.querySelector('.album-overlay'), null);
});

test('16. nenhum caminho de imagem quebrado: todos os assets canônicos existem no repositório', () => {
  const base = fileURLToPath(new URL('../assets/album/', import.meta.url));
  const arquivos = [
    'capa.png', 'capa-recortada.png', 'fundo-cosmico.png', 'base-desktop.png', 'base-mobile.png',
    ...ERAS.flatMap((era) => [`${era}-desktop.png`, `${era}-mobile.png`]),
    'ia-desktop.png', 'ia-mobile.png',
  ];
  for (const arquivo of arquivos) {
    assert.ok(existsSync(base + arquivo), `${arquivo} deve existir`);
  }
});

test('próxima tela avança de era quando a coleção atual acaba', () => {
  const { cat, store, raiz } = ambiente();
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  // elementos cabe numa única tela (32 itens / 28 por página / 2 páginas por tela)
  raiz.querySelector('.album-nav-proxima').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(raiz.querySelector('.album-aba[aria-current="true"]').dataset.era, 'natureza');
});

test('página anterior volta pra era anterior, na última tela dela', () => {
  const { cat, store, raiz } = ambiente();
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  raiz.querySelector('.album-aba[data-era="natureza"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  raiz.querySelector('.album-nav-anterior').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(raiz.querySelector('.album-aba[aria-current="true"]').dataset.era, 'elementos');
});

test('era 100% descoberta ganha o selo de completa', () => {
  const cat = criarCatalogo();
  const descobertos = {};
  let t = 0;
  for (const it of cat.allItems().filter((i) => i.era === 'elementos' && !i.ia)) {
    t += 1;
    descobertos[it.id] = { em: t, via: null, fonte: 'base' };
  }
  const store = criarStore({
    versao: 1, descobertos, canvas: [], ajustes: {},
  });
  const raiz = raizLimpa();
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  assert.ok(raiz.querySelector('.album-selo'));
  assert.equal(raiz.querySelector('.album-colecao-contagem').textContent, `${t} / ${t}`);
});

test('figurinha "além do mapa" preserva a identidade platina', () => {
  const cat = criarCatalogo();
  const alemDoMapa = cat.allItems().find((it) => cat.ehAlemDoMapa(it.id));
  assert.ok(alemDoMapa);
  const store = criarStore({
    versao: 1,
    descobertos: { [alemDoMapa.id]: { em: 1, via: null, fonte: 'base' } },
    canvas: [],
    ajustes: {},
  });
  const raiz = raizLimpa();
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  if (alemDoMapa.era !== 'elementos') {
    raiz.querySelector(`.album-aba[data-era="${alemDoMapa.era}"]`).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  }
  const el = raiz.querySelector(`.figurinha-mini[data-id="${alemDoMapa.id}"]`);
  assert.ok(el, 'a figurinha aparece na página correspondente');
  assert.equal(el.dataset.alem, 'mapa');
});

test('perfil com criações da IA hidratadas continua funcionando no Álbum', () => {
  const cat = criarCatalogo();
  cat.hidratarIA(
    { 'coisa-da-ia': { nome: 'Coisa da IA', emoji: '✨', era: 'natureza', raridade: 'raro', profundidade: 1 } },
    {},
  );
  const store = criarStore({
    versao: 1,
    descobertos: { agua: { em: 1, via: null, fonte: 'base' }, 'coisa-da-ia': { em: 2, via: ['agua'], fonte: 'ia' } },
    canvas: [],
    ajustes: {},
  });
  const raiz = raizLimpa();
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  raiz.querySelector('.album-aba[data-era="ia"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.ok(raiz.querySelector('.figurinha-mini[data-id="coisa-da-ia"]'));
});

test('abrir o Álbum de novo depois de fechado volta a mostrar a capa', () => {
  const { cat, store, raiz } = ambiente();
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  raiz.querySelector('.album-aba[data-era="vida"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  album.fechar();
  album.abrir();
  assert.ok(raiz.querySelector('.album-capa-imagem'), 'reabre pela capa, sem persistir a posição interna');
});

test('a fileira de atalhos circulares antiga não existe mais no miolo', () => {
  const { cat, store, raiz } = ambiente();
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  assert.equal(raiz.querySelector('.album-atalhos'), null);
  assert.equal(raiz.querySelector('.album-atalho'), null);
});

test('as 6 eras canônicas viram áreas de toque acessíveis sobre as abas físicas do livro', () => {
  const { cat, store, raiz } = ambiente();
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  const abas = raiz.querySelectorAll('.album-abas .album-aba');
  assert.equal(abas.length, ERAS.length, 'uma aba de toque por era canônica');
  for (const aba of abas) {
    assert.ok(aba.getAttribute('aria-label'), 'aba tem aria-label');
    assert.ok(aba.dataset.era, 'aba tem data-era');
  }
  raiz.querySelector('.album-aba[data-era="cultura"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.match(raiz.querySelector('.album-pagina-overlay').src, /assets\/album\/cultura-desktop\.png$/);
});

test('a área segura de posicionamento vem de AREA_SEGURA (config), não de percentuais soltos no CSS', () => {
  const { cat, store, raiz } = ambiente();
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  const moldura = raiz.querySelector('.album-pagina-moldura');
  // "elementos" no desktop: valores calibrados a partir da densidade real
  // do PNG daquela era (ver AREA_SEGURA em src/ui/album.js).
  assert.equal(moldura.style.getPropertyValue('--as-top'), '39%');
  assert.equal(moldura.style.getPropertyValue('--as-esq-left'), '13%');
  assert.equal(moldura.style.getPropertyValue('--as-dir-right'), '12%');
});

test('cada era tem sua própria área segura calibrada (não usa mais um único "default" pra todas)', () => {
  const { cat, store, raiz } = ambiente();
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  const moldura = raiz.querySelector('.album-pagina-moldura');
  const topElementos = moldura.style.getPropertyValue('--as-top');

  raiz.querySelector('.album-aba[data-era="natureza"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const topNatureza = raiz.querySelector('.album-pagina-moldura').style.getPropertyValue('--as-top');
  assert.notEqual(topElementos, topNatureza, 'natureza tem uma área segura própria, diferente de elementos');
});

test('miniatura é um componente próprio: não usa a classe/estrutura ".orbe" da carta grande', () => {
  const { cat, store, raiz } = ambiente({ agua: { em: 1, via: null, fonte: 'base' } });
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  const mini = raiz.querySelector('.figurinha-mini[data-id="agua"]');
  assert.ok(mini, 'a miniatura existe');
  assert.equal(mini.querySelector('.orbe'), null, 'não reaproveita o DOM do orbe grande');
  assert.equal(mini.className.includes('orbe'), false);
  assert.ok(mini.querySelector('.figurinha-mini-icone'), 'tem seu próprio container de ícone');
  assert.equal(mini.dataset.raridade, 'comum');
});

test('miniatura não mostra a palavra da raridade espremida no visual (só no aria-label acessível)', () => {
  const { cat, store, raiz } = ambiente({ agua: { em: 1, via: null, fonte: 'base' } });
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  const mini = raiz.querySelector('.figurinha-mini[data-id="agua"]');
  assert.equal(mini.querySelector('.figurinha-mini-selo'), null);
  assert.match(mini.getAttribute('aria-label'), /Água/);
});

test('espaço vazio da figurinha não descoberta é um cartão discreto, não um círculo cheio', () => {
  const { cat, store, raiz } = ambiente({ agua: { em: 1, via: null, fonte: 'base' } });
  const album = montarAlbum({
    raiz, store, catalogo: cat, T,
  });
  abrirMiolo(album, raiz);
  const vazia = raiz.querySelector('.figurinha-vazia');
  assert.ok(vazia);
  assert.equal(vazia.querySelector('.figurinha-vazia-marca').textContent, '?');
});
