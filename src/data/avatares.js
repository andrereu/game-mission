// Medalhões de perfil: cada um representa um pequeno universo do Misturária
// (Eu, Natureza, Bichos, Elementos, Tecnologia, Ciência, Espaço, Mistério),
// não mais uma cor abstrata. `id` é o identificador persistente — nunca o
// emoji/tema, que pode mudar de nome ou arte sem quebrar saves antigos.
// `assetSrc` fica pronto pra receber uma ilustração própria (PNG/WebP) no
// futuro: null aqui = usa o ícone SVG embutido (ver ./ui/avatarSvg.js).
export const AVATARES = [
  {
    id: 'nova', tema: 'eu', emoji: '🙂', cor: '#4aa3ff', icone: 'carinha', assetSrc: null,
  },
  {
    id: 'lumen', tema: 'natureza', emoji: '🌳', cor: '#45c26b', icone: 'natureza', assetSrc: null,
  },
  {
    id: 'astra', tema: 'bichos', emoji: '🐾', cor: '#ff8a5c', icone: 'bichos', assetSrc: null,
  },
  {
    id: 'cosmo', tema: 'elementos', emoji: '🔥', cor: '#ff6b4a', icone: 'elementos', assetSrc: null,
  },
  {
    id: 'orbe', tema: 'tecnologia', emoji: '⚙️', cor: '#8fa3c9', icone: 'tecnologia', assetSrc: null,
  },
  {
    id: 'nebula', tema: 'ciencia', emoji: '🧪', cor: '#ff5c8a', icone: 'ciencia', assetSrc: null,
  },
  {
    id: 'vega', tema: 'espaco', emoji: '🪐', cor: '#b57cff', icone: 'espaco', assetSrc: null,
  },
  {
    id: 'polar', tema: 'misterio', emoji: '✨', cor: '#ffd25c', icone: 'misterio', assetSrc: null,
  },
];

const POR_ID = new Map(AVATARES.map((a) => [a.id, a]));

export function getAvatar(avatarId) {
  return POR_ID.get(avatarId) || AVATARES[0];
}

// Determinístico: o mesmo id de perfil sempre cai no mesmo medalhão — nunca
// muda sozinho entre aberturas, nem depende de Math.random. Usado como
// padrão pra perfis antigos que ainda não tinham avatarId (também cobre
// perfis que só tinham `cor`, sem avatarId nenhum).
export function avatarPadrao(perfilId) {
  const s = String(perfilId || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATARES[h % AVATARES.length].id;
}
