// Comemoração ao alcançar uma era nova — o mascote feliz aparece por cima do
// jogo. Dispara depois do overlay de descoberta normal (ver app.js).
//
// Nunca causa layout shift: renderiza como overlay `position: fixed` (fora do
// fluxo do documento), num backdrop `pointer-events: none` para não bloquear a
// interação com o Canvas/drawer por baixo. Fecha sozinho após ~2,5 s; um toque
// no cartão antecipa o fechamento. Descobertas consecutivas nunca empilham
// mascotes — a comemoração anterior é dispensada antes da nova.
import { T } from '../data/textos.js';
import { ERAS } from '../engine/catalogo.js';

const DURACAO_MS = 2500;

let ativo = null; // { over, limpar } — no máximo uma comemoração por vez

function prefereMovimentoReduzido() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function tocarSino(comSom) {
  if (!comSom) return;
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

export function mostrarEraNova({
  era, progresso, comSom, ms = DURACAO_MS,
}) {
  return new Promise((resolve) => {
    // descobertas consecutivas: dispensa a comemoração anterior antes da nova
    // (sem empilhar mascotes, sem overlay órfão).
    ativo?.limpar();

    const raiz = document.getElementById('overlay-raiz') || document.body;
    const over = document.createElement('div');
    over.className = 'era-nova-overlay';
    over.setAttribute('role', 'status');
    over.setAttribute('aria-live', 'polite');
    over.setAttribute('aria-label', `${T.eraNovaSelo} ${T.eras[era] || era}`);
    if (prefereMovimentoReduzido()) over.dataset.semAnimacao = '';

    const feitos = new Set((progresso || []).filter((p) => p.descobertos > 0).map((p) => p.era));
    const pontos = ERAS.map((e) => {
      const classe = e === era ? 'agora' : (feitos.has(e) ? 'feita' : '');
      return `<span class="era-ponto ${classe}"></span>`;
    }).join('');

    over.innerHTML = `
      <div class="era-nova-cartao" role="button" tabindex="0">
        <img class="era-nova-mascote" src="assets/cartas/mascote-feliz.png" alt="" />
        <div class="era-nova-icone">${T.erasIcone[era] || '✨'}</div>
        <p class="era-nova-selo">${T.eraNovaSelo}</p>
        <h2 class="era-nova-nome">${T.eras[era] || era}</h2>
        <div class="era-nova-pontos">${pontos}</div>
      </div>`;

    let encerrado = false;
    let timer = null;
    function limpar() {
      if (encerrado) return;
      encerrado = true;
      clearTimeout(timer); // limpa o timer ao desmontar
      over.removeEventListener('pointerdown', limpar);
      over.removeEventListener('keydown', aoTeclar);
      over.remove();
      if (ativo && ativo.over === over) ativo = null;
      resolve();
    }
    function aoTeclar(ev) {
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Escape') { ev.preventDefault(); limpar(); }
    }

    timer = setTimeout(limpar, ms);
    over.addEventListener('pointerdown', limpar); // um toque no cartão antecipa
    over.addEventListener('keydown', aoTeclar);

    raiz.appendChild(over);
    ativo = { over, limpar };
    tocarSino(comSom);
  });
}
