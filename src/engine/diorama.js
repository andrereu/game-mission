// Diorama V0 — "o mundo responde". Estado 100% derivado (nunca persiste o
// cenário objeto por objeto): mesmas descobertas + mesmo catálogo sempre
// produzem a mesma estrutura. Quem persiste (o mínimo: níveis por família +
// era já vista) é a camada de app/store, não este arquivo.
//
// Taxonomia: nunca inventa uma paralela ao catálogo. 4 das 6 eras mapeiam
// 1:1 pra uma família ('vida'->vida, 'cultura'->civilizacao,
// 'tecnologia'->tecnologia, 'ficcao'->cosmico); só 'elementos' e 'natureza'
// misturam mais de uma família visual, então esses itens têm um split
// explícito abaixo. Ver a auditoria completa em docs/diorama-auditoria.md.
import { ERAS } from './catalogo.js';
import { erasAlcancadas, eraMaisAvancada } from './eras.js';

export const FAMILIAS = ['terreno', 'agua', 'vegetacao', 'vida', 'civilizacao', 'tecnologia', 'cosmico'];

// 0..4 (5 estados por família) — "poucas famílias, poucos níveis, evolução
// perceptível" (briefing §4). O mesmo número vale pra todas: os LIMIARES de
// cada nível é que são derivados do catálogo real (ver thresholdsPorFamilia).
export const NIVEIS_POR_FAMILIA = 4;

const FAMILIA_POR_ERA = {
  vida: 'vida',
  cultura: 'civilizacao',
  tecnologia: 'tecnologia',
  ficcao: 'cosmico',
};

// split de 'elementos' (32 itens) e 'natureza' (48 itens) — únicas eras que
// misturam terreno/água/vegetação/cósmico. Ver docs/diorama-auditoria.md
// pra contagem final por família.
const COSMICO_IDS = new Set(['ceu', 'estrela', 'lua', 'planeta', 'sol']);
const AGUA_IDS = new Set([
  'agua', 'vapor', 'gelo', 'frio', 'neve', 'granizo', 'bolha', 'nevoa',
  'chuva', 'oceano', 'rio', 'lago', 'cachoeira', 'pantano', 'orvalho', 'poca',
  'iceberg', 'oasis', 'maremoto', 'geleira', 'praia', 'tempestade', 'furacao',
  'trovao', 'relampago', 'nuvem', 'vento', 'arco-iris',
]);
const VEGETACAO_IDS = new Set([
  'planta', 'arvore', 'floresta', 'flor', 'fruta', 'semente', 'grama', 'raiz',
  'folha', 'madeira', 'cogumelo', 'cacto', 'palmeira', 'coco', 'mato', 'campo',
  'selva', 'polen',
]);
// terreno é o resto de elementos/natureza (elementos "brutos" + geologia) —
// nunca listado explicitamente: é o fallback de quem não caiu nos 3 acima.

// A família de um item, ou null quando ele não entra na progressão canônica
// (criações da IA — ver §8 do briefing: nunca aceleram os marcos).
export function familiaDoItem(item) {
  if (!item || item.ia) return null;
  const direta = FAMILIA_POR_ERA[item.era];
  if (direta) return direta;
  if (item.era === 'elementos' || item.era === 'natureza') {
    if (COSMICO_IDS.has(item.id)) return 'cosmico';
    if (AGUA_IDS.has(item.id)) return 'agua';
    if (VEGETACAO_IDS.has(item.id)) return 'vegetacao';
    return 'terreno';
  }
  return null; // era desconhecida (não deveria acontecer com o catálogo real)
}

function totaisPorFamilia(catalogo) {
  const totais = Object.fromEntries(FAMILIAS.map((f) => [f, 0]));
  for (const item of catalogo.allItems()) {
    const f = familiaDoItem(item);
    if (f) totais[f] += 1;
  }
  return totais;
}

