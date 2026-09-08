// Diorama V1 — engine de composição visual do "Meu Mundo".
//
// Separa GEOGRAFIA (fixa, nunca muda por era/descoberta) de COMPOSIÇÃO
// (o que ocupa cada âncora, decidido pelo estado derivado em
// src/engine/diorama.js). Regra central do briefing: estado → anchor →
// asset → escala/offset/z-order. Nenhum asset "sabe" onde mora no mundo;
// só a tabela COMPOSICAO sabe.
//
// Este módulo não toca em save nem em fila de eventos — isso continua
// 100% em src/engine/diorama.js e src/ui/diorama.js. Aqui só existe
// geometria e uma tabela de composição.

// ---- Âncoras espaciais fixas (% dentro do palco 400x300) ----------------
// Determinísticas: o mesmo elemento pedido pelo mesmo estado sempre cai na
// mesma âncora. z = ordem de empilhamento (maior = mais à frente/perto).
export const ANCHORS = {
  ceu_esquerda: {
    x: 15, y: 6, z: 30,
  },
  ceu_direita: {
    x: 86, y: 6, z: 30,
  },
  alto_observatorio: {
    x: 23, y: 13, z: 16,
  },
  arco_rochoso: {
    x: 80, y: 19, z: 15,
  },
  nascente: {
    x: 49, y: 21, z: 14,
  },
  margem_lago: {
    x: 49, y: 47, z: 11,
  },
  clareira_esquerda: {
    x: 24, y: 56, z: 9,
  },
  clareira_central: {
    x: 51, y: 60, z: 9,
  },
  clareira_direita: {
    x: 76, y: 55, z: 9,
  },
  ponte: {
    x: 54, y: 68, z: 12,
  },
  borda_cachoeira: {
    x: 50, y: 84, z: 6,
  },
};

