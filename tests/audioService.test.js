import test from 'node:test';
import assert from 'node:assert/strict';
import { criarAudioService } from '../src/audio/audioService.js';

function contarOsciladores() {
  let n = 0;
  const OrigCtx = window.AudioContext;
  class ContaOsciladores extends OrigCtx {
    createOscillator() {
      n += 1;
      return super.createOscillator();
    }
  }
  window.AudioContext = ContaOsciladores;
  return {
    total: () => n,
    restaurar: () => { window.AudioContext = OrigCtx; },
  };
}

test('efeitos (tocarX) só soam quando getSom() é true', () => {
  let somLigado = false;
  const audio = criarAudioService({ getSom: () => somLigado, getVoz: () => false });
  const contador = contarOsciladores();
  try {
    audio.tocarSelecao();
    assert.equal(contador.total(), 0, 'som desligado: nenhum oscilador criado');
    somLigado = true;
    audio.tocarSelecao();
    assert.equal(contador.total(), 1, 'som ligado: efeito tocou');
  } finally {
    contador.restaurar();
  }
});

test('sem getSom/getVoz explícitos: som vem ligado por padrão, voz desligada', () => {
  const audio = criarAudioService();
  const contador = contarOsciladores();
  try {
    audio.tocarSelecao();
    assert.equal(contador.total(), 1);
  } finally {
    contador.restaurar();
  }
  // não deve lançar mesmo sem voz configurada
  assert.doesNotThrow(() => audio.falarSelecao('Água'));
});

test('falarSelecao/falarResultado só falam quando getVoz() é true', () => {
  let vozLigada = false;
  const audio = criarAudioService({ getSom: () => true, getVoz: () => vozLigada });
  const chamadas = [];
  const origSpeak = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = (u) => { chamadas.push(u.text); origSpeak(u); };
  try {
    audio.falarSelecao('Água');
    assert.equal(chamadas.length, 0, 'voz desligada: não fala');
    vozLigada = true;
    audio.falarSelecao('Água');
    assert.deepEqual(chamadas, ['Água']);
  } finally {
    speechSynthesis.speak = origSpeak;
  }
});

test('um novo toque cancela a fala anterior do mesmo nível (debounce)', () => {
  const audio = criarAudioService({ getSom: () => true, getVoz: () => true });
  let cancelamentos = 0;
  const chamadas = [];
  const origCancel = speechSynthesis.cancel.bind(speechSynthesis);
  const origSpeak = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.cancel = () => { cancelamentos += 1; origCancel(); };
  speechSynthesis.speak = (u) => { chamadas.push(u.text); origSpeak(u); };
  try {
    audio.falarSelecao('Água');
    audio.falarSelecao('Fogo');
    audio.falarSelecao('Terra');
    // a 1ª fala não tem nada pra cancelar (nada estava falando ainda); a 2ª
    // e a 3ª cada uma cancela a anterior, que ainda estava em curso —
    // cancel() só é chamado quando há mesmo algo pra cancelar (evita o
    // cancel()+speak() sem necessidade que alguns Android tratam mal).
    assert.equal(cancelamentos, 2, 'a 2ª e a 3ª fala cancelam a anterior, que ainda estava em curso');
    assert.deepEqual(chamadas, ['Água', 'Fogo', 'Terra'], 'as 3 chegam a chamar speak(), mesmo que canceladas em seguida');
  } finally {
    speechSynthesis.cancel = origCancel;
    speechSynthesis.speak = origSpeak;
  }
});

test('resultado de combinação tem prioridade sobre leitura de item: seleção não interrompe resultado em andamento', () => {
  const audio = criarAudioService({ getSom: () => true, getVoz: () => true });
  const chamadas = [];
  const origSpeak = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = (u) => { chamadas.push(u.text); /* nunca chama origSpeak: nunca dispara onend, simula "ainda falando" */ };
  try {
    audio.falarResultado('Nuvem'); // prioridade alta, "ainda falando" (onend nunca disparado)
    audio.falarSelecao('Água'); // prioridade baixa: deve ser ignorada
    assert.deepEqual(chamadas, ['Nuvem'], 'a seleção não deve interromper/entrar na fila durante o resultado');
  } finally {
    speechSynthesis.speak = origSpeak;
  }
});

