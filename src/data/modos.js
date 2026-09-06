// Modo de cada perfil: quanta interface e ajuda a criança vê. Definido pelo
// pai ao criar o perfil, trocável depois. Não é dificuldade de jogo.
export const MODOS = ['pequenos', 'medio', 'completo'];
export const MODO_PADRAO = 'medio';

export function normalizarModo(m) {
  return MODOS.includes(m) ? m : MODO_PADRAO;
}

// Ajustes de comportamento (o resto é só CSS via body[data-modo]).
export const CONFIG_MODO = {
  // margem em px que infla a área de encaixe da peça-alvo ao fundir
  pequenos: { margemFusao: 24 },
  medio: { margemFusao: 0 },
  completo: { margemFusao: 0 },
};

export function configDoModo(m) {
  return CONFIG_MODO[normalizarModo(m)];
}
