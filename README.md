# Misturária

Misturária é um jogo infantil de descobertas em português do Brasil. A criança combina dois elementos no canvas, descobre novos itens, acompanha sua evolução pelas eras e coleciona cartas no Álbum.

O projeto nasceu como uma experiência familiar inspirada na liberdade de combinação de Infinite Craft e na sensação de evolução de Cell to Singularity, mas possui catálogo, progressão, identidade visual e regras próprias.

**Jogar:** https://dist-vert-theta.vercel.app

> Projeto pessoal, sem anúncios, com funcionamento online e offline. O repositório é público para documentação e acompanhamento da evolução do jogo.

## Estado atual

- 283 itens oficiais
- 394 combinações curadas
- 6 eras: Elementos, Natureza, Vida, Tecnologia, Cultura e Ficção
- 256 testes automatizados passando
- PWA instalável em celular e desktop
- Interface responsiva para mobile, tablet e desktop
- Sincronização opcional entre aparelhos
- IA opcional e desligada por padrão

Versão de referência: commit b3037dd.

## Como jogar

Arraste ou toque em dois itens para colocá-los no canvas. Quando eles formam uma combinação conhecida, um novo elemento é criado e registrado no perfil da criança.

Uma descoberta inédita:

1. permanece como peça no canvas;
2. abre sua carta colecionável;
3. voa visualmente até o Álbum;
4. passa a aparecer no inventário, na Árvore e no Álbum oficial.

O catálogo possui rotas alternativas para combinações intuitivas. As receitas oficiais funcionam sem internet e não dependem da IA.

## Principais recursos

### Canvas e inventário

- Peças em formato de orbe, com identidade cósmica.
- Drawer inferior no mobile/tablet e painel lateral no desktop.
- Busca, filtros por era e progresso da coleção.
- Arrastar do inventário ou tocar para adicionar ao canvas.
- Limpar canvas com possibilidade de desfazer.

### Perfis infantis

Cada criança possui um perfil separado, com avatar, descobertas, canvas e preferências próprias.

Os três modos alteram apenas a quantidade de interface exibida:

- **Pequenos:** elementos maiores e menos controles.
- **Médio:** experiência padrão.
- **Completo:** todas as ferramentas disponíveis.

Perfis antigos são migrados sem perder progresso.

### Eras, Árvore e Álbum

- A progressão oficial é dividida em seis eras.
- A Árvore mostra as relações entre descobertas sem revelar itens ainda desconhecidos.
- O foco de um nó mostra somente seus pais e filhos diretos.
- O Álbum organiza as figurinhas por era.
- Cada carta possui raridade, origem, usos e exportação como imagem.
- Eras completas recebem uma celebração e selo próprio.

### Itens “Além do mapa”

Itens sem continuação no catálogo oficial recebem uma borda platina e o símbolo ∞. Isso indica que o caminho canônico daquele item terminou, mas ele ainda pode participar de uma mistura inventada com IA.

A classificação é calculada automaticamente a partir das combinações oficiais.

### Misturas inventadas com IA

A IA é opcional, fica desligada por padrão e nunca substitui uma receita oficial.

Quando uma dupla não possui combinação curada, o jogo pode oferecer:

**✨ Inventar com IA**

O resultado:

- passa pelos guardrails infantis do servidor;
- fica identificado como criação da IA;
- permanece fora do cânone;
- não altera a contagem ou conclusão das eras oficiais.

A IA exige internet e a variável GEMINI_API_KEY configurada na Vercel.

### PWA e funcionamento offline

Depois do primeiro carregamento, o app-shell, catálogo, combinações e assets essenciais ficam disponíveis offline.

No desktop:

- Chrome e Edge podem instalar o jogo como aplicativo;
- window-controls-overlay integra o header à barra da janela quando suportado;
- a opção **Tela cheia** nos Ajustes usa a Fullscreen API e precisa ser ativada pelo usuário.

