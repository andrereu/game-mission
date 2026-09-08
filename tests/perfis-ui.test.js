import test from 'node:test';
import assert from 'node:assert/strict';
import { montarSeletorPerfis } from '../src/ui/perfis.js';
import { T } from '../src/data/textos.js';
import { AVATARES } from '../src/data/avatares.js';

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

test('o formulário de novo perfil tem os 3 modos e passa o escolhido pro aoCriar', async () => {
  const raiz = raizLimpa();
  const chamadas = [];
  const sel = montarSeletorPerfis({
    raiz, T, aoEscolher() {}, async aoEditar() {},
    async aoCriar(nome, cor, modo) { chamadas.push({ nome, cor, modo }); return { lista: [], ativo: null }; },
    async aoApagar() {},
  });
  sel.abrir({ lista: [], ativo: null });
  const modos = raiz.querySelectorAll('.perfil-novo .perfil-modo');
  assert.equal(modos.length, 3);
  [...modos].find((b) => b.dataset.modo === 'pequenos').dispatchEvent(clique());
  raiz.querySelector('.perfil-novo input').value = 'Matheus';
  raiz.querySelector('.perfil-novo form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(chamadas, [{ nome: 'Matheus', cor: AVATARES[0].cor, modo: 'pequenos' }]);
});

test('editar um card troca o modo via aoEditar', async () => {
  const raiz = raizLimpa();
  let editado = null;
  const sel = montarSeletorPerfis({
    raiz, T, aoEscolher() {}, async aoCriar() {}, async aoApagar() {},
    async aoEditar(id, campos) {
      editado = { id, campos };
      return { lista: [{ id, nome: 'Ana', cor: '#4aa3ff', modo: campos.modo }], ativo: null };
    },
  });
  sel.abrir({ lista: [{ id: 'a', nome: 'Ana', cor: '#4aa3ff', modo: 'medio' }], ativo: null });
  raiz.querySelector('.perfil-card .perfil-editar').dispatchEvent(clique());
  const opcoes = raiz.querySelectorAll('.perfil-card .perfil-modo');
  assert.equal(opcoes.length, 3);
  [...opcoes].find((b) => b.dataset.modo === 'completo').dispatchEvent(clique());
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(editado, { id: 'a', campos: { modo: 'completo' } });
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

test('o formulário de novo perfil mostra 8 símbolos do jogo e passa o escolhido pro aoCriar', async () => {
  const raiz = raizLimpa();
  const chamadas = [];
  const sel = montarSeletorPerfis({
    raiz, T, aoEscolher() {}, async aoEditar() {},
    async aoCriar(nome, cor, modo, avatarId) { chamadas.push({ nome, cor, modo, avatarId }); return { lista: [], ativo: null }; },
    async aoApagar() {},
  });
  sel.abrir({ lista: [], ativo: null });
  const opcoes = raiz.querySelectorAll('.perfil-novo .perfil-avatar-opcao');
  assert.equal(opcoes.length, 8);
  opcoes[3].dispatchEvent(clique());
  raiz.querySelector('.perfil-novo input').value = 'Duda';
  raiz.querySelector('.perfil-novo form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].nome, 'Duda');
  assert.equal(chamadas[0].avatarId, opcoes[3].dataset.avatar);
  assert.ok(chamadas[0].cor, 'a cor é derivada automaticamente da carinha escolhida');
});

test('cada card de perfil mostra um símbolo cósmico (não mais um círculo de cor abstrato)', () => {
  const raiz = raizLimpa();
  const sel = montarSeletorPerfis({ raiz, T, aoEscolher() {}, async aoCriar() {}, async aoApagar() {} });
  sel.abrir({ lista: [{ id: 'a', nome: 'Ana', cor: '#4aa3ff', avatarId: 'lumen' }], ativo: null });
  const avatar = raiz.querySelector('.perfil-card .perfil-avatar');
  assert.ok(avatar, 'tem um contêiner de símbolo');
  assert.ok(avatar.querySelector('svg'), 'o símbolo fica em um medalhão SVG');
  assert.equal(avatar.querySelector('text').textContent, '🌳');
  assert.equal(raiz.querySelector('.perfil-cor'), null, 'o círculo de cor abstrato não existe mais');
});

test('perfil sem avatarId (perfil antigo) ainda mostra um símbolo determinístico, sem quebrar', () => {
  const raiz = raizLimpa();
  const sel = montarSeletorPerfis({ raiz, T, aoEscolher() {}, async aoCriar() {}, async aoApagar() {} });
  sel.abrir({ lista: [{ id: 'legado', nome: 'Legado', cor: '#4aa3ff' }], ativo: null });
  assert.ok(raiz.querySelector('.perfil-card .perfil-avatar svg'));
});

test('editar um card também permite trocar a carinha via aoEditar', async () => {
  const raiz = raizLimpa();
  let editado = null;
  const sel = montarSeletorPerfis({
    raiz, T, aoEscolher() {}, async aoCriar() {}, async aoApagar() {},
    async aoEditar(id, campos) {
      editado = { id, campos };
      return { lista: [{ id, nome: 'Ana', cor: campos.cor || '#4aa3ff', modo: 'medio', avatarId: campos.avatarId }], ativo: null };
    },
  });
  sel.abrir({ lista: [{ id: 'a', nome: 'Ana', cor: '#4aa3ff', modo: 'medio', avatarId: 'nova' }], ativo: null });
  raiz.querySelector('.perfil-card .perfil-editar').dispatchEvent(clique());
  const opcoes = raiz.querySelectorAll('.perfil-card .perfil-avatar-opcao');
  assert.equal(opcoes.length, 8);
  const outra = [...opcoes].find((b) => b.dataset.avatar !== 'nova');
  outra.dispatchEvent(clique());
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(editado.id, 'a');
  assert.equal(editado.campos.avatarId, outra.dataset.avatar);
});
