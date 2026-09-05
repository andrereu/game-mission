# Mistura!

Jogo de descobertas no estilo Infinite Craft, em português, para jogar online e offline.
Arraste dois itens no canvas para descobrir um terceiro. Cada descoberta nova ganha um
destaque em tela cheia antes de virar um card na gaveta.

Fase 1 (esta): jogo jogável offline — canvas, gaveta com busca e filtro, destaque de
descoberta, 35 itens e 40 combinações em pt_BR (com Pikachu e Homem-Aranha), IA desligada.

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
por navegador/computador. (O modo instalável/PWA vem na fase 2.)

### Cada filho no seu navegador

O save fica preso ao navegador. Para saves separados, use perfis do Chrome ou navegadores
diferentes por criança. (Perfis dentro do jogo vêm na fase 2.)

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
