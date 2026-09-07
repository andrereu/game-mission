import { T } from '../data/textos.js';
import { ERAS } from '../engine/catalogo.js';
import { slug } from '../engine/slug.js';
import { ehAlemDoMapaVisivel, atributosOrbeAlemDoMapa, srOnlyAlemDoMapa } from './alemDoMapaUI.js';

const LIMIAR_MOV = 8; // px de movimento antes do "segurar" = virou scroll
const SEGURAR_MS = 180; // hold pra "pegar" o card e começar a arrastar

export function montarDrawer({
  raiz, store, catalogo, aoEscolherItem, aoSoltarItem, aoAbrirAlbum,
}) {
  const soltar = aoSoltarItem || (() => {});

  function posicionarFantasma(el, x, y) {
    el.style.left = `${x - 30}px`;
    el.style.top = `${y - 30}px`;
  }

  function ligarArrasto(card, id) {
    let inicio = null;
    let timer = null;
    let fantasma = null;
    let arrastando = false;

    function encerrar() {
      clearTimeout(timer);
      timer = null;
      if (fantasma) { fantasma.remove(); fantasma = null; }
      arrastando = false;
      inicio = null;
    }

    card.addEventListener('pointerdown', (ev) => {
      if (ev.button != null && ev.button !== 0) return;
      inicio = { x: ev.clientX, y: ev.clientY, pid: ev.pointerId };
      clearTimeout(timer);
      timer = setTimeout(() => {
        arrastando = true;
        fantasma = document.createElement('div');
        fantasma.className = 'drawer-ghost';
        fantasma.setAttribute('aria-hidden', 'true');
        fantasma.innerHTML = card.innerHTML;
        posicionarFantasma(fantasma, inicio.x, inicio.y);
        document.body.appendChild(fantasma);
        try { card.setPointerCapture?.(inicio.pid); } catch { /* ponteiro já inativo */ }
      }, SEGURAR_MS);
    });

    card.addEventListener('pointermove', (ev) => {
      if (!inicio) return;
      if (!arrastando) {
        const dist = Math.hypot(ev.clientX - inicio.x, ev.clientY - inicio.y);
        if (dist > LIMIAR_MOV) { clearTimeout(timer); timer = null; } // é scroll
        return;
      }
      ev.preventDefault();
      posicionarFantasma(fantasma, ev.clientX, ev.clientY);
    });

    card.addEventListener('pointerup', (ev) => {
      const foiArrasto = arrastando;
      const { clientX, clientY } = ev;
      try { card.releasePointerCapture?.(ev.pointerId); } catch { /* nada */ }
      encerrar();
      if (foiArrasto) {
        card.__ignorarClique = true; // o click sintético vem logo depois
        setTimeout(() => { card.__ignorarClique = false; }, 0);
        soltar(id, clientX, clientY);
      }
    });

    card.addEventListener('pointercancel', encerrar);
  }

  raiz.setAttribute('aria-label', T.inventarioTitulo);
  raiz.innerHTML = `
    <div class="drawer-puxador" aria-hidden="true"></div>
    <div class="drawer-cabecalho">
      <div class="drawer-cabecalho-texto">
        <h2 class="drawer-titulo">${T.inventarioTitulo}</h2>
        <div class="drawer-cabecalho-contagem">
          <span class="drawer-contador"></span>
          <span class="drawer-contador-ia"></span>
        </div>
      </div>
      <button type="button" class="drawer-ver-todos">${T.verTodos}</button>
    </div>
    <div class="drawer-controles">
      <input class="drawer-busca" type="search" placeholder="${T.buscar}" />
      <div class="drawer-chips-scroll"><div class="drawer-chips"></div></div>
      <div class="drawer-progresso">
        <div class="drawer-progresso-trilho"><div class="drawer-progresso-barra"></div></div>
      </div>
    </div>
    <div class="drawer-grade"></div>`;

  const elBusca = raiz.querySelector('.drawer-busca');
  const elChips = raiz.querySelector('.drawer-chips');
  const elContador = raiz.querySelector('.drawer-contador');
  const elContadorIA = raiz.querySelector('.drawer-contador-ia');
  const elBarraProgresso = raiz.querySelector('.drawer-progresso-barra');
  const elGrade = raiz.querySelector('.drawer-grade');
  const elVerTodos = raiz.querySelector('.drawer-ver-todos');
  elVerTodos.addEventListener('click', () => aoAbrirAlbum?.());

  const erasAtivas = new Set();
  const chipsPorEra = new Map();
  let iaAtivo = false;

  // "Todos" limpa os filtros de era e o filtro de IA — junto com os chips de
  // era, agora numa fita com scroll horizontal (não dependem mais de caber
  // numa linha só)
  const chipTodos = document.createElement('button');
  chipTodos.type = 'button';
  chipTodos.className = 'drawer-chip drawer-chip-todos';
  chipTodos.innerHTML = `<span class="drawer-chip-icone">✨</span><span class="drawer-chip-nome">${T.chipTodos}</span>`;
  chipTodos.setAttribute('aria-pressed', 'true');
  chipTodos.addEventListener('click', () => {
    erasAtivas.clear();
    for (const chip of chipsPorEra.values()) chip.setAttribute('aria-pressed', 'false');
    iaAtivo = false;
    chipIA.setAttribute('aria-pressed', 'false');
    atualizarChipTodos();
    render();
  });
  elChips.appendChild(chipTodos);

  function atualizarChipTodos() {
    chipTodos.setAttribute('aria-pressed', String(erasAtivas.size === 0 && !iaAtivo));
  }

  for (const era of ERAS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'drawer-chip';
    chip.innerHTML = `<span class="drawer-chip-icone">${T.erasIcone[era] || ''}</span><span class="drawer-chip-nome">${T.eras[era]}</span>`;
    chip.dataset.era = era;
    chip.setAttribute('aria-pressed', 'false');
    chip.addEventListener('click', () => {
      iaAtivo = false;
      chipIA.setAttribute('aria-pressed', 'false');
      if (erasAtivas.has(era)) {
        erasAtivas.delete(era);
        chip.setAttribute('aria-pressed', 'false');
      } else {
        erasAtivas.add(era);
        chip.setAttribute('aria-pressed', 'true');
      }
      atualizarChipTodos();
      render();
    });
    elChips.appendChild(chip);
    chipsPorEra.set(era, chip);
  }

  // filtro próprio da coleção "Inventadas com IA": mutuamente exclusivo com
  // os filtros de era (item.ia nunca conta pra nenhuma era canônica)
  const chipIA = document.createElement('button');
  chipIA.type = 'button';
  chipIA.className = 'drawer-chip drawer-chip-ia';
  chipIA.innerHTML = `<span class="drawer-chip-icone">✨</span><span class="drawer-chip-nome">${T.chipIA}</span>`;
  chipIA.dataset.ia = 'true';
  chipIA.setAttribute('aria-pressed', 'false');
  chipIA.addEventListener('click', () => {
    iaAtivo = !iaAtivo;
    chipIA.setAttribute('aria-pressed', String(iaAtivo));
    if (iaAtivo) {
      erasAtivas.clear();
      for (const chip of chipsPorEra.values()) chip.setAttribute('aria-pressed', 'false');
    }
    atualizarChipTodos();
    render();
  });
  elChips.appendChild(chipIA);

  elBusca.addEventListener('input', render);

  function itensDescobertos() {
    const desc = store.getSave().descobertos;
    return Object.keys(desc)
      .map((id) => ({ item: catalogo.getItem(id), meta: desc[id] }))
      .filter((x) => x.item)
      .sort((a, b) => {
        // itens da IA não são canônicos: sempre por último, depois da curadoria
        const ia = Number(Boolean(a.item.ia)) - Number(Boolean(b.item.ia));
        if (ia !== 0) return ia;
        const ea = ERAS.indexOf(a.item.era);
        const eb = ERAS.indexOf(b.item.era);
        if (ea !== eb) return ea - eb;
        return a.meta.em - b.meta.em;
      });
  }

  function render() {
    const termo = slug(elBusca.value || '');
    const lista = itensDescobertos().filter(({ item }) => {
      // "IA" mostra só criações da IA; os filtros de era nunca incluem
      // item.ia (não conta pra nenhuma era canônica); "Todos" reúne os dois.
      if (iaAtivo) {
        if (!item.ia) return false;
      } else if (erasAtivas.size && (item.ia || !erasAtivas.has(item.era))) {
        return false;
      }
      if (termo && !slug(item.nome).includes(termo)) return false;
      return true;
    });

    // contagem canônica separada da contagem de criações da IA — criar com
    // IA nunca aumenta o denominador canônico (283 itens do mapa)
    const totalCanonico = catalogo.allItems().filter((it) => !it.ia).length;
    const todosDescobertos = itensDescobertos();
    const feitosCanonico = todosDescobertos.filter(({ item }) => !item.ia).length;
    const feitosIA = todosDescobertos.filter(({ item }) => item.ia).length;
    elContador.textContent = T.contador(feitosCanonico, totalCanonico);
    elContadorIA.textContent = feitosIA > 0 ? T.drawerInventadas(feitosIA) : '';
    elBarraProgresso.style.width = `${totalCanonico ? Math.min(100, (feitosCanonico / totalCanonico) * 100) : 0}%`;

    elGrade.innerHTML = '';
    for (const { item, meta } of lista) {
      const card = document.createElement('div');
      card.className = 'drawer-card';
      card.dataset.id = item.id;
      card.dataset.era = item.era;
      card.dataset.fonte = meta.fonte;
      const icone = item.svg
        ? `<img class="card-icone" src="${item.svg}" alt="" />`
        : `<span class="card-icone">${item.emoji}</span>`;
      const alem = ehAlemDoMapaVisivel(catalogo, store, item.id);
      card.innerHTML =
        `<span class="orbe orbe-gaveta" data-era="${item.era}"${meta.fonte === 'ia' ? ' data-fonte="ia"' : ''}${atributosOrbeAlemDoMapa(alem, T)}>${icone}</span>` +
        `<span class="card-nome">${item.nome}${srOnlyAlemDoMapa(alem, T)}</span>`;
      card.addEventListener('click', () => {
        if (card.__ignorarClique) return;
        aoEscolherItem(item.id);
      });
      ligarArrasto(card, item.id);
      elGrade.appendChild(card);
    }
  }

  render();

  return {
    render,
    adicionarCard() {
      render();
    },
  };
}
