// Progressão por era: deriva tudo de `save.descobertos` + catálogo. Sem estado
// novo no save. As 6 eras já vêm ordenadas em ERAS (catalogo.js).
import { ERAS } from './catalogo.js';

export function progressoPorEra(descobertos, catalogo) {
  const total = {};
  const feitos = {};
  for (const era of ERAS) { total[era] = 0; feitos[era] = 0; }

  for (const item of catalogo.allItems()) {
    if (total[item.era] === undefined) continue;
    if (item.ia) continue; // conteúdo da IA não conta pra progressão da era
    total[item.era] += 1;
    if (descobertos && descobertos[item.id]) feitos[item.era] += 1;
  }

  return ERAS.map((era) => ({ era, descobertos: feitos[era], total: total[era] }));
}

// Era de um item da IA quando ela não devolve uma era válida:
// mesma dos dois pais, ou a mais avançada quando forem diferentes.
export function eraHerdada(eraA, eraB) {
  const a = ERAS.includes(eraA) ? eraA : null;
  const b = ERAS.includes(eraB) ? eraB : null;
  if (a && b) return ERAS.indexOf(a) >= ERAS.indexOf(b) ? a : b;
  return a || b || 'ficcao';
}

export function erasAlcancadas(descobertos, catalogo) {
  const set = new Set();
  for (const { era, descobertos: n } of progressoPorEra(descobertos, catalogo)) {
    if (n > 0) set.add(era);
  }
  return set;
}

export function eraMaisAvancada(alcancadas) {
  const tem = alcancadas instanceof Set ? alcancadas : new Set(alcancadas || []);
  let melhor = ERAS[0];
  for (const era of ERAS) {
    if (tem.has(era)) melhor = era;
  }
  return melhor;
}
