import test from 'node:test';
import assert from 'node:assert/strict';
import { AVATARES, getAvatar, avatarPadrao } from '../src/data/avatares.js';
import { avatarSvgMarkup } from '../src/ui/avatarSvg.js';

test('existem exatamente 8 medalhões temáticos', () => {
  assert.equal(AVATARES.length, 8);
});

test('o primeiro medalhão é explicitamente a carinha neutra ("eu"), não um emoji do SO', () => {
  assert.equal(AVATARES[0].tema, 'eu');
  assert.equal(AVATARES[0].emoji, '🙂');
});

test('cada medalhão tem um tema único e um id semântico e estável (não é o emoji)', () => {
  const temas = new Set(AVATARES.map((a) => a.tema));
  const ids = new Set(AVATARES.map((a) => a.id));
  assert.equal(temas.size, 8, 'temas não se repetem');
  assert.equal(ids.size, 8, 'ids não se repetem');
  for (const av of AVATARES) {
    assert.notEqual(av.id, av.emoji, 'id nunca é o próprio emoji');
  }
});

test('todo medalhão está pronto para receber asset próprio (assetSrc) sem quebrar o save', () => {
  for (const av of AVATARES) {
    assert.ok('assetSrc' in av);
    assert.equal(av.assetSrc, null, 'por enquanto nenhum tem asset — usa o ícone SVG embutido');
  }
});

test('getAvatar cai no primeiro avatar quando o id é desconhecido', () => {
  assert.equal(getAvatar('inexistente'), AVATARES[0]);
});

test('avatarPadrao é determinístico pro mesmo id de perfil', () => {
  assert.equal(avatarPadrao('perfil-x'), avatarPadrao('perfil-x'));
  assert.ok(AVATARES.some((a) => a.id === avatarPadrao('perfil-x')));
});

test('avatarSvgMarkup desenha um SVG (nunca emoji cru) quando não há assetSrc', () => {
  for (const av of AVATARES) {
    const html = avatarSvgMarkup(av.id);
    assert.match(html, /<svg/);
    assert.doesNotMatch(html, new RegExp(av.emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('avatarSvgMarkup usa <img> com fallback pro SVG quando o avatar tem assetSrc', () => {
  // simula a chegada de um asset próprio pro avatar 'nova', sem acoplar o
  // save ao caminho do arquivo (o save só guarda o id, nunca o assetSrc).
  const alvo = AVATARES.find((a) => a.id === 'nova');
  const original = alvo.assetSrc;
  alvo.assetSrc = 'assets/avatares/eu.webp';
  try {
    const html = avatarSvgMarkup('nova');
    assert.match(html, /<img/);
    assert.match(html, /assets\/avatares\/eu\.webp/);
    assert.match(html, /onerror=/, 'tem fallback automático pro SVG se a imagem falhar');
  } finally {
    alvo.assetSrc = original;
  }
});
