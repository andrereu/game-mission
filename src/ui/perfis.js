// Seletor de perfis: overlay em tela cheia com os cards das crianças e um
// formulário pra criar um novo. Só desenha e dispara os callbacks; quem
// persiste e recarrega o jogo é o app.js.
import { MODOS, MODO_PADRAO } from '../data/modos.js';

const CORES = ['#4aa3ff', '#45c26b', '#ff8a5c', '#b57cff', '#ffd25c', '#ff5c8a'];

export function montarSeletorPerfis({
  raiz, T, aoEscolher, aoCriar, aoApagar, aoEditar,
}) {
  const editar = aoEditar || (async () => {});
  let overlay = null;
  let corEscolhida = CORES[0];
  let modoEscolhido = MODO_PADRAO;

  function fechar() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
  }

  function rotuloModo(m) {
    return { pequenos: T.modoPequenos, medio: T.modoMedio, completo: T.modoCompleto }[m] || m;
  }

  // fileira de 3 botões de modo; `aoTrocar(m)` é chamado no clique
  function fileiraModos(atual, aoTrocar) {
    const box = document.createElement('div');
    box.className = 'perfil-modos';
    for (const m of MODOS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'perfil-modo';
      b.dataset.modo = m;
      b.textContent = rotuloModo(m);
      if (m === atual) b.classList.add('escolhida');
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        for (const outro of box.children) outro.classList.toggle('escolhida', outro === b);
        aoTrocar(m);
      });
      box.appendChild(b);
    }
    return box;
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
        <span class="perfil-modo-tag"></span>
        <button type="button" class="perfil-editar" aria-label="${T.perfilEditar}">✎</button>
        <button type="button" class="perfil-apagar" aria-label="${T.perfilApagar}">×</button>`;
      card.querySelector('.perfil-nome').textContent = p.nome;
      card.querySelector('.perfil-modo-tag').textContent = rotuloModo(p.modo || MODO_PADRAO);

      card.addEventListener('click', (ev) => {
        if (ev.target.closest('.perfil-apagar')) return;
        if (ev.target.closest('.perfil-editar')) return;
        if (ev.target.closest('.perfil-modos')) return;
        aoEscolher(p.id);
      });
      card.querySelector('.perfil-apagar').addEventListener('click', async (ev) => {
        ev.stopPropagation();
        if (!window.confirm(T.perfilConfirmarApagar(p.nome))) return;
        const novo = await aoApagar(p.id);
        if (novo) render(novo);
      });
      card.querySelector('.perfil-editar').addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (card.querySelector('.perfil-modos')) return; // já aberto
        card.appendChild(fileiraModos(p.modo || MODO_PADRAO, async (m) => {
          const novo = await editar(p.id, { modo: m });
          if (novo) render(novo);
        }));
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
          </form>
        </div>
      </div>`;

    const form = overlay.querySelector('.perfil-novo form');

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
        for (const outro of cores.children) outro.classList.toggle('escolhida', outro === b);
      });
      cores.appendChild(b);
    }

    modoEscolhido = MODO_PADRAO;
    form.appendChild(fileiraModos(modoEscolhido, (m) => { modoEscolhido = m; }));

    const btnCriar = document.createElement('button');
    btnCriar.type = 'submit';
    btnCriar.textContent = T.perfilCriar;
    form.appendChild(btnCriar);

    overlay.querySelector('.perfil-fechar').addEventListener('click', fechar);
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const campo = overlay.querySelector('.perfil-novo input');
      const nome = campo.value.trim();
      if (!nome) return;
      campo.value = '';
      const novo = await aoCriar(nome, corEscolhida, modoEscolhido);
      if (novo) render(novo);
    });

    (raiz || document.body).appendChild(overlay);
    render(estado);
  }

  return { abrir, fechar, render };
}
