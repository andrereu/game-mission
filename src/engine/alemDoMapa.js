// "Além do mapa": itens do catálogo oficial (não-IA) que chegaram
// estruturalmente ao fim da árvore — nunca funcionam como ingrediente de uma
// combinação curada capaz de produzir um item DIFERENTE deles mesmos.
// Calculado só a partir do catálogo curado (itens/combos "de fábrica"): itens
// e combos criados pela IA em tempo real nunca entram nessa conta, e a lista
// nunca é mantida manualmente — sempre recalculada do zero.
export function calcularAlemDoMapa(itensCurados, combosCurados) {
  const podeProduzirOutro = new Set();
  for (const c of combosCurados) {
    if (c.resultado === c.a && c.resultado === c.b) continue; // self+self=self: não conta
    if (c.resultado !== c.a) podeProduzirOutro.add(c.a);
    if (c.resultado !== c.b) podeProduzirOutro.add(c.b);
  }
  const resultado = new Set();
  for (const it of itensCurados) {
    if (!podeProduzirOutro.has(it.id)) resultado.add(it.id);
  }
  return resultado;
}
