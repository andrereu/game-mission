import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo, ERAS } from '../src/engine/catalogo.js';
import { montarArvore } from '../src/ui/arvore.js';
import { T } from '../src/data/textos.js';

function raizLimpa() {
  document.body.innerHTML = '<div id="arvore-raiz"></div>';
  return document.getElementById('arvore-raiz');
}

function saveCom(descobertos) {
  return { versao: 1, descobertos, canvas: [], ajustes: { som: true, iaLigada: false } };
}

function storeFake(save) {
  return {
    getSave: () => save,
    isDiscovered: (id) => Boolean(save.descobertos[id]),
  };
}

function no(raiz, id) {
  return raiz.querySelector(`.arvore-no[data-id="${id}"]`);
}

function ptr(tipo, x, y, id = 1) {
  const e = new window.Event(tipo, { bubbles: true, cancelable: true });
  e.pointerId = id;
  e.clientX = x;
  e.clientY = y;
  return e;
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

test('abrir monta um nó por descoberto e fechar remove o overlay', () => {
  const raiz = raizLimpa();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 2, via: null, fonte: 'base' },
    vapor: { em: 3, via: ['agua', 'fogo'], fonte: 'local' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  assert.ok(raiz.querySelector('.arvore-overlay'), 'overlay no DOM');
  assert.equal(raiz.querySelectorAll('.arvore-no').length, 3);
  arv.fechar();
  assert.equal(raiz.querySelector('.arvore-overlay'), null);
});

test('abrir duas vezes não empilha overlays', () => {
  const raiz = raizLimpa();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 2, via: null, fonte: 'base' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  arv.abrir();
  assert.equal(raiz.querySelectorAll('.arvore-overlay').length, 1);
});

// 1. perfil novo abre centralizado nos quatro elementos
test('perfil novo (só os 4 elementos primordiais) abre com a câmera centrada no núcleo', () => {
  const raiz = raizLimpa();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 2, via: null, fonte: 'base' },
    terra: { em: 3, via: null, fonte: 'base' },
    ar: { em: 4, via: null, fonte: 'base' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();

  const palco = raiz.querySelector('.arvore-palco');
  const rect = palco.getBoundingClientRect();
  const mundo = raiz.querySelector('.arvore-mundo');
  const [, tx, ty, escala] = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/
    .exec(mundo.style.transform) || [];
  assert.ok(tx !== undefined, 'transform aplicado');
  // os 4 primordiais formam um diamante em volta do centro do núcleo: o
  // centroide deles, na tela, deve cair exatamente no centro do palco
  let somaX = 0;
  let somaY = 0;
  for (const id of ['agua', 'fogo', 'terra', 'ar']) {
    const el = no(raiz, id);
    somaX += parseFloat(el.style.left) + 34; // metade da largura nominal do nó
    somaY += parseFloat(el.style.top) + 34;
  }
  const centroX = somaX / 4;
  const centroY = somaY / 4;
  const telaX = centroX * Number(escala) + Number(tx);
  const telaY = centroY * Number(escala) + Number(ty);
  assert.ok(Math.abs(telaX - rect.width / 2) < 0.01, 'núcleo centralizado em x');
  assert.ok(Math.abs(telaY - rect.height / 2) < 0.01, 'núcleo centralizado em y');
});

// 2. somente itens descobertos aparecem
test('somente itens descobertos aparecem no universo', () => {
  const raiz = raizLimpa();
  const cat = criarCatalogo();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 2, via: null, fonte: 'base' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: cat, T });
  arv.abrir();
  assert.equal(raiz.querySelectorAll('.arvore-no').length, 2);
  // "terra" e "ar" existem no catálogo mas não foram descobertos: sem nó, sem "???"
  assert.equal(no(raiz, 'terra'), null);
  assert.equal(no(raiz, 'ar'), null);
  assert.equal(raiz.textContent.includes('???'), false);
});

