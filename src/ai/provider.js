// Camada de IA do cliente. O app usa `criarProviderEndpoint('/api/combinar')`;
// a função serverless (api/combinar.js) tem os guard-rails (prompt fixo
// family-friendly, lista de bloqueio, pt_BR, timeout) e devolve corpo vazio
// quando não há sugestão — que aqui vira `null` = "nada aconteceu".
// `stubDesligado` fica para testes.

export const stubDesligado = {
  async sugerirCombo() {
    return null;
  },
};

// `aoFalhar` é chamado só quando a IA fica REALMENTE inacessível: erro de
// rede/timeout ou resposta HTTP não-ok do endpoint. Um 200 com corpo vazio
// NÃO chama `aoFalhar` — pode ser o guard-rail recusando a sugestão, o que
// não significa "IA caiu".
export function criarProviderEndpoint(url, { aoFalhar } = {}) {
  return {
    async sugerirCombo(itemA, itemB) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ a: itemA.nome, b: itemB.nome }),
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) { aoFalhar?.(); return null; }
        const dados = await resp.json();
        if (!dados || !dados.resultadoNome) return null;
        return {
          resultadoNome: String(dados.resultadoNome),
          emoji: dados.emoji ? String(dados.emoji) : '✨',
          texto: String(dados.texto || ''),
          ...(dados.era ? { era: String(dados.era) } : {}),
        };
      } catch {
        aoFalhar?.();
        return null;
      }
    },
  };
}
