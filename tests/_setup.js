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
  }
  createOscillator() {
    return { connect() {}, start() {}, stop() {}, frequency: { value: 0 } };
  }
  createGain() {
    return {
      connect() {},
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    };
  }
}
definir('AudioContext', AudioContextStub);