// 3. cada item aparece uma única vez
test('cada item descoberto aparece uma única vez', () => {
  const raiz = raizLimpa();
  const cat = criarCatalogo();
  const descobertos = {};
  let t = 1;
  for (const it of cat.allItems().filter((i) => i.era === 'elementos')) {
    descobertos[it.id] = { em: t += 1, via: null, fonte: 'base' };
  }
  const save = saveCom(descobertos);
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: cat, T });
  arv.abrir();
  const ids = [...raiz.querySelectorAll('.arvore-no')].map((el) => el.dataset.id);
  assert.equal(ids.length, new Set(ids).size, 'sem ids duplicados');
  assert.equal(ids.length, Object.keys(descobertos).length);
});

// 4. posições são determinísticas entre aberturas
test('posições são determinísticas: abrir de novo dá exatamente as mesmas coordenadas', () => {
  const raiz = raizLimpa();
  const cat = criarCatalogo();
  const descobertos = {
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 2, via: null, fonte: 'base' },
    terra: { em: 3, via: null, fonte: 'base' },
    ar: { em: 4, via: null, fonte: 'base' },
    vapor: { em: 5, via: ['agua', 'fogo'], fonte: 'local' },
    lava: { em: 6, via: ['fogo', 'terra'], fonte: 'local' },
  };
  const save = saveCom(descobertos);
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: cat, T });
  arv.abrir();
  const antes = new Map([...raiz.querySelectorAll('.arvore-no')].map((el) => [el.dataset.id, el.style.left + '|' + el.style.top]));
  arv.fechar();
  arv.abrir();
  const depois = new Map([...raiz.querySelectorAll('.arvore-no')].map((el) => [el.dataset.id, el.style.left + '|' + el.style.top]));
  assert.deepEqual([...depois.entries()].sort(), [...antes.entries()].sort());
});

// 5. posições calculadas são finitas e válidas
test('posições calculadas são sempre números finitos, mesmo com muitos itens', () => {
  const raiz = raizLimpa();
  const cat = criarCatalogo();
  const descobertos = {};
  let t = 0;
  for (const it of cat.allItems()) {
    t += 1;
    descobertos[it.id] = { em: t, via: null, fonte: 'base' };
  }
  const save = saveCom(descobertos);
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: cat, T });
  arv.abrir();
  const nos = raiz.querySelectorAll('.arvore-no');
  assert.equal(nos.length, Object.keys(descobertos).length);
  for (const el of nos) {
    const x = parseFloat(el.style.left);
    const y = parseFloat(el.style.top);
    assert.ok(Number.isFinite(x), `x finito pra ${el.dataset.id}`);
    assert.ok(Number.isFinite(y), `y finito pra ${el.dataset.id}`);
  }
});

// 6. regiões seguem a ordem das eras
test('regiões seguem a ordem das eras: raio cresce do núcleo pra fora', () => {
  const raiz = raizLimpa();
  const cat = criarCatalogo();
  const descobertos = {};
  let t = 0;
  for (const era of ERAS) {
    for (const it of cat.allItems().filter((i) => i.era === era).slice(0, 3)) {
      t += 1;
      descobertos[it.id] = { em: t, via: null, fonte: 'base' };
    }
  }
  const save = saveCom(descobertos);
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: cat, T });
  arv.abrir();
  const regioes = [...raiz.querySelectorAll('.arvore-regiao')];
  assert.equal(regioes.length, ERAS.length);
  const raioPorEra = new Map(regioes.map((r) => [r.dataset.era, parseFloat(r.style.width) / 2]));
  let raioAnterior = 0;
  for (const era of ERAS) {
    const raio = raioPorEra.get(era);
    assert.ok(raio > raioAnterior, `${era} fica mais longe do núcleo que a era anterior`);
    raioAnterior = raio;
  }
});

