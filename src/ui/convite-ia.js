// Convite lúdico pra IA: só aparece quando a dupla não tem combinação
// oficial e a IA está disponível (ligada + online). Nunca chama a IA sem
// esse toque explícito — "Agora não" ou fechar/Esc conta como recusa, sem
// gastar rede nem criar nada.
function iconeMini(item) {
  if (!item) return '';
  if (item.svg) return `<img class="convite-ia-icone" src="${item.svg}" alt="" />`;
  return `<span class="convite-ia-icone">${item.emoji}</span>`;
}

export function mostrarConviteIA({ itemA, itemB, T }) {
  return new Promise((resolve) => {
    const raiz = document.getElementById('overlay-raiz') || document.body;
    const overlay = document.createElement('div');
    overlay.className = 'convite-ia-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', T.conviteIATitulo);
    overlay.innerHTML = `
      <div class="convite-ia-cartao">
        <p class="convite-ia-dupla">${iconeMini(itemA)} ${itemA?.nome ?? ''} + ${iconeMini(itemB)} ${itemB?.nome ?? ''}</p>
        <h2 class="convite-ia-titulo">${T.conviteIATitulo}</h2>
        <p class="convite-ia-texto">${T.conviteIATexto}</p>
        <p class="convite-ia-explicacao">${T.conviteIAExplicacao}</p>
        <div class="convite-ia-botoes">
          <button type="button" class="convite-ia-aceitar">${T.conviteIAAceitar}</button>
          <button type="button" class="convite-ia-recusar">${T.conviteIARecusar}</button>
        </div>
      </div>`;

    let resolvido = false;
    function concluir(valor) {
      if (resolvido) return;
      resolvido = true;
      document.removeEventListener('keydown', aoTeclar);
      overlay.remove();
      resolve(valor);
    }
    function aoTeclar(ev) {
      if (ev.key === 'Escape') concluir(false);
    }

    overlay.querySelector('.convite-ia-aceitar').addEventListener('click', () => concluir(true));
    overlay.querySelector('.convite-ia-recusar').addEventListener('click', () => concluir(false));
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) concluir(false); });
    document.addEventListener('keydown', aoTeclar);
    raiz.appendChild(overlay);
  });
}
