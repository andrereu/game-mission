import { T } from '../data/textos.js';
import { ERAS } from '../engine/catalogo.js';
import { slug } from '../engine/slug.js';

const LIMIAR_MOV = 8; // px de movimento antes do "segurar" = virou scroll
const SEGURAR_MS = 180; // hold pra "pegar" o card e começar a arrastar

export function montarDrawer({ raiz, store, catalogo, aoEscolherItem, aoSoltarItem }) {
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

  raiz.innerHTML = `
    <div class="drawer-cabecalho">
      <span class="drawer-titulo">${T.inventarioTitulo}</span>
      <span class="drawer-contador"></span>
    </div>
    <input class="drawer-busca" type="search" placeholder="${T.buscar}" />
    <div class="drawer-chips-scroll"><div class="drawer-chips"></div></div>
    <div class="drawer-grade"></div>`;

  const elBusca = raiz.querySelector('.drawer-busca');
  const elChips = raiz.querySelector('.drawer-chips');
  const elContador = raiz.querySelector('.drawer-contador');
  const elGrade = raiz.querySelector('.drawer-grade');

  const erasAtivas = new Set();
  const chipsPorEra = new Map();

  // "Todos" limpa os filtros de era — junto com os chips de era, agora numa
  // fita com scroll horizontal (não dependem mais de caber numa linha só)
  const chipTodos = document.createElement('button');
  chipTodos.type = 'button';
  chipTodos.className = 'drawer-chip';
  chipTodos.textContent = T.chipTodos;
  chipTodos.setAttribute('aria-pressed', 'true');
  chipTodos.addEventListener('click', () => {
    erasAtivas.clear();
    for (const chip of chipsPorEra.values()) chip.setAttribute('aria-pressed', 'false');
    atualizarChipTodos();
    render();
  });
  elChips.appendChild(chipTodos);

  function atualizarChipTodos() {
    chipTodos.setAttribute('aria-pressed', String(erasAtivas.size === 0));
  }

  for (const era of ERAS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'drawer-chip';
    chip.textContent = `${T.erasIcone[era] || ''} ${T.eras[era]}`;
    chip.dataset.era = era;
    chip.setAttribute('aria-pressed', 'false');
    chip.addEventListener('click', () => {
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
      if (erasAtivas.size && !erasAtivas.has(item.era)) return false;
      if (termo && !slug(item.nome).includes(termo)) return false;
      return true;
    });

    elContador.textContent = T.contador(
      Object.keys(store.getSave().descobertos).length,
      catalogo.allItems().length,
    );

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
      card.innerHTML =
        `<span class="orbe orbe-gaveta" data-era="${item.era}"${meta.fonte === 'ia' ? ' data-fonte="ia"' : ''}>${icone}</span>` +
        `<span class="card-nome">${item.nome}</span>`;
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
