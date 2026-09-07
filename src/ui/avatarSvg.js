// Desenha a carinha de um avatar (ver src/data/avatares.js) como SVG inline
// simples e original — nunca emoji do sistema, nunca imagem de CDN.
import { getAvatar } from '../data/avatares.js';

function olhos(tipo) {
  switch (tipo) {
    case 'redondos':
      return '<circle cx="38" cy="45" r="6"/><circle cx="62" cy="45" r="6"/>';
    case 'estrela':
      return '<path d="M38 39l2.6 5.3 5.9.8-4.3 4.1 1 5.8L38 52l-5.2 3-1-5.8-4.3-4.1 5.9-.8z"/>'
        + '<path d="M62 39l2.6 5.3 5.9.8-4.3 4.1 1 5.8-5.2-3-5.2 3 1-5.8-4.3-4.1 5.9-.8z"/>';
    case 'piscando':
      return '<path d="M32 45q6-7 12 0" fill="none" stroke-width="3.5" stroke-linecap="round"/><circle cx="62" cy="45" r="6"/>';
    case 'oculos':
      return '<circle cx="38" cy="46" r="9" fill="none" stroke-width="3.5"/><circle cx="62" cy="46" r="9" fill="none" stroke-width="3.5"/><path d="M47 46h6" stroke-width="3.5"/>';
    case 'sonolento':
      return '<path d="M32 46q6 4 12 0" fill="none" stroke-width="3.5" stroke-linecap="round"/><path d="M56 46q6 4 12 0" fill="none" stroke-width="3.5" stroke-linecap="round"/>';
    case 'felizes':
    default:
      return '<path d="M32 48q6-9 12 0" fill="none" stroke-width="3.5" stroke-linecap="round"/><path d="M56 48q6-9 12 0" fill="none" stroke-width="3.5" stroke-linecap="round"/>';
  }
}

function boca(tipo) {
  switch (tipo) {
    case 'aberta':
      return '<ellipse cx="50" cy="66" rx="10" ry="7"/>';
    case 'reta':
      return '<path d="M40 66h20" fill="none" stroke-width="3.5" stroke-linecap="round"/>';
    case 'oh':
      return '<circle cx="50" cy="66" r="5"/>';
    case 'lingua':
      return '<path d="M38 62q12 14 24 0" fill="none" stroke-width="3.5" stroke-linecap="round"/><path d="M46 66q4 6 8 0" />';
    case 'sorriso':
    default:
      return '<path d="M36 60q14 14 28 0" fill="none" stroke-width="3.5" stroke-linecap="round"/>';
  }
}

export function avatarSvgMarkup(avatarId) {
  const av = getAvatar(avatarId);
  return `<svg viewBox="0 0 100 100" role="img" aria-hidden="true" focusable="false">
    <circle cx="50" cy="50" r="48" fill="${av.cor}" />
    <circle cx="50" cy="50" r="48" fill="#0a0f1c" fill-opacity="0.08" />
    <g fill="#12172a" stroke="#12172a">${olhos(av.olhos)}${boca(av.boca)}</g>
  </svg>`;
}
