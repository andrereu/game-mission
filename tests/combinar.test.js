import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo } from '../src/engine/catalogo.js';
import { criarCombinador } from '../src/engine/combinar.js';
import { stubDesligado } from '../src/ai/provider.js';

test('combo local é encontrado nos dois sentidos', async () => {
  const cat = criarCatalogo();
  const combinar = criarCombinador({
    catalogo: cat, aiProvider: stubDesligado, estaOnline: () => false,
  });
  const r1 = await combinar('agua', 'fogo');
  const r2 = await combinar('fogo', 'agua');
  assert.equal(r1.tipo, 'ok');
  assert.equal(r1.fonte, 'local');
  assert.equal(r1.item.id, 'vapor');
  assert.equal(r1.combo.texto, r2.combo.texto);
});

test('sem combo e offline devolve nada', async () => {
  const cat = criarCatalogo();
  const combinar = criarCombinador({
    catalogo: cat, aiProvider: stubDesligado, estaOnline: () => false,
  });
  assert.deepEqual(await combinar('robo', 'musica'), { tipo: 'nada' });
});

test('sem combo, online e IA sugere: cria item e combo com fonte ia', async () => {
  const cat = criarCatalogo();
  const aiProvider = {
    async sugerirCombo() {
      return { resultadoNome: 'Robô Musical', emoji: '🎸', texto: 'Um robô que toca música.' };
    },
  };
  const combinar = criarCombinador({ catalogo: cat, aiProvider, estaOnline: () => true });
  const r = await combinar('robo', 'musica');
  assert.equal(r.tipo, 'ok');
  assert.equal(r.fonte, 'ia');
  assert.equal(r.item.id, 'robo-musical');
  assert.equal(r.item.emoji, '🎸');
  assert.equal(r.combo.texto, 'Um robô que toca música.');
  // registrado: repetir acha como local
  const r2 = await combinar('musica', 'robo');
  assert.equal(r2.fonte, 'local');
  assert.equal(r2.item.id, 'robo-musical');
});

test('online mas IA devolve null: nada', async () => {
  const cat = criarCatalogo();
  const combinar = criarCombinador({
    catalogo: cat, aiProvider: stubDesligado, estaOnline: () => true,
  });
  assert.deepEqual(await combinar('robo', 'musica'), { tipo: 'nada' });
});

test('IA que lança erro cai em nada', async () => {
  const cat = criarCatalogo();
  const aiProvider = { async sugerirCombo() { throw new Error('falhou'); } };
  const combinar = criarCombinador({ catalogo: cat, aiProvider, estaOnline: () => true });
  assert.deepEqual(await combinar('robo', 'musica'), { tipo: 'nada' });
});

test('combo local tem prioridade sobre a IA', async () => {
  const cat = criarCatalogo();
  let chamouIA = false;
  const aiProvider = {
    async sugerirCombo() { chamouIA = true; return { resultadoNome: 'X', emoji: '❓', texto: '' }; },
  };
  const combinar = criarCombinador({ catalogo: cat, aiProvider, estaOnline: () => true });
  const r = await combinar('agua', 'fogo');
  assert.equal(r.fonte, 'local');
  assert.equal(chamouIA, false);
});
