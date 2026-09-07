import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo } from '../src/engine/catalogo.js';
import { montarArvore } from '../src/ui/arvore.js';
import { T } from '../src/data/textos.js';

function raizLimpa() {
  document.body.innerHTML = '<div id="arvore-raiz"></div>';
  return document.getElementById('arvore-raiz');
}

function saveCom(descobertos) {
  return { versao: 1, descobertos, canvas: [], ajustes: { som: true, iaLigada: false } };
}

function storeFake(save) {
  return { getSave: () => save };
}

function no(raiz, id) {
  return raiz.querySelector(`.arvore-no[data-id="${id}"]`);
}

test('abrir monta um nó por descoberto e fechar remove o overlay', () => {
  const raiz = raizLimpa();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 2, via: null, fonte: 'base' },
    vapor: { em: 3, via: ['agua', 'fogo'], fonte: 'local' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  assert.ok(raiz.querySelector('.arvore-overlay'), 'overlay no DOM');
  assert.equal(raiz.querySelectorAll('.arvore-no').length, 3);
  arv.fechar();
  assert.equal(raiz.querySelector('.arvore-overlay'), null);
});

test('abrir duas vezes não empilha overlays', () => {
  const raiz = raizLimpa();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 2, via: null, fonte: 'base' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  arv.abrir();
  assert.equal(raiz.querySelectorAll('.arvore-overlay').length, 1);
});

test('nível cresce com a profundidade a partir das raízes', () => {
  const raiz = raizLimpa();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 1, via: null, fonte: 'base' },
    vapor: { em: 2, via: ['agua', 'fogo'], fonte: 'local' },
    // 'ar' não foi descoberto: esse pai é ignorado no cálculo de nível
    nuvem: { em: 3, via: ['ar', 'vapor'], fonte: 'local' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  const nivel = (id) => Number(no(raiz, id).dataset.nivel);
  assert.equal(nivel('agua'), 0);
  assert.equal(nivel('fogo'), 0);
  assert.equal(nivel('vapor'), 1);
  assert.equal(nivel('nuvem'), 2);
});

test('nó de item inventado pela IA leva o marcador de fonte', () => {
  const raiz = raizLimpa();
  const cat = criarCatalogo();
  cat.registrarItemIA({ nome: 'Gelo', emoji: '🧊' });
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    ar: { em: 1, via: null, fonte: 'base' },
    gelo: { em: 2, via: ['agua', 'ar'], fonte: 'ia' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: cat, T });
  arv.abrir();
  assert.equal(no(raiz, 'gelo').dataset.fonte, 'ia');
});

test('clicar num nó dá destaque a ele, marca pais/filhos e esmaece o resto', () => {
  const raiz = raizLimpa();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 1, via: null, fonte: 'base' },
    ar: { em: 1, via: null, fonte: 'base' },
    vapor: { em: 2, via: ['agua', 'fogo'], fonte: 'local' },
    nuvem: { em: 3, via: ['ar', 'vapor'], fonte: 'local' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  no(raiz, 'vapor').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.ok(no(raiz, 'vapor').classList.contains('destaque'), 'o próprio nó');
  assert.ok(no(raiz, 'agua').classList.contains('pai'), 'pai não é mais "destaque", é "pai"');
  assert.ok(no(raiz, 'fogo').classList.contains('pai'));
  assert.ok(no(raiz, 'nuvem').classList.contains('filho'));
  assert.ok(no(raiz, 'ar').classList.contains('esmaecido'), 'fora da relação, mas continua no DOM (não "morto")');
  assert.match(raiz.querySelector('.arvore-legenda').textContent, /vapor/i);
  assert.match(raiz.querySelector('.arvore-legenda').textContent, /água \+ fogo/i);
  assert.match(raiz.querySelector('.arvore-legenda').textContent, /nuvem/i);
});

test('sem foco, nenhuma aresta aparece; focando, só as diretas ficam visíveis', () => {
  const raiz = raizLimpa();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 1, via: null, fonte: 'base' },
    ar: { em: 1, via: null, fonte: 'base' },
    vapor: { em: 2, via: ['agua', 'fogo'], fonte: 'local' },
    nuvem: { em: 3, via: ['ar', 'vapor'], fonte: 'local' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();

  // 4 pares no total: agua>vapor, fogo>vapor, ar>nuvem, vapor>nuvem
  const arestas = () => [...raiz.querySelectorAll('.arvore-aresta')];
  assert.equal(arestas().length, 4);
  assert.equal(arestas().filter((a) => a.classList.contains('ativa')).length, 0, 'nenhuma visível sem foco');

  // foco em vapor: 2 pais (agua, fogo) + 1 filho (nuvem) = 3 arestas diretas
  no(raiz, 'vapor').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const ativasVapor = arestas().filter((a) => a.classList.contains('ativa'));
  assert.equal(ativasVapor.length, 3);
  assert.equal(ativasVapor.filter((a) => a.classList.contains('aresta-pai')).length, 2, 'agua->vapor e fogo->vapor');
  assert.equal(ativasVapor.filter((a) => a.classList.contains('aresta-filho')).length, 1, 'vapor->nuvem');

  // foco em ar: só ar->nuvem (ar não tem pais; nuvem é o único filho direto)
  no(raiz, 'ar').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const ativasAr = arestas().filter((a) => a.classList.contains('ativa'));
  assert.equal(ativasAr.length, 1);
  assert.ok(ativasAr[0].classList.contains('aresta-filho'));
});

