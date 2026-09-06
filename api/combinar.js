// Função serverless (Vercel, Node). Recebe { a, b } — nomes de dois itens —
// e devolve { resultadoNome, emoji, texto } quando o Gemini sugere uma
// combinação que passa nos guard-rails. Em qualquer outra situação devolve
// 200 com corpo vazio, e o cliente trata como "nada aconteceu".
import {
  PROMPT_SISTEMA, montarPrompt, entradaValida, passaNoFiltro, parseRespostaGemini,
} from './_guardrails.js';

// Alias auto-atualizado para o flash-lite atual (v1beta). Trocável por env var
// sem mexer no código: GEMINI_MODELO = gemini-2.5-flash, gemini-flash-latest, ...
const MODELO = process.env.GEMINI_MODELO || 'gemini-flash-lite-latest';
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
    console.error('combinar: sem GEMINI_API_KEY');
    vazio(res);
    return;
  }

  // ?debug=1 devolve o detalhe do erro no corpo, para diagnóstico manual.
  const depurar = /[?&]debug=/.test(req.url || '');

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
              era: {
                type: 'STRING',
                enum: ['elementos', 'natureza', 'vida', 'tecnologia', 'cultura', 'ficcao'],
              },
            },
            required: ['resultadoNome', 'emoji', 'texto', 'era'],
          },
        },
      }),
    });
    if (!r.ok) {
      const detalhe = await r.text().catch(() => '');
      console.error('combinar: gemini', r.status, detalhe.slice(0, 600));
      if (depurar) { res.status(200).json({ _erro: 'gemini-nao-ok', modelo: MODELO, status: r.status, detalhe: detalhe.slice(0, 800) }); return; }
      vazio(res);
      return;
    }
    const dados = await r.json();
    const sugestao = parseRespostaGemini(dados);
    if (!sugestao) {
      console.error('combinar: parse falhou', JSON.stringify(dados).slice(0, 600));
      if (depurar) { res.status(200).json({ _erro: 'parse', dados }); return; }
      vazio(res);
      return;
    }
    if (!passaNoFiltro(sugestao)) {
      console.error('combinar: bloqueado', JSON.stringify(sugestao));
      if (depurar) { res.status(200).json({ _erro: 'bloqueado', sugestao }); return; }
      vazio(res);
      return;
    }
    res.status(200).json(sugestao);
  } catch (err) {
    console.error('combinar: excecao', err && err.message);
    if (depurar) { res.status(200).json({ _erro: 'excecao', mensagem: String(err && err.message) }); return; }
    vazio(res);
  }
}
