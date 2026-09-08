// Diorama V1.1 — engine de composição visual do "Meu Mundo", agora com os
// assets finais do primeiro slice (kit "misturaria-diorama-assets-v1").
//
// Continua separando GEOGRAFIA (fixa) de COMPOSIÇÃO (estado -> âncora ->
// asset -> escala/offset/z-order) — nenhuma coordenada embutida em asset,
// nenhum hack por objeto espalhado no renderer (ver src/ui/diorama.js).
// Este módulo não toca em save nem em fila de eventos — isso continua
// 100% em src/engine/diorama.js.
//
// As âncoras foram recalibradas medindo a arte real (script de extração em
// scripts/), não são mais chutes sobre um SVG desenhado à mão: terreno,
// água e cobertura verde são a mesma ilha aprovada (diorama-terreno-base-
// master), com água e grama como camadas PNG derivadas por color-key da
// referência (nunca a imagem full-state inteira — ver README de entrega).

const ASSETS = 'assets/diorama/';

// ---- Âncoras espaciais fixas (% do container .diorama-ilha, que tem a
// MESMA proporção do terreno-master — 900x675 ≈ 4:3). Medidas na arte
// real: pico do monte, abertura do arco, nascente/lagos/cachoeira do
// leito d'água, e os dois campos de grama extraídos da referência
// aprovada. Determinísticas: o mesmo pedido do estado cai sempre no
// mesmo lugar. z = ordem de empilhamento (maior = mais perto da câmera).
export const ANCHORS = {
  ceu_esquerda: { x: 14, y: -3, z: 30 },
  ceu_direita: { x: 86, y: -2, z: 30 },
  alto_observatorio: { x: 44, y: 8, z: 16 },
  arco_rochoso: { x: 73, y: 17, z: 15 },
  nascente: { x: 40, y: 28, z: 14 },
  margem_lago: { x: 56, y: 44, z: 11 },
  clareira_esquerda: { x: 31, y: 63, z: 9 },
  clareira_central: { x: 48, y: 52, z: 10 },
  clareira_direita: { x: 76, y: 58, z: 9 },
  ponte: { x: 61, y: 55, z: 12 },
  borda_cachoeira: { x: 63, y: 83, z: 6 },
};

// ---- Geografia: terreno-master é o palco visual principal (§2 do
// briefing "Integração"). Água e cobertura verde são camadas PNG
// derivadas da MESMA ilha por color-key sobre as referências aprovadas —
// nunca a imagem full-state inteira substituindo o terreno. O caminho
// (trilha entre clareiras) continua sendo geometria de estado, desenhada
// como um SVG fino por cima, na mesma escala 900x675 do terreno. ------
export const TERRENO_LARGURA = 900;
export const TERRENO_ALTURA = 675;

export const GEOGRAFIA_HTML = `
<img class="diorama-mundo-terreno" src="${ASSETS}terreno-master.png" alt="" aria-hidden="true" />
<img class="diorama-mundo-agua" src="${ASSETS}agua-layer.png" alt="" aria-hidden="true" />
<img class="diorama-mundo-vegetacao" src="${ASSETS}vegetacao-layer.png" alt="" aria-hidden="true" />
<svg class="diorama-mundo-caminho" viewBox="0 0 ${TERRENO_LARGURA} ${TERRENO_ALTURA}" preserveAspectRatio="none" aria-hidden="true">
  <path class="geo-caminho" d="M280,425 C340,395 400,375 432,350 C500,375 600,395 684,417" fill="none" stroke="#caa06a" stroke-width="7" stroke-linecap="round" stroke-dasharray="620" stroke-dashoffset="620" />
</svg>
<div class="diorama-mundo-cristal" aria-hidden="true"></div>
`;

// ---- Registro de elementos: cada um sabe só o próprio visual (imagem ou
// emoji-placeholder) e a classe de animação de nascimento — nunca onde
// mora no mundo (isso é só da COMPOSICAO/ANCHORS). Objetos "de chão"
// (árvore/fogueira/casa) usam ponto de contato na base (pé do asset
// encostado no anchor); objetos "flutuantes" (estrela, borboleta) usam
// centro. Assets com `img` são os do kit aprovado; sem `img` seguem como
// placeholder emoji (famílias sem asset final nesta rodada: vida,
// tecnologia, cósmico).
export const ELEMENTOS = {
  broto: {
    img: `${ASSETS}vegetacao-broto.png`, anim: 'nasce-do-solo', contato: 'base',
  },
  jovem: {
    img: `${ASSETS}vegetacao-jovem.png`, anim: 'cresce', contato: 'base',
  },
  arvore: {
    img: `${ASSETS}vegetacao-arvore.png`, anim: 'cresce', contato: 'base',
  },
  fogueira: {
    img: `${ASSETS}civilizacao-fogueira.png`, anim: 'acende', contato: 'base',
  },
  casa: {
    img: `${ASSETS}civilizacao-casa.png`, anim: 'monta', contato: 'base',
  },
  borboleta: { conteudo: '🦋', anim: 'entra-voando', contato: 'centro' },
  passaro: { conteudo: '🐦', anim: 'entra-voando', contato: 'centro' },
  bicho: { conteudo: '🐇', anim: 'entra-andando', contato: 'base' },
  ferramenta: { conteudo: '🔨', anim: 'aparece', contato: 'base' },
  engrenagem: { conteudo: '⚙️', anim: 'aparece', contato: 'base' },
  observatorio: { conteudo: '🔭', anim: 'monta', contato: 'base' },
  foguete: { conteudo: '🚀', anim: 'monta', contato: 'base' },
  estrela: { conteudo: '⭐', anim: 'acende', contato: 'centro' },
  fenomeno: { conteudo: '🌌', anim: 'acende', contato: 'centro' },
};

