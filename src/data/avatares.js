// Carinhas de perfil: substituem a cor abstrata como escolha principal.
// 8 opções visualmente distintas, sem gênero, sem emoji nativo do sistema
// (que muda de aparência entre Android/iOS/desktop) — SVGs internos simples,
// coerentes com o resto do universo do Misturária. A cor de cada carinha
// continua existindo (vira o aro/fundo), só deixou de ser a escolha em si.
export const AVATARES = [
  { id: 'nova', cor: '#4aa3ff', olhos: 'felizes', boca: 'sorriso' },
  { id: 'lumen', cor: '#45c26b', olhos: 'redondos', boca: 'aberta' },
  { id: 'astra', cor: '#ff8a5c', olhos: 'estrela', boca: 'reta' },
  { id: 'cosmo', cor: '#b57cff', olhos: 'piscando', boca: 'sorriso' },
  { id: 'orbe', cor: '#ffd25c', olhos: 'redondos', boca: 'oh' },
  { id: 'nebula', cor: '#ff5c8a', olhos: 'felizes', boca: 'lingua' },
  { id: 'vega', cor: '#4ad0e6', olhos: 'oculos', boca: 'sorriso' },
  { id: 'polar', cor: '#dfe6f5', olhos: 'sonolento', boca: 'reta' },
];

const POR_ID = new Map(AVATARES.map((a) => [a.id, a]));

export function getAvatar(avatarId) {
  return POR_ID.get(avatarId) || AVATARES[0];
}

// Determinístico: o mesmo id de perfil sempre cai na mesma carinha — nunca
// muda sozinho entre aberturas, nem depende de Math.random. Usado como
// padrão pra perfis antigos que ainda não tinham avatarId.
export function avatarPadrao(perfilId) {
  const s = String(perfilId || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATARES[h % AVATARES.length].id;
}
