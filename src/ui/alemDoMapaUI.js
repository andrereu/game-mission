// Ponto único pras 4 telas que representam um item (canvas, gaveta, álbum,
// carta) decidirem se mostram a identidade "além do mapa" — nunca antes de
// descoberto, nunca pra criações da IA (catalogo.ehAlemDoMapa já garante isso).
export function ehAlemDoMapaVisivel(catalogo, store, id) {
  return catalogo.ehAlemDoMapa(id) && store.isDiscovered(id);
}

// atributos do <span class="orbe">: liga o visual platina (base.css) e dá uma
// dica acessível extra além do glow (title = tooltip nativo em hover/foco).
export function atributosOrbeAlemDoMapa(visivel, T) {
  if (!visivel) return '';
  return ` data-alem="mapa" title="${T.alemDoMapaTitulo}: ${T.alemDoMapaTexto}"`;
}

// texto só pra leitor de tela — nunca depende só de cor/brilho pra avisar.
export function srOnlyAlemDoMapa(visivel, T) {
  if (!visivel) return '';
  return `<span class="sr-only"> — ${T.alemDoMapaTitulo}: ${T.alemDoMapaTexto}</span>`;
}
