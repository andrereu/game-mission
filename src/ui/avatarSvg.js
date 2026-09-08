// Desenha o medalhão de um avatar (ver src/data/avatares.js) como SVG inline
// simples e original — nunca emoji do sistema (renderiza diferente entre
// Android/iOS/desktop), nunca imagem de CDN. Se o avatar já tiver um
// `assetSrc` (ilustração própria futura), usa <img> com fallback pro ícone
// SVG caso o arquivo falhe — a lógica de save nunca depende do caminho do
// arquivo, só do `id`.
import { getAvatar } from '../data/avatares.js';

const INK = '#12172a';

function icone(tipo) {
  switch (tipo) {
    case 'natureza': // 🌳 copa + tronco
      return '<circle cx="50" cy="40" r="22"/>'
        + `<rect x="45" y="58" width="10" height="16" rx="2" fill="${INK}"/>`;
    case 'bichos': // 🐾 pata
      return '<circle cx="50" cy="56" r="14"/>'
        + '<circle cx="30" cy="42" r="7"/><circle cx="70" cy="42" r="7"/>'
        + '<circle cx="38" cy="26" r="6.5"/><circle cx="62" cy="26" r="6.5"/>';
    case 'elementos': // 🔥 chama
      return '<path d="M50 22c8 10 16 18 16 30a16 16 0 1 1-32 0c0-6 3-10 6-14 1 6 4 8 6 6-2-9 0-16 4-22z"/>';
    case 'tecnologia': // ⚙️ engrenagem
      return '<circle cx="50" cy="50" r="13" fill="none" stroke-width="7"/>'
        + '<g>'
        + '<rect x="46" y="18" width="8" height="14" rx="2"/>'
        + '<rect x="46" y="68" width="8" height="14" rx="2"/>'
        + '<rect x="18" y="46" width="14" height="8" rx="2"/>'
        + '<rect x="68" y="46" width="14" height="8" rx="2"/>'
        + '<rect x="27" y="27" width="8" height="14" rx="2" transform="rotate(45 31 34)"/>'
        + '<rect x="65" y="27" width="8" height="14" rx="2" transform="rotate(-45 69 34)"/>'
        + '<rect x="27" y="59" width="8" height="14" rx="2" transform="rotate(-45 31 66)"/>'
        + '<rect x="65" y="59" width="8" height="14" rx="2" transform="rotate(45 69 66)"/>'
        + '</g>';
    case 'ciencia': // 🧪 frasco borbulhando
      return `<path d="M42 20h16v18l14 26a8 8 0 0 1-7 12H35a8 8 0 0 1-7-12l14-26z" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`
        + `<path d="M35 52h30l8 14a5 5 0 0 1-4.4 7.4H31.4A5 5 0 0 1 27 66z"/>`
        + '<circle cx="46" cy="62" r="2.6" fill="#fff" fill-opacity="0.6"/>'
        + '<circle cx="55" cy="66" r="2" fill="#fff" fill-opacity="0.6"/>';
    case 'espaco': // 🪐 planeta com anel
      return '<circle cx="50" cy="52" r="15"/>'
        + `<ellipse cx="50" cy="52" rx="30" ry="8" fill="none" stroke="${INK}" stroke-width="4" transform="rotate(-14 50 52)"/>`;
    case 'misterio': // ✨ estrela cadente / brilho
      return '<path d="M50 20l6 20 20 6-20 6-6 20-6-20-20-6 20-6z"/>'
        + '<circle cx="78" cy="26" r="4"/>'
        + '<circle cx="24" cy="72" r="3"/>';
    case 'carinha': // 🙂 carinha neutra — explícita, nunca depende do emoji do SO
    default:
      return '<path d="M32 45q6-9 12 0" fill="none" stroke-width="3.5" stroke-linecap="round"/>'
        + '<path d="M56 45q6-9 12 0" fill="none" stroke-width="3.5" stroke-linecap="round"/>'
        + '<path d="M36 60q14 14 28 0" fill="none" stroke-width="3.5" stroke-linecap="round"/>';
  }
}

function medalhaoSvg(av) {
  return `<svg viewBox="0 0 100 100" role="img" aria-hidden="true" focusable="false">
    <circle cx="50" cy="50" r="48" fill="${av.cor}" />
    <circle cx="50" cy="50" r="48" fill="#0a0f1c" fill-opacity="0.08" />
    <g fill="${INK}" stroke="${INK}">${icone(av.icone)}</g>
  </svg>`;
}

// Markup do medalhão: usa a ilustração própria quando existir (`assetSrc`),
// com fallback automático pro ícone SVG se a imagem falhar ao carregar.
export function avatarSvgMarkup(avatarId) {
  const av = getAvatar(avatarId);
  if (av.assetSrc) {
    const svgFallback = medalhaoSvg(av).replace(/"/g, '&quot;');
    return `<img src="${av.assetSrc}" alt="" `
      + `onerror="this.outerHTML=&quot;${svgFallback}&quot;" />`;
  }
  return medalhaoSvg(av);
}