// 7. IA ocupa região própria e não entra nos cinturões canônicos
test('IA ocupa uma região própria, além da borda de Ficção, e não fica marcada com a era herdada', () => {
  const raiz = raizLimpa();
  const cat = criarCatalogo();
  cat.registrarItemIA({ nome: 'Gelo Estelar', emoji: '🧊', era: 'elementos' });
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    ar: { em: 1, via: null, fonte: 'base' },
    'gelo-estelar': { em: 2, via: ['agua', 'ar'], fonte: 'ia' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: cat, T });
  arv.abrir();

  const regiaoIA = raiz.querySelector('.arvore-regiao[data-era="ia"]');
  assert.ok(regiaoIA);
  const regiaoElementos = raiz.querySelector('.arvore-regiao[data-era="elementos"]');
  assert.ok(parseFloat(regiaoIA.style.width) > parseFloat(regiaoElementos.style.width));

  const noGelo = no(raiz, 'gelo-estelar');
  assert.equal(noGelo.dataset.era, 'ia', 'não fica marcado como "elementos" (era herdada)');
  assert.equal(noGelo.querySelector('.orbe').dataset.fonte, 'ia');
});

test('região "IA" não aparece quando não há criações da IA descobertas', () => {
  const raiz = raizLimpa();
  const save = saveCom({ agua: { em: 1, via: null, fonte: 'base' } });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  assert.equal(raiz.querySelector('.arvore-regiao[data-era="ia"]'), null);
  assert.equal(raiz.querySelector('.arvore-atalho[data-era="ia"]'), null);
});

// 8. "Além do mapa" preserva identidade platina
test('item "além do mapa" preserva a identidade platina no universo', () => {
  const raiz = raizLimpa();
  const cat = criarCatalogo();
  const alemDoMapa = cat.allItems().find((it) => cat.ehAlemDoMapa(it.id));
  assert.ok(alemDoMapa, 'catálogo real tem pelo menos um item além do mapa');
  const save = saveCom({ [alemDoMapa.id]: { em: 1, via: null, fonte: 'base' } });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: cat, T });
  arv.abrir();
  const el = no(raiz, alemDoMapa.id);
  const orbe = el.querySelector('.orbe');
  assert.equal(orbe.getAttribute('data-alem'), 'mapa');
  assert.ok(el.classList.contains('arvore-no-grande'), 'presença ligeiramente maior no panorama');
});

// 9 e 10. foco: nenhuma conexão sem foco; só pais/filhos diretos ao focar
test('clicar num nó dá destaque a ele, marca pais/filhos e esmaece o resto', () => {
  const raiz = raizLimpa();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 1, via: null, fonte: 'base' },
    ar: { em: 1, via: null, fonte: 'base' },
    vapor: { em: 2, via: ['agua', 'fogo'], fonte: 'local' },
    nuvem: { em: 3, via: ['ar', 'vapor'], fonte: 'local' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  no(raiz, 'vapor').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.ok(no(raiz, 'vapor').classList.contains('destaque'), 'o próprio nó');
  assert.ok(no(raiz, 'agua').classList.contains('pai'), 'pai não é mais "destaque", é "pai"');
  assert.ok(no(raiz, 'fogo').classList.contains('pai'));
  assert.ok(no(raiz, 'nuvem').classList.contains('filho'));
  assert.ok(no(raiz, 'ar').classList.contains('esmaecido'), 'fora da relação, mas continua no DOM (não "morto")');
  assert.match(raiz.querySelector('.arvore-bandeja-nome').textContent, /vapor/i);
});

test('sem foco, nenhuma aresta aparece; focando, só as diretas ficam visíveis', () => {
  const raiz = raizLimpa();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 1, via: null, fonte: 'base' },
    ar: { em: 1, via: null, fonte: 'base' },
    vapor: { em: 2, via: ['agua', 'fogo'], fonte: 'local' },
    nuvem: { em: 3, via: ['ar', 'vapor'], fonte: 'local' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();

  const arestas = () => [...raiz.querySelectorAll('.arvore-aresta')];
  assert.equal(arestas().length, 4);
  assert.equal(arestas().filter((a) => a.classList.contains('ativa')).length, 0, 'nenhuma visível sem foco');

  no(raiz, 'vapor').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const ativasVapor = arestas().filter((a) => a.classList.contains('ativa'));
  assert.equal(ativasVapor.length, 3);
  assert.equal(ativasVapor.filter((a) => a.classList.contains('aresta-pai')).length, 2, 'agua->vapor e fogo->vapor');
  assert.equal(ativasVapor.filter((a) => a.classList.contains('aresta-filho')).length, 1, 'vapor->nuvem');

  no(raiz, 'ar').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const ativasAr = arestas().filter((a) => a.classList.contains('ativa'));
  assert.equal(ativasAr.length, 1);
  assert.ok(ativasAr[0].classList.contains('aresta-filho'));
});

