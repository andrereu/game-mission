// Símbolos de perfil: oito descobertas reconhecíveis do próprio Misturária.
// Os ids históricos são preservados para que perfis já salvos mudem apenas de
// aparência, sem migração nem perda da escolha. A cor continua sendo o halo do
// medalhão e também mantém compatibilidade com o formato antigo do save.
export const AVATARES = [
  { id: 'nova', nome: 'Humano', emoji: '🧑', era: 'vida', cor: '#ff8a5c' },
  { id: 'lumen', nome: 'Árvore', emoji: '🌳', era: 'natureza', cor: '#45c26b' },
  { id: 'astra', nome: 'Dinossauro', emoji: '🦕', era: 'vida', cor: '#ff8a5c' },
  { id: 'cosmo', nome: 'Robô', emoji: '🤖', era: 'tecnologia', cor: '#b57cff' },
  { id: 'orbe', nome: 'Foguete', emoji: '🚀', era: 'tecnologia', cor: '#b57cff' },
  { id: 'nebula', nome: 'Música', emoji: '🎵', era: 'cultura', cor: '#ffd25c' },
  { id: 'vega', nome: 'Dragão', emoji: '🐉', era: 'ficcao', cor: '#ff5c8a' },
  { id: 'polar', nome: 'Planeta', emoji: '🪐', era: 'elementos', cor: '#4aa3ff' },
];

const POR_ID = new Map(AVATARES.map((a) => [a.id, a]));

export function getAvatar(avatarId) {
  return POR_ID.get(avatarId) || AVATARES[0];
}

// Determinístico: o mesmo id de perfil sempre cai no mesmo símbolo — nunca
// muda sozinho entre aberturas, nem depende de Math.random. Usado como
// padrão pra perfis antigos que ainda não tinham avatarId.
export function avatarPadrao(perfilId) {
  const s = String(perfilId || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATARES[h % AVATARES.length].id;
}
