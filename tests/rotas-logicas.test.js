// Rotas lógicas alternativas adicionadas nesta rodada: caminhos novos até
// resultados já existentes, sem mexer no cânone. Ver src/data/combos.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { combos } from '../src/data/combos.js';
import { itens } from '../src/data/itens.js';
import { criarCatalogo, comboKey } from '../src/engine/catalogo.js';
import { criarCombinador } from '../src/engine/combinar.js';

const NOVAS_ROTAS = [
  ['terra', 'terra', 'montanha'],
  ['agua', 'poeira', 'lama'],
  ['lava', 'agua', 'pedra'],
  ['nuvem', 'nuvem', 'tempestade'],
  ['nuvem', 'frio', 'neve'],
  ['gelo', 'gelo', 'geleira'],
  ['chuva', 'chuva', 'lago'],
  ['rio', 'rio', 'lago'],
  ['lago', 'lago', 'oceano'],
  ['agua', 'areia', 'praia'],
  ['oceano', 'terra', 'ilha'],
  ['semente', 'agua', 'planta'],
  ['vida', 'agua', 'peixe'],
  ['vida', 'ar', 'passaro'],
  ['fogo', 'vapor', 'motor'],
  ['papel', 'papel', 'livro'],
  ['madeira', 'metal', 'ferramenta'],
  ['vidro', 'madeira', 'janela'],
  ['casa', 'casa', 'cidade'],
  ['fruta', 'gelo', 'sorvete'],
];

// receitas do cânone anterior que NÃO podem mudar de resultado nesta rodada
const CANONE_PRESERVADO = [
  ['agua', 'agua', 'oceano'],
  ['ar', 'fogo', 'energia'],
  ['vento', 'nuvem', 'chuva'],
  ['chuva', 'terra', 'planta'],
  ['eletricidade', 'metal', 'bateria'],
];

// associações explicitamente rejeitadas nesta rodada (não devem existir)
const NAO_ADICIONAR = [
  ['oceano', 'lua'],
  ['computador', 'eletricidade'],
];

test('todas as 20 rotas lógicas novas existem com o resultado esperado', () => {
  const cat = criarCatalogo();
  for (const [a, b, resultado] of NOVAS_ROTAS) {
    const combo = cat.findCombo(a, b);
    assert.ok(combo, `rota ausente: ${a} + ${b}`);
    assert.equal(combo.resultado, resultado, `${a} + ${b} deveria dar ${resultado}`);
  }
});

test('as novas rotas funcionam com os ingredientes em qualquer ordem', () => {
  const cat = criarCatalogo();
  for (const [a, b, resultado] of NOVAS_ROTAS) {
    assert.equal(cat.findCombo(a, b).resultado, resultado);
    assert.equal(cat.findCombo(b, a).resultado, resultado);
  }
});

test('nenhuma dupla (ordem ignorada) tem dois resultados diferentes em todo o catálogo', () => {
  const vistos = new Map();
  for (const c of combos) {
    const k = comboKey(c.a, c.b);
    if (vistos.has(k)) {
      assert.equal(vistos.get(k), c.resultado, `dupla ${k} com resultados diferentes`);
    }
    vistos.set(k, c.resultado);
  }
});

test('as receitas do cânone anterior continuam produzindo o mesmo resultado', () => {
  const cat = criarCatalogo();
  for (const [a, b, resultado] of CANONE_PRESERVADO) {
    assert.equal(cat.findCombo(a, b).resultado, resultado, `${a} + ${b} não pode mudar de resultado`);
  }
});

test('associações pedagogicamente ruins citadas na rodada não foram adicionadas', () => {
  const cat = criarCatalogo();
  for (const [a, b] of NAO_ADICIONAR) {
    assert.equal(cat.findCombo(a, b), undefined, `${a} + ${b} não deveria existir`);
  }
});

test('nenhum item ou resultado das novas rotas depende da IA (tudo resolve offline, sem aiProvider)', async () => {
  const cat = criarCatalogo();
  const combinar = criarCombinador({
    catalogo: cat,
    aiProvider: null,
    estaOnline: () => false,
    aoRegistrarIA: () => { throw new Error('não deveria registrar IA pra uma rota curada'); },
  });
  for (const [a, b, resultado] of NOVAS_ROTAS) {
    const r = await combinar(a, b);
    assert.equal(r.tipo, 'ok');
    assert.equal(r.fonte, 'local');
    assert.equal(r.item.id, resultado);
    assert.notEqual(cat.getItem(resultado).ia, true);
  }
});

test('as novas rotas não introduziram nenhum item novo no catálogo', () => {
  const idsConhecidos = new Set(itens.map((it) => it.id));
  for (const [a, b, resultado] of NOVAS_ROTAS) {
    assert.ok(idsConhecidos.has(a));
    assert.ok(idsConhecidos.has(b));
    assert.ok(idsConhecidos.has(resultado));
  }
});