test('um novo resultado sempre interrompe e fala, mesmo com um resultado anterior "em andamento"', () => {
  const audio = criarAudioService({ getSom: () => true, getVoz: () => true });
  const chamadas = [];
  const origSpeak = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = (u) => { chamadas.push(u.text); };
  try {
    audio.falarResultado('Nuvem');
    audio.falarResultado('Vapor');
    assert.deepEqual(chamadas, ['Nuvem', 'Vapor']);
  } finally {
    speechSynthesis.speak = origSpeak;
  }
});

test('prefere voz pt-BR quando disponível entre várias', () => {
  const vozes = [
    { lang: 'en-US', name: 'Alex' },
    { lang: 'pt-PT', name: 'Joana' },
    { lang: 'pt-BR', name: 'Luciana' },
  ];
  const origGetVoices = speechSynthesis.getVoices.bind(speechSynthesis);
  speechSynthesis.getVoices = () => vozes;
  const audio = criarAudioService({ getSom: () => true, getVoz: () => true });
  const usadas = [];
  const origSpeak = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = (u) => { usadas.push(u.voice); origSpeak(u); };
  try {
    audio.falarSelecao('Água');
    assert.equal(usadas[0]?.name, 'Luciana');
  } finally {
    speechSynthesis.getVoices = origGetVoices;
    speechSynthesis.speak = origSpeak;
  }
});

test('sem voz pt-BR: cai para qualquer "pt-" disponível, sem quebrar', () => {
  const vozes = [
    { lang: 'en-US', name: 'Alex' },
    { lang: 'pt-PT', name: 'Joana' },
  ];
  const origGetVoices = speechSynthesis.getVoices.bind(speechSynthesis);
  speechSynthesis.getVoices = () => vozes;
  const audio = criarAudioService({ getSom: () => true, getVoz: () => true });
  const usadas = [];
  const origSpeak = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = (u) => { usadas.push(u.voice); origSpeak(u); };
  try {
    audio.falarSelecao('Água');
    assert.equal(usadas[0]?.name, 'Joana');
  } finally {
    speechSynthesis.getVoices = origGetVoices;
    speechSynthesis.speak = origSpeak;
  }
});

test('navegador sem nenhuma voz disponível: fala sem `voice` definido, nunca lança', () => {
  const origGetVoices = speechSynthesis.getVoices.bind(speechSynthesis);
  speechSynthesis.getVoices = () => [];
  const audio = criarAudioService({ getSom: () => true, getVoz: () => true });
  try {
    assert.doesNotThrow(() => audio.falarSelecao('Água'));
  } finally {
    // getVoices() vazia dispara a espera limitada (ver bloco Android 14
    // abaixo) — cancela o timer pendente antes de sair, senão ele fica
    // pendurado e pode disparar no meio de um teste seguinte.
    audio.cancelarFala();
    speechSynthesis.getVoices = origGetVoices;
  }
});

// ---- diagnóstico: cenário Android 14 relatado — getVoices() começa vazia
// e a lista real só chega depois via 'voiceschanged' ----
test('Android 14: getVoices() começa vazia e chega depois via voiceschanged — a fala espera e sai com a voz certa', async () => {
  speechSynthesis._definirVozes([]); // estado inicial no aparelho relatado
  const audio = criarAudioService({ getSom: () => true, getVoz: () => true });
  const chamadas = [];
  const origSpeak = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = (u) => { chamadas.push({ texto: u.text, voz: u.voice?.name }); origSpeak(u); };
  try {
    audio.falarSelecao('Água');
    assert.equal(chamadas.length, 0, 'ainda não falou: está esperando as vozes carregarem');

    // simula o carregamento tardio (o bug relatado): as vozes chegam, o
    // navegador dispara 'voiceschanged'
    speechSynthesis._definirVozes([{ lang: 'pt-BR', name: 'Google português do Brasil' }]);
    speechSynthesis._dispararVoiceschanged();

    assert.equal(chamadas.length, 1, 'assim que as vozes chegaram, a fala pendente saiu');
    assert.equal(chamadas[0].texto, 'Água');
    assert.equal(chamadas[0].voz, 'Google português do Brasil', 'já usa a voz pt-BR recém-carregada');
  } finally {
    speechSynthesis.speak = origSpeak;
    speechSynthesis._definirVozes([{ lang: 'pt-BR', name: 'Voz Padrão de Teste', voiceURI: 'padrao' }]);
  }
});

