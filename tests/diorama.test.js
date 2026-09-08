import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo } from '../src/engine/catalogo.js';
import {
  FAMILIAS, familiaDoItem, thresholdsPorFamilia, resolverEstadoDiorama,
  calcularAcontecimentosPendentes, haAcontecimentosPendentes, proximoProgressoVisto,
} from '../src/engine/diorama.js';

const cat = criarCatalogo();

test('familiaDoItem classifica itens reais representativos de cada era', () => {
  assert.equal(familiaDoItem(cat.getItem('agua')), 'agua');
  assert.equal(familiaDoItem(cat.getItem('fogo')), 'terreno');
  assert.equal(familiaDoItem(cat.getItem('estrela')), 'cosmico');
  assert.equal(familiaDoItem(cat.getItem('arvore')), 'vegetacao');
  assert.equal(familiaDoItem(cat.getItem('oceano')), 'agua');
  assert.equal(familiaDoItem(cat.getItem('leao')), 'vida'); // era 'vida' inteira -> família vida
  assert.equal(familiaDoItem(cat.getItem('casa')), 'tecnologia'); // 'casa' está na era 'tecnologia' no catálogo real
  assert.equal(familiaDoItem(cat.getItem('cidade')), 'civilizacao'); // era 'cultura' -> civilizacao
});

test('familiaDoItem: toda a era "vida" mapeia pra família vida, toda "cultura" pra civilizacao, "tecnologia" pra tecnologia, "ficcao" pra cosmico', () => {
  for (const item of cat.allItems()) {
    if (item.ia) continue;
    if (item.era === 'vida') assert.equal(familiaDoItem(item), 'vida', item.id);
    if (item.era === 'cultura') assert.equal(familiaDoItem(item), 'civilizacao', item.id);
    if (item.era === 'tecnologia') assert.equal(familiaDoItem(item), 'tecnologia', item.id);
    if (item.era === 'ficcao') assert.equal(familiaDoItem(item), 'cosmico', item.id);
  }
});

test('familiaDoItem nunca devolve null pra um item real do catálogo canônico', () => {
  for (const item of cat.allItems()) {
    if (item.ia) continue;
    assert.ok(FAMILIAS.includes(familiaDoItem(item)), `${item.id} (${item.era}) sem família`);
  }
});

test('familiaDoItem: item da IA nunca entra na progressão canônica (sempre null)', () => {
  const itemIA = {
    id: 'coisa-ia', nome: 'Coisa', era: 'natureza', ia: true,
  };
  assert.equal(familiaDoItem(itemIA), null);
});

test('thresholdsPorFamilia: 4 limiares crescentes por família, derivados da contagem real do catálogo (nunca zero pra família com itens)', () => {
  const thresholds = thresholdsPorFamilia(cat);
  for (const familia of FAMILIAS) {
    const lista = thresholds[familia];
    assert.equal(lista.length, 4, familia);
    for (let i = 1; i < lista.length; i += 1) assert.ok(lista[i] >= lista[i - 1], familia);
    assert.ok(lista[3] > 0, `${familia} deveria ter itens no catálogo real`);
  }
});

test('resolverEstadoDiorama é determinístico: mesmas descobertas -> mesma estrutura', () => {
  const descobertos = { agua: {}, fogo: {}, arvore: {}, leao: {} };
  const a = resolverEstadoDiorama({ descobertos, catalogo: cat });
  const b = resolverEstadoDiorama({ descobertos, catalogo: cat });
  assert.deepEqual(a, b);
});

test('resolverEstadoDiorama: sem nenhuma descoberta, todos os níveis ficam em 0', () => {
  const estado = resolverEstadoDiorama({ descobertos: {}, catalogo: cat });
  for (const familia of FAMILIAS) assert.equal(estado.niveis[familia], 0, familia);
  assert.equal(estado.era, 'elementos');
  assert.equal(estado.temCriacoesIA, false);
});

test('resolverEstadoDiorama: descobrir itens suficientes de uma família sobe o nível dela, só dela', () => {
  const thresholds = thresholdsPorFamilia(cat);
  // pega itens reais de vegetação até bater o 1º limiar
  const vegetacaoIds = cat.allItems().filter((it) => !it.ia && familiaDoItem(it) === 'vegetacao').map((it) => it.id);
  const qtd = thresholds.vegetacao[0];
  const descobertos = {};
  for (const id of vegetacaoIds.slice(0, qtd)) descobertos[id] = {};
  const estado = resolverEstadoDiorama({ descobertos, catalogo: cat });
  assert.equal(estado.niveis.vegetacao, 1);
  for (const familia of FAMILIAS) {
    if (familia !== 'vegetacao') assert.equal(estado.niveis[familia], 0, familia);
  }
});

test('resolverEstadoDiorama: itens da IA nunca contam pros níveis canônicos, só acendem temCriacoesIA', () => {
  const catalogoComIA = criarCatalogo();
  const itemIA = {
    id: 'anomalia-x', nome: 'Anomalia X', emoji: '✨', era: 'natureza', base: false, ia: true, raridade: 'raro',
  };
  catalogoComIA.hidratarIA({ 'anomalia-x': itemIA }, {});
  const descobertos = { 'anomalia-x': {} };
  const estado = resolverEstadoDiorama({ descobertos, catalogo: catalogoComIA, itensIA: { 'anomalia-x': itemIA } });
  for (const familia of FAMILIAS) assert.equal(estado.niveis[familia], 0, familia);
  assert.equal(estado.temCriacoesIA, true);
});

