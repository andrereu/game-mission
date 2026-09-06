import { itens as itensBase } from '../data/itens.js';
import { combos as combosBase } from '../data/combos.js';
import { slug } from './slug.js';
import {
  calcularRaridadesCatalogo,
  calcularProfundidadesCatalogo,
  calcularRaridadeIA,
} from './raridade.js';

export const ERAS = ['elementos', 'natureza', 'vida', 'tecnologia', 'cultura', 'ficcao'];

export function comboKey(idA, idB) {
  return [idA, idB].sort().join('+');
}

const DESCRICAO_BASE = 'Um dos itens originais. Tudo começa por aqui.';

export function criarCatalogo() {
  const itens = new Map(itensBase.map((it) => [it.id, { ...it }]));
  const combos = new Map();
  for (const c of combosBase) {
    combos.set(comboKey(c.a, c.b), { ...c });
  }

  // Raridade e profundidade de combinação: calculadas uma vez sobre o
  // catálogo curado. Itens da IA entram nesse mesmo mapa de profundidade
  // quando são criados, pra combos futuros a partir deles continuarem
  // corretos — mas a raridade deles é calculada uma única vez e persistida
  // (nunca recalculada), ver registrarItemIA/hidratarIA.
  const raridadesCuradas = calcularRaridadesCatalogo(itensBase, combosBase);
  const profundidade = calcularProfundidadesCatalogo(itensBase, combosBase);

  function comboDoResultado(id) {
    for (const c of combos.values()) if (c.resultado === id) return c;
    return null;
  }

  return {
    getItem: (id) => itens.get(id),
    allItems: () => [...itens.values()],
    baseItems: () => [...itens.values()].filter((it) => it.base === true),
    findCombo: (idA, idB) => combos.get(comboKey(idA, idB)),
    getComboDoResultado: comboDoResultado,

    getRaridade(id) {
      const item = itens.get(id);
      if (!item) return 'comum';
      if (item.ref) return 'lendario';
      if (item.ia) return item.raridade || 'comum';
      return raridadesCuradas.get(id) || 'comum';
    },

    getDescricao(id) {
      const item = itens.get(id);
      if (!item) return '';
      if (item.base) return DESCRICAO_BASE;
      const combo = comboDoResultado(id);
      return (combo && combo.texto) || DESCRICAO_BASE;
    },

    registrarItemIA({
      nome, emoji, era, idA, idB,
    } = {}) {
      const id = slug(nome);
      const existente = itens.get(id);
      if (existente) return existente;
      const eraFinal = ERAS.includes(era) ? era : 'ficcao';
      const profA = profundidade.get(idA) ?? 0;
      const profB = profundidade.get(idB) ?? 0;
      const novo = {
        id,
        nome: String(nome),
        emoji: emoji || '✨',
        svg: null,
        era: eraFinal,
        base: false,
        ref: null,
        ia: true, // conteúdo inventado pela IA — a estrela na gaveta/árvore
        raridade: calcularRaridadeIA(eraFinal, profA, profB),
        profundidade: 1 + Math.max(profA, profB),
      };
      itens.set(id, novo);
      profundidade.set(id, novo.profundidade);
      return novo;
    },
    registrarComboIA(idA, idB, resultadoId, texto) {
      combos.set(comboKey(idA, idB), { a: idA, b: idB, resultado: resultadoId, texto });
    },
    // Repõe no catálogo (recriado do zero a cada boot) as criações da IA
    // gravadas no save, senão elas somem ao trocar de sessão.
    hidratarIA(itensIA = {}, combosIA = {}) {
      for (const [id, dados] of Object.entries(itensIA)) {
        if (!dados || itens.has(id)) continue;
        itens.set(id, {
          id,
          nome: String(dados.nome ?? id),
          emoji: dados.emoji || '✨',
          svg: null,
          era: ERAS.includes(dados.era) ? dados.era : 'ficcao',
          base: false,
          ref: null,
          ia: true,
          raridade: dados.raridade || 'comum',
          profundidade: dados.profundidade ?? 0,
        });
        profundidade.set(id, dados.profundidade ?? 0);
      }
      for (const [key, combo] of Object.entries(combosIA)) {
        if (!combo || combos.has(key)) continue;
        combos.set(key, { ...combo });
      }
    },
  };
}
