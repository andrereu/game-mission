// Classificação de raridade das cartas de descoberta: determinística e
// calculada para o catálogo inteiro (não muda por save nem se repete IA vs
// jogo). pontuação = índice da era + profundidade de combinação (quantos
// passos de combo até chegar num item base). Itens com `ref` (personagens
// licenciados) são sempre Lendário, sem entrar na conta.
import { ERAS } from './catalogo.js';

export const NIVEIS_RARIDADE = ['comum', 'raro', 'epico', 'lendario'];

function calcularProfundidades(itens, combos) {
  const profundidade = new Map();
  for (const it of itens) if (it.base) profundidade.set(it.id, 0);

  const receitasPorResultado = new Map();
  for (const c of combos) {
    if (!receitasPorResultado.has(c.resultado)) receitasPorResultado.set(c.resultado, []);
    receitasPorResultado.get(c.resultado).push(c);
  }

  let mudou = true;
  let voltas = 0;
  const limite = itens.length + 1;
  while (mudou && voltas <= limite) {
    mudou = false;
    voltas += 1;
    for (const it of itens) {
      if (profundidade.has(it.id)) continue;
      const receitas = receitasPorResultado.get(it.id) || [];
      let melhor = null;
      for (const r of receitas) {
        const pa = profundidade.get(r.a);
        const pb = profundidade.get(r.b);
        if (pa === undefined || pb === undefined) continue;
        const p = 1 + Math.max(pa, pb);
        if (melhor === null || p < melhor) melhor = p;
      }
      if (melhor !== null) {
        profundidade.set(it.id, melhor);
        mudou = true;
      }
    }
  }
  // item sem receita alcançável a partir dos itens base (não deveria existir
  // num catálogo curado, mas evita undefined em vez de travar)
  for (const it of itens) if (!profundidade.has(it.id)) profundidade.set(it.id, 0);
  return profundidade;
}

export function pontuacaoRaridade(era, profundidade) {
  const eraIdx = ERAS.indexOf(era);
  return (eraIdx === -1 ? 0 : eraIdx) + profundidade;
}

// Cortes calibrados na pontuação real do catálogo atual (~283 itens): geram
// uma pirâmide de raridade (~52% comum, 24% raro, 17% épico, 7% lendário)
// parecida com a de jogos de colecionáveis. Recalibrar se o catálogo crescer
// muito e a distribuição desandar.
export function classificarPontuacao(pontuacao) {
  if (pontuacao <= 8) return 'comum';
  if (pontuacao <= 10) return 'raro';
  if (pontuacao <= 12) return 'epico';
  return 'lendario';
}

// Mapa id -> raridade para todo o catálogo curado (itens + combos "de fábrica").
// Uso: cartas de itens do jogo. Itens da IA usam calcularRaridadeIA abaixo,
// calculada uma vez na criação e persistida (não recalculada depois).
export function calcularRaridadesCatalogo(itens, combos) {
  const profundidade = calcularProfundidades(itens, combos);
  const raridades = new Map();
  for (const it of itens) {
    if (it.ref) { raridades.set(it.id, 'lendario'); continue; }
    raridades.set(it.id, classificarPontuacao(pontuacaoRaridade(it.era, profundidade.get(it.id) ?? 0)));
  }
  return raridades;
}

// Raridade de uma criação da IA: mesma fórmula, usando a profundidade dos dois
// ingredientes que a IA combinou (maior das duas profundidades + 1).
export function calcularRaridadeIA(era, profundidadeA, profundidadeB) {
  const profundidade = 1 + Math.max(profundidadeA ?? 0, profundidadeB ?? 0);
  return classificarPontuacao(pontuacaoRaridade(era, profundidade));
}

export function calcularProfundidadesCatalogo(itens, combos) {
  return calcularProfundidades(itens, combos);
}
