// V1.3: testes de UI reais (jsdom) pro Diorama — cobre o que só existe na
// camada de apresentação (src/ui/diorama.js): nunca colapsar transições da
// mesma família numa só, e preservar corretamente o que ainda não foi
// mostrado quando a criança fecha no meio da sequência. O motor
// (src/engine/diorama.js) já é coberto à parte em diorama.test.js e
// diorama-pipeline.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo } from '../src/engine/catalogo.js';
import { criarStore } from '../src/engine/state.js';
import { saveInicial } from '../src/engine/storage.js';
import { familiaDoItem, thresholdsPorFamilia } from '../src/engine/diorama.js';
import { montarDiorama } from '../src/ui/diorama.js';
import { elementosDaFamilia } from '../src/ui/diorama-mundo.js';
import { T } from '../src/data/textos.js';

const cat = criarCatalogo();

function forcarReducedMotion() {
  const antes = window.matchMedia;
  window.matchMedia = (q) => ({
    matches: /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {},
  });
  return () => { window.matchMedia = antes; };
}

function raizLimpa() {
  document.body.innerHTML = '<div id="diorama-raiz"></div>';
  return document.getElementById('diorama-raiz');
}

function montar(save) {
  const raiz = raizLimpa();
  const store = criarStore(save);
  const audio = { falarSelecao() {}, tocarSelecao() {} };
  const diorama = montarDiorama({
    raiz, store, catalogo: cat, T, audio,
  });
  return { diorama, store, raiz };
}

test('reproduzir a fila nunca colapsa 2 marcos da mesma família num só: cada nível vira sua própria linha no progresso persistido', async () => {
  const restaurar = forcarReducedMotion();
  try {
    const save = saveInicial(cat);
    const { diorama, store } = montar(save);
    diorama.garantirBootstrap();

    // pega itens reais de tecnologia suficientes pra pular 2 níveis de
    // uma vez (mesmo cenário do teste de engine "pular 2 níveis", agora
    // through a camada de UI de verdade).
    const thresholds = thresholdsPorFamilia(cat);
    const ids = cat.allItems().filter((it) => !it.ia && familiaDoItem(it) === 'tecnologia').map((it) => it.id);
    for (const id of ids.slice(0, thresholds.tecnologia[1])) store.recordDiscovery(id, null, 'combo');

    diorama.abrir();
    // dá tempo da fila (com reduced-motion, tudo resolve quase na hora)
    // rodar por completo.
    await new Promise((r) => { setTimeout(r, 50); });

    const visto = diorama._paraTeste.progressoVisto();
    assert.equal(visto.niveis.tecnologia, 2, 'os dois níveis devem ter sido persistidos ao final');
  } finally {
    restaurar();
  }
});

test('fechar o Diorama no meio da sequência preserva o que ainda não foi mostrado (nunca marca como visto o que não tocou)', async () => {
  // Propositalmente SEM reduced-motion aqui: precisamos de tempo real
  // passando pra conseguir fechar no MEIO da fila (com reduced-motion,
  // esperar() resolve na mesma microtask e a fila inteira terminaria
  // antes de qualquer setTimeout de teste rodar).
  const save = saveInicial(cat);
  const { diorama, store } = montar(save);
  diorama.garantirBootstrap();

  const thresholds = thresholdsPorFamilia(cat);
  const idsTec = cat.allItems().filter((it) => !it.ia && familiaDoItem(it) === 'tecnologia').map((it) => it.id);
  for (const id of idsTec.slice(0, thresholds.tecnologia[3])) store.recordDiscovery(id, null, 'combo');
  // confirma que realmente preparamos uma fila com vários marcos pendentes
  const pendentesAntes = diorama._paraTeste.pendentes();
  const totalAntes = pendentesAntes.filter((e) => e.tipo === 'marco' && e.familia === 'tecnologia').length;
  assert.ok(totalAntes >= 3, `precisa de pelo menos 3 marcos pendentes pra este teste, veio ${totalAntes}`);

  diorama.abrir();
  // a pausa de orientação (500ms) + o 1º marco (~760ms) ainda não
  // terminaram aos 700ms — fecha certamente no meio da sequência.
  await new Promise((r) => { setTimeout(r, 700); });
  diorama.fechar();
  // dá tempo do finally{} (já em andamento) persistir o que foi mostrado.
  await new Promise((r) => { setTimeout(r, 100); });

  const visto = diorama._paraTeste.progressoVisto();
  assert.ok(
    (visto?.niveis?.tecnologia || 0) < 4,
    'fechar antes do fim não pode marcar como visto níveis que nunca foram exibidos',
  );

  // reabrir mais tarde ainda deve ter o restante pendente (nada foi
  // perdido silenciosamente).
  const pendentesDepois = diorama._paraTeste.pendentes();
  const totalRestante = pendentesDepois.filter((e) => e.tipo === 'marco' && e.familia === 'tecnologia').length;
  assert.ok(totalRestante > 0, 'o que não foi mostrado precisa continuar pendente pra próxima visita');
});

