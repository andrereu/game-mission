# Mistura!

Jogo de descobertas no estilo Infinite Craft, em português, para jogar online e offline.
Arraste dois itens no canvas para descobrir um terceiro. Cada descoberta nova ganha um
destaque em tela cheia antes de virar um card na gaveta.

Jogo jogável offline — canvas, gaveta com busca e filtro, destaque de descoberta,
árvore de descobertas, PWA instalável, 283 itens e 374 combinações em pt_BR
(com Pikachu e Homem-Aranha e SVGs próprios), IA desligada.

## Como jogar (Windows)

Você precisa do **Node.js** instalado (https://nodejs.org — versão 20.6 ou mais nova).

**Opção fácil:** dê dois cliques em **`Jogar Mistura.bat`**. Ele abre o navegador e liga o jogo.

**Pelo terminal:**

```
npm start
```

Depois abra **http://localhost:4173** no navegador. Para parar o servidor: `Ctrl+C`.

> Não dá para abrir o `index.html` direto (dois cliques no arquivo) — o navegador bloqueia
> os módulos. Tem que passar pelo `npm start` / pelo `.bat`.

### Offline

Depois de abrir uma vez, o jogo funciona sem internet — é só rodar `npm start` de novo.
O progresso (itens descobertos e o que está no canvas) fica salvo no próprio navegador,
por navegador/computador.

**Instalar como app:** com o jogo aberto no Chrome ou Edge, use o ícone de instalar na
barra de endereço (ou menu → "Instalar Mistura!"). Vira um app com janela e ícone
próprios e funciona offline pelo cache. Nos aparelhos dos filhos, o caminho é publicar
(abaixo) e usar "Adicionar à tela inicial".

### Um perfil por filho

No primeiro acesso o jogo pergunta "Quem vai jogar?" e você cria um perfil por criança
(nome + cor). Cada perfil tem o save próprio (descobertas, canvas, ajustes). O jogo abre
direto no último perfil usado; o botão no canto superior-esquerdo troca de perfil ou cria
outro. Tudo continua no mesmo navegador/aparelho — não sincroniza entre aparelhos.

## Publicar e atualizar (GitHub → Vercel)

O repositório está conectado à Vercel: **todo `git push` na `main` builda e
publica sozinho**. A Vercel roda `scripts/build.mjs` (`vercel.json`:
`buildCommand` + `outputDirectory`), serve o `dist/` gerado **e** publica
`api/combinar.js` como função. `vercel.json` marca a página como `noindex` e
manda o `/sw.js` não ser cacheado; `.vercelignore` tira `tests/`, `docs/` e o
`scratchpad` do upload.

Atalho para publicar o que estiver pendente:

```
npm run deploy
```

`scripts/deploy.mjs` sobe a versão do cache no `sw.js` (`mistura-v1` → `v2` → ...),
comita tudo e dá `git push`. A troca da versão é o que faz os aparelhos já
instalados baixarem os arquivos novos. (Se preferir commitar à mão, lembre de
bumpar o `sw.js` no mesmo commit quando mudar conteúdo.)

Configuração feita uma vez: no painel da Vercel → projeto → Settings →
Environment Variables → `GEMINI_API_KEY` (chave do Google AI Studio) e, opcional,
`GEMINI_MODELO`. E Settings → Git → repositório conectado, branch de produção `main`.

> `netlify.toml` ficou no repositório como alternativa: a Netlify passou a exigir
> créditos pra deploy de produção no time grátis.

## Rodar os testes

```
npm install
npm test
```

## Estrutura

```
index.html          página e pontos de montagem
servidor.mjs        servidor estático local (sem dependências)
src/engine/         slug, catalogo, storage, state, combinar
src/ui/             canvas, drawer, descoberta (overlay)
src/ai/             interface de IA (stub desligado nesta fase)
src/data/           itens, combos e textos (pt_BR)
docs/superpowers/   spec de design e plano de implementação
```

## Fase 2 (depois dos testes com as crianças)

Ainda pendente: validar toque num aparelho real; manter o Realtime Database
"acordado" (o free pausa sozinho? um ping via GitHub Actions resolve se
precisar). Roadmap com sabor Cell to Singularity em `docs/superpowers/` /
memória — próximo é a espinha de progressão de eras.

### Feito na fase 2

- **Árvore de descobertas** (`src/ui/arvore.js`) — grafo em tela cheia do que já
  foi descoberto, layout próprio por profundidade, pan/zoom, clique num nó realça
  pais e filhos e mostra o texto do combo. Botão "Árvore" no canto inferior-esquerdo.
- **PWA instalável e offline** — `manifest.webmanifest` + `sw.js` (cache
  `mistura-v1`, pré-cache do app-shell inteiro no `install`, cache-first no
  `fetch`, limpeza de caches antigos no `activate`). Registro em `app.js` atrás
  de `'serviceWorker' in navigator`. Ícones gerados por `scripts/gerar-icones.mjs`
  (sem dependência). Falta validar o registro em Chrome real / celular — o
  navegador de preview embutido bloqueia service worker.
- **Catálogo maior** — 283 itens / 374 combos curados (era 35 / 40), só emoji,
  todas as seis eras. Integridade garantida por `tests/dados.test.js`.
- **SVGs de Pokémon e Homem-Aranha** — `assets/svg/` com pikachu, raichu,
  pokebola, homem-aranha, venom e duende-verde. Ícones flat legíveis de 24px a
  96px; a UI troca emoji por `<img>` quando o item tem `svg`.
- **Perfis por criança** (`src/engine/perfis.js`, `src/ui/perfis.js`) — save
  separado por perfil na chave `save:<id>`; índice em `perfis`. Migra o save
  antigo `principal` sem perder progresso. Seletor "Quem vai jogar?" no primeiro
  acesso e no botão do canto.
- **Toque no celular** — pinça-zoom (`src/ui/panzoom.js`, compartilhado pelo
  canvas e pela árvore) e arrastar o card da gaveta pro canvas por ponteiro
  (segura ~180 ms, um "fantasma" segue o dedo, solta no tabuleiro). Tocar no card
  segue criando a peça no centro. Falta validar num aparelho real.
- **IA opcional** (`api/combinar.js`, `api/_guardrails.js`, `src/ui/ajustes.js`) —
  quando o par não está no catálogo e o perfil ligou a IA no ⚙️, o cliente chama
  `/api/combinar`; a função serverless pergunta ao Gemini (`gemini-flash-lite-latest`,
  trocável por `GEMINI_MODELO`) e devolve a sugestão só se ela passar nos
  guard-rails (prompt fixo pt_BR family-friendly, lista de bloqueio, nome curto).
  Falha/bloqueio/sem chave = "nada aconteceu". Desligada por padrão. Precisa de
  `GEMINI_API_KEY` na Vercel. `?debug=1` na URL devolve o erro no corpo.
- **Sincronizar entre aparelhos** (`src/engine/sync.js`, `src/data/config.js`) —
  no ⚙️ → "Ativar" gera um **código de família** (`ABCD-2345`); digite o mesmo
  código no ⚙️ dos outros aparelhos. Ao abrir o jogo (online), puxa e mescla do
  Firebase Realtime Database: lista de perfis (união por id) e `descobertos`
  (união, mantém a descoberta mais antiga). Canvas e ajustes ficam por aparelho.
  Empurra as descobertas ~2 s depois de cada uma nova. Sem credencial no cliente
  — as rules do RTDB (`firebase-rules.json`) exigem o código com 8+ caracteres.
  URL do banco em `src/data/config.js`.

### Ajustes vindos dos testes no notebook (2026-09-05)

- **Canvas com fundo mais claro.** _Feito (2026-09-05, commit `9857e44`)._
  `--cor-canvas` foi de `#121d31` para `#2c3c59`. A peça ganhou variáveis próprias
  acima desse tom (`--cor-peca: #405682`, `--cor-peca-borda: #5b74a8`) para não
  ficar mais escura que o fundo; o botão "Limpar canvas" usa as mesmas. Texto
  segue `#eaf0ff`. Drawer e corpo continuam escuros, emoldurando o canvas.
- **Arrastar e soltar no mobile não foi testado.** Só notebook até agora. O canvas usa
  Pointer Events (funciona em toque), mas falta: validar o drag de card da gaveta para o
  canvas no celular, o toque-longo (500 ms) para apagar sem conflitar com scroll, e a
  ausência de pinça-zoom (`touch-action: none` + `user-scalable=no`). Testar em um
  aparelho real no início da fase 2, antes da pinça-zoom.
