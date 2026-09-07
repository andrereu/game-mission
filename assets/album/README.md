# Álbum — assets canônicos

Pacote visual aprovado para a implementação do álbum de figurinhas.

## Estrutura

- `capa.png`: capa fechada do álbum.
- `fundo-cosmico.png`: fundo panorâmico da abertura.
- `base-desktop.png`: miolo/base do álbum aberto no desktop.
- `base-mobile.png`: miolo/base de página no mobile.
- `<era>-desktop.png`: camada temática transparente da era sobre a base desktop.
- `<era>-mobile.png`: camada temática transparente da era sobre a base mobile.

Eras disponíveis: `elementos`, `natureza`, `vida`, `tecnologia`, `cultura`, `ficcao` e `ia`.

## Regras canônicas de implementação

- Preservar as artes; não redesenhar nem recriar em SVG/CSS.
- Compor cada página na ordem: base → slots/figurinhas → overlay temático.
- As figurinhas do miolo são versões compactas das cartas já existentes, sem os blocos “Sobre”, “Vim disso” e “Criei isso” e sem os controles “Salvar imagem” e “Fechar”.
- Ao tocar/clicar numa figurinha descoberta, abrir a carta completa já existente no jogo, com seus detalhes e controles normais. Não ampliar a miniatura.
- Itens não descobertos aparecem como espaços vazios/ocultos, sem revelar nome ou imagem.
- Itens criados por IA ficam na coleção própria e não entram na contagem ou conclusão das eras canônicas.
- A densidade inicial deve seguir o piloto visual, mas precisa ser validada no jogo real em mobile e desktop; ajustar quantidade por página se leitura ou toque ficarem comprometidos.