// ---- Composição: estado (família + nível) -> lista de {âncora,
// elemento, escala}, cumulativa por nível. -----------------------------
//
// Vegetação é UM organismo evoluindo no MESMO ponto (broto -> jovem ->
// árvore adulta), nunca três árvores lado a lado (briefing §5) — a
// "cobertura verde" espalhando pelo resto do terreno é a camada
// diorama-mundo-vegetacao (grama), não objetos avulsos.
export const COMPOSICAO = {
  vegetacao: {
    1: [{ anchor: 'clareira_central', elemento: 'broto', escala: 0.55 }],
    2: [{ anchor: 'clareira_central', elemento: 'jovem', escala: 0.7 }],
    3: [{ anchor: 'clareira_central', elemento: 'arvore', escala: 0.85 }],
  },
  vida: {
    1: [{ anchor: 'margem_lago', elemento: 'borboleta', escala: 0.5 }],
    2: [
      { anchor: 'margem_lago', elemento: 'borboleta', escala: 0.5 },
      { anchor: 'clareira_direita', elemento: 'bicho', escala: 0.55 },
    ],
    3: [
      { anchor: 'margem_lago', elemento: 'passaro', escala: 0.55 },
      { anchor: 'clareira_direita', elemento: 'bicho', escala: 0.6 },
      { anchor: 'ceu_esquerda', elemento: 'passaro', escala: 0.4 },
    ],
  },
  civilizacao: {
    1: [{ anchor: 'clareira_esquerda', elemento: 'fogueira', escala: 0.55 }],
    2: [
      { anchor: 'clareira_esquerda', elemento: 'fogueira', escala: 0.55 },
      { anchor: 'clareira_direita', elemento: 'casa', escala: 0.7 },
    ],
    3: [
      { anchor: 'clareira_esquerda', elemento: 'fogueira', escala: 0.55 },
      { anchor: 'clareira_direita', elemento: 'casa', escala: 0.75 },
    ],
  },
  tecnologia: {
    1: [{ anchor: 'clareira_esquerda', elemento: 'ferramenta', escala: 0.45 }],
    2: [{ anchor: 'clareira_esquerda', elemento: 'engrenagem', escala: 0.5 }],
    3: [{ anchor: 'alto_observatorio', elemento: 'observatorio', escala: 0.55 }],
    4: [{ anchor: 'alto_observatorio', elemento: 'foguete', escala: 0.6 }],
  },
  cosmico: {
    1: [{ anchor: 'ceu_esquerda', elemento: 'estrela', escala: 0.5 }],
    2: [
      { anchor: 'ceu_esquerda', elemento: 'estrela', escala: 0.5 },
      { anchor: 'ceu_direita', elemento: 'estrela', escala: 0.45 },
    ],
    3: [
      { anchor: 'ceu_esquerda', elemento: 'estrela', escala: 0.5 },
      { anchor: 'ceu_direita', elemento: 'fenomeno', escala: 0.55 },
    ],
  },
  // terreno e água não colocam objetos soltos — mudam a própria geografia
  // (brilho da água, opacidade/raio de revelação da grama), tratado à
  // parte em aplicarNivelAgua/aplicarNivelVegetacao (src/ui/diorama.js).
};

// nível de civilização a partir do qual a trilha entre clareiras aparece
// — geometria de estado, não asset avulso. A PONTE do kit aprovado tem
// rio/margem "colados" na composição e não pode ser recortada com
// transparência nesta rodada — fica de fora até existir uma versão
// bridge-only isolada (ver relatório de entrega).
export const NIVEL_CAMINHO_CIVILIZACAO = 2;

function elementosCumulativos(tabela, nivel) {
  if (!tabela || nivel <= 0) return [];
  for (let n = Math.min(nivel, 4); n >= 1; n -= 1) {
    if (tabela[n]) return tabela[n];
  }
  return [];
}

export function elementosDaFamilia(familia, nivel) {
  return elementosCumulativos(COMPOSICAO[familia], nivel);
}

// mais de uma família pode legitimamente ocupar a mesma clareira ao mesmo
// tempo. Um deslocamento pequeno e fixo POR FAMÍLIA (nunca por asset)
// evita que um elemento esconda o outro sem inventar âncoras novas pra
// cada combinação possível.
const DESLOCAMENTO_POR_FAMILIA = {
  vegetacao: { dx: 0, dy: 0 },
  civilizacao: { dx: 0, dy: 0 },
  tecnologia: { dx: 7, dy: -3 },
  vida: { dx: 0, dy: -6 },
  cosmico: { dx: 0, dy: 0 },
  agua: { dx: 0, dy: 0 },
  terreno: { dx: 0, dy: 0 },
};

// única função de mapeamento anchor lógico -> posição de tela (§9 do
// briefing): tudo (deslocamento por família incluso) passa por aqui —
// nunca um offset manual espalhado dentro de um asset ou de um seletor
// CSS específico de objeto.
export function posicaoDoObjeto(familia, nomeAnchor) {
  const a = ANCHORS[nomeAnchor];
  if (!a) return null;
  const d = DESLOCAMENTO_POR_FAMILIA[familia] || { dx: 0, dy: 0 };
  return {
    left: `${a.x + d.dx}%`, top: `${a.y + d.dy}%`, zIndex: a.z,
  };
}
