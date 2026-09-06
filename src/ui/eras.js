// Linha do tempo das eras: overlay só-visualização com o progresso de cada
// uma. Lê um snapshot de save.descobertos a cada abrir().
import { progressoPorEra } from '../engine/eras.js';

export function montarLinhaDoTempo({ raiz, store, catalogo, T }) {
  let overlay = null;

  function fechar() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
  }

  function abrir() {
    fechar();
    overlay = document.createElement('div');
    overlay.className = 'eras-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', T.erasTitulo);
    overlay.innerHTML = `
      <div class="eras-cabecalho">
        <h2>${T.erasTitulo}</h2>
        <button type="button" class="eras-fechar">${T.fechar}</button>
      </div>
      <div class="eras-lista"></div>`;

    const lista = overlay.querySelector('.eras-lista');
    const progresso = progressoPorEra(store.getSave().descobertos, catalogo);
    for (const { era, descobertos, total } of progresso) {
      const linha = document.createElement('div');
      linha.className = 'era-linha';
      linha.dataset.era = era;
      if (descobertos > 0) linha.classList.add('alcancada');
      const pct = total ? Math.round((descobertos / total) * 100) : 0;
      linha.innerHTML = `
        <span class="era-linha-icone">${T.erasIcone[era] || '✨'}</span>
        <div class="era-linha-corpo">
          <div class="era-linha-topo">
            <span class="era-linha-nome">${T.eras[era] || era}</span>
            <span class="era-linha-contagem">${descobertos} / ${total}</span>
          </div>
          <div class="era-barra"><span class="era-barra-cheia" style="width:${pct}%"></span></div>
        </div>`;
      lista.appendChild(linha);
    }

    overlay.querySelector('.eras-fechar').addEventListener('click', fechar);
    (raiz || document.body).appendChild(overlay);
  }

  return { abrir, fechar };
}