// limiares de cada família: 25/50/75/100% da contagem REAL daquela família
// no catálogo atual — nunca um número copiado do briefing. Se o catálogo
// crescer, os limiares se ajustam sozinhos.
export function thresholdsPorFamilia(catalogo) {
  const totais = totaisPorFamilia(catalogo);
  const thresholds = {};
  for (const f of FAMILIAS) {
    const total = totais[f] || 0;
    thresholds[f] = Array.from(
      { length: NIVEIS_POR_FAMILIA },
      (_, i) => Math.ceil((total * (i + 1)) / NIVEIS_POR_FAMILIA),
    );
  }
  return thresholds;
}

function nivelPelosLimites(contagem, limites) {
  let nivel = 0;
  for (const limite of limites) {
    if (limite > 0 && contagem >= limite) nivel += 1;
  }
  return Math.min(nivel, limites.length);
}

// ---- estado puro e determinístico ----
// resolverEstadoDiorama(descobertos, eras[implícito via catalogo], perfil
// [implícito: descobertos+itensIA já são do perfil ativo]) — nunca lê nem
// grava nada; quem persiste é quem chama.
export function resolverEstadoDiorama({ descobertos = {}, catalogo, itensIA = {} }) {
  const thresholds = thresholdsPorFamilia(catalogo);
  const contagens = Object.fromEntries(FAMILIAS.map((f) => [f, 0]));

  for (const id of Object.keys(descobertos)) {
    const familia = familiaDoItem(catalogo.getItem(id));
    if (familia) contagens[familia] += 1;
  }

  const niveis = {};
  for (const f of FAMILIAS) niveis[f] = nivelPelosLimites(contagens[f], thresholds[f]);

  const era = eraMaisAvancada(erasAlcancadas(descobertos, catalogo));
  const temCriacoesIA = Object.keys(itensIA || {}).length > 0;

  return {
    niveis, contagens, thresholds, era, temCriacoesIA, nivelMaximo: NIVEIS_POR_FAMILIA,
  };
}

// ---- fila de acontecimentos pendentes ----
// Compara o estado atual com o último progresso já EXIBIDO (persistido —
// ver store.setDiorama) e devolve, em ordem, os marcos ainda não vistos.
// `progressoVisto` pode ser null/undefined (save sem diorama ainda: ver
// bootstrap em app.js) — nesse caso tudo written conta como pendente, então
// quem chama decide se quer reproduzir ou só semear o baseline em silêncio
// (tudo contaria como pendente, o que inundaria um save veterano).
export function calcularAcontecimentosPendentes(estadoAtual, progressoVisto) {
  const visto = progressoVisto || { niveis: {}, era: null };
  const eventos = [];

  // marco de era: escala maior, sempre antes dos marcos normais da visita —
  // distinto por `tipo`, nunca dispara a própria celebração sonora daqui
  // (ver §7: integração futura com tocarNovaEra, sem duplicar o disparo já
  // existente no fluxo de descoberta).
  const eraIdx = ERAS.indexOf(estadoAtual.era);
  const eraVistaIdx = visto.era ? ERAS.indexOf(visto.era) : -1;
  if (eraIdx > eraVistaIdx) {
    eventos.push({ tipo: 'era', era: estadoAtual.era });
  }

  for (const familia of FAMILIAS) {
    const nivelAtual = estadoAtual.niveis[familia] || 0;
    const nivelVisto = (visto.niveis && visto.niveis[familia]) || 0;
    for (let n = nivelVisto + 1; n <= nivelAtual; n += 1) {
      eventos.push({
        tipo: 'marco', familia, de: n - 1, para: n,
      });
    }
  }
  return eventos;
}

export function haAcontecimentosPendentes(estadoAtual, progressoVisto) {
  if (!progressoVisto) return false; // bootstrap: ver app.js — nunca "pendente" num save que nunca abriu o Diorama
  return calcularAcontecimentosPendentes(estadoAtual, progressoVisto).length > 0;
}

// o que persistir depois de reproduzir a fila (ou pra semear o bootstrap).
// Idempotente: chamar de novo com o mesmo estado sempre gera o mesmo
// progresso — reload nunca reabre uma transformação já vista.
export function proximoProgressoVisto(estadoAtual) {
  return { niveis: { ...estadoAtual.niveis }, era: estadoAtual.era };
}
