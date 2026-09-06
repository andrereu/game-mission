// Seletor de perfis: overlay em tela cheia com os cards das crianças e um
// formulário pra criar um novo. Só desenha e dispara os callbacks; quem
// persiste e recarrega o jogo é o app.js.

const CORES = ['#4aa3ff', '#45c26b', '#ff8a5c', '#b57cff', '#ffd25c', '#ff5c8a'];

export function montarSeletorPerfis({ raiz, T, aoEscolher, aoCriar, aoApagar }) {
  let overlay = null;
  let corEscolhida = CORES[0];

  function fechar() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
  }

  function render(estado) {
    if (!overlay) return;
    const grade = overlay.querySelector('.perfis-grade');
    grade.innerHTML = '';
    for (const p of estado.lista) {
      const card = document.createElement('div');
      card.className = 'perfil-card';
      card.dataset.id = p.id;
      if (estado.ativo === p.id) card.classList.add('ativo');
      card.innerHTML = `
        <span class="perfil-cor" style="background:${p.cor}"></span>
        <span class="perfil-nome"></span>
        <button type="button" class="perfil-apagar" aria-label="${T.perfilApagar}">×</button>`;
      card.querySelector('.perfil-nome').textContent = p.nome;
      card.addEventListener('click', (ev) => {
        if (ev.target.closest('.perfil-apagar')) return;
        aoEscolher(p.id);
      });
      card.querySelector('.perfil-apagar').addEventListener('click', async (ev) => {
        ev.stopPropagation();
        if (!window.confirm(T.perfilConfirmarApagar(p.nome))) return;
        const novo = await aoApagar(p.id);
        if (novo) render(novo);
      });
      grade.appendChild(card);
    }

    const fecharBtn = overlay.querySelector('.perfil-fechar');
    fecharBtn.hidden = !estado.ativo;
  }

  function abrir(estado) {
    fechar();
    overlay = document.createElement('div');
    overlay.className = 'perfis-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', T.perfilTitulo);
    overlay.innerHTML = `
      <div class="perfis-cartao">
        <div class="perfis-cabecalho">
          <h2>${T.perfilTitulo}</h2>
          <button type="button" class="perfil-fechar" hidden>${T.fechar}</button>
        </div>
        <div class="perfis-grade"></div>
        <div class="perfil-novo">
          <form>
            <input type="text" maxlength="16" placeholder="${T.perfilNome}" aria-label="${T.perfilNome}" />
            <div class="perfil-cores"></div>
            <button type="submit">${T.perfilCriar}</button>
          </form>
        </div>
      </div>`;

    const cores = overlay.querySelector('.perfil-cores');
    corEscolhida = CORES[0];
    for (const c of CORES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'perfil-swatch';
      b.style.background = c;
      b.dataset.cor = c;
      if (c === corEscolhida) b.classList.add('escolhida');
      b.addEventListener('click', () => {
        corEscolhida = c;
        for (const outro of cores.children) {
          outro.classList.toggle('escolhida', outro === b);
        }
      });
      cores.appendChild(b);
    }

    overlay.querySelector('.perfil-fechar').addEventListener('click', fechar);
    overlay.querySelector('.perfil-novo form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const campo = overlay.querySelector('.perfil-novo input');
      const nome = campo.value.trim();
      if (!nome) return;
      campo.value = '';
      const novo = await aoCriar(nome, corEscolhida);
      if (novo) render(novo);
    });

    (raiz || document.body).appendChild(overlay);
    render(estado);
  }

  return { abrir, fechar, render };
}
