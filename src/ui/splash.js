// Tela de abertura real (ver index.html — o markup já vem no HTML, sem
// esperar JS, pra nunca dar flash branco). Este módulo decide QUANDO ela
// some: depois do boot (src/app.js: iniciar()), com uma duração mínima
// visível — pra dar sensação real de entrada, não um flash — e um timeout de
// segurança pra nunca travar o acesso ao jogo. Também cuida das frases
// curtas que alternam enquanto o boot roda (nunca percentual falso).
const CHAVE_SESSAO = 'misturaria-splash-visto';
const DURACAO_MINIMA_MS = 2000;
const TIMEOUT_SEGURANCA_MS = 4500;
const CADENCIA_FRASE_MS = 650;

const FRASES = [
  'Organizando os elementos…',
  'Acendendo as estrelas…',
  'Preparando novas descobertas…',
  'Abrindo o Misturária…',
];

let inicio = null;
let escondida = false;
let timerSeguranca = null;
let timerFrase = null;
let indiceFrase = 0;

function jaViuNestaSessao() {
  try {
    return sessionStorage.getItem(CHAVE_SESSAO) === '1';
  } catch {
    return false; // sem sessionStorage (modo privado etc.): sempre mostra
  }
}

function marcarComoVisto() {
  try {
    sessionStorage.setItem(CHAVE_SESSAO, '1');
  } catch { /* segue sem persistir — não é crítico */ }
}

function iniciarFrases() {
  const el = document.getElementById('splash-status');
  if (!el) return;
  indiceFrase = 0;
  el.textContent = FRASES[0];
  timerFrase = setInterval(() => {
    indiceFrase = (indiceFrase + 1) % FRASES.length;
    el.classList.add('splash-status-trocando');
    setTimeout(() => {
      el.textContent = FRASES[indiceFrase];
      el.classList.remove('splash-status-trocando');
    }, 140);
  }, CADENCIA_FRASE_MS);
}

function pararFrases() {
  clearInterval(timerFrase);
  timerFrase = null;
}

// Chamado assim que src/app.js começa a rodar. Se o splash já foi visto
// nesta sessão de aba (reload interno pra trocar de perfil, ativar sync
// etc.), ele já está com display:none via o script inline do index.html —
// aqui só confirmamos o estado e não armamos nada.
export function prepararSplash() {
  inicio = Date.now();
  escondida = jaViuNestaSessao();
  if (escondida) return;
  timerSeguranca = setTimeout(() => esconderSplash(), TIMEOUT_SEGURANCA_MS);
  iniciarFrases();
}

// Chamado quando o boot termina (com ou sem perfil ativo). Segura uma
// duração mínima visível se o boot foi rápido demais, mas nunca atrasa além
// disso — e o timeout de segurança acima garante que isto roda de qualquer
// jeito mesmo se algo travar antes.
export function esconderSplash() {
  if (escondida) return;
  escondida = true;
  clearTimeout(timerSeguranca);
  marcarComoVisto();

  const el = document.getElementById('splash');
  if (!el) { pararFrases(); return; }

  const decorrido = inicio ? Date.now() - inicio : DURACAO_MINIMA_MS;
  const espera = Math.max(0, DURACAO_MINIMA_MS - decorrido);
  setTimeout(() => {
    pararFrases();
    el.classList.add('splash-saindo');
    const remover = () => el.remove();
    el.addEventListener('transitionend', remover, { once: true });
    setTimeout(remover, 500); // rede de segurança se transitionend não disparar
  }, espera);
}