test('calcularAcontecimentosPendentes: sem visto nenhum, todo nível > 0 conta como pendente', () => {
  const estado = { niveis: { terreno: 2, agua: 0, vegetacao: 1 }, era: 'natureza' };
  const eventos = calcularAcontecimentosPendentes(estado, null);
  const marcos = eventos.filter((e) => e.tipo === 'marco');
  assert.equal(marcos.length, 3); // terreno 1->2, vegetacao 0->1... (terreno tem 2 níveis, vegetacao 1)
  assert.ok(eventos.some((e) => e.tipo === 'era' && e.era === 'natureza'));
});

test('calcularAcontecimentosPendentes: mesmo estado do "visto" -> fila vazia (idempotência)', () => {
  const estado = resolverEstadoDiorama({ descobertos: { agua: {}, fogo: {} }, catalogo: cat });
  const visto = proximoProgressoVisto(estado);
  assert.deepEqual(calcularAcontecimentosPendentes(estado, visto), []);
});

test('calcularAcontecimentosPendentes: um novo marco de família gera exatamente 1 evento "marco" com de/para corretos', () => {
  const thresholds = thresholdsPorFamilia(cat);
  const aguaIds = cat.allItems().filter((it) => !it.ia && familiaDoItem(it) === 'agua').map((it) => it.id);
  const descobertosAntes = {};
  for (const id of aguaIds.slice(0, thresholds.agua[0])) descobertosAntes[id] = {};
  const antes = resolverEstadoDiorama({ descobertos: descobertosAntes, catalogo: cat });
  const visto = proximoProgressoVisto(antes);

  const descobertosDepois = { ...descobertosAntes };
  for (const id of aguaIds.slice(thresholds.agua[0], thresholds.agua[1])) descobertosDepois[id] = {};
  const depois = resolverEstadoDiorama({ descobertos: descobertosDepois, catalogo: cat });

  const marcos = calcularAcontecimentosPendentes(depois, visto).filter((e) => e.tipo === 'marco');
  assert.deepEqual(marcos, [{
    tipo: 'marco', familia: 'agua', de: 1, para: 2,
  }]);
});

test('calcularAcontecimentosPendentes: pular 2 níveis de uma vez gera 2 eventos de marco em sequência', () => {
  const thresholds = thresholdsPorFamilia(cat);
  const tecIds = cat.allItems().filter((it) => !it.ia && familiaDoItem(it) === 'tecnologia').map((it) => it.id);
  const visto = { niveis: { tecnologia: 0 }, era: 'elementos' };
  const descobertos = {};
  for (const id of tecIds.slice(0, thresholds.tecnologia[1])) descobertos[id] = {};
  const estado = resolverEstadoDiorama({ descobertos, catalogo: cat });
  const eventos = calcularAcontecimentosPendentes(estado, visto).filter((e) => e.tipo === 'marco' && e.familia === 'tecnologia');
  assert.deepEqual(eventos, [
    { tipo: 'marco', familia: 'tecnologia', de: 0, para: 1 },
    { tipo: 'marco', familia: 'tecnologia', de: 1, para: 2 },
  ]);
});

test('marco de era só aparece quando a era mais avançada realmente muda desde o último visto', () => {
  const estado = { niveis: {}, era: 'natureza' };
  assert.equal(calcularAcontecimentosPendentes(estado, { niveis: {}, era: 'natureza' }).some((e) => e.tipo === 'era'), false);
  assert.equal(calcularAcontecimentosPendentes(estado, { niveis: {}, era: 'elementos' }).some((e) => e.tipo === 'era'), true);
  // nunca "volta": se o visto já registra uma era mais avançada, sem novo evento de era
  assert.equal(calcularAcontecimentosPendentes(estado, { niveis: {}, era: 'ficcao' }).some((e) => e.tipo === 'era'), false);
});

test('haAcontecimentosPendentes: save sem diorama nunca é "pendente" (bootstrap fica a cargo de quem chama)', () => {
  const estado = resolverEstadoDiorama({ descobertos: { agua: {} }, catalogo: cat });
  assert.equal(haAcontecimentosPendentes(estado, null), false);
  assert.equal(haAcontecimentosPendentes(estado, undefined), false);
});

test('haAcontecimentosPendentes: true assim que um novo marco é alcançado depois de um "visto" existente', () => {
  const thresholds = thresholdsPorFamilia(cat);
  const vidaIds = cat.allItems().filter((it) => !it.ia && familiaDoItem(it) === 'vida').map((it) => it.id);
  const descobertosAntes = {};
  const antes = resolverEstadoDiorama({ descobertos: descobertosAntes, catalogo: cat });
  const visto = proximoProgressoVisto(antes);

  const descobertosDepois = {};
  for (const id of vidaIds.slice(0, thresholds.vida[0])) descobertosDepois[id] = {};
  const depois = resolverEstadoDiorama({ descobertos: descobertosDepois, catalogo: cat });
  assert.equal(haAcontecimentosPendentes(depois, visto), true);
});

test('save "antigo" (sem diorama nunca gravado) continua funcionando: bootstrap não trava nem lança', () => {
  const descobertosVeterano = {};
  for (const it of cat.baseItems()) descobertosVeterano[it.id] = {};
  assert.doesNotThrow(() => {
    const estado = resolverEstadoDiorama({ descobertos: descobertosVeterano, catalogo: cat });
    const visto = proximoProgressoVisto(estado); // é isto que o boot grava, sem reproduzir nada
    assert.deepEqual(calcularAcontecimentosPendentes(estado, visto), []);
  });
});
