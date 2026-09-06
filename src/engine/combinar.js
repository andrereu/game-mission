import { ERAS } from './catalogo.js';
import { eraHerdada } from './eras.js';

export function criarCombinador({ catalogo, aiProvider, estaOnline }) {
  return async function combinar(idA, idB) {
    const combo = catalogo.findCombo(idA, idB);
    if (combo) {
      return {
        tipo: 'ok',
        item: catalogo.getItem(combo.resultado),
        combo,
        fonte: 'local',
      };
    }

    if (aiProvider && estaOnline()) {
      const itemA = catalogo.getItem(idA);
      const itemB = catalogo.getItem(idB);
      let sugestao = null;
      try {
        sugestao = await aiProvider.sugerirCombo(itemA, itemB);
      } catch {
        sugestao = null;
      }
      if (sugestao && sugestao.resultadoNome) {
        const item = catalogo.registrarItemIA({
          nome: sugestao.resultadoNome,
          emoji: sugestao.emoji,
          era: ERAS.includes(sugestao.era)
            ? sugestao.era
            : eraHerdada(itemA && itemA.era, itemB && itemB.era),
        });
        catalogo.registrarComboIA(idA, idB, item.id, sugestao.texto || '');
        return {
          tipo: 'ok',
          item,
          combo: { a: idA, b: idB, resultado: item.id, texto: sugestao.texto || '' },
          fonte: 'ia',
        };
      }
    }

    return { tipo: 'nada' };
  };
}
