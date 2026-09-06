// Comemoração ao alcançar uma era nova. Dispara depois do overlay de
// descoberta normal (ver app.js). Fecha em qualquer clique/tecla.
import { T } from '../data/textos.js';
import { ERAS } from '../engine/catalogo.js';

export function mostrarEraNova({ era, progresso, comSom }) {
  return new Promise((resolve) => {
    const raiz = document.getElementById('overlay-raiz') || document.body;
    const over = document.createElement('div');
    over.className = 'era-nova-overlay';
    over.setAttribute('role', 'dialog');
    over.setAttribute('aria-label', T.eras[era] || era);
    over.tabIndex = -1;

    const feitos = new Set((progresso || []).filter((p) => p.descobertos > 0).map((p) => p.era));
    const pontos = ERAS.map((e) => {
      const classe = e === era ? 'agora' : (feitos.has(e) ? 'feita' : '');
      return `<span class="era-ponto ${classe}"></span>`;
    }).join('');

    over.innerHTML = `
      <div class="era-nova-cartao">
        <div class="era-nova-icone">${T.erasIcone[era] || '✨'}</div>
        <p class="era-nova-selo">${T.eraNovaSelo}</p>
        <h2 class="era-nova-nome">${T.eras[era] || era}</h2>
        <div class="era-nova-pontos">${pontos}</div>
        <button type="button" class="era-nova-fechar">${T.fechar}</button>
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
    if (comSom) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = 520;
        g.gain.setValueAtTime(0.18, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        o.start();
        o.stop(ctx.currentTime + 0.5);
      } catch {
        /* sem som */
      }
    }
  });
}
