// src/app.js
import { criarCatalogo, comboKey } from './engine/catalogo.js';
import {
  carregar, salvar, criarAgendadorSalvar, saveInicial,
} from './engine/storage.js';
import { criarStore } from './engine/state.js';
import { criarCombinador } from './engine/combinar.js';
import { criarProviderEndpoint } from './ai/provider.js';
import { montarCanvas } from './ui/canvas.js';
import { criarAudioService } from './audio/audioService.js';
import { montarDrawer } from './ui/drawer.js';
import { mostrarRecompensaDescoberta } from './ui/descoberta-carta.js';
import { montarArvore } from './ui/arvore.js';
import { montarDiorama } from './ui/diorama.js';
import { montarAjustes } from './ui/ajustes.js';
import { montarStatusRede } from './ui/rede.js';
import { mostrarDesfazer } from './ui/desfazer.js';
import { montarAlbum } from './ui/album.js';
import { mostrarEraNova } from './ui/era-nova.js';
import { mostrarAtualizacaoDisponivel } from './ui/atualizacao.js';
import { erasAlcancadas, eraMaisAvancada, progressoPorEra } from './engine/eras.js';
import {
  carregarPerfis, criarPerfil, editarPerfil, apagarPerfil, definirAtivo, salvarPerfis, chaveSave,
} from './engine/perfis.js';
import { configDoModo, MODO_PADRAO } from './data/modos.js';
import { montarSeletorPerfis } from './ui/perfis.js';
import {
  carregarSync, definirCodigo, desativar as desativarSync, gerarCodigo,
  sincronizar, empurrar,
} from './engine/sync.js';
import { T } from './data/textos.js';
import { prepararSplash, esconderSplash } from './ui/splash.js';
import { avatarSvgMarkup } from './ui/avatarSvg.js';
import { avatarPadrao } from './data/avatares.js';

prepararSplash();

