// src/ui/canvas.js
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;
const TOQUE_LONGO_MS = 500;

export function montarCanvas({ raiz, store, catalogo, combinar, aoResultado }) {
  raiz.innerHTML = '';
  const mundo = document.createElement('div');
  mundo.className = 'canvas-mundo';
  raiz.appendChild(mundo);

  const vista = { x: 0, y: 0, escala: 1 };
  const pecas = new Map(); // uid -> elemento

  function aplicarVista() {
    mundo.style.transform =
      `translate(${vista.x}px, ${vista.y}px) scale(${vista.escala})`;
  }

  function elementoPeca(inst) {
    const item = catalogo.getItem(inst.id);
    const el = document.createElement('div');
    el.className = 'peca';
    el.dataset.uid = inst.uid;
    el.style.left = `${inst.x}px`;
    el.style.top = `${inst.y}px`;
    const icone = item.svg
      ? `<img class="peca-icone" src="${item.svg}" alt="" />`
      : `<span class="peca-icone">${item.emoji}</span>`;
    el.innerHTML = `${icone}<span class="peca-nome">${item.nome}</span>`;
    ligarArrasto(el, inst.uid);
    return el;
  }

  function render() {
    for (const el of pecas.values()) el.remove();
    pecas.clear();
    for (const inst of store.listInstances()) {
      const el = elementoPeca(inst);
      mundo.appendChild(el);
      pecas.set(inst.uid, el);
    }
  }

  function centro(uid) {
    const inst = store.getInstance(uid);
    const el = pecas.get(uid);
    if (!inst || !el) return null;
    return { x: inst.x + el.offsetWidth / 2, y: inst.y + el.offsetHeight / 2 };
  }

  function alvoSob(uidArrastada) {
    const c = centro(uidArrastada);
    if (!c) return null;
    for (const inst of store.listInstances()) {
      if (inst.uid === uidArrastada) continue;
      const el = pecas.get(inst.uid);
      if (!el) continue;
      const dentro =
        c.x >= inst.x && c.x <= inst.x + el.offsetWidth &&
        c.y >= inst.y && c.y <= inst.y + el.offsetHeight;
      if (dentro) return inst.uid;
    }
    return null;
  }

  async function fundir(uidArrastada, uidAlvo) {
    const a = store.getInstance(uidArrastada);
    const b = store.getInstance(uidAlvo);
    if (!a || !b) return;
    const px = (a.x + b.x) / 2;
    const py = (a.y + b.y) / 2;
    const resultado = await combinar(a.id, b.id);
    if (resultado.tipo === 'ok') {
      const novo = !store.isDiscovered(resultado.item.id);
      store.removeInstance(uidArrastada);
      store.removeInstance(uidAlvo);
      pecas.get(uidArrastada)?.remove();
      pecas.get(uidAlvo)?.remove();
      pecas.delete(uidArrastada);
      pecas.delete(uidAlvo);
      const inst = store.addInstance(resultado.item.id, px, py);
      const el = elementoPeca(inst);
      el.classList.add('surgindo');
      mundo.appendChild(el);
      pecas.set(inst.uid, el);
      store.recordDiscovery(resultado.item.id, [a.id, b.id], resultado.fonte);
      aoResultado(resultado, { x: px, y: py, novo });
    } else {
      aoResultado(resultado, { x: a.x, y: a.y, novo: false });
    }
  }

  function ligarArrasto(el, uid) {
    let arrastando = false;
    let inicio = null;
    let timerLongo = null;

    el.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      arrastando = true;
      el.setPointerCapture?.(ev.pointerId);
      el.classList.add('arrastando');
      const inst = store.getInstance(uid);
      inicio = { mx: ev.clientX, my: ev.clientY, x: inst.x, y: inst.y };
      timerLongo = setTimeout(() => {
        arrastando = false;
        store.removeInstance(uid);
        el.remove();
        pecas.delete(uid);
      }, TOQUE_LONGO_MS);
    });

    el.addEventListener('pointermove', (ev) => {
      if (!arrastando || !inicio) return;
      clearTimeout(timerLongo);
      const dx = (ev.clientX - inicio.mx) / vista.escala;
      const dy = (ev.clientY - inicio.my) / vista.escala;
      const nx = inicio.x + dx;
      const ny = inicio.y + dy;
      el.style.left = `${nx}px`;
      el.style.top = `${ny}px`;
      store.moveInstance(uid, nx, ny);
    });

    el.addEventListener('pointerup', async (ev) => {
      clearTimeout(timerLongo);
      if (!arrastando) return;
      arrastando = false;
      el.classList.remove('arrastando');
      el.releasePointerCapture?.(ev.pointerId);
      const alvo = alvoSob(uid);
      if (alvo) {
        await fundir(uid, alvo);
      }
    });
  }

  // pan e zoom no fundo
  let panInicio = null;
  raiz.addEventListener('pointerdown', (ev) => {
    if (ev.target !== raiz && ev.target !== mundo) return;
    panInicio = { mx: ev.clientX, my: ev.clientY, x: vista.x, y: vista.y };
  });
  raiz.addEventListener('pointermove', (ev) => {
    if (!panInicio) return;
    vista.x = panInicio.x + (ev.clientX - panInicio.mx);
    vista.y = panInicio.y + (ev.clientY - panInicio.my);
    aplicarVista();
  });
  raiz.addEventListener('pointerup', () => { panInicio = null; });
  raiz.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const passo = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
    vista.escala = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, vista.escala * passo));
    aplicarVista();
  }, { passive: false });

  render();
  aplicarVista();

  return {
    render,
    soltarItem(id, x, y) {
      const inst = store.addInstance(id, x, y);
      const el = elementoPeca(inst);
      mundo.appendChild(el);
      pecas.set(inst.uid, el);
      return inst;
    },
    destruirTudo() {
      for (const el of pecas.values()) el.remove();
      pecas.clear();
      store.clearInstances();
    },
    _fundirParaTeste: fundir,
  };
}
