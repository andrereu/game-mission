# Interface Cósmica 2.0 — direção e inventário de assets

Esta é uma única frente visual antes do Diorama. A execução acontece por
superfície, mas compartilha o mesmo sistema e a mesma branch.

## Direção aprovada para protótipo

- O Álbum é a referência visual; suas artes não serão redesenhadas.
- Cenário cósmico em tela cheia, com conteúdo em painéis escuros translúcidos.
- Orbes/medalhões continuam sendo a linguagem dos itens e agora também dos perfis.
- Ciano e violeta dão profundidade; dourado continua reservado para descoberta,
  raridade, conclusão e celebração.
- Os emojis do catálogo continuam sendo a matéria visual das descobertas.

## Símbolos de perfil

Os oito ids já persistidos no save são mantidos. Só a apresentação muda:

| id preservado | símbolo | descoberta | era |
|---|---:|---|---|
| `nova` | 🧑 | Humano | Vida |
| `lumen` | 🌳 | Árvore | Natureza |
| `astra` | 🦕 | Dinossauro | Vida |
| `cosmo` | 🤖 | Robô | Tecnologia |
| `orbe` | 🚀 | Foguete | Tecnologia |
| `nebula` | 🎵 | Música | Cultura |
| `vega` | 🐉 | Dragão | Ficção |
| `polar` | 🪐 | Planeta | Elementos |

## Auditoria de superfícies

| prioridade | superfície | diagnóstico | intervenção |
|---|---|---|---|
| P0 | Perfis | fundo decorativo isolado e painel utilitário | novo cenário, painel cósmico, medalhões e hierarquia responsiva |
| P1 | Tabuleiro | grande área azul chapada | atmosfera sutil em CSS/asset otimizado, sem competir com as peças |
| P1 | Árvore | estrutura boa sobre fundo chapado | campo estelar discreto e regiões mais legíveis |
| P1 | Navegação | emojis genéricos soltos | família pequena de ícones/medalhões para Árvore, Álbum, Ajustes e Limpar |
| P2 | Gaveta | próxima da linguagem dos orbes | harmonizar cabeçalho, busca, filtros e fundo |
| P2 | Ajustes | já consistente e funcional | apenas compartilhar moldura, luz e ícones do kit |
| preservar | Álbum e cartas | referência visual canônica | não redesenhar; somente integrar transições e molduras externas |

## Inventário mínimo de assets

### Reaproveitar

- logos e mascote em `assets/cartas/`;
- cenário canônico `assets/album/fundo-cosmico.png` como fonte visual;
- planeta, estrelas, asteroides e orbes em `assets/decor/`;
- overlays V2 e artes do Álbum sem alteração.

### Produzir depois dos mockups aprovados

1. Dois fundos responsivos derivados do cenário canônico: desktop e mobile,
   comprimidos em WebP/AVIF. O PNG-fonte tem 6,3 MB e não deve ser baixado na
   entrada final do jogo.
2. Quatro ícones de navegação consistentes: Árvore, Álbum, Ajustes e Limpar.
   Preferência por SVG leve ou composição CSS; raster só se o acabamento pedir.
3. Se os mockups mostrarem necessidade, uma textura estelar muito leve para o
   tabuleiro e a Árvore. Não criar antes dessa validação.

### Não produzir nesta frente

- ilustrações individuais para as 283 descobertas;
- novas versões do Álbum, cartas, logos ou mascote;
- assets específicos do Diorama.

## Portão de aprovação

O protótipo de Perfis valida linguagem, escala e recorte em desktop e celular.
Só depois dessa aprovação os assets responsivos e a expansão às demais
superfícies entram na implementação final.