async function iniciar() {
  const catalogo = criarCatalogo();

  const seletor = montarSeletorPerfis({
    raiz: document.getElementById('perfis-raiz'),
    T,
    aoEscolher: async (id) => { await definirAtivo(id); location.reload(); },
    aoCriar: async (nome, cor, modo, avatarId) => {
      await criarPerfil(nome, cor, modo, avatarId);
      return carregarPerfis();
    },
    aoEditar: async (id, campos) => { await editarPerfil(id, campos); return carregarPerfis(); },
    aoApagar: async (id) => { await apagarPerfil(id); return carregarPerfis(); },
  });

  let perfis = await carregarPerfis();

  // Sincronização entre aparelhos (se ativa + online): puxa e mescla ANTES de
  // decidir o perfil ativo e de carregar o save.
  const sync = await carregarSync();
  if (sync.codigo && navigator.onLine) {
    try {
      await sincronizar(sync.codigo, {
        carregarPerfis,
        salvarPerfis,
        carregarSave: (id) => carregar(catalogo, chaveSave(id)),
        salvarSave: (id, s) => salvar(s, chaveSave(id)),
        ativo: perfis.ativo,
      });
      perfis = await carregarPerfis();
    } catch (err) {
      console.warn('sync falhou:', err);
    }
  }

  if (!perfis.ativo) {
    // Primeira vez (ou todos apagados): não inicia o jogo até escolher.
    // aoEscolher recarrega a página, então o boot recomeça já com um ativo.
    seletor.abrir(perfis);
    esconderSplash();
    return;
  }

  const perfilAtivo = perfis.lista.find((p) => p.id === perfis.ativo);
  const modo = (perfilAtivo && perfilAtivo.modo) || MODO_PADRAO;
  document.body.dataset.modo = modo; // o resto do "modo" é CSS

  const chaveDoSave = chaveSave(perfis.ativo);
  let save;
  try {
    save = await carregar(catalogo, chaveDoSave);
  } catch (err) {
    console.error(err);
    save = saveInicial(catalogo); // boot com save novo em vez de página em branco
  }
  // catálogo é recriado do zero a cada boot: repõe as criações da IA gravadas no save
  catalogo.hidratarIA(save.itensIA, save.combosIA);
  const store = criarStore(save);

  const agendarSalvar = criarAgendadorSalvar(() => store.getSave(), 400, chaveDoSave);
  store.on('estado:mudou', agendarSalvar);

  // "Voz das descobertas": Pequenos vem ligada, Médio/Completo vem desligada
  // — mas só como PADRÃO. Assim que a pessoa mexe no switch em Ajustes, a
  // escolha dela vira explícita (true/false gravado) e passa a valer sempre,
  // independente do modo (mesmo se o perfil trocar de modo depois). Saves
  // antigos (ajustes.vozDescobertas nunca gravado) caem no padrão do modo
  // sem precisar de migração — fallback não destrutivo.
  const vozPadraoDoModo = modo === 'pequenos';
  const vozEfetiva = () => {
    const explicita = store.getSave().ajustes.vozDescobertas;
    return explicita == null ? vozPadraoDoModo : explicita;
  };
  const audio = criarAudioService({
    getSom: () => store.getSave().ajustes.som,
    getVoz: vozEfetiva,
  });

  // Progressão de eras: snapshot das eras já alcançadas + pinta o fundo.
  const erasVistas = erasAlcancadas(store.getSave().descobertos, catalogo);
  document.body.dataset.era = eraMaisAvancada(erasVistas);

  // A IA só é tentada quando o perfil ligou `iaLigada` E há rede (spec §5.2/§9).
  // Nasce desligada; o painel de ajustes liga. Mesma checagem usada pro
  // convite lúdico da IA no canvas (só oferece o convite quando dá pra
  // atender, ver montarCanvas abaixo).
  const iaElegivel = () => store.getSave().ajustes.iaLigada === true && navigator.onLine;
  const iaLigadaMasOffline = () => store.getSave().ajustes.iaLigada === true && !navigator.onLine;
  // indicador de disponibilidade da IA (barra) — criado mais abaixo; o
  // provider avisa aqui quando a IA fica realmente inacessível.
  let statusIA = null;
  const combinar = criarCombinador({
    catalogo,
    aiProvider: criarProviderEndpoint('/api/combinar', {
      aoFalhar: () => statusIA?.marcarGeracaoFalhou(),
    }),
    estaOnline: iaElegivel,
    aoRegistrarIA: (item, combo) => {
      store.registrarItemIA(item, comboKey(combo.a, combo.b), combo);
    },
  });

  const elCanvas = document.getElementById('canvas');
  const elDrawer = document.getElementById('drawer');
  const elLimpar = document.getElementById('limpar');
  const elArvore = document.getElementById('arvore');
  const elEras = document.getElementById('eras');
  const elAjustes = document.getElementById('ajustes');
  const elDiorama = document.getElementById('diorama');
  const modoPequenos = modo === 'pequenos';

  let drawer;

  // destino da carta que "voa" na 1ª descoberta: o botão do Álbum — ou,
  // quando ele está escondido (Modo Pequenos), o cabeçalho do inventário,
  // pra não mandar a animação pra um alvo invisível. Resolvido de novo a
  // cada descoberta (nunca coordenada fixa) via getBoundingClientRect
  // dentro de animarVooParaDestino.
  function destinoRecompensa() {
    if (modoPequenos) return elDrawer.querySelector('.drawer-progresso-topo');
    return elEras;
  }

  const canvas = montarCanvas({
    raiz: elCanvas,
    store,
    catalogo,
    combinar,
    iaElegivel,
    iaLigadaMasOffline,
    audio,
    margemFusao: configDoModo(modo).margemFusao,
    aoResultado: async (resultado, ctx) => {
      // uma geração de IA bem-sucedida prova que a IA está de pé — atualiza o
      // indicador na hora (mesmo quando o item não é "novo").
      if (resultado.tipo === 'ok' && resultado.fonte === 'ia') statusIA?.marcarGeracaoOk();
      if (resultado.tipo !== 'ok' || !ctx.novo) return;
      const comSom = store.getSave().ajustes.som;

      // já disponível no drawer/álbum: não espera a animação de recompensa
      drawer.adicionarCard(resultado.item.id);

      // assinatura sonora de "item inédito" — antes/junto da celebração de
      // sempre (carta + voo), nunca no lugar dela.
      audio.tocarNovaDescoberta();

      await mostrarRecompensaDescoberta({
        id: resultado.item.id,
        store,
        catalogo,
        T,
        destinoEl: destinoRecompensa(),
        comSom,
      });

      // primeira descoberta de uma era ainda não vista: comemora e repinta
      // (só depois da carta+voo — as duas celebrações não se sobrepõem)
      const eraNova = resultado.item.era;
      if (!resultado.item.ia && eraNova && !erasVistas.has(eraNova)) {
        erasVistas.add(eraNova);
        document.body.dataset.era = eraMaisAvancada(erasVistas);
        // assinatura sonora própria de Nova Era — claramente mais importante
        // que a de "nova descoberta" acima; toca junto da celebração visual
        // de sempre, sem alterá-la.
        audio.tocarNovaEra();
        await mostrarEraNova({
          era: eraNova,
          progresso: progressoPorEra(store.getSave().descobertos, catalogo),
          comSom,
        });
      }
    },
  });

  drawer = montarDrawer({
    raiz: elDrawer,
    store,
    catalogo,
    aoEscolherItem: (id) => {
      const r = elCanvas.getBoundingClientRect();
      canvas.soltarItem(id, r.width / 2, r.height / 2);
    },
    // arrastar o card (ponteiro: toque + mouse) e soltar em cima do canvas
    aoSoltarItem: (id, clientX, clientY) => {
      const r = elCanvas.getBoundingClientRect();
      const dentro = clientX >= r.left && clientX <= r.right
        && clientY >= r.top && clientY <= r.bottom;
      if (!dentro) return; // soltou fora do tabuleiro: ignora
      canvas.soltarItem(id, clientX - r.left, clientY - r.top);
    },
    aoAbrirAlbum: () => album.abrir(),
  });

  // limpar sem alerta bloqueante: some tudo e oferece "Desfazer" por alguns segundos
  let desfazerAtivo = null;
  elLimpar.addEventListener('click', () => {
    const antes = store.listInstances(); // cópia
    if (antes.length === 0) return;
    canvas.destruirTudo();
    desfazerAtivo?.fechar();
    desfazerAtivo = mostrarDesfazer({
      raiz: elCanvas,
      T,
      ms: 5000,
      aoDesfazer: () => {
        for (const inst of antes) store.addInstance(inst.id, inst.x, inst.y);
        canvas.render();
      },
    });
  });

  const arvore = montarArvore({
    raiz: document.getElementById('arvore-raiz'),
    store,
    catalogo,
    T,
    aoEnviarPraCanvas: (id) => {
      const r = elCanvas.getBoundingClientRect();
      canvas.soltarItem(id, r.width / 2, r.height / 2);
    },
  });
  elArvore.addEventListener('click', () => arvore.abrir()); // rótulo já está no HTML

  // Diorama V0 ("Meu Mundo"): estado 100% derivado das descobertas, nunca
  // abre sozinho — só sinaliza discretamente que algo mudou (ver §6/§10 do
  // briefing). Bootstrap silencioso no boot: um save que nunca abriu o
  // Diorama (novo ou veterano) começa "em dia" com o estado atual, sem
  // inundar a 1ª visita com dezenas de marcos que já existiam antes dele.
  const diorama = montarDiorama({
    raiz: document.getElementById('diorama-raiz'), store, catalogo, T, audio,
  });
  diorama.garantirBootstrap();
  const elDioramaPonto = elDiorama.querySelector('.barra-botao-ponto');
  function atualizarIndicadorDiorama() {
    if (elDioramaPonto) elDioramaPonto.hidden = !diorama.temPendentes();
  }
  atualizarIndicadorDiorama();
  store.on('descoberta:nova', atualizarIndicadorDiorama);
  // 'diorama:mudou' dispara quando a visita termina de reproduzir a fila e
  // persiste o progresso visto (ver store.setDiorama em ui/diorama.js) —
  // é o sinal certo pra apagar o indicador, não o clique em si (a
  // reprodução ainda está rodando quando o clique acontece).
  store.on('diorama:mudou', atualizarIndicadorDiorama);
  elDiorama.addEventListener('click', () => diorama.abrir());

  const album = montarAlbum({
    raiz: document.getElementById('eras-raiz'),
    store,
    catalogo,
    T,
  });
  document.getElementById('eras').addEventListener('click', () => album.abrir());

  const ajustes = montarAjustes({
    raiz: document.getElementById('ajustes-raiz'),
    T,
    get: (chave) => (chave === 'vozDescobertas' ? vozEfetiva() : store.getSave().ajustes[chave]),
    set: (chave, valor) => {
      store.setAjuste(chave, valor);
      // desligou som ou voz com uma fala em andamento: para na hora, não
      // espera a frase terminar sozinha.
      if (chave === 'vozDescobertas' && !valor) audio.cancelarFala();
    },
    sync: {
      carregar: carregarSync,
      ativar: async () => { await definirCodigo(gerarCodigo()); return carregarSync(); },
      usar: async (c) => { await definirCodigo(c); location.reload(); },
      desativar: async () => { await desativarSync(); return carregarSync(); },
      agora: () => location.reload(),
    },
  });
  elAjustes.addEventListener('click', () => ajustes.abrir());

  // com sync ativo, empurra descobertas + criações da IA do perfil ativo pouco
  // depois de cada novidade (sem itensIA/combosIA, o outro aparelho só saberia
  // o id descoberto, sem saber o que a IA inventou — o mesmo bug do ❔ só que
  // entre aparelhos em vez de entre sessões)
  if (sync.codigo) {
    let tPush = null;
    const empurrarLogo = () => {
      clearTimeout(tPush);
      tPush = setTimeout(() => {
        if (!navigator.onLine) return;
        const s = store.getSave();
        empurrar(sync.codigo, perfis.ativo, {
          descobertos: s.descobertos, itensIA: s.itensIA, combosIA: s.combosIA,
        }).catch(() => {});
      }, 2000);
    };
    store.on('descoberta:nova', empurrarLogo);
    store.on('itemIA:novo', empurrarLogo);
  }

  // botão de trocar de perfil: a mini-orbe do avatar usa a cor do perfil
  const elPerfil = document.getElementById('perfil');
  elPerfil.querySelector('.barra-perfil-nome').textContent = perfilAtivo ? perfilAtivo.nome : T.trocarPerfil;
  if (perfilAtivo) {
    const elAvatar = elPerfil.querySelector('.barra-avatar');
    elAvatar.style.setProperty('--cor-orbe', perfilAtivo.cor);
    elAvatar.innerHTML = avatarSvgMarkup(perfilAtivo.avatarId || avatarPadrao(perfilAtivo.id));
  }
  elPerfil.addEventListener('click', async () => {
    seletor.abrir(await carregarPerfis());
  });

  statusIA = montarStatusRede({ el: document.getElementById('rede'), T });
  esconderSplash();
}

iniciar().catch((err) => {
  esconderSplash();
  console.error(err);
});

// PWA: registra o service worker (não bloqueia o jogo se falhar). O install
// já chama self.skipWaiting() + clients.claim() (ver sw.js) — a troca de
// versão em background dispara 'controllerchange'. A primeira vez que a
// página é controlada (1ª instalação) NÃO é uma atualização; só avisamos a
// partir da 2ª troca de controlador em diante.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    let jaTinhaControlador = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!jaTinhaControlador) {
        jaTinhaControlador = true;
        return;
      }
      mostrarAtualizacaoDisponivel({ T, aoAtualizar: () => window.location.reload() });
    });
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('service worker não registrou:', err);
    });
  });
}
