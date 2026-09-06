// Painel de Ajustes: som, IA e sincronização entre aparelhos.
// Só lê/escreve via callbacks; quem persiste é o app.
const CONFIG_LINHA = {
  som: { icone: '🔊' },
  iaLigada: { icone: '✨' },
};

export function montarAjustes({ raiz, T, get, set, sync }) {
  let overlay = null;
  let aoTelaCheiaMudar = null;

  function fechar() {
    if (!overlay) return;
    document.removeEventListener('keydown', aoTeclar);
    if (aoTelaCheiaMudar) {
      document.removeEventListener('fullscreenchange', aoTelaCheiaMudar);
      aoTelaCheiaMudar = null;
    }
    overlay.remove();
    overlay = null;
  }

  function aoTeclar(ev) {
    if (ev.key === 'Escape') fechar();
  }

  // Não é uma preferência persistida (não passa por get/set): só reflete o
  // estado real da Fullscreen API, ativado por um toque/clique da pessoa —
  // nunca sozinho ao abrir os Ajustes. Some da lista quando a API não existe.
  function linhaTelaCheia() {
    if (!document.fullscreenEnabled) return null;
    const l = document.createElement('div');
    l.className = 'ajuste-linha';
    l.innerHTML = `
      <span class="ajuste-icone">⛶</span>
      <div class="ajuste-texto">
        <span class="ajuste-titulo"></span>
        <span class="ajuste-desc"></span>
      </div>
      <label class="ajuste-switch">
        <input type="checkbox" data-chave="telaCheia" />
        <span class="ajuste-switch-trilho" aria-hidden="true"></span>
      </label>`;
    l.querySelector('.ajuste-titulo').textContent = T.ajusteTelaCheia;
    l.querySelector('.ajuste-desc').textContent = T.ajusteTelaCheiaDesc;
    const inp = l.querySelector('input');
    aoTelaCheiaMudar = () => { inp.checked = Boolean(document.fullscreenElement); };
    aoTelaCheiaMudar();
    document.addEventListener('fullscreenchange', aoTelaCheiaMudar);
    inp.addEventListener('change', () => {
      try {
        if (inp.checked) {
          Promise.resolve(document.documentElement.requestFullscreen())
            .catch(() => { inp.checked = false; });
        } else {
          Promise.resolve(document.exitFullscreen()).catch(() => {});
        }
      } catch {
        inp.checked = Boolean(document.fullscreenElement);
      }
    });
    return l;
  }

  function linha(chave, rotulo, descricao) {
    const cfg = CONFIG_LINHA[chave] || {};
    const l = document.createElement('div');
    l.className = 'ajuste-linha';
    l.innerHTML = `
      <span class="ajuste-icone">${cfg.icone || '⚙️'}</span>
      <div class="ajuste-texto">
        <span class="ajuste-titulo"></span>
        <span class="ajuste-desc"></span>
      </div>
      <label class="ajuste-switch">
        <input type="checkbox" />
        <span class="ajuste-switch-trilho" aria-hidden="true"></span>
      </label>`;
    l.querySelector('.ajuste-titulo').textContent = rotulo;
    l.querySelector('.ajuste-desc').textContent = descricao;
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
        <div class="ajustes-secao-cabecalho">
          <span class="ajuste-icone">🔗</span>
          <h3>${T.syncTitulo}</h3>
        </div>
        <p class="ajustes-secao-texto">${T.syncCodigo}: <strong class="sync-valor"></strong></p>
        <small class="ajustes-secao-dica">${T.syncDica}</small>
        <div class="sync-acoes">
          <button type="button" class="botao-cosmico sync-agora">${T.syncAgora}</button>
          <button type="button" class="botao-cosmico botao-cosmico-fantasma sync-desativar">${T.syncDesativar}</button>
        </div>`;
      box.querySelector('.sync-valor').textContent = estado.codigo;
      box.querySelector('.sync-agora').addEventListener('click', () => sync.agora());
      box.querySelector('.sync-desativar').addEventListener('click', async () => {
        renderSync(await sync.desativar());
      });
    } else {
      box.innerHTML = `
        <div class="ajustes-secao-cabecalho">
          <span class="ajuste-icone">🔗</span>
          <h3>${T.syncTitulo}</h3>
        </div>
        <p class="ajustes-secao-texto">${T.syncExplicacao}</p>
        <button type="button" class="botao-cosmico sync-ativar">${T.syncAtivar}</button>
        <div class="sync-entrar">
          <input type="text" class="sync-codigo" placeholder="${T.syncDigite}" />
          <button type="button" class="botao-cosmico botao-cosmico-fantasma sync-usar">${T.syncUsar}</button>
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
        <button type="button" class="ajustes-fechar" aria-label="${T.fechar}">✕</button>
        <div class="ajustes-decor" aria-hidden="true"></div>
        <div class="ajustes-cabecalho">
          <img class="ajustes-mascote" src="assets/cartas/mascote-busto.png" alt="" />
          <h2>${T.ajustesTitulo}</h2>
          <p class="ajustes-subtitulo">${T.ajustesSubtitulo}</p>
          <p class="ajustes-balao">${T.ajustesBalao}</p>
        </div>
        <div class="ajustes-corpo">
          <div class="ajustes-lista"></div>
          ${sync ? '<div class="ajustes-sync ajustes-secao"></div>' : ''}
        </div>
        <p class="ajustes-rodape">${T.ajustesRodape}</p>
      </div>`;
    const lista = overlay.querySelector('.ajustes-lista');
    lista.appendChild(linha('som', T.ajusteSom, T.ajusteSomDesc));
    lista.appendChild(linha('iaLigada', T.ajusteIA, T.ajusteIADesc));
    const linhaFS = linhaTelaCheia();
    if (linhaFS) lista.appendChild(linhaFS);
    overlay.querySelector('.ajustes-fechar').addEventListener('click', fechar);
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) fechar(); });
    document.addEventListener('keydown', aoTeclar);
    (raiz || document.body).appendChild(overlay);

    if (sync) {
      Promise.resolve(sync.carregar()).then((estado) => {
        if (overlay) renderSync(estado);
      });
    }
  }

  return { abrir, fechar };
}
