// Função serverless (Vercel, Node). Recebe { a, b } — nomes de dois itens —
// e devolve { resultadoNome, emoji, texto } quando o Gemini sugere uma
// combinação que passa nos guard-rails. Em qualquer outra situação devolve
// 200 com corpo vazio, e o cliente trata como "nada aconteceu".
import {
  PROMPT_SISTEMA, montarPrompt, entradaValida, passaNoFiltro, parseRespostaGemini,
} from './_guardrails.js';

const MODELO = 'gemini-2.5-flash-lite';
const ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;

function vazio(res) {
  res.status(200).json({});
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  let corpo = req.body;
  if (typeof corpo === 'string') {
    try { corpo = JSON.parse(corpo); } catch { corpo = null; }
  }
  const a = corpo && corpo.a;
  const b = corpo && corpo.b;
  if (!entradaValida(a, b)) {
    vazio(res);
    return;
  }

  const chave = process.env.GEMINI_API_KEY;
  if (!chave) {
    vazio(res);
    return;
  }

  try {
    const r = await fetch(`${ENDPOINT}?key=${chave}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(6000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PROMPT_SISTEMA }] },
        contents: [{ role: 'user', parts: [{ text: montarPrompt(a, b) }] }],
        generationConfig: {
          temperature: 0.9,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              resultadoNome: { type: 'STRING' },
              emoji: { type: 'STRING' },
              texto: { type: 'STRING' },
            },
            required: ['resultadoNome', 'emoji', 'texto'],
          },
        },
      }),
    });
    if (!r.ok) {
      vazio(res);
      return;
    }
    const sugestao = parseRespostaGemini(await r.json());
    if (!sugestao || !passaNoFiltro(sugestao)) {
      vazio(res);
      return;
    }
    res.status(200).json(sugestao);
  } catch {
    vazio(res);
  }
}