test('perfis independentes: pendências de um perfil nunca vazam pro estado inicial de outro', () => {
  const saveA = saveInicial(cat);
  const { diorama: diaA, store: storeA } = montar(saveA);
  diaA.garantirBootstrap();
  const thresholds = thresholdsPorFamilia(cat);
  const idsVeg = cat.allItems().filter((it) => !it.ia && familiaDoItem(it) === 'vegetacao').map((it) => it.id);
  for (const id of idsVeg.slice(0, thresholds.vegetacao[0])) storeA.recordDiscovery(id, null, 'combo');
  assert.equal(diaA.temPendentes(), true);

  const saveB = saveInicial(cat);
  const { diorama: diaB } = montar(saveB);
  diaB.garantirBootstrap();
  assert.equal(diaB.temPendentes(), false, 'um perfil novo não pode herdar pendências de outro perfil');
});


// ---- V2 A2: Tecnologia cumulativa + ponte na fila ----

test('COMPOSICAO tecnologia é cumulativa/evolutiva: N1 oficina, N2 engenho (substitui), N3 engenho+observatório, N4 engenho+observatório+foguete', () => {
  const n1 = elementosDaFamilia('tecnologia', 1).map((e) => e.elemento);
  const n2 = elementosDaFamilia('tecnologia', 2).map((e) => e.elemento);
  const n3 = elementosDaFamilia('tecnologia', 3).map((e) => e.elemento).sort();
  const n4 = elementosDaFamilia('tecnologia', 4).map((e) => e.elemento).sort();
  assert.deepEqual(n1, ['ferramenta']);
  assert.deepEqual(n2, ['engrenagem']); // substitui a oficina no mesmo ponto
  assert.deepEqual(n3, ['engrenagem', 'observatorio']);
  assert.deepEqual(n4, ['engrenagem', 'foguete', 'observatorio']);
  // âncoras aprovadas
  const porElem = Object.fromEntries(elementosDaFamilia('tecnologia', 4).map((e) => [e.elemento, e]));
  assert.equal(porElem.engrenagem.anchor, 'clareira_esquerda');
  assert.equal(porElem.observatorio.anchor, 'alto_observatorio');
  assert.equal(porElem.foguete.anchor, 'arco_rochoso');
});

test('ponte: fechar o Diorama antes do beat da ponte NÃO marca a ponte como vista e ela continua pendente', async () => {
  const save = saveInicial(cat);
  const { diorama, store } = montar(save);
  diorama.garantirBootstrap();

  // fila longa de marcos de tecnologia + a descoberta canônica da ponte,
  // pra a fila ter vários beats ANTES do beat de construção da ponte.
  const thresholds = thresholdsPorFamilia(cat);
  const idsTec = cat.allItems().filter((it) => !it.ia && familiaDoItem(it) === 'tecnologia').map((it) => it.id);
  for (const id of idsTec.slice(0, thresholds.tecnologia[3])) store.recordDiscovery(id, null, 'combo');
  store.recordDiscovery('ponte', null, 'combo');

  const pend = diorama._paraTeste.pendentes();
  assert.equal(pend.filter((e) => e.tipo === 'construcao').length, 1, 'construção da ponte precisa estar pendente');

  diorama.abrir();
  // 700ms: pausa de orientação (500) + 1º marco (~760) ainda rolando -> o
  // beat da ponte (depois dos marcos) com certeza ainda não aconteceu.
  await new Promise((r) => { setTimeout(r, 700); });
  diorama.fechar();
  await new Promise((r) => { setTimeout(r, 100); });

  const visto = diorama._paraTeste.progressoVisto();
  assert.equal(visto?.ponte, false, 'a ponte não pode ser marcada como vista antes do seu beat');
  const restante = diorama._paraTeste.pendentes();
  assert.equal(restante.filter((e) => e.tipo === 'construcao').length, 1, 'a construção da ponte continua pendente pra próxima visita');
});

test('ponte: uma vez reproduzido o beat, reabrir não repete (idempotente na camada de UI)', async () => {
  const restaurar = forcarReducedMotion();
  try {
    const save = saveInicial(cat);
    const { diorama, store } = montar(save);
    diorama.garantirBootstrap();
    store.recordDiscovery('ponte', null, 'combo');
    assert.equal(diorama._paraTeste.pendentes().some((e) => e.tipo === 'construcao'), true);

    diorama.abrir();
    await new Promise((r) => { setTimeout(r, 50); });
    assert.equal(diorama._paraTeste.progressoVisto().ponte, true, 'depois do beat, a ponte fica registrada como vista');
    diorama.fechar();

    diorama.abrir();
    await new Promise((r) => { setTimeout(r, 50); });
    assert.equal(diorama._paraTeste.pendentes().some((e) => e.tipo === 'construcao'), false, 'reabrir não repete o beat da ponte');
  } finally {
    restaurar();
  }
});
