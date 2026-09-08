// Indicador de disponibilidade da IA de combinação, ao lado do nome do perfil.
//
// Três estados (data-ia = 'verificando' | 'online' | 'offline'):
//  - verificando: estado neutro enquanto consulta a disponibilidade;
//  - online: navegador com rede + endpoint interno acessível + IA configurada;
//  - offline: sem rede, endpoint inacessível, configuração ausente OU falha
//    real recente de uma geração.
//
// Regras:
//  - nunca expõe chave, nome de segredo nem detalhe interno (o endpoint
//    /api/ia-status já devolve só { disponivel: bool });
//  - não dispara geração paga só para verificar;
//  - considera navigator.onLine + resposta do servidor + gerações reais;
//  - atualiza na hora nos eventos online/offline;
//  - após falha, re-verifica com backoff;
//  - uma geração bem-sucedida => online imediatamente;
//  - uma falha real de rede/serviço na geração => offline + re-checagem;
//  - erro de receita / validação do usuário NÃO é indisponibilidade da IA
//    (o chamador simplesmente não invoca marcarGeracaoFalhou nesses casos);
//  - acessível: texto além da cor + aria-live.

const ENDPOINT = '/api/ia-status';
const BACKOFF_MS = [5000, 10000, 20000, 40000, 60000];
const RECHECK_OK_MS = 120000;

export function montarStatusRede({ el, T, endpoint = ENDPOINT }) {
  let estado = 'verificando';
  let timer = null;
  let falhas = 0;
  let checagemSeq = 0; // ignora respostas de checagens já superadas
  let destruido = false;

  function textoDoEstado() {
    if (estado === 'online') return T.iaEstadoOnline;
    if (estado === 'offline') return T.iaEstadoOffline;
    return T.iaEstadoVerificando;
  }

  function pintar() {
    const txt = textoDoEstado();
    el.dataset.ia = estado;
    // compat com o CSS/marcações antigas: sim | nao | checando
    el.dataset.online = estado === 'online' ? 'sim' : (estado === 'offline' ? 'nao' : 'checando');
    el.textContent = txt;
    el.title = txt;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', `${T.iaEstadoRotulo}: ${txt}`);
  }

  function definir(novo) {
    if (destruido || novo === estado) return;
    estado = novo;
    pintar();
  }

  function agendar(ms) {
    clearTimeout(timer);
    if (destruido) return;
    let d = ms;
    if (d == null) {
      d = BACKOFF_MS[Math.min(falhas, BACKOFF_MS.length - 1)];
      falhas += 1;
    }
    timer = setTimeout(verificar, d);
  }

  async function verificar() {
    if (destruido) return;
    if (window.navigator && window.navigator.onLine === false) {
      definir('offline');
      agendar();
      return;
    }
    if (estado !== 'online') definir('verificando');
    const meu = ++checagemSeq;
    try {
      const resp = await fetch(endpoint, { method: 'GET', cache: 'no-store' });
      if (destruido || meu !== checagemSeq) return;
      if (!resp.ok) { definir('offline'); agendar(); return; }
      const dados = await resp.json().catch(() => null);
      if (destruido || meu !== checagemSeq) return;
      if (dados && dados.disponivel === true) {
        falhas = 0;
        definir('online');
        agendar(RECHECK_OK_MS);
      } else {
        definir('offline');
        agendar();
      }
    } catch {
      if (destruido || meu !== checagemSeq) return;
      definir('offline');
      agendar();
    }
  }

  function aoOnline() {
    falhas = 0;
    verificar();
  }
  function aoOffline() {
    clearTimeout(timer);
    definir('offline');
  }

  window.addEventListener('online', aoOnline);
  window.addEventListener('offline', aoOffline);

  pintar();
  verificar();

  return {
    // geração real bem-sucedida => IA está de pé, agora.
    marcarGeracaoOk() {
      if (destruido) return;
      falhas = 0;
      definir('online');
      agendar(RECHECK_OK_MS);
    },
    // falha REAL de rede/serviço numa geração => offline + re-checagem com backoff.
    // (o chamador não invoca isto para erro de receita/validação do usuário.)
    marcarGeracaoFalhou() {
      if (destruido) return;
      falhas = 0;
      definir('offline');
      agendar();
    },
    estado: () => estado,
    verificar,
    destruir() {
      destruido = true;
      clearTimeout(timer);
      window.removeEventListener('online', aoOnline);
      window.removeEventListener('offline', aoOffline);
    },
  };
}
