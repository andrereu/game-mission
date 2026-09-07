// Seletor de perfis: overlay em tela cheia com os cards das crianças e um
// formulário pra criar um novo. Só desenha e dispara os callbacks; quem
// persiste e recarrega o jogo é o app.js.
import { MODOS, MODO_PADRAO } from '../data/modos.js';
import { AVATARES, avatarPadrao } from '../data/avatares.js';
import { avatarSvgMarkup } from './avatarSvg.js';

export function montarSeletorPerfis({
  raiz, T, aoEscolher, aoCriar, aoApagar, aoEditar,
}) {
  const editar = aoEditar || (async () => {});
  let overlay = null;
  let avatarEscolhido = AVATARES[0].id;
  let modoEscolhido = MODO_PADRAO;

  // fileira de carinhas selecionáveis — reaproveitada na criação e na edição.
  // `aoTrocar(avatarId)` é chamado no clique; marca a opção ativa visualmente.
  function fileiraAvatares(atual, aoTrocar) {
    const box = document.createElement('div');
    box.className = 'perfil-avatares';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', T.perfilEscolherCarinha);
    AVATARES.forEach((av, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'perfil-avatar-opcao';
      b.dataset.avatar = av.id;
      b.setAttribute('aria-label', T.perfilCarinha(i + 1));
      b.innerHTML = avatarSvgMarkup(av.id);
      if (av.id === atual) b.classList.add('escolhida');
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        for (const outro of box.children) outro.classList.toggle('escolhida', outro === b);
        aoTrocar(av.id);
      });
      box.appendChild(b);
    });
    return box;
  }

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
        <span class="perfil-avatar">${avatarSvgMarkup(p.avatarId || avatarPadrao(p.id))}</span>
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
        card.appendChild(fileiraAvatares(p.avatarId || avatarPadrao(p.id), async (avatarId) => {
          const av = AVATARES.find((a) => a.id === avatarId);
          const novo = await editar(p.id, { avatarId, cor: av?.cor });
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
        <img class="perfis-logo" src="assets/cartas/logo-completo.png" alt="Misturária" />
        <div class="perfis-cabecalho">
          <h2>${T.perfilTitulo}</h2>
          <button type="button" class="perfil-fechar" hidden>${T.fechar}</button>
        </div>
        <div class="perfis-grade"></div>
        <div class="perfil-novo">
          <form>
            <input type="text" maxlength="16" placeholder="${T.perfilNome}" aria-label="${T.perfilNome}" />
          </form>
        </div>
      </div>`;

    const form = overlay.querySelector('.perfil-novo form');

    avatarEscolhido = AVATARES[0].id;
    form.appendChild(fileiraAvatares(avatarEscolhido, (avatarId) => { avatarEscolhido = avatarId; }));

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
      const avatar = AVATARES.find((a) => a.id === avatarEscolhido) || AVATARES[0];
      const novo = await aoCriar(nome, avatar.cor, modoEscolhido, avatar.id);
      if (novo) render(novo);
    });

    (raiz || document.body).appendChild(overlay);
    render(estado);
  }

  return { abrir, fechar, render };
}
