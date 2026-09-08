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
  const origCancel = speechSynthesis.cancel.bind(speechSynthesis);
  speechSynthesis.cancel = () => { cancelamentos += 1; origCancel(); };
  try {
    audio.falarSelecao('Água');
    audio.falarSelecao('Fogo');
    audio.falarSelecao('Terra');
    assert.equal(cancelamentos, 3, 'cada toque cancela a fala anterior antes de falar de novo');
  } finally {
    speechSynthesis.cancel = origCancel;
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
    speechSynthesis.getVoices = origGetVoices;
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
