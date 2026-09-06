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
    <input class="drawer-busca" type="search" placeholder="${T.buscar}" />
    <div class="drawer-chips"></div>
    <div class="drawer-contador"></div>
    <div class="drawer-grade"></div>`;

  const elBusca = raiz.querySelector('.drawer-busca');
  const elChips = raiz.querySelector('.drawer-chips');
  const elContador = raiz.querySelector('.drawer-contador');
  const elGrade = raiz.querySelector('.drawer-grade');

  const erasAtivas = new Set();

  for (const era of ERAS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'drawer-chip';
    chip.textContent = T.eras[era];
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
      render();
    });
    elChips.appendChild(chip);
  }

  elBusca.addEventListener('input', render);

  function itensDescobertos() {
    const desc = store.getSave().descobertos;
    return Object.keys(desc)
      .map((id) => ({ item: catalogo.getItem(id), meta: desc[id] }))
      .filter((x) => x.item)
      .sort((a, b) => {
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
      card.innerHTML = `${icone}<span class="card-nome">${item.nome}</span>`;
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