test('Android 14: se voiceschanged nunca disparar, a espera é limitada — fala mesmo assim, sem voice definido', async () => {
  speechSynthesis._definirVozes([]); // nunca chega a carregar (falha real do TTS do SO)
  const audio = criarAudioService({ getSom: () => true, getVoz: () => true });
  const chamadas = [];
  const origSpeak = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = (u) => { chamadas.push({ texto: u.text, voz: u.voice }); origSpeak(u); };
  try {
    audio.falarSelecao('Água');
    assert.equal(chamadas.length, 0, 'ainda esperando');
    await new Promise((r) => setTimeout(r, 350)); // além do limite de espera
    assert.equal(chamadas.length, 1, 'a espera é LIMITADA: fala mesmo sem voz nenhuma ter chegado');
    assert.equal(chamadas[0].texto, 'Água');
    assert.equal(chamadas[0].voz, null, 'sem voz encontrada: speak() sai sem .voice, fallback do sistema');
  } finally {
    speechSynthesis.speak = origSpeak;
    speechSynthesis._definirVozes([{ lang: 'pt-BR', name: 'Voz Padrão de Teste', voiceURI: 'padrao' }]);
  }
});

test('Android 14: voiceschanged disparando DEPOIS do timeout não fala uma 2ª vez (sem duplicação)', async () => {
  speechSynthesis._definirVozes([]);
  const audio = criarAudioService({ getSom: () => true, getVoz: () => true });
  const chamadas = [];
  const origSpeak = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = (u) => { chamadas.push(u.text); origSpeak(u); };
  try {
    audio.falarSelecao('Água');
    await new Promise((r) => setTimeout(r, 350)); // dispara pelo timeout
    assert.equal(chamadas.length, 1);
    // voiceschanged chega tarde, depois do timeout já ter resolvido a fala
    speechSynthesis._definirVozes([{ lang: 'pt-BR', name: 'Tardia' }]);
    speechSynthesis._dispararVoiceschanged();
    assert.equal(chamadas.length, 1, 'não fala de novo só porque as vozes chegaram depois');
  } finally {
    speechSynthesis.speak = origSpeak;
    speechSynthesis._definirVozes([{ lang: 'pt-BR', name: 'Voz Padrão de Teste', voiceURI: 'padrao' }]);
  }
});

test('Android 14: um novo toque durante a espera cancela a espera anterior — só o mais recente fala', () => {
  speechSynthesis._definirVozes([]);
  const audio = criarAudioService({ getSom: () => true, getVoz: () => true });
  const chamadas = [];
  const origSpeak = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = (u) => { chamadas.push(u.text); origSpeak(u); };
  try {
    audio.falarSelecao('Água'); // começa a esperar vozes
    audio.falarSelecao('Fogo'); // cancela a espera da "Água" antes dela sair
    speechSynthesis._definirVozes([{ lang: 'pt-BR', name: 'Chegou' }]);
    speechSynthesis._dispararVoiceschanged();
    assert.deepEqual(chamadas, ['Fogo'], '"Água" nunca chegou a falar — foi cancelada pelo toque seguinte');
  } finally {
    speechSynthesis.speak = origSpeak;
    speechSynthesis._definirVozes([{ lang: 'pt-BR', name: 'Voz Padrão de Teste', voiceURI: 'padrao' }]);
  }
});

