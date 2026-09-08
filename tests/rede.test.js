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

function stubFetch(fn) {
  const orig = globalThis.fetch;
  globalThis.fetch = fn;
  return () => { globalThis.fetch = orig; };
}

const respostaOk = (disponivel) => async () => ({ ok: true, json: async () => ({ disponivel }) });
const proximoFrame = () => new Promise((r) => setTimeout(r, 0));

function montar(el) {
  return montarStatusRede({ el, T });
}

test('parte de "verificando" (estado neutro) e vira "online" quando o endpoint diz disponível', async () => {
  document.body.innerHTML = '<span id="r"></span>';
  const el = document.getElementById('r');
  const rede = fingirOnLine(true);
  const restore = stubFetch(respostaOk(true));
  let api;
  try {
    api = montar(el);
    assert.equal(el.dataset.ia, 'verificando', 'começa neutro');
    assert.ok(el.textContent.length > 0, 'tem texto além da cor');
    await api.verificar();
    assert.equal(el.dataset.ia, 'online');
    assert.equal(el.dataset.online, 'sim');
    assert.match(el.getAttribute('aria-label'), /pronta/i);
    assert.equal(el.getAttribute('role'), 'status');
  } finally {
    api?.destruir();
    restore();
    rede.restaurar();
  }
});

test('endpoint diz indisponível => offline', async () => {
  document.body.innerHTML = '<span id="r"></span>';
  const el = document.getElementById('r');
  const rede = fingirOnLine(true);
  const restore = stubFetch(respostaOk(false));
  let api;
  try {
    api = montar(el);
    await api.verificar();
    assert.equal(el.dataset.ia, 'offline');
    assert.equal(el.dataset.online, 'nao');
    assert.match(el.textContent, /indispon/i);
  } finally {
    api?.destruir();
    restore();
    rede.restaurar();
  }
});

test('endpoint inacessível (HTTP não-ok ou erro de rede) => offline', async () => {
  document.body.innerHTML = '<span id="r"></span>';
  const el = document.getElementById('r');
  const rede = fingirOnLine(true);
  let api;
  let restore = stubFetch(async () => ({ ok: false, json: async () => ({}) }));
  try {
    api = montar(el);
    await api.verificar();
    assert.equal(el.dataset.ia, 'offline', 'HTTP não-ok');
    restore();
    restore = stubFetch(async () => { throw new Error('rede'); });
    await api.verificar();
    assert.equal(el.dataset.ia, 'offline', 'erro de rede');
  } finally {
    api?.destruir();
    restore();
    rede.restaurar();
  }
});

test('navigator.onLine false => offline sem sequer chamar o endpoint', async () => {
  document.body.innerHTML = '<span id="r"></span>';
  const el = document.getElementById('r');
  const rede = fingirOnLine(false);
  let chamou = false;
  const restore = stubFetch(async () => { chamou = true; return { ok: true, json: async () => ({ disponivel: true }) }; });
  let api;
  try {
    api = montar(el);
    await api.verificar();
    assert.equal(el.dataset.ia, 'offline');
    assert.equal(chamou, false, 'não gasta requisição quando o navegador está offline');
  } finally {
    api?.destruir();
    restore();
    rede.restaurar();
  }
});

test('eventos online/offline atualizam na hora', async () => {
  document.body.innerHTML = '<span id="r"></span>';
  const el = document.getElementById('r');
  const rede = fingirOnLine(true);
  const restore = stubFetch(respostaOk(true));
  let api;
  try {
    api = montar(el);
    await api.verificar();
    assert.equal(el.dataset.ia, 'online');

    rede.set(false);
    window.dispatchEvent(new window.Event('offline'));
    assert.equal(el.dataset.ia, 'offline', 'offline imediato');

    rede.set(true);
    window.dispatchEvent(new window.Event('online'));
    await proximoFrame();
    assert.equal(el.dataset.ia, 'online', 're-checa ao voltar a rede');
  } finally {
    api?.destruir();
    restore();
    rede.restaurar();
  }
});

test('marcarGeracaoOk => online na hora; marcarGeracaoFalhou => offline', async () => {
  document.body.innerHTML = '<span id="r"></span>';
  const el = document.getElementById('r');
  const rede = fingirOnLine(true);
  const restore = stubFetch(respostaOk(false)); // endpoint diz indisponível
  let api;
  try {
    api = montar(el);
    await api.verificar();
    assert.equal(el.dataset.ia, 'offline');

    api.marcarGeracaoOk(); // uma geração real funcionou => IA está de pé
    assert.equal(el.dataset.ia, 'online');

    api.marcarGeracaoFalhou(); // falha real de rede/serviço numa geração
    assert.equal(el.dataset.ia, 'offline');
  } finally {
    api?.destruir();
    restore();
    rede.restaurar();
  }
});

test('destruir para de reagir e não deixa timer órfão', async () => {
  document.body.innerHTML = '<span id="r"></span>';
  const el = document.getElementById('r');
  const rede = fingirOnLine(true);
  const restore = stubFetch(respostaOk(true));
  try {
    const api = montar(el);
    await api.verificar();
    api.destruir();
    rede.set(false);
    window.dispatchEvent(new window.Event('offline'));
    assert.equal(el.dataset.ia, 'online', 'não mudou depois de destruir');
    api.marcarGeracaoFalhou();
    assert.equal(el.dataset.ia, 'online', 'ignora chamadas após destruir');
  } finally {
    restore();
    rede.restaurar();
  }
});