test('clicar no fundo limpa o realce', () => {
  const raiz = raizLimpa();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 1, via: null, fonte: 'base' },
    vapor: { em: 2, via: ['agua', 'fogo'], fonte: 'local' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  no(raiz, 'vapor').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  raiz.querySelector('.arvore-palco').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(raiz.querySelectorAll('.arvore-no.destaque').length, 0);
  assert.equal(raiz.querySelectorAll('.arvore-no.esmaecido').length, 0);
});

test('clicar na camada de nós, fora de um nó, também limpa o realce', () => {
  const raiz = raizLimpa();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 1, via: null, fonte: 'base' },
    vapor: { em: 2, via: ['agua', 'fogo'], fonte: 'local' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  no(raiz, 'vapor').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  raiz.querySelector('.arvore-nos').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(raiz.querySelectorAll('.arvore-no.destaque').length, 0);
  assert.equal(raiz.querySelectorAll('.arvore-no.esmaecido').length, 0);
});

test('desenha uma faixa por era', () => {
  const raiz = raizLimpa();
  const save = saveCom({ agua: { em: 1, via: null, fonte: 'base' } });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  const faixas = raiz.querySelectorAll('.arvore-faixa');
  assert.equal(faixas.length, 6);
  assert.equal(raiz.querySelector('.arvore-faixa[data-era="elementos"]') !== null, true);
});

function ptr(tipo, x, y, id = 1) {
  const e = new window.Event(tipo, { bubbles: true, cancelable: true });
  e.pointerId = id;
  e.clientX = x;
  e.clientY = y;
  return e;
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

test('segurar um nó manda o item pro canvas; toque curto só realça', async () => {
  const raiz = raizLimpa();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 2, via: null, fonte: 'base' },
  });
  const enviados = [];
  const arv = montarArvore({
    raiz, store: storeFake(save), catalogo: criarCatalogo(), T,
    aoEnviarPraCanvas: (id) => enviados.push(id),
  });
  arv.abrir();

  const agua = no(raiz, 'agua');
  agua.dispatchEvent(ptr('pointerdown', 10, 10));
  await espera(500); // passa do tempo de "segurar"
  assert.ok(agua.classList.contains('segurando'));
  agua.dispatchEvent(ptr('pointerup', 10, 10));
  assert.deepEqual(enviados, ['agua']);
  assert.ok(!agua.classList.contains('destaque'), 'segurar não realça');

  const fogo = no(raiz, 'fogo');
  fogo.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(enviados, ['agua'], 'toque curto não manda pro canvas');
  assert.ok(fogo.classList.contains('destaque'), 'toque curto continua realçando');
});

test('faixa "IA" não aparece quando não há criações da IA descobertas', () => {
  const raiz = raizLimpa();
  const save = saveCom({ agua: { em: 1, via: null, fonte: 'base' } });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  assert.equal(raiz.querySelector('.arvore-faixa[data-era="ia"]'), null);
  assert.equal(raiz.querySelectorAll('.arvore-faixa').length, 6);
});

test('criação da IA descoberta ganha faixa própria, depois das 6 faixas de era', () => {
  const raiz = raizLimpa();
  const cat = criarCatalogo();
  cat.registrarItemIA({ nome: 'Gelo Estelar', emoji: '🧊', era: 'elementos' });
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    ar: { em: 1, via: null, fonte: 'base' },
    'gelo-estelar': { em: 2, via: ['agua', 'ar'], fonte: 'ia' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: cat, T });
  arv.abrir();

  const faixas = raiz.querySelectorAll('.arvore-faixa');
  assert.equal(faixas.length, 7, '6 faixas de era + 1 faixa da IA');
  const faixaIA = raiz.querySelector('.arvore-faixa[data-era="ia"]');
  assert.ok(faixaIA);
  assert.match(faixaIA.textContent, /IA/);

  // faixa da IA fica depois das 6 faixas canônicas (maior "top")
  const tops = [...faixas].map((f) => parseFloat(f.style.top));
  assert.equal(Math.max(...tops), parseFloat(faixaIA.style.top));

  const noGelo = no(raiz, 'gelo-estelar');
  assert.equal(noGelo.dataset.era, 'ia', 'nó da IA fica marcado com a faixa própria, não a era herdada');
  assert.ok(parseFloat(noGelo.style.top) > parseFloat(no(raiz, 'agua').style.top));
});

test('relações entre itens canônicos e criações da IA continuam corretas na faixa separada', () => {
  const raiz = raizLimpa();
  const cat = criarCatalogo();
  cat.registrarItemIA({ nome: 'Gelo Estelar', emoji: '🧊', era: 'elementos' });
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    ar: { em: 1, via: null, fonte: 'base' },
    'gelo-estelar': { em: 2, via: ['agua', 'ar'], fonte: 'ia' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: cat, T });
  arv.abrir();

  no(raiz, 'gelo-estelar').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.ok(no(raiz, 'agua').classList.contains('pai'));
  assert.ok(no(raiz, 'ar').classList.contains('pai'));
  assert.match(raiz.querySelector('.arvore-legenda').textContent, /água \+ ar/i);
});

test('botão Fechar remove o overlay', () => {
  const raiz = raizLimpa();
  const save = saveCom({ agua: { em: 1, via: null, fonte: 'base' } });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  raiz.querySelector('.arvore-fechar').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(raiz.querySelector('.arvore-overlay'), null);
});
