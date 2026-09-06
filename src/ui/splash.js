// Tela de abertura real (ver index.html — o markup já vem no HTML, sem
// esperar JS, pra nunca dar flash branco). Este módulo só decide QUANDO ela
// some: depois do boot (src/app.js: iniciar()), com uma duração mínima
// visível e um timeout de segurança pra nunca travar a entrada no jogo.
const CHAVE_SESSAO = 'misturaria-splash-visto';
const DURACAO_MINIMA_MS = 800;
const TIMEOUT_SEGURANCA_MS = 4000;

let inicio = null;
let escondida = false;
let timerSeguranca = null;

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

// Chamado assim que src/app.js começa a rodar. Se o splash já foi visto
// nesta sessão de aba (reload interno pra trocar de perfil, ativar sync
// etc.), ele já está com display:none via o script inline do index.html —
// aqui só confirmamos o estado e não armamos nada.
export function prepararSplash() {
  inicio = Date.now();
  escondida = jaViuNestaSessao();
  if (escondida) return;
  timerSeguranca = setTimeout(() => esconderSplash(), TIMEOUT_SEGURANCA_MS);
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
  if (!el) return;

  const decorrido = inicio ? Date.now() - inicio : DURACAO_MINIMA_MS;
  const espera = Math.max(0, DURACAO_MINIMA_MS - decorrido);
  setTimeout(() => {
    el.classList.add('splash-saindo');
    const remover = () => el.remove();
    el.addEventListener('transitionend', remover, { once: true });
    setTimeout(remover, 500); // rede de segurança se transitionend não disparar
  }, espera);
}
