import 'fake-indexeddb/auto';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
});

function definir(nome, valor) {
  if (globalThis[nome] === undefined) {
    globalThis[nome] = valor;
  }
}

definir('window', dom.window);
definir('document', dom.window.document);
definir('navigator', dom.window.navigator);
definir('localStorage', dom.window.localStorage);
definir('sessionStorage', dom.window.sessionStorage);
definir('HTMLElement', dom.window.HTMLElement);
definir('Event', dom.window.Event);
definir('CustomEvent', dom.window.CustomEvent);
definir('getComputedStyle', dom.window.getComputedStyle);

// AudioContext não existe em jsdom; stub silencioso para os testes de UI.
class AudioContextStub {
  constructor() {
    this.currentTime = 0;
    this.destination = {};
    this.state = 'suspended'; // como no Chrome real: começa suspenso até resume()
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  createOscillator() {
    return {
      connect() {},
      start() {},
      stop() {},
      frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
    };
  }
  createGain() {
    return {
      connect() {},
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
    };
  }
}
definir('AudioContext', AudioContextStub);
// o código de produção sempre lê `window.AudioContext` (nunca a global nua);
// como `window` aqui é o objeto dom.window (distinto de globalThis), o stub
// precisa existir nos dois pra valer nos testes que espiam criação de som.
if (dom.window.AudioContext === undefined) dom.window.AudioContext = AudioContextStub;

// speechSynthesis não existe em jsdom; stub controlável pelos testes de
// áudio (fala é assíncrona nos navegadores reais, mas aqui resolve na hora
// pra não deixar timers pendurados nos testes).
class SpeechSynthesisUtteranceStub {
  constructor(text) {
    this.text = text;
    this.lang = '';
    this.voice = null;
    this.rate = 1;
    this.pitch = 1;
    this.volume = 1;
    this.onend = null;
    this.onerror = null;
  }
}
class SpeechSynthesisStub {
  constructor() {
    // não-vazia por padrão: simula o caminho feliz (desktop/Android 16),
    // onde getVoices() já responde na hora. O cenário Android 14 (vazia no
    // início, chega depois) é simulado explicitamente via _definirVozes([])
    // + _dispararVoiceschanged() nos testes que o exercitam.
    this._vozes = [{ lang: 'pt-BR', name: 'Voz Padrão de Teste', voiceURI: 'padrao' }];
    this._ouvintes = new Map();
    this.speaking = false;
    this.pending = false;
    this.paused = false;
  }
  getVoices() { return this._vozes; }
  speak(utterance) {
    this.paused = false;
    this.speaking = true;
    queueMicrotask(() => {
      this.speaking = false;
      utterance.onend?.();
    });
  }
  cancel() { this.speaking = false; this.pending = false; }
  resume() { this.paused = false; }
  pause() { this.paused = true; }
  addEventListener(tipo, fn) {
    if (!this._ouvintes.has(tipo)) this._ouvintes.set(tipo, new Set());
    this._ouvintes.get(tipo).add(fn);
  }
  removeEventListener(tipo, fn) { this._ouvintes.get(tipo)?.delete(fn); }
  // helpers só de teste: simulam o cenário Android onde getVoices() começa
  // vazia e a lista real chega depois via 'voiceschanged'.
  _definirVozes(lista) { this._vozes = lista; }
  _dispararVoiceschanged() {
    for (const fn of this._ouvintes.get('voiceschanged') || []) fn();
  }
}
definir('SpeechSynthesisUtterance', SpeechSynthesisUtteranceStub);
definir('speechSynthesis', new SpeechSynthesisStub());
