import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo } from '../src/engine/catalogo.js';
import { criarStore } from '../src/engine/state.js';
import { montarAlbum } from '../src/ui/album.js';
import { montarCartaOverlay } from '../src/ui/carta.js';
import { T } from '../src/data/textos.js';

function raizLimpa(id) {
  document.body.innerHTML = `<div id="${id}"></div>`;
  return document.getElementById(id);
}

test('abrir a carta de um item base mostra raridade, nome e "Origem"', () => {
  const raiz = raizLimpa('carta-raiz');
  const cat = criarCatalogo();
  const store = criarStore({
    versao: 1, descobertos: { agua: { em: 1 } }, canvas: [], ajustes: {},
  });
  const carta = montarCartaOverlay({ raiz, store, catalogo: cat, T });
  carta.abrir('agua');

  const el = raiz.querySelector('.carta');
  assert.ok(el, 'a carta abre');
  assert.match(el.className, /raridade-comum/);
  assert.match(el.textContent, /Água/);
  assert.match(el.textContent, new RegExp(T.cartaOrigem));

  carta.fechar();
  assert.equal(raiz.querySelector('.carta-overlay'), null);
});

test('carta de item combinado mostra "Vim disso" com os dois ingredientes', () => {
  const raiz = raizLimpa('carta-raiz');
  const cat = criarCatalogo();
  const store = criarStore({
    versao: 1,
    descobertos: {
      agua: { em: 1 }, fogo: { em: 1 }, vapor: { em: 2, via: ['agua', 'fogo'] },
    },
    canvas: [],
    ajustes: {},
  });
  const carta = montarCartaOverlay({ raiz, store, catalogo: cat, T });
  carta.abrir('vapor');

  const texto = raiz.querySelector('.carta').textContent;
  assert.match(texto, new RegExp(T.cartaVimDisso));
  assert.match(texto, /Água/);
  assert.match(texto, /Fogo/);
});

test('carta mostra "Criei isso" quando o item já gerou outra descoberta', () => {
  const raiz = raizLimpa('carta-raiz');
  const cat = criarCatalogo();
  const store = criarStore({
    versao: 1,
    descobertos: {
      agua: { em: 1 }, fogo: { em: 1 }, vapor: { em: 2, via: ['agua', 'fogo'] },
    },
    canvas: [],
    ajustes: {},
  });
  const carta = montarCartaOverlay({ raiz, store, catalogo: cat, T });
  carta.abrir('agua');

  const texto = raiz.querySelector('.carta').textContent;
  assert.match(texto, new RegExp(T.cartaCrieiIsso));
  assert.match(texto, /Vapor/);
});

test('sem-spoiler: abrir a carta de um id não descoberto não faz nada', () => {
  const raiz = raizLimpa('carta-raiz');
  const cat = criarCatalogo();
  const store = criarStore({
    versao: 1, descobertos: {}, canvas: [], ajustes: {},
  });
  const carta = montarCartaOverlay({ raiz, store, catalogo: cat, T });
  carta.abrir('agua');
  assert.equal(raiz.querySelector('.carta-overlay'), null);
});

test('item lendário (com ref) mostra o selo Lendário mesmo sendo item "simples"', () => {
  const raiz = raizLimpa('carta-raiz');
  const cat = criarCatalogo();
  const store = criarStore({
    versao: 1, descobertos: { 'homem-aranha': { em: 1, fonte: 'jogo' } }, canvas: [], ajustes: {},
  });
  const carta = montarCartaOverlay({ raiz, store, catalogo: cat, T });
  carta.abrir('homem-aranha');

  const el = raiz.querySelector('.carta');
  assert.match(el.className, /raridade-lendario/);
});

test('item criado pela IA mostra a raridade persistida e o marcador de IA', () => {
  const raiz = raizLimpa('carta-raiz');
  const cat = criarCatalogo();
  const item = cat.registrarItemIA({
    nome: 'Nuvem Quente', emoji: '☁️', era: 'elementos', idA: 'vapor', idB: 'calor',
  });
  const store = criarStore({
    versao: 1,
    descobertos: { [item.id]: { em: 1, via: ['vapor', 'calor'], fonte: 'ia' } },
    canvas: [],
    ajustes: {},
  });
  const carta = montarCartaOverlay({ raiz, store, catalogo: cat, T });
  carta.abrir(item.id);

  const el = raiz.querySelector('.carta');
  assert.match(el.className, new RegExp(`raridade-${item.raridade}`));
  assert.match(el.textContent, new RegExp(T.cartaCriadoPelaIA));
});

test('clicar numa figurinha descoberta do álbum abre a carta correspondente', () => {
  const raiz = raizLimpa('album-raiz');
  const cat = criarCatalogo();
  const store = criarStore({
    versao: 1, descobertos: { agua: { em: 1 } }, canvas: [], ajustes: {},
  });
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  album.abrir();
  raiz.querySelector('.album-capa-botao').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

  const figAgua = raiz.querySelector('.figurinha-mini[data-id="agua"]');
  assert.ok(figAgua);
  figAgua.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

  assert.ok(raiz.querySelector('.carta'), 'a carta abre por cima do álbum');

  album.fechar();
  assert.equal(raiz.querySelector('.carta-overlay'), null, 'fechar o álbum também fecha a carta aberta');
});
