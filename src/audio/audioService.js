// Camada central de áudio do loop jogável (Canvas): efeitos curtos via Web
// Audio (osciladores, nunca arquivo/API paga) + nomeação por speechSynthesis
// (nunca API paga, nunca gera arquivo de fala). Único ponto que toca som ou
// fala no Canvas — quem chama (canvas.js/app.js) só invoca os métodos aqui,
// nunca cria AudioContext/utterance por conta própria.
//
// Duas preferências independentes, resolvidas pelo chamador e passadas como
// getters (mesmo padrão de `iaElegivel` em app.js):
//   getSom -> liga/desliga TODOS os efeitos (tocarX)
//   getVoz -> liga/desliga só a fala (falarSelecao/falarResultado)

const PRIORIDADE = { selecao: 0, resultado: 1 };

export function criarAudioService({ getSom, getVoz } = {}) {
  const somAtivo = typeof getSom === 'function' ? getSom : () => true;
  const vozAtiva = typeof getVoz === 'function' ? getVoz : () => false;

  let ctx = null;
  function contexto() {
    if (ctx) return ctx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      ctx = new Ctx();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  // um "tom": envelope curto de ganho + oscilador opcionalmente varrendo de
  // freq -> freqFinal. Bloco único reaproveitado por todos os efeitos abaixo
  // — nenhum arquivo de áudio, só síntese.
  function tom({
    freq, freqFinal = null, duracaoMs, tipo = 'sine', ganho = 0.06,
  }) {
    if (!somAtivo()) return;
    const c = contexto();
    if (!c) return;
    try {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = tipo;
      o.frequency.value = freq;
      o.connect(g);
      g.connect(c.destination);
      const agora = c.currentTime;
      const fim = agora + duracaoMs / 1000;
      g.gain.setValueAtTime(ganho, agora);
      g.gain.exponentialRampToValueAtTime(0.001, fim);
      if (freqFinal != null && o.frequency.exponentialRampToValueAtTime) {
        o.frequency.exponentialRampToValueAtTime(Math.max(freqFinal, 1), fim);
      }
      o.start(agora);
      o.stop(fim);
    } catch {
      /* sem som: nunca quebra o jogo */
    }
  }

  // ---- efeitos do loop jogável ----
  function tocarSelecao() { tom({ freq: 620, duracaoMs: 90, ganho: 0.05 }); }
  function tocarWhoosh() { tom({ freq: 340, freqFinal: 170, duracaoMs: 140, tipo: 'sine', ganho: 0.04 }); }
  function tocarAproximacao() { tom({ freq: 260, freqFinal: 460, duracaoMs: 110, tipo: 'triangle', ganho: 0.05 }); }
  function tocarCombinacaoValida() {
    tom({ freq: 660, duracaoMs: 90, ganho: 0.07 });
    setTimeout(() => tom({ freq: 880, duracaoMs: 150, ganho: 0.07 }), 70);
  }
  function tocarNada() { tom({ freq: 180, duracaoMs: 180, ganho: 0.06 }); }
  // assinatura de "nova descoberta": pequeno arpejo de 3 notas, sempre curto,
  // tocado antes/junto da celebração já existente (carta + voo) — nunca a
  // substitui, só anuncia que é um item inédito.
  function tocarNovaDescoberta() {
    tom({ freq: 523.25, duracaoMs: 90, ganho: 0.06 });
    setTimeout(() => tom({ freq: 659.25, duracaoMs: 90, ganho: 0.06 }), 80);
    setTimeout(() => tom({ freq: 783.99, duracaoMs: 170, ganho: 0.06 }), 160);
  }

  // ---- fala: nome do item/resultado, preferindo voz pt-BR ----
  let vozPreferida = null;
  function resolverVoz() {
    if (typeof speechSynthesis === 'undefined') return null;
    let vozes = [];
    try { vozes = speechSynthesis.getVoices() || []; } catch { vozes = []; }
    if (!vozes.length) return null;
    return vozes.find((v) => v.lang === 'pt-BR')
      || vozes.find((v) => (v.lang || '').toLowerCase() === 'pt_br')
      || vozes.find((v) => (v.lang || '').toLowerCase().startsWith('pt-br'))
      || vozes.find((v) => (v.lang || '').toLowerCase().startsWith('pt'))
      || null;
  }
  if (typeof speechSynthesis !== 'undefined') {
    vozPreferida = resolverVoz();
    // getVoices() costuma vir vazia no 1º tick em vários navegadores — a
    // lista real chega depois, via este evento (nunca falha se não disparar:
    // resolverVoz() é tentada de novo a cada falar()).
    try {
      speechSynthesis.addEventListener?.('voiceschanged', () => { vozPreferida = resolverVoz(); });
    } catch { /* navegador sem esse evento: segue sem voz preferida fixada cedo */ }
  }

  // debounce/cancelamento + prioridade: um novo toque cancela a fala
  // anterior (mesmo nível), mas nunca interrompe uma fala de prioridade
  // maior já em andamento (resultado > seleção). `token` evita que o
  // onend/onerror de uma fala JÁ cancelada resete o estado da fala atual.
  let falandoNivel = -1;
  let token = 0;
  function falar(texto, prioridade) {
    if (!vozAtiva() || !texto) return;
    if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return;
    const nivel = PRIORIDADE[prioridade] ?? 0;
    if (falandoNivel > nivel) return; // algo mais prioritário está falando: ignora
    try {
      speechSynthesis.cancel();
      if (!vozPreferida) vozPreferida = resolverVoz();
      const u = new SpeechSynthesisUtterance(String(texto));
      u.lang = 'pt-BR';
      if (vozPreferida) u.voice = vozPreferida;
      const meuToken = ++token;
      falandoNivel = nivel;
      const limpar = () => { if (token === meuToken) falandoNivel = -1; };
      u.onend = limpar;
      u.onerror = limpar;
      speechSynthesis.speak(u);
    } catch {
      /* sem voz: nunca quebra o jogo */
      falandoNivel = -1;
    }
  }
  function falarSelecao(nome) { falar(nome, 'selecao'); }
  function falarResultado(nome) { falar(nome, 'resultado'); }
  function cancelarFala() {
    try { speechSynthesis?.cancel(); } catch { /* nada */ }
    falandoNivel = -1;
  }

  return {
    tocarSelecao,
    tocarWhoosh,
    tocarAproximacao,
    tocarCombinacaoValida,
    tocarNada,
    tocarNovaDescoberta,
    falarSelecao,
    falarResultado,
    cancelarFala,
  };
}