// 11. estilos de pai/filho continuam semanticamente diferentes
test('arestas e nós de "pai" e "filho" usam classes/estilos distintos', () => {
  const raiz = raizLimpa();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 1, via: null, fonte: 'base' },
    vapor: { em: 2, via: ['agua', 'fogo'], fonte: 'local' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  no(raiz, 'agua').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const aresta = raiz.querySelector('.arvore-aresta.ativa');
  assert.ok(aresta.classList.contains('aresta-filho'));
  assert.ok(!aresta.classList.contains('aresta-pai'));
  assert.ok(no(raiz, 'vapor').classList.contains('filho'));
  assert.ok(!no(raiz, 'vapor').classList.contains('pai'));
});

test('clicar no fundo limpa o foco', () => {
  const raiz = raizLimpa();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 1, via: null, fonte: 'base' },
    vapor: { em: 2, via: ['agua', 'fogo'], fonte: 'local' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  no(raiz, 'vapor').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  raiz.querySelector('.arvore-palco').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(raiz.querySelectorAll('.arvore-no.destaque').length, 0);
  assert.equal(raiz.querySelectorAll('.arvore-no.esmaecido').length, 0);
  assert.equal(raiz.querySelector('.arvore-bandeja-dica').hidden, false);
});

// 12. mini-orbes do painel navegam entre relações
test('mini-orbe do painel de descoberta leva o foco até o pai/filho tocado', () => {
  const raiz = raizLimpa();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 1, via: null, fonte: 'base' },
    vapor: { em: 2, via: ['agua', 'fogo'], fonte: 'local' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  no(raiz, 'vapor').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const miniAgua = raiz.querySelector('.arvore-mini-orbe[data-id="agua"]');
  assert.ok(miniAgua, 'mini-orbe do pai aparece na bandeja');
  miniAgua.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.ok(no(raiz, 'agua').classList.contains('destaque'), 'foco pulou pro pai tocado');
  assert.match(raiz.querySelector('.arvore-bandeja-nome').textContent, /água/i);
});

test('painel mostra "nada ainda" de forma lúdica quando o item não tem descendentes', () => {
  const raiz = raizLimpa();
  const save = saveCom({ agua: { em: 1, via: null, fonte: 'base' } });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  no(raiz, 'agua').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.match(raiz.querySelector('.arvore-bandeja-conteudo').textContent, /nada ainda/i);
});

// 13. busca encontra e focaliza item descoberto
test('busca encontra e focaliza um item já descoberto', () => {
  const raiz = raizLimpa();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 2, via: null, fonte: 'base' },
    vapor: { em: 3, via: ['agua', 'fogo'], fonte: 'local' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  const busca = raiz.querySelector('.arvore-busca');
  busca.value = 'vapor';
  busca.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.ok(no(raiz, 'vapor').classList.contains('destaque'));
});

// 14. busca encontra item da IA
test('busca encontra uma criação da IA já descoberta', () => {
  const raiz = raizLimpa();
  const cat = criarCatalogo();
  cat.registrarItemIA({ nome: 'Gelo Estelar', emoji: '🧊', era: 'elementos' });
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    ar: { em: 1, via: null, fonte: 'base' },
    'gelo-estelar': { em: 2, via: ['agua', 'ar'], fonte: 'ia' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: cat, T });
  arv.abrir();
  const busca = raiz.querySelector('.arvore-busca');
  busca.value = 'estelar';
  busca.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.ok(no(raiz, 'gelo-estelar').classList.contains('destaque'));
});

