import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo, ERAS } from '../src/engine/catalogo.js';
import { criarStore } from '../src/engine/state.js';
import { montarAlbum } from '../src/ui/eras.js';
import { mostrarEraNova } from '../src/ui/era-nova.js';
import { T } from '../src/data/textos.js';

function raizLimpa(id) {
  document.body.innerHTML = `<div id="${id}"></div>`;
  return document.getElementById(id);
}

test('álbum mostra uma seção por era, com figurinha por item curado', () => {
  const raiz = raizLimpa('eras-raiz');
  const cat = criarCatalogo();
  const store = criarStore({
    versao: 1,
    descobertos: { agua: {}, fogo: {}, terra: {}, ar: {}, vapor: {}, bicho: {} },
    canvas: [],
    ajustes: {},
  });
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  album.abrir();

  const secoes = raiz.querySelectorAll('.album-era');
  assert.equal(secoes.length, 6);
  assert.deepEqual([...secoes].map((s) => s.dataset.era), ERAS);

  const elem = raiz.querySelector('.album-era[data-era="elementos"]');
  assert.match(elem.textContent, /5\s*\/\s*\d+/); // 5 descobertos em elementos

  album.fechar();
  assert.equal(raiz.querySelector('.album-overlay'), null);
});

test('figurinha descoberta mostra o nome real; não descoberta vira "???"', () => {
  const raiz = raizLimpa('eras-raiz');
  const cat = criarCatalogo();
  const store = criarStore({
    versao: 1,
    descobertos: { agua: {} },
    canvas: [],
    ajustes: {},
  });
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  album.abrir();

  const aguaCard = [...raiz.querySelectorAll('.figurinha')]
    .find((f) => f.textContent.includes('Água'));
  assert.ok(aguaCard, 'figurinha da água descoberta aparece com o nome');
  assert.ok(aguaCard.classList.contains('descoberta'));

  const ocultas = raiz.querySelectorAll('.figurinha.oculta');
  assert.ok(ocultas.length > 0, 'itens não descobertos viram figurinha oculta');
  assert.ok([...ocultas].every((f) => f.textContent.includes('???')));
});

test('itens da IA não entram nas seções de era (não são conteúdo curado)', () => {
  const raiz = raizLimpa('eras-raiz');
  const cat = criarCatalogo();
  const item = cat.registrarItemIA({ nome: 'Coisa da IA', emoji: '✨', era: 'elementos' });
  const store = criarStore({
    versao: 1,
    descobertos: { agua: {}, [item.id]: {} },
    canvas: [],
    ajustes: {},
  });
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  album.abrir();

  const eraElementos = raiz.querySelector('.album-era[data-era="elementos"]');
  assert.equal(eraElementos.querySelector(`.figurinha[data-id="${item.id}"]`), null);
  for (const secao of raiz.querySelectorAll('.album-era:not(.album-era-ia)')) {
    assert.ok(!secao.textContent.includes('Coisa da IA'));
  }
});

test('item da IA descoberto aparece na coleção "Inventadas com IA" do álbum', () => {
  const raiz = raizLimpa('eras-raiz');
  const cat = criarCatalogo();
  const item = cat.registrarItemIA({ nome: 'Coisa da IA', emoji: '✨', era: 'elementos' });
  const store = criarStore({
    versao: 1,
    descobertos: { agua: {}, [item.id]: {} },
    canvas: [],
    ajustes: {},
  });
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  album.abrir();

  const secaoIA = raiz.querySelector('.album-era-ia');
  assert.ok(secaoIA, 'seção "Inventadas com IA" aparece');
  assert.ok(secaoIA.querySelector(`.figurinha[data-id="${item.id}"]`), 'figurinha da criação da IA aparece na seção');
  assert.ok(secaoIA.textContent.includes('Coisa da IA'));
});

test('seção "Inventadas com IA" não aparece quando não há criações descobertas', () => {
  const raiz = raizLimpa('eras-raiz');
  const cat = criarCatalogo();
  cat.registrarItemIA({ nome: 'Coisa da IA', emoji: '✨', era: 'elementos' }); // registrada, mas não descoberta
  const store = criarStore({
    versao: 1,
    descobertos: { agua: {} },
    canvas: [],
    ajustes: {},
  });
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  album.abrir();

  assert.equal(raiz.querySelector('.album-era-ia'), null);
});

test('seção da IA não cria posições ocultas "???" pra criações futuras', () => {
  const raiz = raizLimpa('eras-raiz');
  const cat = criarCatalogo();
  const item = cat.registrarItemIA({ nome: 'Coisa da IA', emoji: '✨', era: 'elementos' });
  const store = criarStore({
    versao: 1,
    descobertos: { agua: {}, [item.id]: {} },
    canvas: [],
    ajustes: {},
  });
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  album.abrir();

  const secaoIA = raiz.querySelector('.album-era-ia');
  assert.equal(secaoIA.querySelectorAll('.figurinha.oculta').length, 0);
  assert.equal(secaoIA.querySelectorAll('.figurinha-oculta').length, 0);
});

