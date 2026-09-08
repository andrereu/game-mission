# Misturária — especificação canônica do Álbum V2

**Status:** CANONICAL / APPROVED / PRESERVE

**Data:** 08/09/2026

**Base técnica:** `main` em `c96b768`

**Assets aprovados:** `assets/album/v2/`

Esta especificação substitui a direção visual do piloto `7×4 / 4×5 / 4×4`. Não muda as regras do jogo, o catálogo, a carta grande ou a separação entre cânone e IA.

## 1. Arquitetura visual

### Desktop

- Sempre mostrar o álbum como uma dupla página real.
- A página física esquerda é a abertura artística da coleção e não recebe slots ou figurinhas.
- A página física direita recebe uma única grade `3×3`, capacidade fixa de nove itens.
- Ao avançar dentro da coleção, a arte esquerda permanece fixa e só o conteúdo da página direita muda.
- Total de telas da coleção: `max(1, ceil(totalDeItens / 9))`.
- Asset: `assets/album/v2/<colecao>-desktop-overlay-3344x1882.png`.
- Geometria inicial comum da grade, relativa ao canvas completo 3344×1882:
  - `left: 60%`
  - `right: 13%`
  - `top: 18%`
  - `bottom: 18%`
- Esses valores são uma única fonte de verdade global. Se a validação real exigir ajuste, ajustar o conjunto globalmente; não criar tamanhos diferentes por era.

### Mobile

- A primeira tela de cada coleção é a abertura, sem slots e sem figurinhas.
- Asset da abertura: `assets/album/v2/<colecao>-mobile-abertura-2048x3072.png`.
- As telas seguintes usam `assets/album/v2/<colecao>-mobile-folha-2048x3072.png` e uma grade `3×3`, capacidade fixa de nove itens.
- Total de telas da coleção: `1 + max(1, ceil(totalDeItens / 9))`; para IA sem itens a coleção nem aparece.
- Geometria inicial comum da grade, relativa ao canvas 2048×3072:
  - `left: 20%`
  - `right: 20%`
  - `top: 22%`
  - `bottom: 25%`
- A mesma moldura, escala, área segura e tamanho de mini-figurinha devem valer para todas as coleções. É proibido adaptar tamanho por era.

### Grade comum

- `grid-template-columns: repeat(3, minmax(0, 1fr))`.
- `grid-template-rows: repeat(3, minmax(0, 1fr))`.
- Gap proporcional, discreto e único para todas as eras; ponto inicial recomendado: `2%` da caixa da grade.
- Preenchimento em ordem de leitura: esquerda para direita, cima para baixo.
- Não usar distribuição balanceada que altere capacidade ou posição. Fatiar deterministicamente em blocos fixos de nove.
- Itens canônicos mantêm posição estável pela lista completa ordenada, inclusive quando ainda não descobertos.
- O último grupo mantém as posições restantes como slots vazios.
- Na coleção IA, mostrar somente criações já descobertas em ordem de criação; não criar `?`, slots futuros ou denominador desconhecido.

## 2. Camadas e enquadramento

Ordem visual:

1. fundo/modal do Álbum;
2. base existente do livro (`base-desktop.png` ou `base-mobile.png`);
3. overlay temático V2 ativo;
4. slots e mini-figurinhas;
5. moldura física/tabs/controles interativos.

Regras:

- Base, overlay e grid compartilham exatamente a mesma caixa proporcional: 3344×1882 no desktop e 2048×3072 no mobile.
- `object-fit: contain` isolado em apenas uma imagem não pode determinar alinhamento; dimensionar primeiro a caixa proporcional comum e posicionar tudo dentro dela.
- O overlay é decorativo: `pointer-events: none`.
- Tema e grid devem ser limitados à superfície do papel. A arte não pode cobrir lombada, borda azul/dourada, cantoneiras ou tabs.
- Se a base atual mantiver papel e moldura no mesmo bitmap, resolver por uma camada de conteúdo recortada/máscara comum ou por frame superior derivado da própria base. Não redesenhar o livro em CSS/SVG.
- As mini-figurinhas ficam acima da arte temática. Como a grade ocupa a área livre aprovada, não devem cobrir título ou paisagem.
- Capa e fundo cósmico atuais permanecem; no mobile a capa deve ser centralizada e ocupar aproximadamente `70–82vw`, respeitando altura útil e safe areas, sem ficar pequena no topo.

## 3. Mini-figurinha — contrato visual imutável

