// Chip "Desfazer" que aparece depois de limpar o canvas. Some sozinho após
// `ms` ou quando o jogador clica. Sem alerta bloqueante do navegador.
export function mostrarDesfazer({ raiz, T, aoDesfazer, ms = 5000 }) {
  const chip = document.createElement('div');
  chip.className = 'desfazer-chip';
  chip.innerHTML = `<span class="desfazer-texto"></span><button type="button" class="desfazer-btn">${T.desfazer}</button>`;
  chip.querySelector('.desfazer-texto').textContent = T.canvasLimpo || '';

  let timer = null;
  function sair() {
    clearTimeout(timer);
    chip.remove();
  }

  chip.querySelector('.desfazer-btn').addEventListener('click', () => {
    aoDesfazer();
    sair();
  });
  timer = setTimeout(sair, ms);
  (raiz || document.body).appendChild(chip);

  return { fechar: sair };
}
