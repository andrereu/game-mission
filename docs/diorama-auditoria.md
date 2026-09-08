# Diorama V0 — auditoria, matriz e arquitetura

Rodada: "MISTURÁRIA — DIORAMA V0 · O MUNDO RESPONDE". Branch `feat/diorama-v0`,
não mergeada em `main`. Este documento é o entregável de auditoria pedido no
briefing (itens 1 e "Entregar" 1-3), mais o registro de decisão pra próximas
rodadas.

## 1. Auditoria — o que já existe (nunca uma taxonomia paralela)

### Eras reais (`src/engine/catalogo.js`)
```
ERAS = ['elementos', 'natureza', 'vida', 'tecnologia', 'cultura', 'ficcao']
```
6 eras, 283 itens canônicos no catálogo (`src/data/itens.js`):
`elementos` 32 · `natureza` 48 · `vida` 66 · `tecnologia` 54 · `cultura` 47 ·
`ficcao` 36.

### Categorias/famílias existentes
**Não existe campo de categoria/família no catálogo** — só `id, nome, emoji,
svg, era, base, ref`. Não havia nada equivalente a reaproveitar; a matriz da
seção 2 é derivada da `era` (nunca inventada do zero).

### Estrutura do save por perfil (`src/engine/storage.js`, `state.js`)
```
{
  versao, descobertos: { [id]: { em, via, fonte } },
  canvas: [...instâncias no tabuleiro...],
  itensIA: {}, combosIA: {},
  ajustes: { som, vozDescobertas?, iaLigada },
}
```
Progressão de era já é **100% derivada** (`src/engine/eras.js`,
`erasAlcancadas`/`eraMaisAvancada`/`progressoPorEra` — comentário no próprio
arquivo: "Sem estado novo no save"). O Diorama segue exatamente o mesmo
princípio (seção 3) e reaproveita essas funções em vez de recalcular era por
conta própria.

### Fluxo de nova descoberta (`canvas.js` `fundir()` → `app.js` `aoResultado`)
`resultado.tipo === 'ok'` → `store.recordDiscovery(id, via, fonte)` → se
`ctx.novo`: `audio.tocarNovaDescoberta()` → `mostrarRecompensaDescoberta`
(carta + voo) → se é 1ª descoberta de uma era: `audio.tocarNovaEra()` →
`mostrarEraNova`. Hook do Diorama: `store.on('descoberta:nova', ...)` já
existente (usado por sync) — reaproveitado só pra atualizar o indicador
discreto, nunca pra abrir nada.

### Fluxo de Nova Era
Distinto do "marco normal" desde sempre no código-fonte: checagem própria
(`!erasVistas.has(eraNova)`), som próprio (`tocarNovaEra`, ~1,3s, adicionado
na rodada anterior), celebração visual própria (`mostrarEraNova`). O Diorama
espelha essa distinção com um `tipo: 'era'` separado de `tipo: 'marco'` na
fila de acontecimentos (seção 4) — **sem chamar `tocarNovaEra()` a partir do
Diorama**, exatamente pra não duplicar/disparar errado a celebração sonora
já existente (briefing §7).

### Álbum / revelação progressiva (`src/ui/album.js`, `engine/eras.js`)
`erasReveladas()` já revela cada era canônica após a 1ª descoberta dela, e
"IA" como coleção paralela após a 1ª criação da IA — mesmo princípio de
"nunca inventar estado novo" que o Diorama segue. Não foi tocado.

### Áudio central (`src/audio/audioService.js`)
Serviço único (`criarAudioService`) com `getSom`/`getVoz` independentes,
efeitos via Web Audio, fala via `speechSynthesis`. O Diorama reaproveita a
MESMA instância (passada como `audio` pra `montarDiorama`) só pra
`falarSelecao()` no toque num elemento (briefing §9) — nenhum efeito sonoro
novo foi criado pro Diorama nesta rodada (fora do escopo pedido).

### Pontos de navegação existentes (`index.html`, `styles/barra.css`)
A barra principal já tinha um cluster `.barra-acoes` com 3 orbes-botão
(Árvore, Álbum, Ajustes) — criado na rodada "Interface Cósmica 2.0". Esse
já era o padrão estabelecido pra "destinos" do jogo. Decisão: **um 4º
botão nesse mesmo cluster**, não uma superfície nova — é a "solução melhor
dentro da estrutura existente" que o briefing §10 pede, em vez de um botão
solto em outro canto do HUD.

## 2. Matriz V0 (`src/engine/diorama.js`)

