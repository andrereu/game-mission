// Pan + zoom compartilhado pelo canvas de jogo e pela árvore.
// Trata: pan de 1 ponteiro, zoom por scroll (desktop) e pinça de 2 dedos (toque).
// `vista` é { x, y, escala }; `aplicar()` redesenha a partir dela.

export function ligarPanZoom({
  alvo,
  vista,
  aplicar,
  permitePan = () => true,
  zoomMin = 0.3,
  zoomMax = 2.5,
}) {
  const pontos = new Map(); // pointerId -> { x, y }
  let pan = null; // { mx, my, x, y } — arraste de 1 dedo
  let pinca = null; // { dist, cx, cy, escala, vx, vy } — 2 dedos

  const limitar = (e) => Math.min(zoomMax, Math.max(zoomMin, e));

  function centroEDist() {
    const [a, b] = [...pontos.values()];
    return {
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
      dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
    };
  }

  function iniciarPan(x, y) {
    pan = { mx: x, my: y, x: vista.x, y: vista.y };
    pinca = null;
  }

  function iniciarPinca() {
    const { cx, cy, dist } = centroEDist();
    pinca = { dist, cx, cy, escala: vista.escala, vx: vista.x, vy: vista.y };
    pan = null;
  }

  alvo.addEventListener('pointerdown', (ev) => {
    if (!permitePan(ev)) return;
    pontos.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pontos.size === 1) iniciarPan(ev.clientX, ev.clientY);
    else if (pontos.size === 2) iniciarPinca();
    try { alvo.setPointerCapture?.(ev.pointerId); } catch { /* ponteiro já inativo */ }
  });

  alvo.addEventListener('pointermove', (ev) => {
    if (!pontos.has(ev.pointerId)) return;
    pontos.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (pinca && pontos.size >= 2) {
      const { cx, cy, dist } = centroEDist();
      const novaEscala = limitar(pinca.escala * (dist / pinca.dist));
      const rel = novaEscala / pinca.escala;
      vista.escala = novaEscala;
      // mantém o ponto do mundo que estava sob o centro inicial preso ao centro atual
      vista.x = cx - (pinca.cx - pinca.vx) * rel;
      vista.y = cy - (pinca.cy - pinca.vy) * rel;
      aplicar();
    } else if (pan) {
      vista.x = pan.x + (ev.clientX - pan.mx);
      vista.y = pan.y + (ev.clientY - pan.my);
      aplicar();
    }
  });

  function soltar(ev) {
    if (!pontos.has(ev.pointerId)) return;
    pontos.delete(ev.pointerId);
    try { alvo.releasePointerCapture?.(ev.pointerId); } catch { /* nada */ }
    if (pontos.size === 1) {
      const [p] = [...pontos.values()];
      iniciarPan(p.x, p.y); // volta pra 1 dedo: retoma o pan a partir dele
    } else if (pontos.size === 0) {
      pan = null;
      pinca = null;
    }
  }
  alvo.addEventListener('pointerup', soltar);
  alvo.addEventListener('pointercancel', soltar);

  alvo.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const passo = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
    const nova = limitar(vista.escala * passo);
    const rel = nova / vista.escala;
    vista.x = ev.clientX - (ev.clientX - vista.x) * rel; // zoom no ponteiro
    vista.y = ev.clientY - (ev.clientY - vista.y) * rel;
    vista.escala = nova;
    aplicar();
  }, { passive: false });
}
