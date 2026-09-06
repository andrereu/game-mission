// Painelzinho de ajustes: som, IA e sincronização entre aparelhos.
// Só lê/escreve via callbacks; quem persiste é o app.

export function montarAjustes({ raiz, T, get, set, sync }) {
  let overlay = null;

  function fechar() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
  }

  function linha(chave, rotulo) {
    const l = document.createElement('label');
    l.className = 'ajuste-linha';
    l.innerHTML = '<span></span><input type="checkbox" />';
    l.querySelector('span').textContent = rotulo;
    const inp = l.querySelector('input');
    inp.dataset.chave = chave;
    inp.checked = Boolean(get(chave));
    inp.addEventListener('change', () => set(chave, inp.checked));
    return l;
  }

  function renderSync(estado) {
    const box = overlay.querySelector('.ajustes-sync');
    if (!box) return;
    if (estado && estado.codigo) {
      box.innerHTML = `
        <h3>${T.syncTitulo}</h3>
        <p>${T.syncCodigo}: <strong class="sync-valor"></strong></p>
        <small>${T.syncDica}</small>
        <div class="sync-acoes">
          <button type="button" class="sync-agora">${T.syncAgora}</button>
          <button type="button" class="sync-desativar">${T.syncDesativar}</button>
        </div>`;
      box.querySelector('.sync-valor').textContent = estado.codigo;
      box.querySelector('.sync-agora').addEventListener('click', () => sync.agora());
      box.querySelector('.sync-desativar').addEventListener('click', async () => {
        renderSync(await sync.desativar());
      });
    } else {
      box.innerHTML = `
        <h3>${T.syncTitulo}</h3>
        <button type="button" class="sync-ativar">${T.syncAtivar}</button>
        <div class="sync-entrar">
          <input type="text" class="sync-codigo" placeholder="${T.syncDigite}" />
          <button type="button" class="sync-usar">${T.syncUsar}</button>
        </div>`;
      box.querySelector('.sync-ativar').addEventListener('click', async () => {
        renderSync(await sync.ativar());
      });
      box.querySelector('.sync-usar').addEventListener('click', async () => {
        const v = box.querySelector('.sync-codigo').value.trim();
        if (v) await sync.usar(v);
      });
    }
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
        ${sync ? '<div class="ajustes-sync"></div>' : ''}
      </div>`;
    const lista = overlay.querySelector('.ajustes-lista');
    lista.appendChild(linha('som', T.ajusteSom));
    lista.appendChild(linha('iaLigada', T.ajusteIA));
    overlay.querySelector('.ajustes-fechar').addEventListener('click', fechar);
    (raiz || document.body).appendChild(overlay);

    if (sync) {
      Promise.resolve(sync.carregar()).then((estado) => {
        if (overlay) renderSync(estado);
      });
    }
  }

  return { abrir, fechar };
}
