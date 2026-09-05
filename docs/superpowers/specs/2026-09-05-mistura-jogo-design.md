# Mistura! — Jogo de descobertas estilo Infinite Craft

**Data:** 2026-09-05
**Status:** Design aprovado (aguardando revisão do spec)
**Autor:** andrereu@gmail.com + Claude

## 1. Visão geral

Jogo web para os três filhos do autor jogarem. Inspiração de mecânica: Infinite
Craft (arrastar e fundir itens num canvas livre). Inspiração de visual e sensação
de progressão: Cell to Singularity. O jogador combina dois itens para descobrir um
terceiro. Cada descoberta nova é comemorada com um destaque em tela cheia antes de
o item virar um card permanente na gaveta (drawer).

Todo o conteúdo — nomes de itens, textos de explicação e interface — é em
português do Brasil (pt_BR).

O jogo funciona 100% offline. Uma camada de IA opcional (desligada por padrão e
fora do escopo desta fase) poderá, no futuro, sugerir combinações quando o jogador
misturar dois itens sem combinação registrada no código.

### Objetivos

- Diversão para crianças: livre, sem punição, sem pressão de tempo.
- Seguro para crianças: todo o conteúdo é curado à mão nesta fase.
- Offline de verdade: instalável como PWA, joga sem rede.
- Uma quantidade grande de itens para descobrir (~250 nesta fase; expansão
  planejada para a fase 2).
- Referências que as crianças gostam: Pokémon e Homem-Aranha, com ícones próprios.

### Não-objetivos desta fase

- Servidor de IA real e endpoint `/api/combinar`.
- Perfis separados por filho.
- Camada massiva de combinações geradas por regras (fase 2).
- Trilha sonora / múltiplos efeitos sonoros (só 1 som de sucesso).
- Conquistas, pontuação, ranking.
- Árvore em camadas/eras estilo Cell to Singularity (a árvore desta fase é um
  grafo do que foi descoberto).
- Promover uma combinação inventada pela IA para o catálogo curado.

## 2. Stack e restrições

- Web puro: HTML + CSS + JavaScript (módulos ES). Sem framework de runtime.
- Sem build obrigatório. Se uma etapa de build aparecer (ex: empacotar dados),
  ela é opcional e o jogo roda direto do fonte.
- PWA: `manifest.webmanifest` + service worker para cache do app-shell e dados.
- Possível dependência: uma biblioteca pequena de layout de grafo para a tela da
  Árvore (ex: dagre). Se o peso ou a complexidade não compensarem, cai para um
  layout próprio por profundidade. Decisão registrada no plano de implementação.
- Persistência: IndexedDB, com `localStorage` como fallback.
- Alvo de navegador: Chrome/Edge/Safari recentes (desktop e celular). Suporte a
  toque obrigatório.

## 3. Arquitetura

### 3.1 Estrutura de arquivos

```
index.html
manifest.webmanifest
sw.js
styles/
  base.css
  canvas.css
  drawer.css
  overlay.css
  arvore.css
src/
  engine/
    state.js        # estado do jogo + pub/sub
    storage.js      # persistência (IndexedDB / localStorage)
    combinar.js     # resolução de combinação (local -> IA -> nada)
    slug.js         # gera id a partir de um nome pt_BR
  data/
    itens.js        # catálogo de itens base
    combos.js       # mapa de combinações curadas
    textos.js       # todas as strings de interface
  ui/
    canvas.js       # render + drag/drop + fusão
    drawer.js       # lista/busca/filtro de descobertas
    descoberta.js   # overlay de item novo
    arvore.js       # grafo pan/zoom dos descobertos
  ai/
    provider.js     # interface de IA + stub desligado
assets/
  svg/              # ícones desenhados dos itens especiais
  icons/            # ícones do PWA
```

Cada módulo tem um propósito único, expõe uma interface pequena e pode ser testado
sozinho.

### 3.2 Fluxo de dados

1. A UI (canvas ou drawer) dispara uma ação de combinação com dois `uid` de
   instâncias no canvas.
2. `combinar.js` normaliza o par de ids e resolve o resultado.
3. `state.js` aplica a mudança (remove as duas instâncias, cria a do resultado) e,
   se o resultado é inédito no save, marca a descoberta.
4. `state.js` emite eventos (`instancia:criada`, `instancia:removida`,
   `descoberta:nova`, `estado:salvo`).
5. A UI reage: `canvas.js` anima a fusão; em `descoberta:nova`, `descoberta.js`
   mostra o overlay e, ao fechar, `drawer.js` insere o card.
6. `storage.js` persiste o save após cada mudança relevante (debounce curto).

### 3.3 Pub/sub

