// Painelzinho de ajustes: liga/desliga o som e a IA (sugerir combinações novas).
// Só lê e escreve via get/set; quem persiste é o store do app.

export function montarAjustes({ raiz, T, get, set }) {
  let overlay = null;

  function fechar() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
  }

  function linha(chave, rotulo) {
    const l = document.createElement('label');
    l.className = 'ajuste-linha';
    l.innerHTML = `<span></span><input type="checkbox" data-chave="${chave}" />`;
    l.querySelector('span').textContent = rotulo;
    const inp = l.querySelector('input');
    inp.checked = Boolean(get(chave));
    inp.addEventListener('change', () => set(chave, inp.checked));
    return l;
  }

  function abrir() {
    fechar();
    overlay = document.createElement('div');
    overlay.className = 'ajustes-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', T.ajustesTitulo);
    overlay.innerHTML = `
      <div class="ajustes-cartao">
        <div class="ajustes-cabecalho">
          <h2>${T.ajustesTitulo}</h2>
          <button type="button" class="ajustes-fechar">${T.fechar}</button>
        </div>
        <div class="ajustes-lista"></div>
      </div>`;
    const lista = overlay.querySelector('.ajustes-lista');
    lista.appendChild(linha('som', T.ajusteSom));
    lista.appendChild(linha('iaLigada', T.ajusteIA));
    overlay.querySelector('.ajustes-fechar').addEventListener('click', fechar);
    (raiz || document.body).appendChild(overlay);
  }

  return { abrir, fechar };
}
