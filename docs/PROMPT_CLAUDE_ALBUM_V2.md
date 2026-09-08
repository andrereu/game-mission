# Prompt para Claude — implementação final do Álbum V2

Leia integralmente `AGENTS.md`, `CLAUDE.md`, `PROJECT_STATE_GOVERNANCE.md`, o Estado Canônico do Misturária no Notion e `docs/ALBUM_V2_IMPLEMENTATION_SPEC.md` antes de editar qualquer arquivo.

Você receberá o ZIP `misturaria-album-v2.zip`. Ele já contém os arquivos nos caminhos relativos corretos do repositório: extraia/copiei seu conteúdo sobre uma branch nova criada a partir de `main` em `c96b768`, preservando exatamente nomes, dimensões, transparência e diretórios. O pacote aprovado ficará em `assets/album/v2/`. A branch histórica `claude/ia-album-drawer-headers-6yy63g` até `4def0c3` deve ser consultada apenas para compreender bugs e tentativas anteriores; não faça merge ou cherry-pick cego dela.

## Objetivo único desta rodada

Implementar a composição final do Álbum usando exatamente os 21 overlays aprovados de `assets/album/v2/`, sem redesenhar nenhum asset e sem alterar a carta grande.

## Resultado visual obrigatório

### Desktop

- Álbum aberto em dupla página.
- Página esquerda: abertura artística completa e fixa da era, sem qualquer figurinha.
- Página direita: somente uma grade 3×3 com nove mini-figurinhas/slots por tela.
- Ao paginar dentro da mesma era, manter a esquerda e trocar apenas os nove itens da direita.
- Usar `<era>-desktop-overlay-3344x1882.png`.
- Área inicial da grade no canvas inteiro: `left 60%`, `right 13%`, `top 18%`, `bottom 18%`.

### Mobile

- Página 1 de cada era: abertura artística usando `<era>-mobile-abertura-2048x3072.png`, sem slots ou figurinhas.
- Páginas seguintes: `<era>-mobile-folha-2048x3072.png` com grade 3×3.
- Área inicial da grade: `left 20%`, `right 20%`, `top 22%`, `bottom 25%`.
- Todos os livros, overlays, grades e miniaturas devem manter exatamente o mesmo tamanho entre as eras. Não crie `AREA_SEGURA` diferente por coleção.

Use uma caixa proporcional comum para base, overlay e grid. A arte não pode cobrir borda azul/dourada, lombada, cantoneiras ou tabs; as miniaturas devem ficar acima do overlay temático e totalmente clicáveis.

## Grade 3×3

- Capacidade fixa de nove itens.
- CSS estrutural: `grid-template-columns: repeat(3, minmax(0, 1fr))`, três linhas e cartões com `aspect-ratio: 3 / 4`; centralize a grade dentro da área segura sem deformar os cartões.
- O `gap` deve ser proporcional à moldura e único por variante responsiva; não use ajustes diferentes por era nem deixe o conteúdo decidir o tamanho da célula.
- O tamanho do cartão é derivado uma única vez da caixa proporcional e da área segura. Trocar era ou página não pode alterar largura, altura, proporção ou alinhamento da grade.
- Preencher em ordem de leitura e fatiar deterministicamente em blocos de nove; não balancear páginas.
- Itens canônicos preservam posição estável na lista completa, e itens ocultos viram slots verticais tracejados sem qualquer dado no DOM.
- IA mostra somente itens descobertos em ordem de criação, sem `?` ou espaços futuros.

## Mini-figurinha — NÃO ALTERAR ESTA DEFINIÇÃO

A mini-figurinha replica somente a metade superior da carta grande aprovada:

1. cartão vertical aproximadamente 3:4, fundo cósmico azul-marinho e moldura/brilho da raridade;
2. wordmark real Misturária no topo;
3. selo visível da raridade no canto superior direito (`COMUM`, `RARO`, `ÉPICO`, `LENDÁRIO`);
4. medalhão/orbe circular central com o ícone/SVG/emoji real do item;
5. nome do item centralizado;
6. era em caixa alta no rodapé.

Ela NÃO contém Sobre, descrição, Origem/Vim disso, Criei isso, mascote, Salvar imagem, Fechar ou qualquer botão interno. Não remova logo, selo visível, nome ou era. Não use um orbe genérico solto.

Ao clicar, abrir a carta grande existente por seu componente real. A carta grande já está aprovada: não altere uma linha de seu markup, CSS, textos, exportação ou comportamento e não amplie a miniatura.

## Preserve

- capa e fundo cósmico aprovados, com a capa mobile maior e centralizada;
- tabs físicas do livro como navegação acessível; sem fileira genérica de emojis;
- IA separada dos 283 canônicos e dos selos de conclusão;
- ausência de spoiler;
- carregamento sob demanda do asset ativo;
- navegação, acessibilidade, resize e comportamento responsivo existentes.

## Não faça nesta rodada

Não implemente revelação progressiva, indicador Online/Offline, Diorama, troca geral de emojis nem qualquer redesign externo ao Álbum.

## Validação e entrega

Crie/atualize testes para todos os requisitos. Rode a suíte completa e o build. Valide visualmente todas as sete coleções nos viewports 360×800, 390×844, 768×1024, 1280×720, 1366×768, 1440×900 e paisagem mobile. Compare medidas entre eras, teste paginação, tabs, slots ocultos e abertura da carta grande.

Não faça merge em `main` nem deploy sem autorização explícita do André. Ao concluir, informe branch, commit, arquivos, testes/build, validações, decisões tomadas, pendências reais e o próximo passo exato. O status final deve ser “implementação pronta para validação física”, nunca “aprovada”.