`state.js` mantém um emissor de eventos mínimo (`on(evento, fn)`,
`emit(evento, dados)`). Sem biblioteca. Os módulos de UI se inscrevem nos eventos
de que precisam e nunca leem o estado interno de outro módulo.

## 4. Modelo de dados

### 4.1 Item

```js
{
  id: "agua",            // slug único, gerado de `nome` via slug.js
  nome: "Água",          // rótulo pt_BR exibido
  emoji: "💧",           // ícone padrão (Unicode)
  svg: null,             // "assets/svg/pikachu.svg" para itens especiais; senão null
  era: "elementos",      // elementos | natureza | vida | tecnologia | cultura | ficcao
  base: true,            // true = já aparece na drawer no começo do jogo
  ref: null              // null | "pokemon" | "homem-aranha" (só marca a origem)
}
```

Regras:

- `id` é estável. Nunca muda depois de lançado (o save referencia por `id`).
- Item com `svg` usa o SVG em todos os lugares (canvas, drawer, overlay, árvore);
  os demais usam `emoji`.
- `era` define a cor de borda do card/nó e o agrupamento na drawer.

### 4.2 Combo curado

```js
{
  a: "agua",
  b: "fogo",
  resultado: "vapor",
  texto: "Água quente vira vapor."   // obrigatório; aparece no overlay
}
```

Regras:

- A chave de busca é simétrica: o par é ordenado alfabeticamente por `id` antes de
  virar chave (`"agua+fogo"`). `agua+fogo` e `fogo+agua` resolvem para o mesmo
  combo.
- `combos.js` expõe um `Map` já normalizado (`"idA+idB"` -> objeto combo), montado
  uma vez no carregamento a partir da lista de combos crua.
- `texto` é a mini explicação infantil. Uma frase curta.
- Um combo cujo `resultado` não exista em `itens.js` é erro de dados — um teste
  de integridade falha (ver seção 9).

### 4.3 Save (IndexedDB, um registro por família)

```js
{
  versao: 1,
  descobertos: {
    "agua":  { em: 1730800000000, via: null,               fonte: "base" },
    "vapor": { em: 1730800050000, via: ["agua", "fogo"],    fonte: "local" }
  },
  canvas: [
    { uid: "u_ab12", id: "agua", x: 120, y: 300 }
  ],
  ajustes: { som: true, iaLigada: false }
}
```

Campos:

- `descobertos`: mapa `id -> { em, via, fonte }`.
  - `em`: timestamp da descoberta (ordenação na drawer).
  - `via`: `[idPai1, idPai2]` que gerou o item, ou `null` para itens `base`. É a
    aresta que a Árvore desenha.
  - `fonte`: `"base"` | `"local"` (combo curado) | `"ia"` (inventado pela IA).
- `canvas`: instâncias vivas no tabuleiro. `uid` é único por instância — dá para
  ter três "Água" ao mesmo tempo. Restaurado ao abrir o jogo.
- `ajustes.som`: liga/desliga o efeito de sucesso.
- `ajustes.iaLigada`: liga a tentativa de IA (só surte efeito na fase 2, com
  endpoint configurado, e só quando `navigator.onLine`).

### 4.4 Migração de save

`storage.js` lê `versao`. Se for menor que a atual, roda migrações em sequência
(`migra_1_para_2`, ...) antes de entregar o save ao jogo. Nesta fase só existe a
`versao: 1`.

### 4.5 Alvo de conteúdo da fase 1

- ~250 itens em 6 eras: `elementos`, `natureza`, `vida`, `tecnologia`, `cultura`,
  `ficcao`.
- ~700 combos curados.
- ~15 itens Pokémon e ~8 itens Homem-Aranha, na era `ficcao`, com SVG próprio.
- Todo item não-base precisa ser alcançável por pelo menos uma cadeia de combos a
  partir dos itens base (teste de alcançabilidade, seção 9).

## 5. Loop principal (canvas + fusão + descoberta)

### 5.1 Canvas

- Área de jogo limpa, fundo liso, grade sutil opcional (ajuste visual, não afeta
  jogo).
- Pan: arrastar numa área vazia. Zoom: scroll do mouse / pinça no toque. Limites
  de zoom definidos (ex: 0.4x a 2.5x).
- Criar instância: arrastar um card da drawer para o canvas, ou clicar no card
  (aparece no centro da área visível).
- Mover instância: arrastar a instância pelo canvas.
- Combinar: soltar uma instância sobreposta a outra. Se as caixas se
  sobrepõem o suficiente (ex: > 40% da menor), tenta combinar.
- Remover instância: toque longo / clique direito → some do canvas. A descoberta
  correspondente permanece na drawer.
- Botão "Limpar canvas": remove todas as instâncias. Não apaga descobertas. Pede
  confirmação simples.

