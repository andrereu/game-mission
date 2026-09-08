// Seletor de perfis: overlay em tela cheia com os cards das crianças e um
// formulário pra criar um novo. Só desenha e dispara os callbacks; quem
// persiste e recarrega o jogo é o app.js.
import { MODOS, MODO_PADRAO } from '../data/modos.js';
import { AVATARES, avatarPadrao, getAvatar } from '../data/avatares.js';
import { avatarSvgMarkup } from './avatarSvg.js';

export function montarSeletorPerfis({
  raiz, T, aoEscolher, aoCriar, aoApagar, aoEditar,
}) {
  const editar = aoEditar || (async () => {});
  let overlay = null;
  let avatarEscolhido = AVATARES[0].id;
  let modoEscolhido = MODO_PADRAO;

  // fileira de medalhões selecionáveis — reaproveitada na criação e na
  // edição. `aoTrocar(avatarId)` é chamado no clique; marca a opção ativa
  // visualmente. `comRotulo` liga o nome do tema abaixo de cada medalhão
  // (só cabe confortavelmente no formulário de criação; no card de edição,
  // mais estreito, os medalhões continuam só com aria-label).
  function fileiraAvatares(atual, aoTrocar, comRotulo = false) {
    const box = document.createElement('div');
    box.className = comRotulo ? 'perfil-avatares com-rotulo' : 'perfil-avatares';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', T.perfilEscolherCarinha);
    AVATARES.forEach((av, i) => {
      const rotuloTema = T.perfilAvatarTema?.[av.tema];
      const item = comRotulo ? document.createElement('div') : box;
      if (comRotulo) item.className = 'perfil-avatar-item';

      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'perfil-avatar-opcao';
      b.dataset.avatar = av.id;
      b.dataset.tema = av.tema;
      b.style.setProperty('--cor-avatar', av.cor);
      b.setAttribute('aria-label', rotuloTema || T.perfilCarinha(i + 1));
      b.innerHTML = avatarSvgMarkup(av.id);
      if (av.id === atual) b.classList.add('escolhida');
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        for (const outro of box.querySelectorAll('.perfil-avatar-opcao')) {
          outro.classList.toggle('escolhida', outro === b);
        }
        aoTrocar(av.id);
      });
      item.appendChild(b);

      if (comRotulo) {
        const rotulo = document.createElement('span');
        rotulo.className = 'perfil-avatar-rotulo';
        rotulo.textContent = rotuloTema || '';
        item.appendChild(rotulo);
        box.appendChild(item);
      }
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
      const avatarAtivo = getAvatar(p.avatarId || avatarPadrao(p.id));
      card.innerHTML = `
        <span class="perfil-avatar" data-tema="${avatarAtivo.tema}">${avatarSvgMarkup(avatarAtivo.id)}</span>
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
    overlay.className = 'perfis-overlay fundo-cosmico';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', T.perfilTitulo);
    overlay.innerHTML = `
      <div class="perfis-cartao">
        <img class="perfis-logo" src="assets/cartas/logo-completo.png" alt="Misturária" />
        <div class="perfis-cabecalho">
          <h2>${T.perfilTitulo}</h2>
          <button type="button" class="perfil-fechar" hidden>${T.fechar}</button>
        </div>
        <p class="perfis-subtitulo">${T.perfilSubtitulo}</p>
        <div class="perfis-grade"></div>
        <div class="perfil-novo">
          <form>
            <input type="text" maxlength="16" placeholder="${T.perfilNomePlaceholder}" aria-label="${T.perfilNome}" />
          </form>
        </div>
      </div>`;

    const form = overlay.querySelector('.perfil-novo form');

    avatarEscolhido = AVATARES[0].id;
    form.appendChild(fileiraAvatares(avatarEscolhido, (avatarId) => { avatarEscolhido = avatarId; }, true));

    modoEscolhido = MODO_PADRAO;
    form.appendChild(fileiraModos(modoEscolhido, (m) => { modoEscolhido = m; }));

    const btnCriar = document.createElement('button');
    btnCriar.type = 'submit';
    btnCriar.innerHTML = `<span>${T.perfilCriar}</span><span class="perfil-criar-seta" aria-hidden="true">→</span>`;
    form.appendChild(btnCriar);

    const rodape = document.createElement('p');
    rodape.className = 'perfis-rodape';
    rodape.textContent = T.perfilRodape;
    form.appendChild(rodape);

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
