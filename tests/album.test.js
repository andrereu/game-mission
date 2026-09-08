import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { criarCatalogo, ERAS } from '../src/engine/catalogo.js';
import { criarStore } from '../src/engine/state.js';
import { montarAlbum } from '../src/ui/album.js';
import { criarElementoCarta, criarFigurinhaCompacta, calcularDadosCarta } from '../src/ui/carta.js';
import { T } from '../src/data/textos.js';

function raizLimpa() {
  document.body.innerHTML = '<div id="eras-raiz"></div>';
  return document.getElementById('eras-raiz');
}

function ambiente(descobertos = {}) {
  const cat = criarCatalogo();
  const store = criarStore({
    versao: 1,
    descobertos,
    canvas: [],
    ajustes: { som: false, iaLigada: false },
  });
  return { cat, store, raiz: raizLimpa() };
}

function abrirMiolo(album, raiz) {
  album.abrir();
  raiz.querySelector('.album-capa-botao').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

// força desktop/mobile trocando window.matchMedia antes de montar o álbum
function comViewport(matches, fn) {
  const antes = window.matchMedia;
  window.matchMedia = (query) => ({
    matches, media: query, addEventListener() {}, removeEventListener() {},
  });
  try {
    fn();
  } finally {
    window.matchMedia = antes;
  }
}

const TOTAL_ERA = Object.fromEntries(ERAS.map((era) => [
  era, criarCatalogo().allItems().filter((it) => it.era === era && !it.ia).length,
]));

test('1. capa aparece antes do miolo, sem overlay temático carregado', () => {
  const { cat, store, raiz } = ambiente();
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  album.abrir();
  assert.ok(raiz.querySelector('.album-capa-imagem'), 'capa visível');
  assert.equal(raiz.querySelector('.album-miolo'), null, 'miolo ainda não existe');
  assert.equal(raiz.querySelector('.album-pagina-overlay'), null, 'nenhum overlay de era carregado ainda');
});

test('2. tocar na capa abre o livro (miolo)', () => {
  const { cat, store, raiz } = ambiente();
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  abrirMiolo(album, raiz);
  assert.ok(raiz.querySelector('.album-miolo'), 'miolo aparece');
  assert.equal(raiz.querySelector('.album-capa-imagem'), null, 'capa some');
});

test('3. desktop usa o overlay V2 de dupla página da era; troca de era só troca o overlay/grade', () => {
  const { cat, store, raiz } = ambiente();
  comViewport(true, () => {
    const album = montarAlbum({ raiz, store, catalogo: cat, T });
    abrirMiolo(album, raiz);
    assert.match(raiz.querySelector('.album-pagina-base').src, /assets\/album\/base-desktop\.png$/);
    assert.match(
      raiz.querySelector('.album-pagina-overlay').src,
      /assets\/album\/v2\/elementos-desktop-overlay-3344x1882\.png$/,
    );
    raiz.querySelector('.album-tab[data-era="natureza"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert.match(
      raiz.querySelector('.album-pagina-overlay').src,
      /assets\/album\/v2\/natureza-desktop-overlay-3344x1882\.png$/,
    );
  });
});

test('4. desktop: uma única grade 3x3 de nove células por tela, e nenhuma grade na página esquerda', () => {
  const { cat, store, raiz } = ambiente();
  comViewport(true, () => {
    const album = montarAlbum({ raiz, store, catalogo: cat, T });
    abrirMiolo(album, raiz);
    const grades = raiz.querySelectorAll('.album-grade');
    assert.equal(grades.length, 1, 'exatamente uma grade');
    assert.equal(grades[0].children.length, 9, 'capacidade fixa de nove');
    // a grade fica na área da direita (left >= 50% do canvas)
    const area = raiz.querySelector('.album-grade-area');
    assert.ok(parseFloat(area.style.left) >= 50, 'grade ancorada na metade direita');
  });
});

test('5. mobile: primeira tela é a abertura (sem grade e sem figurinhas); as seguintes têm a folha + grade', () => {
  const { cat, store, raiz } = ambiente({ agua: { em: 1, via: null, fonte: 'base' } });
  comViewport(false, () => {
    const album = montarAlbum({ raiz, store, catalogo: cat, T });
    abrirMiolo(album, raiz);
    assert.match(
      raiz.querySelector('.album-pagina-overlay').src,
      /elementos-mobile-abertura-2048x3072\.png$/,
    );
    assert.equal(raiz.querySelector('.album-grade'), null, 'abertura não tem grade');
    assert.equal(raiz.querySelector('.figurinha-mini'), null, 'abertura não tem figurinha');

    raiz.querySelector('.album-nav-proxima').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert.match(
      raiz.querySelector('.album-pagina-overlay').src,
      /elementos-mobile-folha-2048x3072\.png$/,
    );
    assert.equal(raiz.querySelectorAll('.album-grade > *').length, 9, 'folha tem grade 3x3');
  });
});

test('6. total de telas segue a fórmula da spec (desktop ceil/9; mobile 1 + ceil/9)', () => {
  const { cat, store, raiz } = ambiente();
  const gradesVida = Math.max(1, Math.ceil(TOTAL_ERA.vida / 9));

  comViewport(true, () => {
    const album = montarAlbum({ raiz, store, catalogo: cat, T });
    abrirMiolo(album, raiz);
    raiz.querySelector('.album-tab[data-era="vida"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert.equal(raiz.querySelector('.album-rodape').textContent, T.albumPaginaDe(1, gradesVida));
    album.fechar();
  });

  comViewport(false, () => {
    const album = montarAlbum({ raiz, store, catalogo: cat, T });
    abrirMiolo(album, raiz);
    raiz.querySelector('.album-tab[data-era="vida"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert.equal(raiz.querySelector('.album-rodape').textContent, T.albumPaginaDe(1, 1 + gradesVida));
  });
});

test('7. preenchimento determinístico: bloco de nove em ordem de leitura, posição estável dos canônicos', () => {
  const ordenados = criarCatalogo().allItems()
    .filter((it) => it.era === 'elementos' && !it.ia)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const primeiros9 = ordenados.slice(0, 9).map((it) => it.id);
  const descobertos = Object.fromEntries(primeiros9.map((id, i) => [id, { em: i + 1, via: null, fonte: 'base' }]));

  const { cat, store, raiz } = ambiente(descobertos);
  comViewport(true, () => {
    const album = montarAlbum({ raiz, store, catalogo: cat, T });
    abrirMiolo(album, raiz);
    const celulas = [...raiz.querySelectorAll('.album-grade > *')];
    assert.equal(celulas.length, 9);
    celulas.forEach((cel, i) => {
      assert.ok(cel.classList.contains('figurinha-mini'), `posição ${i} preenchida`);
      assert.equal(cel.dataset.id, primeiros9[i], `posição ${i} estável`);
    });
  });
});

test('8. itens canônicos não descobertos viram slots tracejados sem nenhum dado no DOM', () => {
  const { cat, store, raiz } = ambiente({ agua: { em: 1, via: null, fonte: 'base' } });
  comViewport(true, () => {
    const album = montarAlbum({ raiz, store, catalogo: cat, T });
    abrirMiolo(album, raiz);
    const vazios = raiz.querySelectorAll('.album-slot-vazio');
    assert.ok(vazios.length > 0);
    for (const el of vazios) {
      assert.equal(el.dataset.id, undefined, 'nenhum id vazado');
      assert.equal(el.getAttribute('aria-hidden'), 'true');
      assert.equal(el.textContent.trim(), '?');
      assert.equal(el.querySelectorAll('img').length, 0, 'sem imagem');
    }
    // nenhum nome de item oculto aparece no texto da grade
    const nomesOcultos = cat.allItems()
      .filter((it) => it.era === 'elementos' && !it.ia && it.id !== 'agua')
      .map((it) => it.nome);
    const textoGrade = raiz.querySelector('.album-grade').textContent;
    for (const nome of nomesOcultos) {
      assert.equal(textoGrade.includes(nome), false, `"${nome}" não vaza no DOM`);
    }
  });
});

test('9. slots vazios nunca são círculos/ovais', () => {
  const { cat, store, raiz } = ambiente({ agua: { em: 1, via: null, fonte: 'base' } });
  comViewport(true, () => {
    const album = montarAlbum({ raiz, store, catalogo: cat, T });
    abrirMiolo(album, raiz);
    const el = raiz.querySelector('.album-slot-vazio');
    const estilo = window.getComputedStyle(el);
    assert.notEqual(estilo.borderRadius, '50%');
  });
});

test('10. clicar numa mini-figurinha abre a carta grande já existente, sem alterá-la', () => {
  const { cat, store, raiz } = ambiente({ agua: { em: 1, via: null, fonte: 'base' } });
  comViewport(true, () => {
    const album = montarAlbum({ raiz, store, catalogo: cat, T });
    abrirMiolo(album, raiz);
    raiz.querySelector('.figurinha-mini[data-id="agua"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    const carta = raiz.querySelector('.carta-overlay .carta');
    assert.ok(carta, 'carta grande abre');
    assert.match(carta.textContent, /Sobre/);
    assert.match(carta.textContent, /Água/);
    assert.ok(carta.querySelector('.carta-btn-exportar'), 'botão Salvar imagem preservado');
    assert.ok(carta.querySelector('.carta-btn-fechar'), 'botão Fechar preservado');
  });
});

test('11. contrato da mini-figurinha: logo, selo visível de raridade, medalhão, nome e era; sem blocos/controles da carta', () => {
  const { cat, store } = ambiente({ agua: { em: 1, via: null, fonte: 'base' } });
  raizLimpa();
  const dados = calcularDadosCarta('agua', { store, catalogo: cat });
  const mini = criarFigurinhaCompacta(dados, { T });

  assert.equal(mini.tagName, 'BUTTON');
  assert.ok(mini.querySelector('.figurinha-mini-logo'), 'wordmark Misturária');
  assert.equal(mini.querySelector('.figurinha-mini-logo').getAttribute('alt'), 'Misturária');
  const selo = mini.querySelector('.figurinha-mini-selo');
  assert.ok(['COMUM', 'RARO', 'ÉPICO', 'LENDÁRIO'].includes(selo.textContent.trim()), 'selo em caixa alta');
  assert.ok(mini.querySelector('.orbe-figurinha-mini'), 'medalhão circular com ícone real');
  assert.ok(mini.querySelector('.figurinha-mini-nome'), 'nome do item');
  assert.equal(mini.querySelector('.figurinha-mini-era').textContent.trim(), 'ELEMENTOS', 'era em caixa alta no rodapé');
  assert.match(mini.getAttribute('aria-label'), /Água/);

  // nada da carta completa
  for (const proibido of ['carta-bloco', 'carta-rodape', 'carta-btn-exportar', 'carta-btn-fechar', 'carta-mascote']) {
    assert.equal(mini.querySelector(`.${proibido}`), null, `mini não tem .${proibido}`);
  }
  assert.equal(mini.textContent.includes('Sobre'), false);
  assert.equal(mini.textContent.includes('Vim disso'), false);
});

test('12. a carta grande (criarElementoCarta) não foi alterada — markup e controles', () => {
  const { cat, store } = ambiente({ agua: { em: 1, via: null, fonte: 'base' } });
  const dados = calcularDadosCarta('agua', { store, catalogo: cat });
  const carta = criarElementoCarta(dados, { T, comRodape: true });
  assert.ok(carta.classList.contains('carta'));
  assert.ok(carta.querySelector('.selo-raridade'));
  assert.ok(carta.querySelector('.carta-logo'));
  assert.ok(carta.querySelector('.orbe-carta'));
  assert.ok(carta.querySelector('.carta-nome'));
  assert.ok(carta.querySelector('.carta-era'));
  assert.match(carta.textContent, /Sobre/);
  assert.ok(carta.querySelector('.carta-btn-exportar'));
  assert.ok(carta.querySelector('.carta-btn-fechar'));
  assert.ok(carta.querySelector('.carta-mascote'));
});

test('13. tabs físicas do livro: seis áreas clicáveis, uma por era, na ordem de ERAS; sem fileira de emojis', () => {
  const { cat, store, raiz } = ambiente();
  comViewport(true, () => {
    const album = montarAlbum({ raiz, store, catalogo: cat, T });
    abrirMiolo(album, raiz);
    assert.equal(raiz.querySelector('.album-atalhos'), null, 'sem fileira genérica de emojis');
    const tabs = [...raiz.querySelectorAll('.album-tab:not(.album-tab-ia)')];
    assert.equal(tabs.length, 6);
    tabs.forEach((tab, i) => {
      assert.equal(tab.dataset.era, ERAS[i]);
      assert.equal(tab.getAttribute('aria-label'), T.eras[ERAS[i]]);
    });
    assert.equal(raiz.querySelector('.album-tab[aria-current="true"]').dataset.era, 'elementos');
  });
});

test('14. IA: sem tab física própria enquanto não há criação descoberta', () => {
  const { cat, store, raiz } = ambiente({ agua: { em: 1, via: null, fonte: 'base' } });
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  abrirMiolo(album, raiz);
  assert.equal(raiz.querySelector('.album-tab-ia'), null);
  assert.equal(raiz.querySelector('.album-tab[data-era="ia"]'), null);
});

test('15. IA: botão próprio aparece só depois da 1ª criação, e mostra só descobertos em ordem de criação, sem slots futuros', () => {
  const { cat, store, raiz } = ambiente({ agua: { em: 1, via: null, fonte: 'base' } });
  const a = cat.registrarItemIA({ nome: 'Nuvem Cósmica', emoji: '✨', era: 'natureza' });
  cat.registrarItemIA({ nome: 'Robô Poeta', emoji: '🤖', era: 'tecnologia' }); // registrada, não descoberta
  store.getSave().descobertos[a.id] = { em: 2, via: ['agua'], fonte: 'ia' };

  comViewport(true, () => {
    const album = montarAlbum({ raiz, store, catalogo: cat, T });
    abrirMiolo(album, raiz);
    const btnIA = raiz.querySelector('.album-tab-ia');
    assert.ok(btnIA, 'botão IA aparece');
    btnIA.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert.equal(raiz.querySelectorAll('.figurinha-mini').length, 1);
    assert.equal(raiz.querySelectorAll('.album-slot-vazio').length, 0, 'IA não ganha slot futuro');
    assert.ok(raiz.querySelector('.figurinha-mini[data-id="nuvem-cosmica"]'));
  });
});

test('16. IA fica fora do denominador canônico exibido', () => {
  const { cat, store, raiz } = ambiente({ agua: { em: 1, via: null, fonte: 'base' } });
  const item = cat.registrarItemIA({ nome: 'Nuvem Cósmica', emoji: '✨', era: 'natureza' });
  store.getSave().descobertos[item.id] = { em: 2, via: ['agua'], fonte: 'ia' };
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  abrirMiolo(album, raiz);
  assert.match(raiz.querySelector('.album-cabecalho-contagem').textContent, /1 \/ 283 do mapa · 1 inventada/);
});

test('17. progresso canônico exibido não muda ao navegar pelo Álbum', () => {
  const { cat, store, raiz } = ambiente({ agua: { em: 1, via: null, fonte: 'base' } });
  comViewport(true, () => {
    const album = montarAlbum({ raiz, store, catalogo: cat, T });
    abrirMiolo(album, raiz);
    const antes = raiz.querySelector('.album-cabecalho-contagem').textContent;
    raiz.querySelector('.album-tab[data-era="ficcao"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    raiz.querySelector('.album-nav-proxima').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert.equal(raiz.querySelector('.album-cabecalho-contagem').textContent, antes);
    assert.match(antes, /1 \/ 283 do mapa/);
  });
});

test('18. era 100% descoberta ganha o selo de completa', () => {
  const cat = criarCatalogo();
  const descobertos = {};
  let t = 0;
  for (const it of cat.allItems().filter((i) => i.era === 'elementos' && !i.ia)) {
    t += 1;
    descobertos[it.id] = { em: t, via: null, fonte: 'base' };
  }
  const store = criarStore({ versao: 1, descobertos, canvas: [], ajustes: {} });
  const raiz = raizLimpa();
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  abrirMiolo(album, raiz);
  assert.ok(raiz.querySelector('.album-selo'));
  assert.equal(raiz.querySelector('.album-colecao-contagem').textContent, `${t} / ${t}`);
});

test('19. figurinha "além do mapa" preserva a identidade platina', () => {
  const cat = criarCatalogo();
  const alem = cat.allItems().find((it) => cat.ehAlemDoMapa(it.id));
  assert.ok(alem);
  const store = criarStore({
    versao: 1,
    descobertos: { [alem.id]: { em: 1, via: null, fonte: 'base' } },
    canvas: [],
    ajustes: {},
  });
  const raiz = raizLimpa();
  comViewport(true, () => {
    const album = montarAlbum({ raiz, store, catalogo: cat, T });
    abrirMiolo(album, raiz);
    raiz.querySelector(`.album-tab[data-era="${alem.era}"]`).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    // pagina dentro da era até a folha que contém o item
    let el = raiz.querySelector(`.figurinha-mini[data-id="${alem.id}"]`);
    for (let i = 0; i < 40 && !el; i += 1) {
      raiz.querySelector('.album-nav-proxima').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      if (raiz.querySelector('.album-tab[aria-current="true"]').dataset.era !== alem.era) break;
      el = raiz.querySelector(`.figurinha-mini[data-id="${alem.id}"]`);
    }
    assert.ok(el, 'figurinha aparece');
    assert.equal(el.querySelector('.orbe').getAttribute('data-alem'), 'mapa');
  });
});

test('20. navegar e ver cartas nunca grava no save', () => {
  const { cat, store, raiz } = ambiente({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 2, via: null, fonte: 'base' },
  });
  const antes = JSON.parse(JSON.stringify(store.getSave()));
  comViewport(true, () => {
    const album = montarAlbum({ raiz, store, catalogo: cat, T });
    abrirMiolo(album, raiz);
    raiz.querySelector('.album-tab[data-era="vida"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    raiz.querySelector('.figurinha-mini[data-id="agua"]')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    album.fechar();
  });
  assert.deepEqual(store.getSave(), antes);
});

test('21. Escape fecha o Álbum', () => {
  const { cat, store, raiz } = ambiente();
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  abrirMiolo(album, raiz);
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(raiz.querySelector('.album-overlay'), null);
});

test('22. botão Fechar da capa e do miolo removem o overlay', () => {
  const { cat, store, raiz } = ambiente();
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  album.abrir();
  raiz.querySelector('.album-capa-fechar').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(raiz.querySelector('.album-overlay'), null);
  abrirMiolo(album, raiz);
  raiz.querySelector('.album-fechar').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(raiz.querySelector('.album-overlay'), null);
});

test('23. reabrir o Álbum volta pela capa, sem persistir posição interna', () => {
  const { cat, store, raiz } = ambiente();
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  abrirMiolo(album, raiz);
  raiz.querySelector('.album-tab[data-era="vida"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  album.fechar();
  album.abrir();
  assert.ok(raiz.querySelector('.album-capa-imagem'));
});

test('24. próxima tela avança de era quando a coleção atual acaba (desktop)', () => {
  const { cat, store, raiz } = ambiente();
  comViewport(true, () => {
    const album = montarAlbum({ raiz, store, catalogo: cat, T });
    abrirMiolo(album, raiz);
    const telasElementos = Math.max(1, Math.ceil(TOTAL_ERA.elementos / 9));
    for (let i = 0; i < telasElementos; i += 1) {
      raiz.querySelector('.album-nav-proxima').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    }
    assert.equal(raiz.querySelector('.album-tab[aria-current="true"]').dataset.era, 'natureza');
  });
});

test('25. página anterior volta pra era anterior, na última tela dela (desktop)', () => {
  const { cat, store, raiz } = ambiente();
  comViewport(true, () => {
    const album = montarAlbum({ raiz, store, catalogo: cat, T });
    abrirMiolo(album, raiz);
    raiz.querySelector('.album-tab[data-era="natureza"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    raiz.querySelector('.album-nav-anterior').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert.equal(raiz.querySelector('.album-tab[aria-current="true"]').dataset.era, 'elementos');
  });
});

test('26. todos os overlays V2 + base + capa existem no repositório', () => {
  const base = fileURLToPath(new URL('../assets/album/', import.meta.url));
  const v2 = `${base}v2/`;
  const soltos = ['capa.png', 'fundo-cosmico.png', 'base-desktop.png', 'base-mobile.png'];
  for (const arquivo of soltos) assert.ok(existsSync(base + arquivo), `${arquivo} deve existir`);
  const colecoes = [...ERAS, 'ia'];
  for (const c of colecoes) {
    for (const suf of ['desktop-overlay-3344x1882', 'mobile-abertura-2048x3072', 'mobile-folha-2048x3072']) {
      assert.ok(existsSync(`${v2}${c}-${suf}.png`), `v2/${c}-${suf}.png deve existir`);
    }
  }
});

test('28. abertura sem flash: conteúdo fica hidden até decode + rAF; nada da versão antiga aparece', async () => {
  // jsdom não expõe Image global nem decode(); simulamos o navegador real.
  const tinhaImage = 'Image' in globalThis;
  if (!tinhaImage) globalThis.Image = window.Image;
  const proto = globalThis.Image.prototype;
  const orig = Object.getOwnPropertyDescriptor(proto, 'decode');
  const resolvers = [];
  const liberar = () => resolvers.splice(0).forEach((r) => r());
  proto.decode = function decode() { return new Promise((res) => { resolvers.push(res); }); };
  try {
    const { cat, store, raiz } = ambiente();
    const album = montarAlbum({ raiz, store, catalogo: cat, T });
    album.abrir();

    const conteudo = raiz.querySelector('.album-conteudo');
    assert.ok(conteudo, 'wrapper .album-conteudo existe');
    assert.equal(conteudo.hidden, true, 'conteúdo escondido durante a init');
    assert.ok(raiz.querySelector('.album-loader'), 'loading neutro visível');
    assert.ok(raiz.querySelector('.album-capa-fundo'), 'só o fundo cósmico');
    // nenhum resquício da implementação anterior do Álbum
    for (const seletor of ['.album-atalhos', '.album-era', '.figurinha-vazia', '.figurinha-icone', '.orbe-album']) {
      assert.equal(raiz.querySelector(seletor), null, `sem ${seletor} da versão antiga`);
    }

    liberar();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(r) : setTimeout(r, 16)));

    assert.equal(conteudo.hidden, false, 'revelado depois do decode');
    assert.equal(raiz.querySelector('.album-loader'), null, 'loader removido ao revelar');
    assert.ok(raiz.querySelector('.album-capa-imagem'), 'capa pronta e visível');
  } finally {
    if (orig) Object.defineProperty(proto, 'decode', orig);
    else delete proto.decode;
    if (!tinhaImage) delete globalThis.Image;
  }
});

test('29. reabrir nunca mostra a era antes selecionada nem miolo meio montado', () => {
  const { cat, store, raiz } = ambiente();
  const album = montarAlbum({ raiz, store, catalogo: cat, T });
  abrirMiolo(album, raiz);
  raiz.querySelector('.album-tab[data-era="ficcao"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(raiz.querySelector('.album-tab[aria-current="true"]').dataset.era, 'ficcao');
  album.fechar();
  assert.equal(raiz.querySelector('.album-overlay'), null, 'DOM do álbum some ao fechar');

  album.abrir();
  assert.ok(raiz.querySelector('.album-capa-imagem'), 'reabre pela capa');
  assert.equal(raiz.querySelector('.album-miolo'), null, 'sem miolo');
  assert.equal(raiz.querySelector('.album-pagina-overlay'), null, 'sem arte de era');
  assert.equal(raiz.querySelector('.album-tab[aria-current="true"]'), null, 'nenhuma era marcada');
});

test('27. mobilidade entre variantes: mesmos percentuais de área de grade nas duas eras (sem AREA_SEGURA por era)', () => {
  const { cat, store, raiz } = ambiente();
  comViewport(true, () => {
    const album = montarAlbum({ raiz, store, catalogo: cat, T });
    abrirMiolo(album, raiz);
    const areaElementos = raiz.querySelector('.album-grade-area').getAttribute('style');
    raiz.querySelector('.album-tab[data-era="ficcao"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    const areaFiccao = raiz.querySelector('.album-grade-area').getAttribute('style');
    assert.equal(areaElementos, areaFiccao, 'mesma geometria de grade entre eras');
  });
});
