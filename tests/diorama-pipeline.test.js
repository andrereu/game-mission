// Auditoria "STOP visual polish": verifica o caminho REAL ponta a ponta
// (descoberta -> store -> estado derivado -> fila de pendências -> marcar
// visto -> reabrir sem repetir), usando o catálogo e o store de verdade —
// não só o motor isolado (já coberto em tests/diorama.test.js). Não muda
// thresholds/milestones: só confirma que o cano de eventos em si (que já
// existia) está correto, exatamente como pedido na auditoria antes de
// qualquer ajuste de cadência.
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo } from '../src/engine/catalogo.js';
import { criarStore } from '../src/engine/state.js';
import { saveInicial } from '../src/engine/storage.js';
import {
  resolverEstadoDiorama, calcularAcontecimentosPendentes, haAcontecimentosPendentes,
  proximoProgressoVisto, thresholdsPorFamilia, familiaDoItem,
} from '../src/engine/diorama.js';

const cat = criarCatalogo();

function estadoDoStore(store) {
  const save = store.getSave();
  return resolverEstadoDiorama({ descobertos: save.descobertos, catalogo: cat, itensIA: save.itensIA });
}

test('pipeline real: perfil recém-criado (saveInicial) não tem pendências antes do bootstrap rodar', () => {
  const store = criarStore(saveInicial(cat));
  // garantirBootstrap (src/ui/diorama.js) ainda não rodou -> save.diorama
  // não existe -> nunca "pendente" (evita inundar quem nunca abriu).
  assert.equal(store.getSave().diorama, undefined);
  assert.equal(haAcontecimentosPendentes(estadoDoStore(store), store.getSave().diorama), false);
});

test('pipeline real: descoberta via store.recordDiscovery gera delta, entra na fila, some após marcar visto, e reabrir não repete', () => {
  const store = criarStore(saveInicial(cat));

  // bootstrap silencioso (mesma chamada que src/ui/diorama.js faz no boot)
  store.setDiorama(proximoProgressoVisto(estadoDoStore(store)));
  assert.equal(haAcontecimentosPendentes(estadoDoStore(store), store.getSave().diorama), false);

  // acha itens reais de uma família com threshold baixo (vegetação: 5) pra
  // não depender de nenhum número inventado no teste.
  const thresholds = thresholdsPorFamilia(cat);
  const idsVegetacao = cat.allItems()
    .filter((it) => !it.ia && familiaDoItem(it) === 'vegetacao')
    .map((it) => it.id);
  assert.ok(idsVegetacao.length >= thresholds.vegetacao[0], 'catálogo real precisa ter itens suficientes pra este teste');

  // descobre um a um, via o caminho real (store.recordDiscovery, o mesmo
  // que o app usa quando uma combinação dá certo) — confirma que CADA
  // descoberta é refletida no delta assim que cruza o threshold real.
  // (filtra por tipo 'marco': o primeiro item de vegetação também é o
  // primeiro item da era 'natureza', então um evento de ERA — legítimo e
  // independente do threshold de família — aparece antes do marco; isso
  // é o comportamento correto, não o que este teste está verificando.)
  let ficouPendenteNoLimiar = false;
  for (let i = 0; i < thresholds.vegetacao[0]; i += 1) {
    store.recordDiscovery(idsVegetacao[i], null, 'combo');
    const marcos = calcularAcontecimentosPendentes(estadoDoStore(store), store.getSave().diorama)
      .filter((e) => e.tipo === 'marco');
    if (i < thresholds.vegetacao[0] - 1) {
      assert.equal(marcos.length, 0, `não deveria haver marco antes do limiar (item ${i + 1}/${thresholds.vegetacao[0]})`);
    } else {
      ficouPendenteNoLimiar = marcos.length > 0;
    }
  }
  assert.equal(ficouPendenteNoLimiar, true, 'o item que cruza o limiar real deveria gerar um evento pendente');

  const fila = calcularAcontecimentosPendentes(estadoDoStore(store), store.getSave().diorama)
    .filter((e) => e.tipo === 'marco');
  assert.equal(fila.length, 1);
  assert.deepEqual(fila[0], {
    tipo: 'marco', familia: 'vegetacao', de: 0, para: 1,
  });

  // "abrir o Diorama reproduz e marca como visto" = exatamente isto:
  store.setDiorama(proximoProgressoVisto(estadoDoStore(store)));

  // reabrir sem nova descoberta nunca repete o mesmo marco.
  assert.equal(haAcontecimentosPendentes(estadoDoStore(store), store.getSave().diorama), false);
  assert.deepEqual(calcularAcontecimentosPendentes(estadoDoStore(store), store.getSave().diorama), []);

  // reload "de verdade" (novo store a partir do mesmo save serializado) —
  // idempotência sobrevive a serialização, não só à mesma instância em
  // memória.
  const saveRecarregado = JSON.parse(JSON.stringify(store.getSave()));
  const storeRecarregado = criarStore(saveRecarregado);
  assert.equal(haAcontecimentosPendentes(estadoDoStore(storeRecarregado), storeRecarregado.getSave().diorama), false);
});

test('pipeline real: família "terreno" cruza o próprio limiar mas não tem nenhuma manifestação visual registrada (COMPOSICAO vazia) — achado da auditoria, não uma correção', () => {
  // Este teste documenta o estado ATUAL (não o desejado): o motor emite
  // um evento de marco real pra terreno, mas src/ui/diorama-mundo.js não
  // tem entrada de COMPOSICAO pra essa família — só água e vegetação
  // mudam a geografia, terreno não muda nada visível hoje.
  const store = criarStore(saveInicial(cat));
  store.setDiorama(proximoProgressoVisto(estadoDoStore(store)));

  const thresholds = thresholdsPorFamilia(cat);
  const idsTerreno = cat.allItems()
    .filter((it) => !it.ia && familiaDoItem(it) === 'terreno')
    .map((it) => it.id)
    .filter((id) => !store.isDiscovered(id));
  for (let i = 0; i < thresholds.terreno[0] - store.getSave().diorama.niveis.terreno; i += 1) {
    store.recordDiscovery(idsTerreno[i], null, 'combo');
  }
  const fila = calcularAcontecimentosPendentes(estadoDoStore(store), store.getSave().diorama);
  assert.ok(fila.some((e) => e.tipo === 'marco' && e.familia === 'terreno'), 'o motor precisa mesmo emitir o marco de terreno (comportamento real de hoje)');
});