### 5.2 Fusão (`combinar.js`)

`combinar(idA, idB) -> Promise<Resultado>`

`Resultado` é um de:

- `{ tipo: "conhecido", item, combo }` — já estava em `combos.js`.
- `{ tipo: "novo", item, combo, fonte }` — combinação válida cujo resultado é
  inédito no save (`fonte` = `"local"` ou `"ia"`).
- `{ tipo: "nada" }` — sem combinação.

Ordem de resolução:

1. Normaliza o par (ordena por `id`, monta a chave). Busca no `Map` de
   `combos.js`.
2. Achou: resultado com `fonte: "local"`.
3. Não achou, `ajustes.iaLigada` verdadeiro e `navigator.onLine` verdadeiro:
   chama `ai/provider.js`. Enquanto espera, o canvas mostra um spinner discreto no
   ponto da fusão. (Fase 1: o provider é o stub e sempre devolve `null`, então
   este ramo cai no passo 5.)
4. IA devolveu combinação: cria o item (via `slug.js` para o `id`), resultado com
   `fonte: "ia"`.
5. Nada resolveu: `{ tipo: "nada" }`.

`state.js` decide se é descoberta: o resultado é novo quando `item.id` não está em
`save.descobertos`. Nesse caso emite `descoberta:nova`.

### 5.3 Reações no canvas

- `conhecido` / `novo`: remove as duas instâncias de origem, cria a instância do
  resultado na posição média das duas, com uma animação de "junta e brilha".
- `nada`: as duas instâncias dão um "quique" e voltam para onde estavam. Se
  `ajustes.som`, um som fraco de "nada aconteceu". Sem mensagem de erro, sem
  punição.
- Repetir um combo já conhecido sempre funciona; só não dispara overlay.

## 6. Overlay de descoberta (`descoberta.js`)

Dispara em `descoberta:nova`, **antes** de o card entrar na drawer.

Sequência:

1. Escurece a tela (fade ~200 ms).
2. Ícone grande do item novo no centro, com pulso e partículas/brilho. SVG se
   houver; senão emoji grande.
3. Nome em pt_BR em destaque + selo "NOVO!".
4. Linha "De onde veio": `[ícone A] Água  +  [ícone B] Fogo`.
5. Mini texto: `combo.texto` (combo curado) ou a explicação devolvida pela IA.
6. Um som curto de sucesso, se `ajustes.som`.
7. Qualquer clique / toque / tecla: o ícone encolhe e "voa" até a posição da
   drawer; ao chegar, o card aparece lá. O overlay fecha.

Fila: se uma cadeia rara gerar mais de uma descoberta de uma vez, o overlay mostra
uma por vez, na ordem de criação.

Acessibilidade: o overlay recebe foco, o texto é lido por leitor de tela, e há um
botão "Fechar" visível além do "clique em qualquer lugar".

## 7. Drawer

- Painel lateral no desktop, painel inferior no celular. Recolhível. Rolagem
  interna.
- Grade de cards: ícone + nome. Borda colorida pela era.
- Card com `fonte: "ia"` recebe um marcador de canto (ex: estrelinha) para
  distinguir do conteúdo curado.
- Busca por nome (campo de texto) no topo, sem acento e sem caixa
  (`"agua"` acha "Água").
- Filtro por era: chips (`Elementos`, `Natureza`, `Vida`, `Tecnologia`,
  `Cultura`, `Ficção`). Multi-seleção.
- Contador "X / Y descobertos". `Y` = total de itens conhecidos pelo jogo (cresce
  se a IA adicionar itens no save).
- Interação: arrastar card para o canvas cria instância; clique simples cria
  instância no centro da área visível.
- Ordenação: por era e, dentro da era, por `em` (ordem de descoberta).

## 8. Árvore de descobertas (`arvore.js`)

- Abre em tela cheia sobre o jogo, por um botão. Botão para fechar.
- Pan/zoom próprios, independentes do canvas de jogo.
- Nós: cada `id` em `save.descobertos`. Arestas: de cada pai em `via` para o
  filho.
- Itens `base`: raízes (sem aresta de entrada), alinhadas no topo/esquerda.
- Layout automático em camadas por profundidade a partir das raízes. Biblioteca
  pequena (ex: dagre) se valer o peso; senão, layout próprio por profundidade
  (nível = 1 + max(nível dos pais)).
- Nó: ícone + nome, borda colorida pela era. Nó `fonte: "ia"` com o mesmo
  marcador da drawer.
- Clicar num nó: realça o nó e seus pais e filhos diretos; mostra o `texto` da
  combinação que o gerou.