test('busca ignora acentos e caixa (usa o mesmo slug do resto do jogo)', () => {
  const raiz = raizLimpa();
  const save = saveCom({ agua: { em: 1, via: null, fonte: 'base' } });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  const busca = raiz.querySelector('.arvore-busca');
  busca.value = 'AGUA';
  busca.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.ok(no(raiz, 'agua').classList.contains('destaque'));
});

// 15. "Ver tudo" reenquadra o universo
test('"Ver tudo" reenquadra a câmera pra mostrar o universo descoberto', () => {
  const raiz = raizLimpa();
  const cat = criarCatalogo();
  const descobertos = {};
  let t = 0;
  for (const era of ERAS) {
    for (const it of cat.allItems().filter((i) => i.era === era).slice(0, 4)) {
      t += 1;
      descobertos[it.id] = { em: t, via: null, fonte: 'base' };
    }
  }
  const save = saveCom(descobertos);
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: cat, T });
  arv.abrir();
  const mundoAntes = raiz.querySelector('.arvore-mundo').style.transform;
  raiz.querySelector('.arvore-ver-tudo').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const mundoDepois = raiz.querySelector('.arvore-mundo').style.transform;
  assert.notEqual(mundoDepois, mundoAntes, 'a câmera se move/ajusta ao reenquadrar');
});

// 16. atalhos de era centralizam a região
test('atalho de era move a câmera até a região daquela era', () => {
  const raiz = raizLimpa();
  const cat = criarCatalogo();
  const descobertos = {
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 2, via: null, fonte: 'base' },
  };
  let t = 2;
  for (const it of cat.allItems().filter((i) => i.era === 'natureza').slice(0, 3)) {
    t += 1;
    descobertos[it.id] = { em: t, via: null, fonte: 'base' };
  }
  const save = saveCom(descobertos);
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: cat, T });
  arv.abrir();
  const atalhoNatureza = raiz.querySelector('.arvore-atalho[data-era="natureza"]');
  assert.ok(atalhoNatureza);
  const antes = raiz.querySelector('.arvore-mundo').style.transform;
  atalhoNatureza.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const depois = raiz.querySelector('.arvore-mundo').style.transform;
  assert.notEqual(depois, antes, 'câmera se move até a região de Natureza');
});

test('não funciona como filtro: os demais nós continuam no DOM depois do atalho de era', () => {
  const raiz = raizLimpa();
  const cat = criarCatalogo();
  const descobertos = { agua: { em: 1, via: null, fonte: 'base' } };
  const natureza = cat.allItems().find((i) => i.era === 'natureza');
  descobertos[natureza.id] = { em: 2, via: null, fonte: 'base' };
  const save = saveCom(descobertos);
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: cat, T });
  arv.abrir();
  raiz.querySelector('.arvore-atalho[data-era="natureza"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.ok(no(raiz, 'agua'), 'elementos continua no universo, não some ao navegar pra outra era');
  assert.equal(raiz.querySelectorAll('.arvore-no').length, 2);
});

// 17. toque prolongado continua enviando ao canvas
test('segurar um nó manda o item pro canvas; toque curto só foca', async () => {
  const raiz = raizLimpa();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 2, via: null, fonte: 'base' },
  });
  const enviados = [];
  const arv = montarArvore({
    raiz, store: storeFake(save), catalogo: criarCatalogo(), T,
    aoEnviarPraCanvas: (id) => enviados.push(id),
  });
  arv.abrir();

  const agua = no(raiz, 'agua');
  agua.dispatchEvent(ptr('pointerdown', 10, 10));
  await espera(500);
  assert.ok(agua.classList.contains('segurando'));
  agua.dispatchEvent(ptr('pointerup', 10, 10));
  assert.deepEqual(enviados, ['agua']);
  assert.ok(!agua.classList.contains('destaque'), 'segurar não foca');

  const fogo = no(raiz, 'fogo');
  fogo.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(enviados, ['agua'], 'toque curto não manda pro canvas');
  assert.ok(fogo.classList.contains('destaque'), 'toque curto continua focando');
});

