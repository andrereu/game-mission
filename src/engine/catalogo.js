import { itens as itensBase } from '../data/itens.js';
import { combos as combosBase } from '../data/combos.js';
import { slug } from './slug.js';

export const ERAS = ['elementos', 'natureza', 'vida', 'tecnologia', 'cultura', 'ficcao'];

export function comboKey(idA, idB) {
  return [idA, idB].sort().join('+');
}

export function criarCatalogo() {
  const itens = new Map(itensBase.map((it) => [it.id, { ...it }]));
  const combos = new Map();
  for (const c of combosBase) {
    combos.set(comboKey(c.a, c.b), { ...c });
  }

  return {
    getItem: (id) => itens.get(id),
    allItems: () => [...itens.values()],
    baseItems: () => [...itens.values()].filter((it) => it.base === true),
    findCombo: (idA, idB) => combos.get(comboKey(idA, idB)),
    registrarItemIA({ nome, emoji, era } = {}) {
      const id = slug(nome);
      const existente = itens.get(id);
      if (existente) return existente;
      const novo = {
        id,
        nome: String(nome),
        emoji: emoji || '✨',
        svg: null,
        era: ERAS.includes(era) ? era : 'ficcao',
        base: false,
        ref: null,
        ia: true, // conteúdo inventado pela IA — a estrela na gaveta/árvore
      };
      itens.set(id, novo);
      return novo;
    },
    registrarComboIA(idA, idB, resultadoId, texto) {
      combos.set(comboKey(idA, idB), { a: idA, b: idB, resultado: resultadoId, texto });
    },
  };
}