test('Android 14: resultado chega durante a espera de uma seleção — cancela a espera e fala o resultado (prioridade preservada)', () => {
  speechSynthesis._definirVozes([]);
  const audio = criarAudioService({ getSom: () => true, getVoz: () => true });
  const chamadas = [];
  const origSpeak = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = (u) => { chamadas.push(u.text); origSpeak(u); };
  try {
    audio.falarSelecao('Água'); // seleção começa a esperar vozes
    audio.falarResultado('Vapor'); // resultado chega antes das vozes: deve assumir
    speechSynthesis._definirVozes([{ lang: 'pt-BR', name: 'Chegou' }]);
    speechSynthesis._dispararVoiceschanged();
    assert.deepEqual(chamadas, ['Vapor'], 'só o resultado fala — prioridade sobre a seleção continua valendo mesmo em espera');
  } finally {
    speechSynthesis.speak = origSpeak;
    speechSynthesis._definirVozes([{ lang: 'pt-BR', name: 'Voz Padrão de Teste', voiceURI: 'padrao' }]);
  }
});

test('cancelarFala() para a síntese na hora e libera prioridade', () => {
  const audio = criarAudioService({ getSom: () => true, getVoz: () => true });
  const origSpeak = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = (u) => { /* nunca dispara onend: simula fala em andamento */ void u; };
  try {
    audio.falarResultado('Nuvem');
    audio.cancelarFala();
    // depois de cancelar, uma seleção volta a poder falar normalmente
    const chamadas = [];
    speechSynthesis.speak = (u) => chamadas.push(u.text);
    audio.falarSelecao('Água');
    assert.deepEqual(chamadas, ['Água']);
  } finally {
    speechSynthesis.speak = origSpeak;
  }
});

test('speechSynthesis.paused === true: chama resume() antes de falar', () => {
  const audio = criarAudioService({ getSom: () => true, getVoz: () => true });
  speechSynthesis.paused = true;
  let resumiu = false;
  const origResume = speechSynthesis.resume.bind(speechSynthesis);
  speechSynthesis.resume = () => { resumiu = true; origResume(); };
  try {
    audio.falarSelecao('Água');
    assert.equal(resumiu, true, 'resume() foi chamado porque a síntese estava pausada');
    assert.equal(speechSynthesis.paused, false);
  } finally {
    speechSynthesis.resume = origResume;
    speechSynthesis.paused = false;
  }
});

test('nomes muito longos ainda são falados por inteiro', () => {
  const nomeLongo = 'Uma Descoberta Com Nome Bem Comprido De Verdade';
  const audio = criarAudioService({ getSom: () => true, getVoz: () => true });
  const chamadas = [];
  const origSpeak = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = (u) => { chamadas.push(u.text); origSpeak(u); };
  try {
    audio.falarResultado(nomeLongo);
    assert.deepEqual(chamadas, [nomeLongo]);
  } finally {
    speechSynthesis.speak = origSpeak;
  }
});

// ---- correção do bug "efeitos inaudíveis": AudioContext nasce suspenso
// (política de autoplay) e precisa ser retomado antes de qualquer som ----
test('tom() retoma o AudioContext quando ele está suspenso, antes de agendar o oscilador', () => {
  const chamadasResume = [];
  const OrigCtx = window.AudioContext;
  class CtxEspiao extends OrigCtx {
    constructor(...args) {
      super(...args);
      this.state = 'suspended';
    }
    resume() {
      chamadasResume.push(this.state);
      return super.resume();
    }
  }
  window.AudioContext = CtxEspiao;
  try {
    const audio = criarAudioService({ getSom: () => true, getVoz: () => false });
    audio.tocarSelecao();
    assert.equal(chamadasResume.length, 1, 'resume() foi chamado ao tocar um efeito com o contexto suspenso');
  } finally {
    window.AudioContext = OrigCtx;
  }
});

