import { T } from '../data/textos.js';
import { ERAS } from '../engine/catalogo.js';
import { slug } from '../engine/slug.js';

export function montarDrawer({ raiz, store, catalogo, aoEscolherItem }) {
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
      card.draggable = true;
      const icone = item.svg
        ? `<img class="card-icone" src="${item.svg}" alt="" />`
        : `<span class="card-icone">${item.emoji}</span>`;
      card.innerHTML = `${icone}<span class="card-nome">${item.nome}</span>`;
      card.addEventListener('click', () => aoEscolherItem(item.id));
      card.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData('text/mistura-id', item.id);
      });
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
