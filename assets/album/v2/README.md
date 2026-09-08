# Misturária — pacote definitivo do Álbum V2

**CANONICAL / APPROVED / DO NOT REDESIGN** — aprovado visualmente por André em 08/09/2026.

Este diretório contém 21 PNGs RGBA com transparência real: três assets para cada uma das seis eras canônicas e para a coleção especial `Inventadas com IA`.

## Convenção de arquivos

Para cada coleção (`elementos`, `natureza`, `vida`, `tecnologia`, `cultura`, `ficcao`, `ia`):

| Sufixo | Dimensões | Uso |
| --- | ---: | --- |
| `desktop-overlay-3344x1882.png` | 3344×1882 | Dupla página: abertura artística na esquerda e detalhes leves na direita |
| `mobile-abertura-2048x3072.png` | 2048×3072 | Primeira página mobile da coleção, sem figurinhas |
| `mobile-folha-2048x3072.png` | 2048×3072 | Páginas mobile seguintes, com centro livre para grade 3×3 |

## Regras de uso

- Usar os PNGs diretamente; não redesenhar, reinterpretar, recortar nem recriar em SVG/CSS.
- Manter a proporção e o mesmo enquadramento em todas as coleções.
- Os PNGs são overlays transparentes e não incluem livro, papel, tabs, slots, figurinhas ou controles.
- No desktop, a arte da esquerda permanece fixa e as figurinhas aparecem somente na página direita.
- No mobile, a abertura é uma página própria sem figurinhas; as páginas seguintes usam o asset `mobile-folha`.
- O contrato completo de composição, grade e mini-figurinha está em `docs/ALBUM_V2_IMPLEMENTATION_SPEC.md`.

## Coleções

1. Elementos
2. Natureza
3. Vida
4. Tecnologia
5. Cultura
6. Ficção
7. Inventadas com IA — coleção especial, fora da progressão canônica