`condição real → marco do Diorama → estado visual → transformação`

4 das 6 eras mapeiam 1:1 pra uma família (é o próprio `item.era`, sem
reclassificar nada): `vida→vida`, `cultura→civilizacao`,
`tecnologia→tecnologia`, `ficcao→cosmico`. Só `elementos` e `natureza`
misturam mais de uma família visual — pra essas duas, cada um dos 80 itens
foi classificado manualmente em `terreno`/`água`/`vegetação`/`cósmico` (a
tabela completa está em `TERRENO`/`AGUA_IDS`/`VEGETACAO_IDS`/`COSMICO_IDS`
no código, com comentário apontando pra este documento).

| Família | Itens canônicos (não-IA) | Limiares (25/50/75/100%) |
|---|---|---|
| terreno | 29 | 8 / 15 / 22 / 29 |
| água | 28 | 7 / 14 / 21 / 28 |
| vegetação | 18 | 5 / 9 / 14 / 18 |
| vida | 66 | 17 / 33 / 50 / 66 |
| civilização | 47 | 12 / 24 / 36 / 47 |
| tecnologia | 54 | 14 / 27 / 41 / 54 |
| cósmico | 41 | 11 / 21 / 31 / 41 |

Os limiares **não são números do briefing** — são `Math.ceil(total * k/4)`
calculados em runtime a partir da contagem real do catálogo
(`thresholdsPorFamilia(catalogo)`). Se o catálogo crescer, os limiares se
recalculam sozinhos, sem precisar editar código.

5 estados por família (0..4), estado visual textual (usado na legenda/fala):

| Nível | terreno | água | vegetação | vida | civilização | tecnologia | cósmico |
|---|---|---|---|---|---|---|---|
| 0 | Rocha nua | Seco | Solo | Quieto | Nada ainda | Nada ainda | Céu comum |
| 1 | Solo formado | Orvalho | Broto | Primeiros bichos | Primeiros sinais | Ferramentas | Uma estrela |
| 2 | Relevo | Riacho | Arbusto | Pequena variedade | Vila | Máquinas simples | Poucas estrelas |
| 3 | Paisagem rica | Rio | Árvore | Fauna ativa | Povoado | Engenhocas | Céu estelar |
| 4 | Terreno pleno | Oceano | Pequeno bosque | Ecossistema | Pequena civilização | Tecnologia avançada | Fenômeno cósmico |

### Candidatos a "item-herói" (representação literal futura)
Não implementados agora — só registrados pra priorização depois do piloto
aprovado: `arvore` (vegetação), `oceano` (água), `vulcao`/`montanha`
(terreno), `dinossauro` ou `leao` (vida), `castelo` (civilização),
`foguete`/`robo` (tecnologia), `dragao`/`estrela`/`planeta` (cósmico).

## 3. Arquitetura

```
src/engine/diorama.js   — puro, sem I/O
  familiaDoItem(item) -> familia | null
  thresholdsPorFamilia(catalogo) -> { familia: [4 limiares] }
  resolverEstadoDiorama({ descobertos, catalogo, itensIA })
    -> { niveis, contagens, thresholds, era, temCriacoesIA, nivelMaximo }
  calcularAcontecimentosPendentes(estadoAtual, progressoVisto) -> [eventos]
  haAcontecimentosPendentes(estadoAtual, progressoVisto) -> bool
  proximoProgressoVisto(estadoAtual) -> { niveis, era }   // o que persistir

src/engine/state.js
  store.setDiorama(progressoVisto)  // grava save.diorama (mínimo: níveis+era)
  emite 'diorama:mudou'             // HUD escuta isso pra apagar o indicador

src/ui/diorama.js        — overlay, reproduz a fila, nunca decide "o que é novo"
  montarDiorama({ raiz, store, catalogo, T, audio })
    .abrir() / .fechar() / .garantirBootstrap() / .temPendentes()

src/app.js
  no boot: diorama.garantirBootstrap()          // 1x, idempotente
  store.on('descoberta:nova', ...)               // liga o indicador
  store.on('diorama:mudou', ...)                 // desliga o indicador
  #diorama (barra-acoes) -> diorama.abrir()
```

**Estado nunca persistido objeto por objeto.** `save.diorama` guarda só
`{ niveis: { terreno: 2, agua: 1, ... }, era: 'natureza' }` — o cenário
inteiro (ícones, posições, camadas) é recalculado toda vez a partir de
`descobertos` + catálogo. Trocar os emojis-placeholder por assets de verdade
no futuro não exige migração de save nenhuma.