A mini-figurinha é uma versão compacta da metade superior da carta grande já aprovada. Ela não é um orbe, não é uma versão ampliável e não deve ser reinterpretada.

### Deve conter, nesta ordem visual

1. cartão vertical próximo de `3:4`, com cantos arredondados, fundo cósmico azul-marinho e moldura/brilho da raridade;
2. wordmark real `Misturária` no topo, usando o mesmo asset de marca da carta;
3. selo pequeno da raridade no canto superior direito, com texto visível `COMUM`, `RARO`, `ÉPICO` ou `LENDÁRIO`;
4. medalhão/orbe circular escuro centralizado, com o ícone/SVG/emoji real já existente do item;
5. nome do item centralizado abaixo do medalhão, até duas linhas sem sobrepor outros elementos;
6. nome da era em caixa alta e menor no rodapé (`ELEMENTOS`, `NATUREZA`, etc.); para IA usar a identificação correspondente.

### Deve preservar

- Paleta e brilho por raridade já existentes: comum `#7fa8d9`, raro `#4ad0e6`, épico `#b06bff`, lendário `#ffc94a`.
- Acabamento próprio para criações da IA.
- Acabamento platina próprio para itens `Além do mapa`, sem confundi-lo com IA.
- A fonte real do ícone do item (`svg` quando existir; caso contrário, o emoji atual). Substituição geral de emojis não faz parte desta rodada.
- Área clicável igual à área total do cartão e `aria-label` com nome e raridade.

### É proibido incluir na mini-figurinha

- `Sobre` ou descrição;
- `Origem`, `Vim disso` ou combinações-pai;
- `Criei isso` ou filhos;
- mascote;
- `Salvar imagem`;
- `Fechar`;
- quaisquer botões internos;
- textos soltos sobre o ícone;
- orbe genérico escapando da moldura;
- simplificação que remova logo, selo visível, nome ou era.

### Carta grande

- Ao tocar/clicar na mini-figurinha, chamar o overlay/componente da carta grande existente.
- A carta grande está aprovada e deve permanecer sem qualquer alteração de markup, conteúdo, CSS, exportação ou comportamento.
- Não ampliar a miniatura para simular a carta completa.

## 4. Slots vazios e ausência de spoiler

- Um item canônico não descoberto usa a mesma silhueta vertical `3:4` da mini-figurinha, com papel translúcido, contorno tracejado sutil e `?` discreto.
- Não inserir `id`, nome, imagem, descrição, raridade ou qualquer metadado do item não descoberto no DOM.
- Slots nunca podem ser ovais ou círculos.
- A IA não recebe slots vazios futuros.

## 5. Navegação e regras preservadas

- As seis tabs físicas do livro continuam como áreas clicáveis acessíveis para suas eras; não recolocar uma fileira genérica de emojis acima do livro.
- A coleção IA não tem tab física: usar selo/botão próprio, visível somente após existir ao menos uma criação IA descoberta.
- Preservar anterior/próxima, teclado/Escape, foco, resize, breakpoint, contagens, selo de era completa e ausência de spoiler.
- IA continua fora dos 283 itens canônicos, fora do progresso de era e fora do selo de conclusão.
- Carregar somente base + asset ativo; pré-carregar a próxima coleção em tempo ocioso. Não carregar os 21 PNGs na abertura.

## 6. Fora do escopo desta rodada

- revelação progressiva das eras;
- correção do indicador Online/Offline da IA;
- Diorama;
- substituição geral de emojis por ícones próprios;
- redesign da carta grande, capa, mascote, base do livro ou assets aprovados.

## 7. Validação obrigatória

- Testes unitários cobrindo capacidade nove, página de abertura mobile, desktop sem slots à esquerda, posição determinística e regras da IA.
- Teste explícito garantindo que `criarElementoCarta`/carta grande não mudou.
- Teste sem spoiler verificando ausência de dados de itens ocultos no DOM.
- Validação visual real em 360×800, 390×844, 768×1024, 1280×720, 1366×768, 1440×900 e paisagem mobile.
- Em todas as eras, medir que a moldura do álbum tem o mesmo tamanho e que as nove células têm dimensões idênticas.
- Conferir: nenhum overflow horizontal, nenhuma figurinha sob a arte, nenhuma arte sobre o frame/tabs, nenhuma miniatura cortada, nenhum erro de console e nenhum asset quebrado.
- Não declarar concluído nem fazer deploy/merge sem aprovação explícita do André em dispositivo físico.
