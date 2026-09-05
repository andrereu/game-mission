// Camada de IA. Nesta fase o app usa SEMPRE `stubDesligado`.
// `criarProviderEndpoint` fica pronto e documentado para a fase 2,
// quando existir um endpoint /api/combinar com guard-rails
// (prompt family-friendly fixo, lista de bloqueio, resposta pt_BR,
// timeout, fallback "nada aconteceu").

export const stubDesligado = {
  async sugerirCombo() {
    return null;
  },
};

export function criarProviderEndpoint(url) {
  return {
    async sugerirCombo(itemA, itemB) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ a: itemA.nome, b: itemB.nome }),
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) return null;
        const dados = await resp.json();
        if (!dados || !dados.resultadoNome) return null;
        return {
          resultadoNome: String(dados.resultadoNome),
          emoji: dados.emoji ? String(dados.emoji) : '✨',
          texto: String(dados.texto || ''),
        };
      } catch {
        return null;
      }
    },
  };
}