**Bootstrap sem inundação.** `save.diorama` ausente (save novo OU save
antigo que nunca abriu o Diorama) → `garantirBootstrap()` semeia
`niveis`/`era` = estado ATUAL, sem gerar fila nenhuma. Só descobertas feitas
**depois** desse boot geram acontecimentos pendentes de verdade. Validado em
Chromium real com um save com o catálogo inteiro descoberto (ver seção 5).

**Idempotência.** `calcularAcontecimentosPendentes` só compara `niveis`
atuais com `niveis` persistidos — reload nunca reabre uma transformação já
mostrada, porque `visto` só avança depois que a fila termina de rodar
(`reproduzirPendentes` → `finally` → `store.setDiorama(...)`).

**IA isolada.** `familiaDoItem` devolve `null` pra qualquer item com
`item.ia === true` — essas descobertas nunca entram em `contagens`/`niveis`.
`temCriacoesIA` é só um booleano separado (`Object.keys(itensIA).length >
0`), usado pra mostrar/esconder o portal ✨ — nunca acelera nenhum limiar
canônico (testado explicitamente).

**Sequência curta mesmo com muito atraso.** Se o jogador ficar muito tempo
sem visitar (dezenas de marcos pendentes de uma vez), a camada de UI
(`agruparMarcosPorFamilia`, em `src/ui/diorama.js` — não no motor puro)
colapsa marcos consecutivos da MESMA família num único "beat" visual: no
máximo 1 transformação por família + 1 de era por visita, nunca uma fila de
dezenas de eventos de ~700ms cada.

## 4. Escopo do piloto (o que foi e não foi feito)

Feito: motor puro + testes, persistência mínima, overlay com ilha em
camadas (terreno/água/vegetação/vida/civilização/tecnologia + céu cósmico
no fundo), fila de acontecimentos com replay sequencial, indicador discreto
no HUD, distinção marco/era, isolamento de IA com portal próprio, toque com
reação + nome falado.

Não feito (conforme §11 do briefing): nenhum asset definitivo, sem redesign
do Álbum, sem mudança de combinação/raridade/fluxo de IA, sem editor de
mundo, sem geração procedural.

## 5. Validação

`npm test` — 393/393 (17 novos testes em `tests/diorama.test.js`:
classificação, limiares, determinismo, isolamento de IA, fila de
pendentes, idempotência, marco de era, save antigo). `npm run build` — ok.

Playwright (Chromium real), 375/768/1440, sem erros de console, sem overflow
horizontal em nenhum viewport:
- Diorama vazio (perfil recém-criado);
- Diorama pouco evoluído (níveis 1 em terreno/água/vegetação/vida) — ver
  screenshot, transformação de "vida" capturada em pleno pulso;
- Diorama evoluído (nível 4 em todas as famílias) — ver screenshots mobile/
  tablet/desktop;
- reabrir sem novo marco → legenda vazia, nada toca de novo (idempotência);
- indicador discreto: escondido → visível após 1 marco novo → escondido de
  novo só depois que a visita termina de reproduzir (não no clique);
- save "veterano" com o catálogo inteiro descoberto, mas que nunca abriu o
  Diorama → bootstrap silencioso, abre direto no nível 4 sem fila nenhuma;
- marco de era isolado: forçado via injeção de save, abre com "Uma nova era
  chegou ao seu mundo: Ficção!" antes de qualquer marco normal;
- portal de IA: aparece só com `itensIA` populado, toque mostra o texto
  correto, sem interferir nos níveis canônicos.

## 6. Assets que valerá a pena produzir (depois do piloto aprovado)

Nenhum obrigatório pra esta rodada — tudo em emoji/CSS. Prioridade sugerida
pra quando formos substituir por arte própria:

| Prioridade | Peça | Onde |
|---|---|---|
| Alta | Ilha-base (as 5 formas por "quantidade de vida" no terreno) | fundo da cena, substitui o blob CSS |
| Alta | 4 estágios de vegetação (broto→bosque) | camada vegetação |
| Alta | 4 estágios de água (poça→oceano) contornando a ilha | camada água |
| Média | Itens-herói literais (ver seção 2) sobrepostos no nível máximo de cada família | overlay pontual |
| Média | 4 estágios de civilização (fogueira→pequena vila) | camada civilização |
| Média | Sequência de "impacto suave" da Nova Era (partícula/onda) | transformação de era |
| Baixa | Ícone próprio do portal de criações da IA | portal ✨ |
| Baixa | 4 estágios de tecnologia | camada tecnologia |
