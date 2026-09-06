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

test('itens da IA não entram no álbum (não são conteúdo curado)', () => {
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

  assert.equal(raiz.querySelector(`.figurinha[data-id="${item.id}"]`), null);
  assert.ok(![...raiz.querySelectorAll('.figurinha')].some((f) => f.textContent.includes('Coisa da IA')));
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
