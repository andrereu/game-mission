import test from 'node:test';
import assert from 'node:assert/strict';
import { montarAjustes } from '../src/ui/ajustes.js';
import { T } from '../src/data/textos.js';

function ambiente(valores) {
  document.body.innerHTML = '<div id="ajustes-raiz"></div>';
  const estado = { ...valores };
  const set = [];
  const api = montarAjustes({
    raiz: document.getElementById('ajustes-raiz'),
    T,
    get: (k) => estado[k],
    set: (k, v) => { estado[k] = v; set.push([k, v]); },
  });
  return { api, estado, set, raiz: document.getElementById('ajustes-raiz') };
}

const clique = () => new window.MouseEvent('click', { bubbles: true });

test('abrir mostra os interruptores refletindo o estado atual', () => {
  const { api, raiz } = ambiente({ som: true, iaLigada: false });
  api.abrir();
  const checks = raiz.querySelectorAll('input[type="checkbox"]');
  assert.equal(checks.length, 2);
  const som = raiz.querySelector('input[data-chave="som"]');
  const ia = raiz.querySelector('input[data-chave="iaLigada"]');
  assert.equal(som.checked, true);
  assert.equal(ia.checked, false);
});

test('ligar a IA chama set com o valor booleano', () => {
  const { api, set, raiz } = ambiente({ som: true, iaLigada: false });
  api.abrir();
  const ia = raiz.querySelector('input[data-chave="iaLigada"]');
  ia.checked = true;
  ia.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.deepEqual(set, [['iaLigada', true]]);
});

test('cada linha mostra ícone, título e descrição (não é mais um checkbox nu)', () => {
  const { api, raiz } = ambiente({ som: true, iaLigada: false });
  api.abrir();
  const linhas = raiz.querySelectorAll('.ajuste-linha');
  assert.equal(linhas.length, 2);
  for (const l of linhas) {
    assert.ok(l.querySelector('.ajuste-icone').textContent.length > 0);
    assert.ok(l.querySelector('.ajuste-titulo').textContent.length > 0);
    assert.ok(l.querySelector('.ajuste-desc').textContent.length > 0);
    assert.ok(l.querySelector('input[type="checkbox"]'), 'o input real continua lá, só a aparência muda');
  }
});

test('a descrição da IA reflete o funcionamento real (consultada quando não existe combo)', () => {
  const { api, raiz } = ambiente({ som: false, iaLigada: false });
  api.abrir();
  const desc = raiz.querySelector('input[data-chave="iaLigada"]')
    .closest('.ajuste-linha').querySelector('.ajuste-desc').textContent;
  assert.match(desc, /não existe/i);
  assert.doesNotMatch(desc, /dica/i);
});

test('fechar tira o overlay', () => {
  const { api, raiz } = ambiente({ som: false, iaLigada: false });
  api.abrir();
  raiz.querySelector('.ajustes-fechar').dispatchEvent(clique());
  assert.equal(raiz.querySelector('.ajustes-overlay'), null);
});

const tick = () => new Promise((r) => setTimeout(r, 0));

function ambienteSync(estadoInicial, cbs) {
  document.body.innerHTML = '<div id="ajustes-raiz"></div>';
  const raiz = document.getElementById('ajustes-raiz');
  const api = montarAjustes({
    raiz,
    T,
    get: () => false,
    set: () => {},
    sync: {
      carregar: async () => estadoInicial,
      ...cbs,
    },
  });
  return { api, raiz };
}

test('sem código: mostra "Ativar" e clicar gera o código', async () => {
  let gerou = 0;
  const { api, raiz } = ambienteSync({ codigo: null }, {
    ativar: async () => { gerou += 1; return { codigo: 'ABCD-2345' }; },
    usar: async () => {},
    desativar: async () => ({ codigo: null }),
    agora: () => {},
  });
  api.abrir();
  await tick();
  assert.ok(raiz.querySelector('.sync-ativar'));
  raiz.querySelector('.sync-ativar').dispatchEvent(clique());
  await tick();
  assert.equal(gerou, 1);
  assert.match(raiz.querySelector('.sync-valor').textContent, /ABCD-2345/);
});

