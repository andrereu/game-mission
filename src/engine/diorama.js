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

// PRIMEIRO_SINAL: quantas descobertas REAIS daquela família bastam pro
// primeiro sinal visual — recalibrado na auditoria V1.2 (docs pendente):
// os limiares antigos (25% do total) faziam vida/civilização/tecnologia
// esperarem 12-17 itens SÓ daquela família antes do primeiro pixel mudar,
// mesmo quando o primeiro item possível daquela família só existe lá pela
// descoberta #24-57 do jogo inteiro. Regra nova: o primeiro sinal é um
// número pequeno e FIXO (nunca escala com o tamanho da família — uma
// família de 66 itens não deveria ser 4x mais lenta pra reagir que uma de
// 18), e os níveis seguintes se espalham linearmente até 100% do total.
const PRIMEIRO_SINAL = 3;

// limiares de cada família: nível 1 = PRIMEIRO_SINAL (fixo, barato, "muito
// próximo da primeira vez que a criança descobre algo daquela família" —
// auditoria V1.2 §7); níveis 2-4 interpolam linearmente até 100% do total
// REAL da família no catálogo atual — nunca um número copiado de briefing.
// Se o catálogo crescer, os limiares (exceto o primeiro) se ajustam sozinhos.
export function thresholdsPorFamilia(catalogo) {
  const totais = totaisPorFamilia(catalogo);
  const thresholds = {};
  for (const f of FAMILIAS) {
    const total = totais[f] || 0;
    const primeiro = Math.min(PRIMEIRO_SINAL, total);
    thresholds[f] = Array.from({ length: NIVEIS_POR_FAMILIA }, (_, i) => {
      if (i === 0) return primeiro;
      if (i === NIVEIS_POR_FAMILIA - 1) return total;
      return Math.min(total, Math.ceil(primeiro + ((total - primeiro) * i) / (NIVEIS_POR_FAMILIA - 1)));
    });
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

// ---- água: progressão semântica real (auditoria V1.2 §3) --------------
// N0 nascente/poça primordial -> N1 primeiro curso -> N2 rio/lago
// desenvolvido -> N3 curso completo -> N4 cachoeira. Cada nível liga a
// IDs REAIS do catálogo (nunca inventados); quando mais de um item real
// serve o mesmo nível, todos contam (o que a criança descobrir primeiro
// já avança o nível). Contagem genérica da família continua como rede de
// segurança pra quem chegar lá por outro caminho de combinação.
const AGUA_MARCOS_SEMANTICOS = [
  ['poca', 'chuva'], // N1 — primeira água "parada" além da nascente
  ['rio', 'lago'], // N2 — corpo d'água desenvolvido
  ['oceano'], // N3 — curso completo
  ['cachoeira'], // N4 — queda d'água
];

function nivelAgua(contagemAgua, descobertos, limitesContagem) {
  let nivel = 0;
  for (let i = 0; i < AGUA_MARCOS_SEMANTICOS.length; i += 1) {
    const temItemMarco = AGUA_MARCOS_SEMANTICOS[i].some((id) => Boolean(descobertos?.[id]));
    const limite = limitesContagem[i];
    const bateuContagem = limite > 0 && contagemAgua >= limite;
    if (temItemMarco || bateuContagem) nivel = i + 1;
    else break; // sequencial: não pula nível sem cumprir o anterior
  }
  return Math.min(nivel, AGUA_MARCOS_SEMANTICOS.length);
}

// ---- elementos primários (auditoria V1.2 §1/§2) ------------------------
// Terra/Água/Fogo/Ar são os 4 itens-base do save (sempre descobertos desde
// o boot — ver saveInicial). Isso é INDEPENDENTE da família visual
// genérica (fogo e ar caem no fallback 'terreno' pra fins de contagem de
// família, mas ganham manifestação própria na composição visual — nunca
// tratados como "terreno" pro jogador). Como são itens-base, presença aqui
// é praticamente sempre true; o campo existe pra a UI nunca precisar
// assumir isso e pra saves hipotéticos sem os 4 itens ainda funcionarem.
export const ELEMENTOS_PRIMARIOS_IDS = {
  terra: 'terra', agua: 'agua', fogo: 'fogo', ar: 'ar',
};

function calcularElementosPrimarios(descobertos) {
  const out = {};
  for (const [chave, id] of Object.entries(ELEMENTOS_PRIMARIOS_IDS)) {
    out[chave] = Boolean(descobertos?.[id]);
  }
  return out;
}

// ---- vitalidade global (auditoria V1.2 §5, cadência V1.2.1) ------------
// Derivada só do TOTAL de descobertas canônicas (nunca cria objeto novo,
// nunca substitui os marcos semânticos por família) — existe só pra
// garantir que nenhuma janela de descobertas passe em silêncio absoluto.
// V1.2.1: o "passo" (quantas descobertas pro próximo nível) começa
// pequeno (2) e cresce devagar a cada 4 níveis, até um teto (8) — no
// começo do jogo o mundo "respira" quase a cada 2-3 descobertas; mais
// pra frente, o intervalo desacelera gradualmente (nunca uma cadência
// fixa "a cada N"). Intensifica o que já existe; nunca decide sozinha o
// que aparece.
const VITALIDADE_MAXIMA = 30;
const PASSO_VITALIDADE_INICIAL = 2;
const PASSO_VITALIDADE_MAXIMO = 8;
const NIVEIS_POR_DESACELERACAO = 4;

function passoVitalidade(nivelAlcancado) {
  const passo = PASSO_VITALIDADE_INICIAL + Math.floor(nivelAlcancado / NIVEIS_POR_DESACELERACAO);
  return Math.min(passo, PASSO_VITALIDADE_MAXIMO);
}

function calcularVitalidade(descobertos, catalogo) {
  let total = 0;
  for (const id of Object.keys(descobertos || {})) {
    if (familiaDoItem(catalogo.getItem(id))) total += 1;
  }
  let nivel = 0;
  let acumulado = 0;
  while (nivel < VITALIDADE_MAXIMA) {
    acumulado += passoVitalidade(nivel);
    if (total < acumulado) break;
    nivel += 1;
  }
  return nivel;
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
  for (const f of FAMILIAS) {
    niveis[f] = f === 'agua'
      ? nivelAgua(contagens.agua, descobertos, thresholds.agua)
      : nivelPelosLimites(contagens[f], thresholds[f]);
  }

  const era = eraMaisAvancada(erasAlcancadas(descobertos, catalogo));
  const temCriacoesIA = Object.keys(itensIA || {}).length > 0;
  const elementosPrimarios = calcularElementosPrimarios(descobertos);
  const vitalidade = calcularVitalidade(descobertos, catalogo);

  // Ponte: marco semântico por descoberta REAL do item canônico `ponte`
  // (mesmo princípio do marcador de água), desacoplado do nível de
  // Civilização. `descobertos` só guarda descobertas canônicas — criações
  // da IA vivem em `itensIA` e nunca podem chegar aqui.
  const temPonte = Boolean(descobertos.ponte);

  return {
    niveis,
    contagens,
    thresholds,
    era,
    temCriacoesIA,
    nivelMaximo: NIVEIS_POR_FAMILIA,
    elementosPrimarios,
    vitalidade,
    temPonte,
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

  // construção da ponte: acontecimento próprio (um beat), disparado só
  // quando o item canônico `ponte` foi descoberto e ainda não foi visto —
  // idempotente pelo booleano `visto.ponte` (mesmo padrão de nível/água).
  if (estadoAtual.temPonte && !visto.ponte) {
    eventos.push({ tipo: 'construcao', o: 'ponte' });
  }

  // vitalidade: um único evento por visita (nunca um por sub-nível) — só
  // intensifica o que já existe na cena, nunca compete com marcos
  // semânticos por atenção. Ver §5 da auditoria V1.2.
  const vitalidadeAtual = estadoAtual.vitalidade || 0;
  const vitalidadeVista = visto.vitalidade || 0;
  if (vitalidadeAtual > vitalidadeVista) {
    eventos.push({ tipo: 'vitalidade', de: vitalidadeVista, para: vitalidadeAtual });
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
  return {
    niveis: { ...estadoAtual.niveis },
    era: estadoAtual.era,
    vitalidade: estadoAtual.vitalidade || 0,
    ponte: Boolean(estadoAtual.temPonte),
  };
}