test('o 1º gesto do usuário em qualquer lugar da página já desbloqueia o AudioContext (antes de qualquer efeito ser pedido)', () => {
  const chamadasResume = [];
  const OrigCtx = window.AudioContext;
  class CtxEspiao extends OrigCtx {
    constructor(...args) {
      super(...args);
      this.state = 'suspended';
    }
    resume() {
      chamadasResume.push(1);
      return super.resume();
    }
  }
  window.AudioContext = CtxEspiao;
  try {
    criarAudioService({ getSom: () => true, getVoz: () => false });
    assert.equal(chamadasResume.length, 0, 'ainda não houve gesto nenhum');
    document.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true }));
    // >= 1 (não === 1): outras instâncias de audioService criadas por testes
    // anteriores neste mesmo arquivo também escutam gestos em `document` e
    // ainda não dispararam a sua vez — o que importa aqui é que ESTE gesto já
    // desbloqueou o contexto, sem esperar um efeito ser pedido.
    assert.ok(chamadasResume.length >= 1, 'o gesto na página já retomou o contexto, sem esperar um efeito ser chamado');
  } finally {
    window.AudioContext = OrigCtx;
  }
});

// ---- assinatura de Nova Era ----
function espiarNotas() {
  const notas = [];
  const OrigCtx = window.AudioContext;
  class CtxEspiao extends OrigCtx {
    createOscillator() {
      const o = super.createOscillator();
      const nota = { freq: null, inicio: null, fim: null };
      notas.push(nota);
      const origSetFreq = o.frequency.setValueAtTime.bind(o.frequency);
      o.frequency.setValueAtTime = (v, t) => { nota.freq = v; return origSetFreq(v, t); };
      const origStart = o.start.bind(o);
      o.start = (t) => { nota.inicio = t; return origStart(t); };
      const origStop = o.stop.bind(o);
      o.stop = (t) => { nota.fim = t; return origStop(t); };
      return o;
    }
  }
  window.AudioContext = CtxEspiao;
  return {
    notas,
    restaurar: () => { window.AudioContext = OrigCtx; },
  };
}

test('tocarNovaEra toca em 3 fases (várias notas), só quando o Som está ligado', () => {
  let somLigado = false;
  const audio = criarAudioService({ getSom: () => somLigado, getVoz: () => false });
  const espiao = espiarNotas();
  try {
    audio.tocarNovaEra();
    assert.equal(espiao.notas.length, 0, 'Som desligado: nenhuma nota tocou');
    somLigado = true;
    audio.tocarNovaEra();
    assert.ok(espiao.notas.length >= 5, `esperava várias notas (subida+impacto+acorde), veio ${espiao.notas.length}`);
  } finally {
    espiao.restaurar();
  }
});

test('tocarNovaEra dura entre ~1 e ~2 segundos no total (subida -> impacto -> chime)', () => {
  const audio = criarAudioService({ getSom: () => true, getVoz: () => false });
  const espiao = espiarNotas();
  try {
    audio.tocarNovaEra();
    const duracaoTotal = Math.max(...espiao.notas.map((n) => n.fim));
    assert.ok(duracaoTotal >= 1 && duracaoTotal <= 2, `duração total esperada entre 1 e 2s, veio ${duracaoTotal}s`);
  } finally {
    espiao.restaurar();
  }
});

test('tocarNovaEra nunca lança mesmo se o AudioContext falhar ao construir', () => {
  const OrigCtx = window.AudioContext;
  window.AudioContext = class { constructor() { throw new Error('sem áudio'); } };
  const audio = criarAudioService({ getSom: () => true, getVoz: () => false });
  try {
    assert.doesNotThrow(() => audio.tocarNovaEra());
  } finally {
    window.AudioContext = OrigCtx;
  }
});

test('efeitos nunca lançam mesmo se o AudioContext falhar ao construir', () => {
  const OrigCtx = window.AudioContext;
  window.AudioContext = class { constructor() { throw new Error('sem áudio'); } };
  const audio = criarAudioService({ getSom: () => true, getVoz: () => false });
  try {
    assert.doesNotThrow(() => audio.tocarSelecao());
    assert.doesNotThrow(() => audio.tocarWhoosh());
    assert.doesNotThrow(() => audio.tocarAproximacao());
    assert.doesNotThrow(() => audio.tocarCombinacaoValida());
    assert.doesNotThrow(() => audio.tocarNovaDescoberta());
    assert.doesNotThrow(() => audio.tocarNada());
  } finally {
    window.AudioContext = OrigCtx;
  }
});