test('com código: mostra o valor e o botão Desativar', async () => {
  const { api, raiz } = ambienteSync({ codigo: 'MELO-4KX9' }, {
    ativar: async () => ({ codigo: 'x' }),
    usar: async () => {},
    desativar: async () => ({ codigo: null }),
    agora: () => {},
  });
  api.abrir();
  await tick();
  assert.match(raiz.querySelector('.sync-valor').textContent, /MELO-4KX9/);
  assert.ok(raiz.querySelector('.sync-desativar'));
});

test('digitar um código e clicar em Usar chama sync.usar', async () => {
  let usado = null;
  const { api, raiz } = ambienteSync({ codigo: null }, {
    ativar: async () => ({ codigo: 'x' }),
    usar: async (c) => { usado = c; },
    desativar: async () => ({ codigo: null }),
    agora: () => {},
  });
  api.abrir();
  await tick();
  raiz.querySelector('.sync-codigo').value = 'meu-codigo';
  raiz.querySelector('.sync-usar').dispatchEvent(clique());
  await tick();
  assert.equal(usado, 'meu-codigo');
});

async function comFullscreenApi(disponivel, corpo) {
  const antesEnabled = document.fullscreenEnabled;
  const antesRequest = document.documentElement.requestFullscreen;
  const antesExit = document.exitFullscreen;
  const antesElemento = document.fullscreenElement;
  document.fullscreenEnabled = disponivel;
  if (disponivel) {
    document.documentElement.requestFullscreen = () => {
      document.fullscreenElement = document.documentElement;
      document.dispatchEvent(new window.Event('fullscreenchange'));
      return Promise.resolve();
    };
    document.exitFullscreen = () => {
      document.fullscreenElement = null;
      document.dispatchEvent(new window.Event('fullscreenchange'));
      return Promise.resolve();
    };
  }
  try {
    // aguarda mesmo um corpo síncrono: sem isso o `finally` desfaria os mocks
    // antes de um corpo assíncrono terminar de usá-los.
    return await corpo();
  } finally {
    document.fullscreenEnabled = antesEnabled;
    document.documentElement.requestFullscreen = antesRequest;
    document.exitFullscreen = antesExit;
    document.fullscreenElement = antesElemento;
  }
}

test('sem Fullscreen API: a opção "Tela cheia" nem aparece', () => {
  comFullscreenApi(false, () => {
    const { api, raiz } = ambiente({ som: true, iaLigada: false });
    api.abrir();
    assert.equal(raiz.querySelector('input[data-chave="telaCheia"]'), null);
  });
});

test('com Fullscreen API: ligar "Tela cheia" entra em tela cheia; fullscreenchange mantém o switch em dia', async () => {
  await comFullscreenApi(true, async () => {
    const { api, raiz } = ambiente({ som: true, iaLigada: false });
    api.abrir();
    const inp = raiz.querySelector('input[data-chave="telaCheia"]');
    assert.ok(inp, 'a opção aparece quando a API existe');
    assert.equal(inp.checked, false);

    inp.checked = true;
    inp.dispatchEvent(new window.Event('change', { bubbles: true }));
    await tick();
    assert.equal(inp.checked, true, 'continua marcado depois de entrar em tela cheia');

    // saída não iniciada pelo switch (ex.: Esc) também deve refletir no visual
    document.exitFullscreen();
    await tick();
    assert.equal(inp.checked, false);
  });
});

test('fechar os Ajustes remove o listener de fullscreenchange (sem vazar entre aberturas)', async () => {
  await comFullscreenApi(true, async () => {
    const { api, raiz } = ambiente({ som: true, iaLigada: false });
    api.abrir();
    api.fechar();
    // dispara depois de fechado: não deve quebrar nem reabrir nada
    document.fullscreenElement = document.documentElement;
    document.dispatchEvent(new window.Event('fullscreenchange'));
    await tick();
    assert.equal(raiz.querySelector('.ajustes-overlay'), null);
  });
});
