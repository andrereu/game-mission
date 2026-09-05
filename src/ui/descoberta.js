import { T } from '../data/textos.js';

function iconeGrande(item) {
  if (item.svg) {
    return `<img class="descoberta-icone" src="${item.svg}" alt="" />`;
  }
  return `<div class="descoberta-icone">${item.emoji}</div>`;
}

function iconeMini(item) {
  if (!item) return '';
  if (item.svg) return `<img class="icone-mini" src="${item.svg}" alt="" />`;
  return `<span>${item.emoji}</span>`;
}

function tocarBipe() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    o.start();
    o.stop(ctx.currentTime + 0.3);
  } catch {
    /* sem som */
  }
}

export function mostrarDescoberta({ item, combo, catalogo, comSom }) {
  return new Promise((resolve) => {
    const raiz = document.getElementById('overlay-raiz') || document.body;
    const over = document.createElement('div');
    over.className = 'descoberta-overlay';
    over.setAttribute('role', 'dialog');
    over.setAttribute('aria-label', item.nome);
    over.tabIndex = -1;

    const paiA = combo ? catalogo.getItem(combo.a) : null;
    const paiB = combo ? catalogo.getItem(combo.b) : null;
    const origem = paiA && paiB
      ? `<p class="descoberta-origem">${iconeMini(paiA)} ${paiA.nome} + ${iconeMini(paiB)} ${paiB.nome}</p>`
      : '';

    over.innerHTML = `
      <div class="descoberta-cartao">
        ${iconeGrande(item)}
        <p class="descoberta-selo">${T.seloNovo}</p>
        <h2 class="descoberta-nome">${item.nome}</h2>
        ${origem}
        <p class="descoberta-texto">${combo && combo.texto ? combo.texto : ''}</p>
        <button type="button" class="descoberta-fechar">${T.fechar}</button>
      </div>`;

    function fechar() {
      over.removeEventListener('click', fechar);
      document.removeEventListener('keydown', fechar);
      over.remove();
      resolve();
    }

    over.addEventListener('click', fechar);
    document.addEventListener('keydown', fechar);
    raiz.appendChild(over);
    over.focus();
    if (comSom) tocarBipe();
  });
}
