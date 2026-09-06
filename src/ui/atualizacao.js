// Aviso de atualização do PWA com a cara do Misturária, no lugar do aviso
// técnico padrão do navegador — vira parte do universo do jogo, não um
// alerta de app. Só chamado quando o service worker realmente troca de
// versão em background (ver wiring em app.js).
export function mostrarAtualizacaoDisponivel({ T, aoAtualizar }) {
  const raiz = document.getElementById('overlay-raiz') || document.body;
  const chip = document.createElement('div');
  chip.className = 'atualizacao-chip';
  chip.setAttribute('role', 'status');
  chip.innerHTML = `
    <img class="atualizacao-mascote" src="assets/cartas/mascote-feliz.png" alt="" />
    <div class="atualizacao-texto">
      <strong>${T.atualizacaoTitulo}</strong>
      <span>${T.atualizacaoTexto}</span>
    </div>
    <button type="button" class="atualizacao-btn">${T.atualizacaoBotao}</button>
  `;
  chip.querySelector('.atualizacao-btn').addEventListener('click', () => {
    chip.remove();
    aoAtualizar();
  });
  raiz.appendChild(chip);
  return { fechar: () => chip.remove() };
}
