# Mistura!

Jogo de descobertas no estilo Infinite Craft, em português, para jogar online e offline.
Arraste dois itens no canvas para descobrir um terceiro. Cada descoberta nova ganha um
destaque em tela cheia antes de virar um card na gaveta.

Jogo jogável offline — canvas, gaveta com busca e filtro, destaque de descoberta,
árvore de descobertas, PWA instalável, 136 itens e 182 combinações em pt_BR
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

### Cada filho no seu navegador

O save fica preso ao navegador. Para saves separados, use perfis do Chrome ou navegadores
diferentes por criança. (Perfis dentro do jogo vêm depois.)

## Publicar e atualizar (Vercel)

O site publicado é só a pasta `dist/`, montada por `scripts/build.mjs` (index.html,
`sw.js`, `manifest.webmanifest`, `vercel.json`, `styles/`, `src/`, `assets/` — sem
testes nem `node_modules`). `vercel.json` marca a página como `noindex` (não aparece
em buscador) e manda o `/sw.js` não ser cacheado.

Uma vez só:

```
npm install -g vercel
vercel login
```

Cada atualização do jogo:

```
npm run deploy
```

Esse comando sobe a versão do cache no `sw.js` (`mistura-v1` → `v2` → ...), monta o
`dist/` e roda `vercel deploy --prod --yes dist`. A troca da versão é o que faz os
aparelhos já instalados baixarem os arquivos novos — sem isso, eles continuam na
versão velha. Depois do deploy, faça o commit do `sw.js` alterado.

Na primeira vez o `vercel` pergunta o escopo e o nome do projeto e cria tudo; as
próximas usam o `.vercel/` local (fora do git). O plano Hobby é grátis e não trava
deploy de produção.

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

Ainda pendente: endpoint de IA real (sugere combinação quando não existe no
código, com mini explicação) e seus guard-rails; pinça-zoom no toque; perfis por
criança; validação de arrastar/soltar em celular; mais conteúdo rumo a ~250
itens / ~700 combos.

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
- **Catálogo maior** — 136 itens / 182 combos curados (era 35 / 40), só emoji,
  todas as seis eras. Integridade garantida por `tests/dados.test.js`.
- **SVGs de Pokémon e Homem-Aranha** — `assets/svg/` com pikachu, raichu,
  pokebola, homem-aranha, venom e duende-verde. Ícones flat legíveis de 24px a
  96px; a UI troca emoji por `<img>` quando o item tem `svg`.

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
