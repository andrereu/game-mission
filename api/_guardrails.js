// Guard-rails do endpoint /api/combinar. Puro e testável: a função serverless
// (api/combinar.js) só orquestra estas peças em volta da chamada ao Gemini.

export const PROMPT_SISTEMA = [
  'Você inventa combinações para um jogo infantil em português do Brasil, no estilo Infinite Craft.',
  'Dado dois itens, invente um terceiro que seja a mistura lógica e divertida dos dois.',
  'Regras rígidas:',
  '- Conteúdo 100% adequado para crianças pequenas.',
  '- Proibido: violência, armas, morte, sangue, drogas, álcool, cigarro, sexo, nudez, palavrões, ódio, marcas comerciais e pessoas reais.',
  '- "resultadoNome": 1 a 3 palavras, em português do Brasil.',
  '- "era": a categoria mais parecida entre exatamente estas: elementos, natureza, vida, tecnologia, cultura, ficcao.',
  '- "emoji": um único emoji Unicode que represente o item.',
  '- "texto": uma frase curta e simples, como para uma criança de 6 anos, explicando a mistura.',
  'Responda apenas o JSON, sem comentários.',
].join('\n');

export function montarPrompt(a, b) {
  return `Item A: ${a}\nItem B: ${b}`;
}

export function entradaValida(a, b) {
  for (const v of [a, b]) {
    if (typeof v !== 'string') return false;
    const t = v.trim();
    if (t.length < 1 || t.length > 40) return false;
    for (let i = 0; i < v.length; i += 1) {
      const c = v.charCodeAt(i);
      if (c < 0x20 || c === 0x7f) return false; // caractere de controle / quebra de linha
    }
  }
  return true;
}

// Substrings em minúsculas. Preferimos termos específicos para não vetar
// palavras comuns (ex: "arma" pegaria "armário"). Excesso de bloqueio cai em
// "nada aconteceu" — seguro, só chato.
export const TERMOS_BLOQUEADOS = [
  'pistola', 'revólver', 'revolver', 'espingarda', 'rifle', 'metralhadora',
  'granada', 'explosiv', 'bomba', 'faca', 'punhal', 'tiroteio', 'atirar em',
  'assassin', 'matar', 'homicíd', 'homicid', 'cadáver', 'cadaver',
  'suicíd', 'suicid', 'enforca', 'sangue', 'sangrent',
  'maconha', 'cocaína', 'cocaina', 'crack', 'heroína', 'heroina', 'droga',
  'álcool', 'alcool', 'cerveja', 'vodka', 'whisky', 'uísque', 'uisque', 'cigarro',
  'sexo', 'sexual', 'pornô', 'porno', 'nudez', 'pelad', 'transar', 'estupro',
  'racism', 'racist', 'nazis',
];

export function passaNoFiltro({ resultadoNome, texto } = {}) {
  if (typeof resultadoNome !== 'string' || typeof texto !== 'string') return false;
  const nome = resultadoNome.trim();
  const frase = texto.trim();
  if (nome.length < 2 || nome.length > 40) return false;
  if (nome.split(/\s+/).length > 4) return false;
  if (frase.length < 3) return false;
  const alvo = `${nome} ${frase}`.toLowerCase();
  return !TERMOS_BLOQUEADOS.some((t) => alvo.includes(t));
}

export function parseRespostaGemini(resp) {
  let obj = resp;
  const texto = resp?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof texto === 'string') {
    try {
      obj = JSON.parse(texto);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object') return null;
  if (typeof obj.resultadoNome !== 'string' || !obj.resultadoNome.trim()) return null;
  return {
    resultadoNome: String(obj.resultadoNome).trim(),
    emoji: obj.emoji ? String(obj.emoji) : '✨',
    texto: obj.texto ? String(obj.texto) : '',
    ...(obj.era ? { era: String(obj.era) } : {}),
  };
}