// 18. abrir/fechar repetidamente não duplica eventos
test('abrir e fechar repetidamente não duplica listeners nem envios ao canvas', async () => {
  const raiz = raizLimpa();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 2, via: null, fonte: 'base' },
  });
  const enviados = [];
  const arv = montarArvore({
    raiz, store: storeFake(save), catalogo: criarCatalogo(), T,
    aoEnviarPraCanvas: (id) => enviados.push(id),
  });
  for (let i = 0; i < 4; i += 1) { arv.abrir(); arv.fechar(); }
  arv.abrir();
  const agua = no(raiz, 'agua');
  agua.dispatchEvent(ptr('pointerdown', 10, 10));
  await espera(500);
  agua.dispatchEvent(ptr('pointerup', 10, 10));
  assert.deepEqual(enviados, ['agua'], 'um único envio, mesmo depois de reabrir várias vezes');

  // clique num nó diferente (não o que acabou de ser segurado — logo depois
  // do "segurar" o próprio click sintético é suprimido de propósito)
  const fogo = no(raiz, 'fogo');
  fogo.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(raiz.querySelectorAll('.arvore-no.destaque').length, 1, 'um clique = um destaque, sem duplicar handlers');
});

// 19. saves e progresso permanecem inalterados
test('abrir, focar e navegar no universo nunca escreve no save', () => {
  const raiz = raizLimpa();
  const cat = criarCatalogo();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 2, via: null, fonte: 'base' },
    vapor: { em: 3, via: ['agua', 'fogo'], fonte: 'local' },
  });
  const antes = JSON.parse(JSON.stringify(save));
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: cat, T });
  arv.abrir();
  no(raiz, 'vapor').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  raiz.querySelector('.arvore-ver-tudo').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  arv.fechar();
  assert.deepEqual(save, antes);
});

test('perfil com criações da IA hidratadas continua funcionando na árvore', () => {
  const raiz = raizLimpa();
  const cat = criarCatalogo();
  cat.hidratarIA(
    { 'coisa-da-ia': { nome: 'Coisa da IA', emoji: '✨', era: 'natureza', raridade: 'raro', profundidade: 1 } },
    {},
  );
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    'coisa-da-ia': { em: 2, via: ['agua'], fonte: 'ia' },
  });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: cat, T });
  arv.abrir();
  assert.ok(no(raiz, 'coisa-da-ia'));
  assert.equal(no(raiz, 'coisa-da-ia').dataset.era, 'ia');
});

// 20. prefers-reduced-motion remove animações não essenciais
test('prefers-reduced-motion: navegar não agenda transição no mundo', () => {
  const raiz = raizLimpa();
  const save = saveCom({
    agua: { em: 1, via: null, fonte: 'base' },
    fogo: { em: 2, via: null, fonte: 'base' },
    vapor: { em: 3, via: ['agua', 'fogo'], fonte: 'local' },
  });
  const antesMatchMedia = window.matchMedia;
  window.matchMedia = (query) => ({ matches: query.includes('reduce'), media: query });
  try {
    const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
    arv.abrir();
    raiz.querySelector('.arvore-ver-tudo').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    const mundo = raiz.querySelector('.arvore-mundo');
    assert.equal(mundo.style.transition, '', 'sem transição agendada com movimento reduzido');
  } finally {
    window.matchMedia = antesMatchMedia;
  }
});

test('botão Fechar remove o overlay', () => {
  const raiz = raizLimpa();
  const save = saveCom({ agua: { em: 1, via: null, fonte: 'base' } });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  raiz.querySelector('.arvore-fechar').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(raiz.querySelector('.arvore-overlay'), null);
});

test('Escape fecha o universo', () => {
  const raiz = raizLimpa();
  const save = saveCom({ agua: { em: 1, via: null, fonte: 'base' } });
  const arv = montarArvore({ raiz, store: storeFake(save), catalogo: criarCatalogo(), T });
  arv.abrir();
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(raiz.querySelector('.arvore-overlay'), null);
});
