import test from 'node:test';
import assert from 'node:assert/strict';
import { montarSeletorPerfis } from '../src/ui/perfis.js';
import { T } from '../src/data/textos.js';

function raizLimpa() {
  document.body.innerHTML = '<div id="perfis-raiz"></div>';
  return document.getElementById('perfis-raiz');
}

const clique = () => new window.MouseEvent('click', { bubbles: true });

test('abrir mostra um card por perfil e o formulário de novo', () => {
  const raiz = raizLimpa();
  const sel = montarSeletorPerfis({ raiz, T, aoEscolher() {}, async aoCriar() {}, async aoApagar() {} });
  sel.abrir({ lista: [{ id: 'a', nome: 'Ana', cor: '#4aa3ff' }, { id: 'b', nome: 'Beto', cor: '#45c26b' }], ativo: null });
  assert.equal(raiz.querySelectorAll('.perfil-card').length, 2);
  assert.ok(raiz.querySelector('.perfil-novo input'));
  assert.match(raiz.textContent, /Ana/);
});

test('clicar num card chama aoEscolher com o id', () => {
  const raiz = raizLimpa();
  let escolhido = null;
  const sel = montarSeletorPerfis({
    raiz, T, aoEscolher: (id) => { escolhido = id; }, async aoCriar() {}, async aoApagar() {},
  });
  sel.abrir({ lista: [{ id: 'a', nome: 'Ana', cor: '#4aa3ff' }], ativo: null });
  raiz.querySelector('.perfil-card').dispatchEvent(clique());
  assert.equal(escolhido, 'a');
});

test('enviar o formulário chama aoCriar e re-renderiza com o estado devolvido', async () => {
  const raiz = raizLimpa();
  const chamadas = [];
  const sel = montarSeletorPerfis({
    raiz,
    T,
    aoEscolher() {},
    async aoCriar(nome, cor) {
      chamadas.push([nome, cor]);
      return { lista: [{ id: 'novo', nome, cor }], ativo: null };
    },
    async aoApagar() {},
  });
  sel.abrir({ lista: [], ativo: null });
  raiz.querySelector('.perfil-novo input').value = 'Caco';
  raiz.querySelector('.perfil-novo form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0][0], 'Caco');
  assert.equal(raiz.querySelectorAll('.perfil-card').length, 1);
});

test('o × do card chama aoApagar quando confirmado', async () => {
  const raiz = raizLimpa();
  const origConfirm = window.confirm;
  window.confirm = () => true;
  let apagado = null;
  try {
    const sel = montarSeletorPerfis({
      raiz,
      T,
      aoEscolher() {},
      async aoCriar() {},
      async aoApagar(id) { apagado = id; return { lista: [], ativo: null }; },
    });
    sel.abrir({ lista: [{ id: 'a', nome: 'Ana', cor: '#4aa3ff' }], ativo: null });
    raiz.querySelector('.perfil-apagar').dispatchEvent(clique());
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(apagado, 'a');
  } finally {
    window.confirm = origConfirm;
  }
});

test('só dá pra fechar quando já existe um perfil ativo', () => {
  const raiz = raizLimpa();
  const sel = montarSeletorPerfis({ raiz, T, aoEscolher() {}, async aoCriar() {}, async aoApagar() {} });

  sel.abrir({ lista: [], ativo: null });
  assert.ok(raiz.querySelector('.perfil-fechar').hidden, 'sem ativo: fechar escondido');

  sel.abrir({ lista: [{ id: 'a', nome: 'Ana', cor: '#4aa3ff' }], ativo: 'a' });
  assert.ok(!raiz.querySelector('.perfil-fechar').hidden, 'com ativo: fechar visível');
  raiz.querySelector('.perfil-fechar').dispatchEvent(clique());
  assert.equal(raiz.querySelector('.perfis-overlay'), null);
});
