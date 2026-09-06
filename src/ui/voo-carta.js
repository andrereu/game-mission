// Animação de recompensa: um elemento (a própria carta do flash de 1ª
// descoberta) "voa" e encolhe até um destino real na tela — o botão do
// Álbum, ou o cabeçalho do inventário quando o Álbum está escondido (Modo
// Pequenos). Sempre a partir de getBoundingClientRect() no momento do voo,
// nunca coordenadas fixas — funciona depois de girar a tela ou redimensionar.
// Sem Web Animations API (jsdom, navegador muito antigo) ou com
// prefers-reduced-motion: cai num fade simples no lugar, sem voo.

const DURACAO_VOO_MS = 900;
const DURACAO_PULSO_MS = 550;

function prefereMovimentoReduzido() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function pulsarDestino(destinoEl) {
  if (!destinoEl) return;
  destinoEl.classList.add('recebendo-carta');
  setTimeout(() => destinoEl.classList.remove('recebendo-carta'), DURACAO_PULSO_MS);
}

function finalizarComFade(origemEl, destinoEl, aoTerminar) {
  origemEl.style.transition = 'opacity 220ms ease, transform 220ms ease';
  origemEl.style.transform = 'scale(0.94)';
  origemEl.style.opacity = '0';
  setTimeout(() => {
    origemEl.remove();
    pulsarDestino(destinoEl);
    aoTerminar?.();
  }, 220);
}

// `origemEl` é removido do DOM ao final (sucesso ou cancelamento) — nunca
// deixa clone pra trás. `destinoEl` pode ser null (destino sumiu da tela
// entre o disparo e a animação, ex: resize): aí só recolhe sem voo.
export function animarVooParaDestino({ origemEl, destinoEl, aoTerminar }) {
  if (!origemEl) { aoTerminar?.(); return; }
  if (!destinoEl || typeof origemEl.getBoundingClientRect !== 'function') {
    finalizarComFade(origemEl, destinoEl, aoTerminar);
    return;
  }

  if (prefereMovimentoReduzido() || typeof origemEl.animate !== 'function') {
    finalizarComFade(origemEl, destinoEl, aoTerminar);
    return;
  }

  const origemRect = origemEl.getBoundingClientRect();
  const destinoRect = destinoEl.getBoundingClientRect();

  if (!origemRect.width || !destinoRect.width) {
    finalizarComFade(origemEl, destinoEl, aoTerminar);
    return;
  }

  const dx = (destinoRect.left + destinoRect.width / 2) - (origemRect.left + origemRect.width / 2);
  const dy = (destinoRect.top + destinoRect.height / 2) - (origemRect.top + origemRect.height / 2);
  const proporcao = destinoRect.width / origemRect.width;
  const escalaFinal = Math.max(0.08, Math.min(0.3, proporcao));
  const arco = Math.min(90, Math.max(30, Math.abs(dy) * 0.35));

  origemEl.style.position = 'fixed';
  origemEl.style.left = `${origemRect.left}px`;
  origemEl.style.top = `${origemRect.top}px`;
  origemEl.style.margin = '0';
  origemEl.style.zIndex = '80';
  origemEl.style.pointerEvents = 'none';

  let terminou = false;
  function encerrar() {
    if (terminou) return;
    terminou = true;
    origemEl.remove();
    pulsarDestino(destinoEl);
    aoTerminar?.();
  }

  const animacao = origemEl.animate([
    { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
    {
      transform: `translate(${dx * 0.5}px, ${dy * 0.5 - arco}px) scale(${(1 + escalaFinal) / 2})`,
      opacity: 1,
      offset: 0.55,
    },
    { transform: `translate(${dx}px, ${dy}px) scale(${escalaFinal})`, opacity: 0.25, offset: 1 },
  ], { duration: DURACAO_VOO_MS, easing: 'cubic-bezier(.32,.6,.4,1)', fill: 'forwards' });

  animacao.onfinish = encerrar;
  animacao.oncancel = encerrar;
}
