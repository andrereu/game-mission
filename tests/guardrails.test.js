import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROMPT_SISTEMA, montarPrompt, entradaValida, passaNoFiltro, parseRespostaGemini,
} from '../api/_guardrails.js';

test('PROMPT_SISTEMA pede pt_BR, conteúdo infantil e JSON', () => {
  assert.match(PROMPT_SISTEMA, /portugu/i);
  assert.match(PROMPT_SISTEMA, /crian/i);
  assert.match(PROMPT_SISTEMA, /json/i);
});

test('montarPrompt cita os dois itens', () => {
  const p = montarPrompt('Água', 'Fogo');
  assert.match(p, /Água/);
  assert.match(p, /Fogo/);
});

test('entradaValida aceita nomes curtos e recusa lixo', () => {
  assert.equal(entradaValida('Água', 'Fogo'), true);
  assert.equal(entradaValida('', 'Fogo'), false);
  assert.equal(entradaValida('Fogo', '   '), false);
  assert.equal(entradaValida('a'.repeat(60), 'Fogo'), false);
  assert.equal(entradaValida('linha\ncom quebra', 'Fogo'), false);
  assert.equal(entradaValida(42, 'Fogo'), false);
});

test('passaNoFiltro aprova combinação inocente', () => {
  assert.equal(
    passaNoFiltro({ resultadoNome: 'Nuvem de Açúcar', emoji: '☁️', texto: 'Ar doce vira nuvem de açúcar.' }),
    true,
  );
});

test('passaNoFiltro barra termo proibido no nome', () => {
  assert.equal(passaNoFiltro({ resultadoNome: 'Pistola de Água', emoji: '🔫', texto: 'Diverte no verão.' }), false);
});

test('passaNoFiltro barra termo proibido no texto', () => {
  assert.equal(passaNoFiltro({ resultadoNome: 'Poça', emoji: '💧', texto: 'Fica cheia de sangue.' }), false);
});

test('passaNoFiltro exige nome curto e texto com conteúdo', () => {
  assert.equal(passaNoFiltro({ resultadoNome: 'Uma coisa com nome longo demais pra caber', emoji: '✨', texto: 'ok ok' }), false);
  assert.equal(passaNoFiltro({ resultadoNome: 'Gelo', emoji: '🧊', texto: '' }), false);
  assert.equal(passaNoFiltro({ resultadoNome: '', emoji: '🧊', texto: 'algo' }), false);
});

test('parseRespostaGemini extrai o JSON do candidate', () => {
  const resp = {
    candidates: [{
      content: { parts: [{ text: '{"resultadoNome":"Gelo","emoji":"🧊","texto":"Água no frio vira gelo."}' }] },
    }],
  };
  assert.deepEqual(parseRespostaGemini(resp), {
    resultadoNome: 'Gelo', emoji: '🧊', texto: 'Água no frio vira gelo.',
  });
});

test('parseRespostaGemini devolve null em resposta sem texto ou sem nome', () => {
  assert.equal(parseRespostaGemini({}), null);
  assert.equal(parseRespostaGemini({ candidates: [{ content: { parts: [{ text: 'nao e json' }] } }] }), null);
  assert.equal(
    parseRespostaGemini({ candidates: [{ content: { parts: [{ text: '{"texto":"sem nome"}' }] } }] }),
    null,
  );
});

test('parseRespostaGemini completa emoji ausente', () => {
  const r = parseRespostaGemini({
    candidates: [{ content: { parts: [{ text: '{"resultadoNome":"Vento","texto":"Ar correndo."}' }] } }],
  });
  assert.equal(r.emoji, '✨');
});