// ---- Geografia fixa: monte, arco, curso d'água, dois lagos, cachoeira,
// três clareiras, rochas permanentes. Isso NUNCA muda por era ou
// descoberta — só as camadas por cima dela mudam (§1 do briefing). ------
export const GEOGRAFIA_SVG = `
<svg class="diorama-mundo-svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
  <defs>
    <linearGradient id="dg-solo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5a4128" /><stop offset="100%" stop-color="#2c1e10" />
    </linearGradient>
    <linearGradient id="dg-topo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8c7355" /><stop offset="55%" stop-color="#6b5640" /><stop offset="100%" stop-color="#4a3c2c" />
    </linearGradient>
    <linearGradient id="dg-monte" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8a7d6e" /><stop offset="100%" stop-color="#4a4038" />
    </linearGradient>
    <linearGradient id="dg-arco" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#9a8a76" /><stop offset="100%" stop-color="#5c4d3d" />
    </linearGradient>
    <linearGradient id="dg-agua" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8fe0f2" /><stop offset="100%" stop-color="#2f8fc2" />
    </linearGradient>
    <radialGradient id="dg-cristal" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#eaf9ff" stop-opacity="0.95" /><stop offset="100%" stop-color="#7fd4e6" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- lateral/espessura: mesma silhueta do topo, deslocada pra baixo -->
  <path class="geo-lateral" d="M35,150 C18,118 40,80 92,68 C134,42 210,36 262,58 C314,40 378,68 388,112 C400,144 378,170 340,175 C362,196 330,218 278,212 C246,234 182,238 140,222 C88,232 46,206 40,180 C14,180 18,158 35,150 Z" fill="url(#dg-solo)" />

  <!-- cachoeira: água caindo pela borda frontal do terreno -->
  <path class="geo-cachoeira" d="M182,238 C180,262 180,288 186,300 L216,300 C222,288 222,262 220,238 Z" fill="url(#dg-agua)" opacity="0.9" />

  <!-- topo do terreno: base árida/rochosa por padrão. A vegetação NÃO é
       uma cor fixa — é uma camada translúcida por cima que só ganha
       opacidade conforme o nível de vegetação real do perfil sobe
       (data-nivel-vegetacao no <svg>), a mesma geometria o tempo todo. -->
  <path class="geo-topo" d="M35,128 C18,96 40,58 92,46 C134,20 210,14 262,36 C314,18 378,46 388,90 C400,122 378,148 340,153 C362,174 330,196 278,190 C246,212 182,216 140,200 C88,210 46,184 40,158 C14,158 18,136 35,128 Z" fill="url(#dg-topo)" />
  <path class="geo-vegetacao-geral" d="M35,128 C18,96 40,58 92,46 C134,20 210,14 262,36 C314,18 378,46 388,90 C400,122 378,148 340,153 C362,174 330,196 278,190 C246,212 182,216 140,200 C88,210 46,184 40,158 C14,158 18,136 35,128 Z" fill="#2f6b34" />

  <!-- monte principal: alto/esquerda -->
  <path class="geo-monte" d="M30,120 C15,75 45,25 90,15 C120,8 145,30 138,60 C132,86 100,100 70,110 C55,115 40,120 30,120 Z" fill="url(#dg-monte)" />
  <path class="geo-monte-topo" d="M64,44 C76,24 100,16 116,26 C104,34 88,46 78,60 C70,54 64,50 64,44 Z" fill="#c9c2b6" opacity="0.55" />

  <!-- arco rochoso: alto/direita, desenhado como traço grosso arredondado -->
  <path class="geo-arco" d="M300,110 C300,60 325,30 352,30 C379,30 400,60 400,105" fill="none" stroke="url(#dg-arco)" stroke-width="24" stroke-linecap="round" />

  <!-- curso d'água: nascente -> lago intermediário -> lago frontal -->
  <path class="geo-agua-curso" d="M196,64 C188,90 206,108 196,140 C186,168 210,178 200,204" fill="none" stroke="url(#dg-agua)" stroke-width="13" stroke-linecap="round" />
  <ellipse class="geo-lago-intermediario" cx="196" cy="140" rx="30" ry="16" fill="url(#dg-agua)" />
  <ellipse class="geo-lago-frontal" cx="204" cy="204" rx="52" ry="24" fill="url(#dg-agua)" />

  <!-- clareiras: patches de solo nu que ganham grama/vida por cima -->
  <ellipse class="geo-clareira" data-clareira="esquerda" cx="96" cy="168" rx="30" ry="15" fill="#4a3420" />
  <ellipse class="geo-clareira" data-clareira="central" cx="204" cy="180" rx="32" ry="15" fill="#4a3420" />
  <ellipse class="geo-clareira" data-clareira="direita" cx="304" cy="165" rx="28" ry="14" fill="#4a3420" />

  <!-- caminho + ponte: geometria de estado (civilização), não asset avulso;
       escondidos por padrão, "se desenham" quando o nível justifica -->
  <path class="geo-caminho" d="M96,168 C140,190 172,186 204,180 C240,174 272,170 304,165" fill="none" stroke="#caa06a" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="420" stroke-dashoffset="420" />
  <line class="geo-ponte" x1="172" y1="176" x2="228" y2="182" stroke="#caa06a" stroke-width="9" stroke-linecap="round" opacity="0" />

  <!-- cristal/energia discreta na nascente: já existe desde o Mundo Primordial -->
  <circle class="geo-cristal" cx="196" cy="64" r="16" fill="url(#dg-cristal)" />
  <circle class="geo-cristal-nucleo" cx="196" cy="64" r="3.5" fill="#eaf9ff" />

  <!-- rochas permanentes -->
  <ellipse class="geo-rocha" cx="48" cy="150" rx="9" ry="5" fill="#4a3a2a" opacity="0.7" />
  <ellipse class="geo-rocha" cx="358" cy="130" rx="8" ry="5" fill="#4a3a2a" opacity="0.6" />
  <ellipse class="geo-rocha" cx="140" cy="205" rx="7" ry="4" fill="#4a3a2a" opacity="0.55" />
  <ellipse class="geo-rocha" cx="270" cy="215" rx="8" ry="4.5" fill="#4a3a2a" opacity="0.55" />
</svg>`;

// ---- Registro de elementos: placeholders emoji/CSS, já organizados como
// se fossem trocados depois por assets finais transparentes (§6). Cada um
// carrega a classe de animação de "nascimento" própria (§5, Grow-like). --
export const ELEMENTOS = {
  broto: { conteudo: '🌱', anim: 'nasce-do-solo' },
  arvore_pequena: { conteudo: '🌿', anim: 'cresce' },
  arvore: { conteudo: '🌳', anim: 'cresce' },
  bosque: { conteudo: '🌳🌲', anim: 'cresce' },
  borboleta: { conteudo: '🦋', anim: 'entra-voando' },
  passaro: { conteudo: '🐦', anim: 'entra-voando' },
  bicho: { conteudo: '🐇', anim: 'entra-andando' },
  fogueira: { conteudo: '🔥', anim: 'acende' },
  casa: { conteudo: '🏠', anim: 'monta' },
  vila: { conteudo: '🏘️', anim: 'monta' },
  ferramenta: { conteudo: '🔨', anim: 'aparece' },
  engrenagem: { conteudo: '⚙️', anim: 'aparece' },
  observatorio: { conteudo: '🔭', anim: 'monta' },
  foguete: { conteudo: '🚀', anim: 'monta' },
  estrela: { conteudo: '⭐', anim: 'acende' },
  fenomeno: { conteudo: '🌌', anim: 'acende' },
};

