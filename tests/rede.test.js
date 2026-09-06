import test from 'node:test';
import assert from 'node:assert/strict';
import { montarStatusRede } from '../src/ui/rede.js';
import { T } from '../src/data/textos.js';

function fingirOnLine(valorInicial) {
  const desc = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
  let atual = valorInicial;
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => atual });
  return {
    set: (v) => { atual = v; },
    restaurar: () => {
      if (desc) Object.defineProperty(window.navigator, 'onLine', desc);
      else delete window.navigator.onLine;
    },
  };
}

test('mostra "online" quando navigator.onLine é true', () => {
  document.body.innerHTML = '<span id="r"></span>';
  const el = document.getElementById('r');
  const rede = fingirOnLine(true);
  try {
    montarStatusRede({ el, T });
    assert.equal(el.dataset.online, 'sim');
    assert.match(el.textContent, /online/i);
  } finally {
    rede.restaurar();
  }
});

test('reage ao evento offline e volta no online', () => {
  document.body.innerHTML = '<span id="r"></span>';
  const el = document.getElementById('r');
  const rede = fingirOnLine(true);
  try {
    montarStatusRede({ el, T });
    assert.equal(el.dataset.online, 'sim');

    rede.set(false);
    window.dispatchEvent(new window.Event('offline'));
    assert.equal(el.dataset.online, 'nao');
    assert.match(el.textContent, /offline/i);

    rede.set(true);
    window.dispatchEvent(new window.Event('online'));
    assert.equal(el.dataset.online, 'sim');
  } finally {
    rede.restaurar();
  }
});

test('destruir para de reagir aos eventos', () => {
  document.body.innerHTML = '<span id="r"></span>';
  const el = document.getElementById('r');
  const rede = fingirOnLine(true);
  try {
    const api = montarStatusRede({ el, T });
    api.destruir();
    rede.set(false);
    window.dispatchEvent(new window.Event('offline'));
    assert.equal(el.dataset.online, 'sim', 'não mudou depois de destruir');
  } finally {
    rede.restaurar();
  }
});
