// Coloca uma descoberta do catálogo dentro do mesmo medalhão cósmico usado em
// todas as superfícies. O contêiner continua sendo SVG inline (leve e nítido),
// enquanto o centro usa o emoji canônico do item no jogo.
import { getAvatar } from '../data/avatares.js';

export function avatarSvgMarkup(avatarId) {
  const av = getAvatar(avatarId);
  return `<svg viewBox="0 0 100 100" role="img" aria-hidden="true" focusable="false" data-era="${av.era}">
    <circle cx="50" cy="50" r="47" fill="#071225" stroke="${av.cor}" stroke-width="3" />
    <circle cx="50" cy="50" r="41" fill="${av.cor}" fill-opacity="0.16" />
    <ellipse cx="50" cy="50" rx="48" ry="23" fill="none" stroke="${av.cor}" stroke-opacity="0.7" stroke-width="1.5" transform="rotate(-18 50 50)" />
    <circle cx="91" cy="36" r="3.2" fill="#ffe66b" />
    <circle cx="18" cy="73" r="1.8" fill="#fff" fill-opacity="0.9" />
    <text x="50" y="64" text-anchor="middle" font-size="47" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${av.emoji}</text>
  </svg>`;
}
