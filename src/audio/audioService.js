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
//
// BUG CORRIGIDO (rodada "Áudio — correção e assinatura de Nova Era"): em
// notebook real, speechSynthesis funcionava mas os efeitos Web Audio não
// ficavam audíveis. Causa: o AudioContext nasce `suspended` (política de
// autoplay do Chrome) e nunca era retomado — os osciladores eram agendados
// normalmente, mas o grafo de áudio nunca chegava a processar/soar. Cada som
// tocava "no vazio". Corrigido com `resume()` sempre que o contexto não está
// `running`, mais um desbloqueio antecipado no 1º gesto real do usuário em
// qualquer lugar da página (não só quando um efeito é pedido).

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

  // AudioContext nasce (ou pode voltar a ficar, ex.: aba escondida)
  // `suspended` — sem isso NENHUM oscilador soa, mesmo agendado certinho.
  // resume() é seguro de chamar sempre (idempotente quando já `running`).
  function retomarSeSuspenso(c) {
    if (c && c.state !== 'running' && typeof c.resume === 'function') {
      try { c.resume().catch(() => {}); } catch { /* navegador sem Promise aqui: ignora */ }
    }
  }

  // desbloqueio antecipado: cria e retoma o contexto no 1º gesto real do
  // usuário em QUALQUER lugar da página (ex.: o próprio toque em "Criar e
  // jogar" nos Perfis) — assim, quando o primeiro efeito do Canvas for
  // pedido, o contexto já está `running` em vez de negociar isso na hora.
  function desbloquear() {
    retomarSeSuspenso(contexto());
  }
  if (typeof document !== 'undefined') {
    const eventos = ['pointerdown', 'touchstart', 'keydown'];
    for (const ev of eventos) {
      document.addEventListener(ev, desbloquear, { once: true, capture: true, passive: true });
    }
  }

  // um "tom": envelope curto (ataque rápido + decaimento exponencial) +
  // oscilador opcionalmente varrendo de freq -> freqFinal. Bloco único
  // reaproveitado por todos os efeitos abaixo — nenhum arquivo de áudio, só
  // síntese. O ataque (subida linear de ~8ms antes do pico) evita o "clique"
  // seco de saltar direto pro ganho máximo, sem alongar o som.
  function tom({
    freq, freqFinal = null, duracaoMs, tipo = 'sine', ganho = 0.1, atraso = 0,
  }) {
    if (!somAtivo()) return;
    const c = contexto();
    if (!c) return;
    retomarSeSuspenso(c);
    try {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = tipo;
      o.connect(g);
      g.connect(c.destination);
      const inicio = c.currentTime + atraso;
      const ataqueFim = inicio + 0.008;
      const fim = inicio + duracaoMs / 1000;
      o.frequency.setValueAtTime(freq, inicio);
      if (freqFinal != null) o.frequency.exponentialRampToValueAtTime(Math.max(freqFinal, 1), fim);
      g.gain.setValueAtTime(0.0001, inicio);
      g.gain.linearRampToValueAtTime(ganho, ataqueFim);
      g.gain.exponentialRampToValueAtTime(0.001, fim);
      o.start(inicio);
      o.stop(fim + 0.02);
    } catch {
      /* sem som: nunca quebra o jogo */
    }
  }

  // ---- efeitos do loop jogável ----
  // Ganho/duração calibrados pra ficarem claramente audíveis num notebook
  // real com volume normal, sem virar sirene: acima do antigo (0.04-0.07,
  // imperceptível), abaixo de um "alarme" (>0.2).
  function tocarSelecao() { tom({ freq: 620, duracaoMs: 110, ganho: 0.12 }); }
  function tocarWhoosh() { tom({ freq: 380, freqFinal: 190, duracaoMs: 160, tipo: 'triangle', ganho: 0.1 }); }
  function tocarAproximacao() { tom({ freq: 260, freqFinal: 480, duracaoMs: 120, tipo: 'triangle', ganho: 0.11 }); }
  function tocarCombinacaoValida() {
    tom({ freq: 660, duracaoMs: 100, ganho: 0.13 });
    tom({
      freq: 880, duracaoMs: 170, ganho: 0.13, atraso: 0.07,
    });
  }
  function tocarNada() { tom({ freq: 180, duracaoMs: 190, ganho: 0.09 }); }
  // assinatura de "nova descoberta": pequeno arpejo de 3 notas, sempre curto,
  // tocado antes/junto da celebração já existente (carta + voo) — nunca a
  // substitui, só anuncia que é um item inédito. Mais discreta que a
  // assinatura de Nova Era (ver tocarNovaEra), que é o evento maior.
  function tocarNovaDescoberta() {
    tom({ freq: 523.25, duracaoMs: 100, ganho: 0.11 });
    tom({
      freq: 659.25, duracaoMs: 100, ganho: 0.11, atraso: 0.08,
    });
    tom({
      freq: 783.99, duracaoMs: 180, ganho: 0.11, atraso: 0.16,
    });
  }

  // ---- assinatura sonora de Nova Era ----
  // Claramente mais importante que "nova descoberta": ~1,3s em 3 fases —
  // 1) subida/energia (sweep ascendente, ganho crescendo);
  // 2) impacto suave (golpe curto e grave, marca a chegada);
  // 3) brilho/chime final (acorde brilhante, decaimento mais longo).
  // Toca ANTES/JUNTO da celebração visual existente (mascote em era-nova.js)
  // — nunca a substitui, nem mexe nela.
  function tocarNovaEra() {
    if (!somAtivo()) return;
    const c = contexto();
    if (!c) return;
    retomarSeSuspenso(c);
    try {
      const t0 = c.currentTime;

      // 1) subida/energia — sweep ascendente com ganho crescendo por baixo
      const oSobe = c.createOscillator();
      const gSobe = c.createGain();
      oSobe.type = 'sawtooth';
      oSobe.connect(gSobe);
      gSobe.connect(c.destination);
      oSobe.frequency.setValueAtTime(220, t0);
      oSobe.frequency.exponentialRampToValueAtTime(660, t0 + 0.42);
      gSobe.gain.setValueAtTime(0.0001, t0);
      gSobe.gain.linearRampToValueAtTime(0.1, t0 + 0.34);
      gSobe.gain.exponentialRampToValueAtTime(0.001, t0 + 0.46);
      oSobe.start(t0);
      oSobe.stop(t0 + 0.48);

      // 2) impacto suave — golpe curto e grave logo em seguida, marca a chegada
      const tImpacto = t0 + 0.44;
      const oImpacto = c.createOscillator();
      const gImpacto = c.createGain();
      oImpacto.type = 'sine';
      oImpacto.connect(gImpacto);
      gImpacto.connect(c.destination);
      oImpacto.frequency.setValueAtTime(200, tImpacto);
      oImpacto.frequency.exponentialRampToValueAtTime(85, tImpacto + 0.2);
      gImpacto.gain.setValueAtTime(0.0001, tImpacto);
      gImpacto.gain.linearRampToValueAtTime(0.16, tImpacto + 0.02);
      gImpacto.gain.exponentialRampToValueAtTime(0.001, tImpacto + 0.24);
      oImpacto.start(tImpacto);
      oImpacto.stop(tImpacto + 0.26);

      // 3) brilho/chime final — pequeno acorde maior brilhante (A5-C#6-E6),
      // decaimento mais longo, o pico de toda a assinatura
      const tChime = tImpacto + 0.18;
      const notas = [880, 1108.73, 1318.51];
      notas.forEach((freq, i) => {
        const inicio = tChime + i * 0.025;
        const oNota = c.createOscillator();
        const gNota = c.createGain();
        oNota.type = 'sine';
        oNota.connect(gNota);
        gNota.connect(c.destination);
        oNota.frequency.setValueAtTime(freq, inicio);
        gNota.gain.setValueAtTime(0.0001, inicio);
        gNota.gain.linearRampToValueAtTime(0.1, inicio + 0.03);
        gNota.gain.exponentialRampToValueAtTime(0.001, inicio + 0.58);
        oNota.start(inicio);
        oNota.stop(inicio + 0.6);
      });
    } catch {
      /* sem som: a celebração visual segue normalmente */
    }
  }

  // ---- fala: nome do item/resultado, preferindo voz pt-BR ----
  //
  // BUG CORRIGIDO (rodada "Compatibilidade de voz — Android 14"): tablet
  // Android 14 tocava os efeitos Web Audio normalmente, mas a fala nunca
  // saía — mesmo notebook e um celular Android 16 falavam sem problema.
  // Causa provável, documentada em várias implementações Android de
  // speechSynthesis: `getVoices()` volta vazia por mais tempo que o normal
  // (às vezes o evento `voiceschanged` demora ou nunca chega a disparar
  // antes do 1º speak()), e falar imediatamente nesse estado pode resultar
  // em silêncio total, não só numa voz "errada". Corrigido com espera
  // limitada (nunca indefinida) antes da 1ª fala quando getVoices() está
  // vazia, sem nunca EXIGIR uma voz encontrada pra realmente falar.
  const ESPERA_VOZES_MS = 300; // limite curto: não trava a fala além disso

  function obterVozes() {
    if (typeof speechSynthesis === 'undefined') return [];
    try { return speechSynthesis.getVoices() || []; } catch { return []; }
  }

  let vozPreferida = null;
  function resolverVoz() {
    const vozes = obterVozes();
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
    // resolverVoz() é tentada de novo a cada falar()). Um único listener
    // fixo por instância do serviço — nunca duplicado por chamada de falar().
    try {
      speechSynthesis.addEventListener?.('voiceschanged', () => { vozPreferida = resolverVoz(); });
    } catch { /* navegador sem esse evento: segue sem voz preferida fixada cedo */ }
  }

  // debounce/cancelamento + prioridade: um novo toque cancela a fala
  // anterior (mesmo nível), mas nunca interrompe uma fala de prioridade
  // maior já em andamento (resultado > seleção). `token` evita que o
  // onend/onerror de uma fala JÁ cancelada resete o estado da fala atual,
  // e também identifica qual pedido "venceu" quando há espera por vozes.
  let falandoNivel = -1;
  let token = 0;
  // pedido ainda esperando getVoices() carregar (no máx. ESPERA_VOZES_MS) —
  // um novo falar() cancela essa espera antes de começar a sua própria,
  // exatamente como cancela uma fala já em andamento.
  let esperaPendente = null;
  function cancelarEsperaPendente() {
    if (esperaPendente) { esperaPendente(); esperaPendente = null; }
  }

  // dispara a fala de verdade — nunca exige voz encontrada: sem uma voz
  // pt-BR (ou nenhuma voz), ainda assim chama speak() com só `lang`
  // definido, deixando o sistema escolher (fallback do SO/navegador).
  function falarAgora(texto, meuToken) {
    if (token !== meuToken) return; // um pedido mais novo já assumiu
    try {
      // aba retomada de um estado pausado, ou o SO pausou a síntese sozinho
      // (visto em alguns Android): sem resume(), speak() pode não sair som
      // nenhum mesmo sem lançar erro.
      if (speechSynthesis.paused && typeof speechSynthesis.resume === 'function') {
        speechSynthesis.resume();
      }
      if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
      if (!vozPreferida) vozPreferida = resolverVoz();
      const u = new SpeechSynthesisUtterance(String(texto));
      u.lang = 'pt-BR';
      if (vozPreferida) u.voice = vozPreferida; // achou: usa; não achou: fallback do sistema
      const limpar = () => { if (token === meuToken) falandoNivel = -1; };
      u.onend = limpar;
      u.onerror = limpar;
      speechSynthesis.speak(u);
    } catch {
      // API existe mas o SO não conseguiu sintetizar: falha em silêncio,
      // nunca quebra o jogo (não é pra "mascarar" — é pra não travar nada).
      if (token === meuToken) falandoNivel = -1;
    }
  }

  function falar(texto, prioridade) {
    if (!vozAtiva() || !texto) return;
    if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return;
    const nivel = PRIORIDADE[prioridade] ?? 0;
    if (falandoNivel > nivel) return; // algo mais prioritário está falando: ignora

    cancelarEsperaPendente(); // novo pedido: qualquer espera anterior perde
    const meuToken = ++token;
    falandoNivel = nivel;

    if (obterVozes().length > 0) {
      falarAgora(texto, meuToken);
      return;
    }

    // getVoices() vazia agora (cenário Android relatado): espera limitada
    // por 'voiceschanged' OU o timeout, o que vier primeiro — nunca os
    // dois (um `disparado` local evita falar duas vezes pro mesmo pedido).
    let disparado = false;
    const disparar = () => {
      if (disparado) return;
      disparado = true;
      try { speechSynthesis.removeEventListener?.('voiceschanged', aoVozesCarregarem); } catch { /* nada */ }
      clearTimeout(timer);
      falarAgora(texto, meuToken);
    };
    const aoVozesCarregarem = () => disparar();
    const timer = setTimeout(disparar, ESPERA_VOZES_MS);
    try { speechSynthesis.addEventListener?.('voiceschanged', aoVozesCarregarem); } catch { /* nada */ }
    esperaPendente = () => {
      disparado = true; // marca como "resolvida" sem chamar falarAgora
      try { speechSynthesis.removeEventListener?.('voiceschanged', aoVozesCarregarem); } catch { /* nada */ }
      clearTimeout(timer);
    };
  }
  function falarSelecao(nome) { falar(nome, 'selecao'); }
  function falarResultado(nome) { falar(nome, 'resultado'); }
  function cancelarFala() {
    cancelarEsperaPendente();
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
    tocarNovaEra,
    falarSelecao,
    falarResultado,
    cancelarFala,
  };
}
