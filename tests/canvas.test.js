// tests/canvas.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo } from '../src/engine/catalogo.js';
import { criarStore } from '../src/engine/state.js';
import { criarCombinador } from '../src/engine/combinar.js';
import { stubDesligado } from '../src/ai/provider.js';
import { montarCanvas } from '../src/ui/canvas.js';

function ambiente() {
  document.body.innerHTML = '<section id="canvas" class="canvas"></section>';
  const cat = criarCatalogo();
  const store = criarStore({
    versao: 1,
    descobertos: {
      agua: { em: 1, via: null, fonte: 'base' },
      fogo: { em: 1, via: null, fonte: 'base' },
    },
    canvas: [],
    ajustes: { som: false, iaLigada: false },
  });
  const combinar = criarCombinador({
    catalogo: cat, aiProvider: stubDesligado, estaOnline: () => false,
  });
  return { cat, store, combinar, raiz: document.getElementById('canvas') };
}

test('soltarItem cria uma peça no DOM e no store', () => {
  const { cat, store, combinar, raiz } = ambiente();
  const api = montarCanvas({ raiz, store, catalogo: cat, combinar, aoResultado() {} });
  api.soltarItem('agua', 100, 100);
  assert.equal(store.listInstances().length, 1);
  assert.equal(raiz.querySelectorAll('.peca').length, 1);
});

test('fundir duas peças sobrepostas gera o resultado e a descoberta', async () => {
  const { cat, store, combinar, raiz } = ambiente();
  const resultados = [];
  const api = montarCanvas({
    raiz, store, catalogo: cat, combinar,
    aoResultado: (r, ctx) => resultados.push({ r, ctx }),
  });
  const a = api.soltarItem('agua', 100, 100);
  const b = api.soltarItem('fogo', 100, 100); // mesma posição = sobreposto
  await api._fundirParaTeste(a.uid, b.uid);
  assert.ok(store.isDiscovered('vapor'));
  const ids = store.listInstances().map((i) => i.id);
  assert.deepEqual(ids, ['vapor']);
  assert.equal(resultados.at(-1).r.item.id, 'vapor');
  assert.equal(resultados.at(-1).ctx.novo, true);
});

test('destruirTudo limpa o canvas mas não as descobertas', async () => {
  const { cat, store, combinar, raiz } = ambiente();
  const api = montarCanvas({ raiz, store, catalogo: cat, combinar, aoResultado() {} });
  const a = api.soltarItem('agua', 10, 10);
  const b = api.soltarItem('fogo', 10, 10);
  await api._fundirParaTeste(a.uid, b.uid);
  api.soltarItem('agua', 200, 200);
  api.destruirTudo();
  assert.equal(store.listInstances().length, 0);
  assert.equal(raiz.querySelectorAll('.peca').length, 0);
  assert.ok(store.isDiscovered('vapor'));
});