- Sem spoiler: só aparece o que já foi descoberto. Nada de silhuetas "???".
- Somente visualização. Não se combina nada nesta tela.

## 9. Camada de IA (`ai/provider.js`)

Interface:

```js
sugerirCombo(itemA, itemB) -> Promise<{ resultadoNome, emoji, texto } | null>
```

Implementações:

- `stubDesligado` (padrão): devolve `null` sempre.
- `viaEndpoint`: `fetch("/api/combinar", { method: "POST", body: {a, b} })`.
  **Não implementado nesta fase.** A interface e o formato ficam prontos e
  documentados.

Regras de acionamento (em `combinar.js`): só tenta se `ajustes.iaLigada` e
`navigator.onLine`.

Ao receber uma sugestão:

- `id` do novo item = `slug(resultadoNome)`. Se colidir com um `id` existente,
  trata como aquele item já conhecido (não cria duplicado).
- Cria o item em memória (`nome`, `emoji`, `svg: null`, `era: "ficcao"` por
  padrão ou uma era devolvida pela IA se válida, `ref: null`).
- Registra em `save.descobertos` com `fonte: "ia"` e `via: [idA, idB]`.
- Registra a combinação num `Map` em memória para repetir sem nova chamada.
- Persiste o save.

Guard-rails documentados para o futuro endpoint (fase 2, não implementados agora):

- Prompt fixo, family-friendly, resposta obrigatoriamente em pt_BR.
- Lista de bloqueio de temas/palavras; resposta rejeitada cai em "nada aconteceu".
- Timeout curto; erro de rede cai em "nada aconteceu".
- Sem dados pessoais na chamada.

## 10. Offline / PWA

- `manifest.webmanifest`: nome "Mistura!" (provisório), conjunto de ícones,
  `display: standalone`, `theme_color` e `background_color` definidos,
  `start_url` "./".
- `sw.js`:
  - No `install`: pré-cacheia o app-shell completo (HTML, CSS, todos os módulos
    JS, `itens.js`, `combos.js`, `textos.js`, todos os SVGs, ícones do PWA).
  - No `fetch`: cache-first para todo recurso estático do app. Rede só para o
    (futuro) `/api/combinar`.
  - Versão de cache no nome; `activate` limpa caches antigos.
- Sem rede: a IA simplesmente não é tentada; todo o resto funciona igual.

## 11. Internacionalização

- Tudo em pt_BR agora. Sem biblioteca de i18n.
- Todas as strings de interface ficam em `src/data/textos.js` (um objeto), para
  revisar e ajustar a linguagem infantil num lugar só.
- Nomes de itens e `texto` de combos já nascem em pt_BR nos dados.
- `slug.js` remove acentos e normaliza para gerar `id` a partir de nome pt_BR
  ("Ação" -> "acao").

## 12. Testes

Runner leve, sem etapa de build (ex: `uvu`, ou testes em módulo ES em navegador
headless). Escolha registrada no plano de implementação.

Cobertura-alvo:

- `slug.js`: acentos, espaços, maiúsculas, colisão, caracteres estranhos.
- `combinar.js`: normalização e simetria do par; ordem local -> IA -> nada;
  classificação `conhecido` / `novo` / `nada`; ramo de IA com stub (sempre
  `null`).
- `state.js`: descoberta inédita vs. repetida; emissão dos eventos certos;
  criação/remoção de instâncias por `uid`.
- `storage.js`: salvar, carregar, restaurar canvas, migração por `versao`,
  fallback para `localStorage`.
- Integridade de dados: todo `resultado`/`a`/`b` de `combos.js` existe em
  `itens.js`; todo item não-base é alcançável a partir dos itens base; todo combo
  curado tem `texto`; todo `id` é único; todo caminho de `svg` aponta para um
  arquivo existente.
- UI (`canvas.js`, `drawer.js`, `descoberta.js`, `arvore.js`): 1–2 testes de
  fumaça no DOM cada. O resto é verificação manual.

## 13. Fases

1. **Esta fase.** Jogo completo offline: ~250 itens / ~700 combos curados, canvas
   com arrastar e fundir, drawer com busca e filtro, overlay de descoberta,
   árvore em grafo, PWA instalável, interface de IA presente mas desligada.
2. **Depois.** Camada massiva de combinações (gerador por regras temáticas a
   partir de ~120 itens base), endpoint `/api/combinar` real com guard-rails,
   e — se o jogo for para a web pública — a questão de segurança da chave de API.

## 14. Questões em aberto

- Biblioteca de layout de grafo para a Árvore: usar `dagre` ou layout próprio.
  Decidir no início da implementação, medindo o peso no service worker.
- Runner de testes: `uvu` vs. testes em navegador headless.
- Nome definitivo do jogo (provisório: "Mistura!").
