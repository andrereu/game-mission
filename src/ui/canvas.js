// src/ui/canvas.js
import { T } from '../data/textos.js';

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;
const TOQUE_LONGO_MS = 500;
const TOLERANCIA_TOQUE_LONGO = 6; // px: acima disso é arrasto, não toque longo

// Som fraco de "nada aconteceu" (mais grave e baixo que o bipe de descoberta).
function tocarNada() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 180;
    g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    o.start();
    o.stop(ctx.currentTime + 0.18);
  } catch {
    /* sem som */
  }
}

export function montarCanvas({ raiz, store, catalogo, combinar, aoResultado }) {
  raiz.innerHTML = '';
  const mundo = document.createElement('div');
  mundo.className = 'canvas-mundo';
  raiz.appendChild(mundo);

  const aviso = document.createElement('div');
  aviso.className = 'canvas-aviso';
  aviso.setAttribute('aria-live', 'polite');
  raiz.appendChild(aviso);

  const vista = { x: 0, y: 0, escala: 1 };
  const pecas = new Map(); // uid -> elemento

  function aplicarVista() {
    mundo.style.transform =
      `translate(${vista.x}px, ${vista.y}px) scale(${vista.escala})`;
  }

  function paraMundo(sx, sy) {
    return { x: (sx - vista.x) / vista.escala, y: (sy - vista.y) / vista.escala };
  }

  function animarUmaVez(el, classe) {
    el.classList.add(classe);
    const limpar = () => {
      el.classList.remove(classe);
      el.removeEventListener('animationend', limpar);
    };
    el.addEventListener('animationend', limpar);
  }

  function elementoPeca(inst) {
    const item = catalogo.getItem(inst.id);
    if (!item) return null; // id desconhecido no catálogo em memória: ignora
    const el = document.createElement('div');
    el.className = 'peca';
    el.dataset.uid = inst.uid;
    el.dataset.id = inst.id;
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
      if (!el) continue;
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

  function voltarPara(uid, pos) {
    const el = pecas.get(uid);
    if (pos) {
      store.moveInstance(uid, pos.x, pos.y);
      if (el) {
        el.style.left = `${pos.x}px`;
        el.style.top = `${pos.y}px`;
      }
    }
    if (el) animarUmaVez(el, 'quique');
  }

  async function fundir(uidArrastada, uidAlvo, inicio = null) {
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
      if (el) {
        el.classList.add('surgindo');
        mundo.appendChild(el);
        pecas.set(inst.uid, el);
      }
      store.recordDiscovery(resultado.item.id, [a.id, b.id], resultado.fonte);
      aoResultado(resultado, { x: px, y: py, novo });
    } else {
      // nada: a peça arrastada volta ao ponto de partida, com quique e som fraco
      const origem = inicio ? { x: inicio.x, y: inicio.y } : { x: a.x, y: a.y };
      voltarPara(uidArrastada, origem);
      const elAlvo = pecas.get(uidAlvo);
      if (elAlvo) animarUmaVez(elAlvo, 'quique');
      aviso.textContent = T.nadaAconteceu;
      if (store.getSave().ajustes?.som) tocarNada();
      aoResultado(resultado, { x: origem.x, y: origem.y, novo: false });
    }
  }

  function ligarArrasto(el, uid) {
    let arrastando = false;
    let inicio = null;
    let timerLongo = null;

    function cancelarLongo() {
      clearTimeout(timerLongo);
      timerLongo = null;
    }

    el.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      arrastando = true;
      el.setPointerCapture?.(ev.pointerId);
      el.classList.add('arrastando');
      const inst = store.getInstance(uid);
      if (!inst) return;
      inicio = { mx: ev.clientX, my: ev.clientY, x: inst.x, y: inst.y };
      cancelarLongo();
      timerLongo = setTimeout(() => {
        timerLongo = null;
        arrastando = false;
        store.removeInstance(uid);
        el.remove();
        pecas.delete(uid);
      }, TOQUE_LONGO_MS);
    });

    el.addEventListener('pointermove', (ev) => {
      if (!arrastando || !inicio) return;
      const dxTela = ev.clientX - inicio.mx;
      const dyTela = ev.clientY - inicio.my;
      // só cancela o toque longo se o ponteiro realmente saiu do lugar
      if (Math.hypot(dxTela, dyTela) > TOLERANCIA_TOQUE_LONGO) cancelarLongo();
      const nx = inicio.x + dxTela / vista.escala;
      const ny = inicio.y + dyTela / vista.escala;
      el.style.left = `${nx}px`;
      el.style.top = `${ny}px`;
      store.moveInstance(uid, nx, ny);
    });

    el.addEventListener('pointerup', async (ev) => {
      cancelarLongo();
      if (!arrastando) return;
      arrastando = false;
      el.classList.remove('arrastando');
      el.releasePointerCapture?.(ev.pointerId);
      const partida = inicio ? { x: inicio.x, y: inicio.y } : null;
      const alvo = alvoSob(uid);
      if (alvo) {
        await fundir(uid, alvo, partida);
      }
    });

    function abortar() {
      cancelarLongo();
      arrastando = false;
      el.classList.remove('arrastando');
    }

    el.addEventListener('pointercancel', abortar);
    el.addEventListener('lostpointercapture', abortar);
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
    // sx/sy são coordenadas de TELA relativas à raiz; convertemos para o mundo.
    soltarItem(id, sx, sy) {
      if (!catalogo.getItem(id)) return null;
      const { x, y } = paraMundo(sx, sy);
      const inst = store.addInstance(id, x, y);
      const el = elementoPeca(inst);
      if (el) {
        mundo.appendChild(el);
        pecas.set(inst.uid, el);
      }
      return inst;
    },
    destruirTudo() {
      for (const el of pecas.values()) el.remove();
      pecas.clear();
      store.clearInstances();
    },
    _fundirParaTeste: fundir,
    _setVistaParaTeste({ x = vista.x, y = vista.y, escala = vista.escala }) {
      vista.x = x;
      vista.y = y;
      vista.escala = escala;
      aplicarVista();
      return { ...vista };
    },
  };
}
