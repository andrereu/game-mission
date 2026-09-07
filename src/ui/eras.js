// Álbum de figurinhas: substitui a linha do tempo. Uma seção por era, com uma
// figurinha por item curado (a IA não conta — não é conteúdo do álbum oficial,
// igual já não conta pra progressão da era). Descoberto mostra o ícone real;
// não descoberto vira uma silhueta "?". Era 100% completa ganha um selo.
import { ERAS } from '../engine/catalogo.js';
import { montarCartaOverlay } from './carta.js';
import { ehAlemDoMapaVisivel, atributosOrbeAlemDoMapa, srOnlyAlemDoMapa } from './alemDoMapaUI.js';

export function montarAlbum({ raiz, store, catalogo, T }) {
  let overlay = null;
  const carta = montarCartaOverlay({
    raiz, store, catalogo, T,
  });

  function fechar() {
    carta.fechar();
    if (!overlay) return;
    overlay.remove();
    overlay = null;
  }

  function itensDaEra(era) {
    return catalogo.allItems()
      .filter((it) => it.era === era && !it.ia)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  // Só as criações da IA já descobertas — nunca espaços ocultos "???" pra
  // possíveis criações futuras (a coleção não tem tamanho conhecido de antemão).
  function itensIADescobertos() {
    const descobertos = store.getSave().descobertos;
    return catalogo.allItems()
      .filter((it) => it.ia && descobertos[it.id])
      .sort((a, b) => (descobertos[a.id]?.em ?? 0) - (descobertos[b.id]?.em ?? 0));
  }

  function figurinhaIA(item) {
    const icone = item.svg
      ? `<img class="figurinha-icone" src="${item.svg}" alt="" />`
      : `<span class="figurinha-icone">${item.emoji}</span>`;
    const orbe = `<span class="orbe orbe-album orbe-album-ia" data-era="ia" data-fonte="ia">${icone}</span>`;
    return `<div class="figurinha descoberta" data-id="${item.id}" role="button" tabindex="0">
      ${orbe}<span class="figurinha-nome">${item.nome}</span>
    </div>`;
  }

  function figurinha(item, descoberta) {
    const icone = descoberta
      ? (item.svg
        ? `<img class="figurinha-icone" src="${item.svg}" alt="" />`
        : `<span class="figurinha-icone">${item.emoji}</span>`)
      : '<span class="figurinha-icone figurinha-oculta">?</span>';
    const nome = descoberta ? item.nome : T.albumOculto;
    const alem = descoberta && ehAlemDoMapaVisivel(catalogo, store, item.id);
    const orbe = descoberta
      ? `<span class="orbe orbe-album" data-era="${item.era}"${atributosOrbeAlemDoMapa(alem, T)}>${icone}</span>`
      : `<span class="orbe orbe-album orbe-oculta">${icone}</span>`;
    const atributosClicaveis = descoberta ? ' role="button" tabindex="0"' : '';
    return `<div class="figurinha ${descoberta ? 'descoberta' : 'oculta'}" data-id="${item.id}"${atributosClicaveis}>
      ${orbe}<span class="figurinha-nome">${nome}${srOnlyAlemDoMapa(alem, T)}</span>
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
        <div class="album-cabecalho-estrelas" aria-hidden="true"></div>
        <img class="album-cabecalho-logo" src="assets/cartas/logo-header.png" alt="" aria-hidden="true" />
        <div class="album-cabecalho-titulo">
          <h2>${T.albumTitulo}</h2>
          <span class="album-cabecalho-contagem"></span>
        </div>
        <button type="button" class="album-fechar">${T.fechar}</button>
      </div>
      <div class="album-corpo"></div>`;

    const corpo = overlay.querySelector('.album-corpo');
    const descobertos = store.getSave().descobertos;

    const totalCanonico = catalogo.allItems().filter((it) => !it.ia).length;
    const feitosCanonico = Object.keys(descobertos)
      .filter((id) => catalogo.getItem(id) && !catalogo.getItem(id).ia).length;
    const itensIA = itensIADescobertos();
    overlay.querySelector('.album-cabecalho-contagem').textContent =
      T.albumContagemGeral(feitosCanonico, totalCanonico, itensIA.length);

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

    // Coleção paralela de interface — não é uma 7ª era canônica. Só aparece
    // quando já existe pelo menos uma criação da IA descoberta.
    if (itensIA.length > 0) {
      const secaoIA = document.createElement('section');
      secaoIA.className = 'album-era album-era-ia';
      secaoIA.dataset.era = 'ia';
      secaoIA.innerHTML = `
        <div class="album-era-cabecalho">
          <span class="album-era-icone">✨</span>
          <h3 class="album-era-nome">${T.albumIATitulo}</h3>
          <span class="album-era-contagem">${T.albumIAContagem(itensIA.length)}</span>
        </div>
        <p class="album-era-ia-texto">${T.albumIATexto}</p>
        <div class="album-grade">
          ${itensIA.map((it) => figurinhaIA(it)).join('')}
        </div>`;
      corpo.appendChild(secaoIA);
    }

    overlay.querySelector('.album-fechar').addEventListener('click', fechar);
    for (const el of overlay.querySelectorAll('.figurinha.descoberta')) {
      el.addEventListener('click', () => carta.abrir(el.dataset.id));
      el.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          carta.abrir(el.dataset.id);
        }
      });
    }
    (raiz || document.body).appendChild(overlay);
  }

  return { abrir, fechar };
}