// ---- Composição: estado (família + nível) -> lista de {âncora, elemento,
// escala}. Cada nível já é a lista CUMULATIVA completa daquele estágio —
// a UI só troca uma lista pela outra, nunca soma deltas manualmente. Só os
// 2-3 primeiros níveis de cada família têm conteúdo real nesta rodada
// (§4/§11 — não construir o mundo "Evolved" inteiro ainda); níveis
// seguintes herdam o último conjunto definido até ganharem conteúdo novo.
export const COMPOSICAO = {
  vegetacao: {
    1: [{ anchor: 'clareira_esquerda', elemento: 'broto', escala: 0.55 }],
    2: [
      { anchor: 'clareira_esquerda', elemento: 'broto', escala: 0.6 },
      { anchor: 'clareira_central', elemento: 'arvore_pequena', escala: 0.6 },
    ],
    3: [
      { anchor: 'clareira_esquerda', elemento: 'arvore', escala: 0.75 },
      { anchor: 'clareira_central', elemento: 'arvore', escala: 0.85 },
      { anchor: 'clareira_direita', elemento: 'arvore_pequena', escala: 0.6 },
    ],
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
    1: [{ anchor: 'clareira_central', elemento: 'fogueira', escala: 0.5 }],
    2: [
      { anchor: 'clareira_central', elemento: 'fogueira', escala: 0.5 },
      { anchor: 'clareira_direita', elemento: 'casa', escala: 0.6 },
    ],
    3: [
      { anchor: 'clareira_central', elemento: 'fogueira', escala: 0.5 },
      { anchor: 'clareira_direita', elemento: 'casa', escala: 0.65 },
    ],
  },
  tecnologia: {
    1: [{ anchor: 'clareira_esquerda', elemento: 'ferramenta', escala: 0.45 }],
    2: [
      { anchor: 'clareira_esquerda', elemento: 'engrenagem', escala: 0.5 },
    ],
    3: [
      { anchor: 'alto_observatorio', elemento: 'observatorio', escala: 0.55 },
    ],
    4: [
      { anchor: 'alto_observatorio', elemento: 'foguete', escala: 0.6 },
    ],
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
  // terreno e água não colocam elementos "soltos" — elas mudam a própria
  // geografia (força do brilho da água, textura das clareiras), tratadas
  // à parte em `aplicarNivelTerreno`/`aplicarNivelAgua`.
};

// nível 3 de civilização é o gatilho para o caminho e a ponte aparecerem
// — geometria de estado (linha ligando âncoras), não um asset avulso.
export const NIVEL_CAMINHO_CIVILIZACAO = 3;

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

export function anchorParaEstilo(nomeAnchor) {
  const a = ANCHORS[nomeAnchor];
  if (!a) return null;
  return {
    left: `${a.x}%`, top: `${a.y}%`, zIndex: a.z,
  };
}

// mais de uma família pode legitimamente ocupar a mesma clareira ao mesmo
// tempo (ex.: vegetação e civilização na clareira_central). Um deslocamento
// pequeno e fixo POR FAMÍLIA — nunca por asset — evita que um elemento
// esconda o outro, sem inventar novas âncoras pra cada combinação possível.
const DESLOCAMENTO_POR_FAMILIA = {
  vegetacao: { dx: -6, dy: -4 },
  civilizacao: { dx: 0, dy: 6 },
  tecnologia: { dx: 6, dy: -4 },
  vida: { dx: 0, dy: -8 },
  cosmico: { dx: 0, dy: 0 },
  agua: { dx: 0, dy: 0 },
  terreno: { dx: 0, dy: 0 },
};

export function posicaoDoObjeto(familia, nomeAnchor) {
  const a = ANCHORS[nomeAnchor];
  if (!a) return null;
  const d = DESLOCAMENTO_POR_FAMILIA[familia] || { dx: 0, dy: 0 };
  return {
    left: `${a.x + d.dx}%`, top: `${a.y + d.dy}%`, zIndex: a.z,
  };
}
