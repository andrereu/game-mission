// Álbum de figurinhas: substitui a linha do tempo. Uma seção por era, com uma
// figurinha por item curado (a IA não conta — não é conteúdo do álbum oficial,
// igual já não conta pra progressão da era). Descoberto mostra o ícone real;
// não descoberto vira uma silhueta "?". Era 100% completa ganha um selo.
import { ERAS } from '../engine/catalogo.js';

export function montarAlbum({ raiz, store, catalogo, T }) {
  let overlay = null;

  function fechar() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
  }

  function itensDaEra(era) {
    return catalogo.allItems()
      .filter((it) => it.era === era && !it.ia)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  function figurinha(item, descoberta) {
    const icone = descoberta
      ? (item.svg
        ? `<img class="figurinha-icone" src="${item.svg}" alt="" />`
        : `<span class="figurinha-icone">${item.emoji}</span>`)
      : '<span class="figurinha-icone figurinha-oculta">?</span>';
    const nome = descoberta ? item.nome : T.albumOculto;
    return `<div class="figurinha ${descoberta ? 'descoberta' : 'oculta'}" data-id="${item.id}">
      ${icone}<span class="figurinha-nome">${nome}</span>
    </div>`;
  }

  function abrir() {
    fechar();
    overlay = document.createElement('div');
    overlay.className = 'album-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', T.albumTitulo);
    overlay.innerHTML = `
      <div class="album-cabecalho">
        <h2>${T.albumTitulo}</h2>
        <button type="button" class="album-fechar">${T.fechar}</button>
      </div>
      <div class="album-corpo"></div>`;

    const corpo = overlay.querySelector('.album-corpo');
    const descobertos = store.getSave().descobertos;

    for (const era of ERAS) {
      const itens = itensDaEra(era);
      const feitos = itens.filter((it) => descobertos[it.id]).length;
      const completa = itens.length > 0 && feitos === itens.length;

      const secao = document.createElement('section');
      secao.className = 'album-era';
      secao.dataset.era = era;
      if (completa) secao.classList.add('completa');
      secao.innerHTML = `
        <div class="album-era-cabecalho">
          <span class="album-era-icone">${T.erasIcone[era] || '✨'}</span>
          <h3 class="album-era-nome">${T.eras[era] || era}</h3>
          <span class="album-era-contagem">${feitos} / ${itens.length}</span>
          ${completa ? `<span class="album-selo">${T.albumSeloCompleto}</span>` : ''}
        </div>
        <div class="album-grade">
          ${itens.map((it) => figurinha(it, Boolean(descobertos[it.id]))).join('')}
        </div>`;
      corpo.appendChild(secao);
    }

    overlay.querySelector('.album-fechar').addEventListener('click', fechar);
    (raiz || document.body).appendChild(overlay);
  }

  return { abrir, fechar };
}