test('carta de uma criação da IA abre normalmente a partir do álbum', () => {
  const raiz = raizLimpa('eras-raiz');
  const cat = criarCatalogo();
  const item = cat.registrarItemIA({ nome: 'Coisa da IA', emoji: '✨', era: 'elementos' });
  const store = criarStore({
    versao: 1,
    descobertos: { agua: { em: 1 }, ar: { em: 2 }, [item.id]: { em: 3, via: ['agua', 'ar'], fonte: 'ia' } },
    canvas: [],
    ajustes: {},
  });
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  album.abrir();

  const figurinha = raiz.querySelector(`.figurinha[data-id="${item.id}"]`);
  figurinha.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const carta = raiz.querySelector('.carta-overlay .carta');
  assert.ok(carta, 'carta abre');
  assert.match(carta.textContent, /Coisa da IA/);
});

test('criação da IA não altera o total nem o progresso canônico exibido no álbum', () => {
  const raiz = raizLimpa('eras-raiz');
  const cat = criarCatalogo();
  const totalCanonicoAntes = cat.allItems().filter((it) => !it.ia).length;
  const item = cat.registrarItemIA({ nome: 'Coisa da IA', emoji: '✨', era: 'elementos' });
  const store = criarStore({
    versao: 1,
    descobertos: { agua: {}, [item.id]: {} },
    canvas: [],
    ajustes: {},
  });
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  album.abrir();

  const contagemGeral = raiz.querySelector('.album-cabecalho-contagem').textContent;
  assert.match(contagemGeral, new RegExp(`1 / ${totalCanonicoAntes}`));
  assert.match(contagemGeral, /1 inventada/);

  const eraElementos = raiz.querySelector('.album-era[data-era="elementos"]');
  assert.match(eraElementos.textContent, /1\s*\/\s*\d+/); // só a água conta
  assert.ok(!eraElementos.classList.contains('completa'));
});

test('criação da IA não conclui nem desbloqueia selo de era completa', () => {
  const raiz = raizLimpa('eras-raiz');
  const cat = criarCatalogo();
  const todosElementos = cat.allItems().filter((it) => it.era === 'elementos' && !it.ia);
  const item = cat.registrarItemIA({ nome: 'Coisa da IA', emoji: '✨', era: 'elementos' });
  const descobertos = { [item.id]: {} }; // só a criação da IA, nenhum item canônico
  const store = criarStore({
    versao: 1, descobertos, canvas: [], ajustes: {},
  });
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  album.abrir();

  const eraElementos = raiz.querySelector('.album-era[data-era="elementos"]');
  assert.ok(!eraElementos.classList.contains('completa'));
  assert.equal(eraElementos.querySelector('.album-selo'), null);
  assert.match(eraElementos.textContent, new RegExp(`0\\s*/\\s*${todosElementos.length}`));
});

test('era 100% descoberta ganha o selo de completa', () => {
  const raiz = raizLimpa('eras-raiz');
  const cat = criarCatalogo();
  const todosElementos = cat.allItems().filter((it) => it.era === 'elementos' && !it.ia);
  const descobertos = {};
  for (const it of todosElementos) descobertos[it.id] = {};
  const store = criarStore({
    versao: 1, descobertos, canvas: [], ajustes: {},
  });
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  album.abrir();

  const elem = raiz.querySelector('.album-era[data-era="elementos"]');
  assert.ok(elem.classList.contains('completa'));
  assert.ok(elem.querySelector('.album-selo'));

  const outra = raiz.querySelector('.album-era[data-era="natureza"]');
  assert.ok(!outra.classList.contains('completa'));
  assert.equal(outra.querySelector('.album-selo'), null);
});

test('figurinha da IA nunca recebe o acabamento platina de "Além do mapa"', () => {
  const raiz = raizLimpa('eras-raiz');
  const cat = criarCatalogo();
  const item = cat.registrarItemIA({ nome: 'Coisa da IA', emoji: '✨', era: 'elementos' });
  const store = criarStore({
    versao: 1,
    descobertos: { agua: {}, [item.id]: {} },
    canvas: [],
    ajustes: {},
  });
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  album.abrir();

  const orbeIA = raiz.querySelector(`.figurinha[data-id="${item.id}"] .orbe`);
  assert.equal(orbeIA.getAttribute('data-alem'), null);
  assert.equal(orbeIA.classList.contains('orbe-oculta'), false);
});

test('álbum continua mostrando as criações da IA depois de hidratar um save antigo (troca de sessão)', () => {
  const raiz = raizLimpa('eras-raiz');
  const cat = criarCatalogo();
  cat.hidratarIA(
    { 'coisa-da-ia': { nome: 'Coisa da IA', emoji: '✨', era: 'elementos', raridade: 'raro', profundidade: 1 } },
    {},
  );
  const store = criarStore({
    versao: 1,
    descobertos: { agua: {}, 'coisa-da-ia': {} },
    canvas: [],
    ajustes: {},
  });
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  album.abrir();

  const secaoIA = raiz.querySelector('.album-era-ia');
  assert.ok(secaoIA);
  assert.ok(secaoIA.querySelector('.figurinha[data-id="coisa-da-ia"]'));
});

test('mostrarEraNova mostra o nome da era e fecha no clique', async () => {
  raizLimpa('overlay-raiz');
  const p = mostrarEraNova({
    era: 'vida',
    progresso: [{ era: 'elementos', descobertos: 4, total: 30 }],
    T,
  });
  const over = document.querySelector('.era-nova-overlay');
  assert.ok(over);
  assert.match(over.textContent, new RegExp(T.eras.vida));
  over.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await p;
  assert.equal(document.querySelector('.era-nova-overlay'), null);
});
