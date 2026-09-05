import test from 'node:test';
import assert from 'node:assert/strict';
import { itens } from '../src/data/itens.js';
import { combos } from '../src/data/combos.js';
import { criarCatalogo, comboKey, ERAS } from '../src/engine/catalogo.js';

test('todo id de item é único', () => {
  const vistos = new Set();
  for (const it of itens) {
    assert.ok(!vistos.has(it.id), `id repetido: ${it.id}`);
    vistos.add(it.id);
  }
});

test('todo item tem os campos obrigatórios e era válida', () => {
  for (const it of itens) {
    assert.equal(typeof it.id, 'string');
    assert.ok(it.nome, `sem nome: ${it.id}`);
    assert.ok(it.emoji || it.svg, `sem ícone: ${it.id}`);
    assert.ok(ERAS.includes(it.era), `era inválida em ${it.id}: ${it.era}`);
    assert.equal(typeof it.base, 'boolean');
  }
});

test('todo a/b/resultado de combo existe em itens', () => {
  const cat = criarCatalogo();
  for (const c of combos) {
    assert.ok(cat.getItem(c.a), `combo com 'a' inexistente: ${c.a}`);
    assert.ok(cat.getItem(c.b), `combo com 'b' inexistente: ${c.b}`);
    assert.ok(cat.getItem(c.resultado), `combo com resultado inexistente: ${c.resultado}`);
  }
});

test('todo combo curado tem texto não vazio', () => {
  for (const c of combos) {
    assert.ok(c.texto && c.texto.trim().length > 0, `combo sem texto: ${c.a}+${c.b}`);
  }
});

test('não há duas entradas para a mesma chave de combo', () => {
  const vistos = new Set();
  for (const c of combos) {
    const k = comboKey(c.a, c.b);
    assert.ok(!vistos.has(k), `chave de combo repetida: ${k}`);
    vistos.add(k);
  }
});

test('todo item não-base é alcançável a partir dos itens base', () => {
  const cat = criarCatalogo();
  const alcancavel = new Set(cat.baseItems().map((it) => it.id));
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const c of combos) {
      if (alcancavel.has(c.a) && alcancavel.has(c.b) && !alcancavel.has(c.resultado)) {
        alcancavel.add(c.resultado);
        mudou = true;
      }
    }
  }
  const inalcancaveis = cat.allItems()
    .filter((it) => !it.base && !alcancavel.has(it.id))
    .map((it) => it.id);
  assert.deepEqual(inalcancaveis, [], `itens inalcançáveis: ${inalcancaveis.join(', ')}`);
});

test('todo caminho de svg declarado aponta para arquivo existente', async () => {
  const { existsSync } = await import('node:fs');
  for (const it of itens) {
    if (it.svg) {
      assert.ok(existsSync(it.svg), `svg ausente: ${it.svg} (item ${it.id})`);
    }
  }
});