No mobile, use **Adicionar à tela inicial** ou a opção equivalente do navegador.

Ícones instalados podem permanecer em cache pelo sistema operacional. Se uma instalação antiga não atualizar o ícone, remova e instale novamente.

### Sincronização entre aparelhos

Nos Ajustes, um aparelho pode gerar um código de família. O mesmo código em outro aparelho sincroniza perfis e descobertas pelo Firebase Realtime Database.

O canvas e preferências locais permanecem específicos de cada aparelho.

## Splash e identidade visual

A abertura usa logo e mascote definitivos, atmosfera cósmica, frases alternadas e duração mínima curta enquanto o estado essencial do jogo é preparado.

Os arquivos mestres de alta resolução ficam em design-assets/, fora do bundle. Apenas derivados otimizados ficam em assets/.

## Executar localmente

Requisitos:

- Node.js 20.6 ou mais recente

Instale e rode:

    npm install
    npm start

Abra http://localhost:4173.

No Windows, também é possível usar o arquivo **Jogar Misturaria.bat**.

O index.html não deve ser aberto diretamente porque o navegador bloqueia os módulos nessa condição.

## Testes

    npm test

A suíte cobre dados, combinações, persistência, perfis, IA, sincronização, Árvore, Álbum, cartas, PWA, acessibilidade e comportamentos responsivos relevantes.

## Build e deploy

    npm run build
    npm run deploy

A branch de produção é main. Cada push dispara o build e o deploy automático na Vercel.

O script de deploy atualiza a versão do cache do service worker, realiza commit e envia para o GitHub. O bump do service worker é necessário quando arquivos usados pelo app mudam, mas não para alterações exclusivas de documentação.

Variáveis usadas em produção:

- GEMINI_API_KEY
- GEMINI_MODELO, opcional

A configuração do Firebase fica em src/data/config.js. Nenhum segredo deve ser colocado no cliente ou neste README.

## Estrutura principal

    index.html                 pontos de montagem e splash
    src/app.js                 orquestração do jogo
    src/data/                  itens, combinações, textos, modos e avatares
    src/engine/                catálogo, estado, storage, eras, sync e regras
    src/ui/                    canvas, drawer, Árvore, Álbum, cartas e Ajustes
    src/ai/                    cliente do provider de IA
    api/                       função serverless e guardrails
    assets/                    arquivos otimizados usados em produção
    design-assets/             masters e materiais de design fora do build
    tests/                     suíte automatizada

## Pendência conhecida

Uma descoberta criada pela IA já é persistida e aparece na Árvore, porém ainda não aparece no Álbum de figurinhas.

A correção deverá permitir que essas descobertas sejam vistas em uma seção própria do Álbum — por exemplo, **Descobertas inventadas** — sem incluí-las na contagem, progresso ou conclusão das seis eras oficiais.

## Próximas etapas

1. Diagnosticar e corrigir a presença das descobertas da IA no Álbum, mantendo-as fora do progresso canônico.
2. Validar em instalações reais os novos ícones e o window-controls-overlay.
3. Especificar o diorama: função no loop, progressão visual, layout responsivo, mapa de desbloqueios e inventário exato de assets.
4. Criar os assets individuais aprovados para o diorama.
5. Implementar o diorama como representação viva da evolução do universo.
6. Fazer uma varredura geral de UX, mecânica, performance, acessibilidade e acabamento antes de congelar a V1.

Pendências de menor prioridade:

- revisar o arrastar do drawer no tablet físico;
- avaliar áudio sintetizado por era;
- avaliar futuramente um “pedido do dia”.

## Princípios do projeto

- Feito primeiro para as crianças da família.
- Sem anúncios e sem mecânicas predatórias.
- Jogável sem internet nas combinações oficiais.
- IA opcional, transparente e protegida.
- Linguagem infantil sem tratar a criança como bebê.
- Interfaces simples por fora, com consistência e segurança por baixo.
