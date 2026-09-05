# Mistura! — Plano de Implementação: Núcleo Jogável

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o jogo Mistura! jogável offline — arrastar e fundir itens num canvas, drawer de descobertas com busca e filtro, e o destaque em tela cheia de cada item novo.

**Architecture:** Web puro com módulos ES, sem framework e sem etapa de build. Uma engine de módulos pequenos e testáveis (`slug`, `catalogo`, `storage`, `state`, `combinar`) guarda toda a lógica; os módulos de UI (`canvas`, `drawer`, `descoberta`) só desenham e disparam ações. O estado vive em `state.js` com pub/sub; a persistência é IndexedDB com fallback para `localStorage`. A camada de IA existe como interface e stub desligado.

**Tech Stack:** HTML + CSS + JavaScript (módulos ES). Testes: `node --test` (nativo). devDependencies: `fake-indexeddb`, `jsdom`. Sem dependências de runtime.

**Spec:** `docs/superpowers/specs/2026-09-05-mistura-jogo-design.md`

## Global Constraints

- Node >= 20.6 (necessário para `node --test --import`).
- Zero dependências de runtime no jogo. Apenas devDependencies: `fake-indexeddb`, `jsdom`.
- Sem etapa de build. `index.html` carrega `src/app.js` via `<script type="module">`.
- Todo texto de interface fica em `src/data/textos.js`. Nomes de item e `texto` de combo são pt_BR.
- `id` de item é sempre gerado por `slug()` e é estável depois de lançado.
- Chave de combo é simétrica: `[idA, idB].sort().join('+')`.
- Eras válidas, exatamente estas seis strings: `elementos`, `natureza`, `vida`, `tecnologia`, `cultura`, `ficcao`.
- Save tem `versao: 1` nesta fase.
- Combos curados têm `texto` obrigatório (uma frase curta pt_BR).
- Commits em Conventional Commits, assunto curto em pt_BR.

---

## Estrutura de arquivos (Plano 1)

| Arquivo | Responsabilidade |
|---|---|
| `package.json` | devDependencies + script `test` |
| `index.html` | Shell: área de canvas, drawer, botão limpar, ponto de montagem do overlay |
| `styles/base.css` | Reset, variáveis, layout raiz |
| `styles/canvas.css` | Canvas, instâncias, pan/zoom |
| `styles/drawer.css` | Painel, grade de cards, busca, chips |
| `styles/overlay.css` | Overlay de descoberta |
| `src/data/textos.js` | Todas as strings de UI (objeto `T`) |
| `src/data/itens.js` | Catálogo semente (~30 itens) — array `itens` |
| `src/data/combos.js` | Combos semente (~40) — array `combos` |
| `src/engine/slug.js` | `slug(nome)` |
| `src/engine/catalogo.js` | `criarCatalogo()`, `comboKey()`, `ERAS` |
| `src/engine/storage.js` | `carregar()`, `salvar()`, `saveInicial()`, `criarAgendadorSalvar()`, `VERSAO_ATUAL` |
| `src/engine/state.js` | `criarStore(save)` — pub/sub, instâncias, descobertas |
| `src/engine/combinar.js` | `criarCombinador({...})` |
| `src/ai/provider.js` | `stubDesligado`, `criarProviderEndpoint(url)` |
| `src/ui/descoberta.js` | `mostrarDescoberta({...})` |
| `src/ui/canvas.js` | `montarCanvas({...})` |
| `src/ui/drawer.js` | `montarDrawer({...})` |
| `src/app.js` | Liga tudo |
| `tests/_setup.js` | Globals de teste (fake-indexeddb + jsdom) |
| `tests/slug.test.js` | |
| `tests/catalogo.test.js` | |
| `tests/dados.test.js` | Integridade dos dados semente |
| `tests/storage.test.js` | |
| `tests/state.test.js` | |
| `tests/combinar.test.js` | |
| `tests/descoberta.test.js` | Smoke DOM |
| `tests/canvas.test.js` | Smoke DOM |
| `tests/drawer.test.js` | Smoke DOM |

---

### Task 1: Setup do projeto

**Files:**
- Create: `package.json`
- Create: `tests/_setup.js`
- Create: `index.html`
- Create: `styles/base.css`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nada.
- Produces: comando `npm test` roda `node --test --import ./tests/_setup.js tests/`. `tests/_setup.js` deixa disponíveis nos testes: `indexedDB` (fake), `window`, `document`, `navigator`, `localStorage`, `HTMLElement`, `Event`, `CustomEvent`, `AudioContext` (stub).

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "mistura",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20.6" },
  "scripts": {
    "test": "node --test --import ./tests/_setup.js tests/"
  },
  "devDependencies": {
    "fake-indexeddb": "^6.0.0",
    "jsdom": "^25.0.0"
  }
}
```

- [ ] **Step 2: Instalar devDependencies**

Run: `npm install`
Expected: cria `node_modules/` e `package-lock.json` sem erro.

- [ ] **Step 3: Criar `tests/_setup.js`**

```js
import 'fake-indexeddb/auto';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
});

function definir(nome, valor) {
  if (globalThis[nome] === undefined) {
    globalThis[nome] = valor;
  }
}

definir('window', dom.window);
definir('document', dom.window.document);
definir('navigator', dom.window.navigator);
definir('localStorage', dom.window.localStorage);
definir('HTMLElement', dom.window.HTMLElement);
definir('Event', dom.window.Event);
definir('CustomEvent', dom.window.CustomEvent);
definir('getComputedStyle', dom.window.getComputedStyle);

// AudioContext não existe em jsdom; stub silencioso para os testes de UI.
class AudioContextStub {
  constructor() {
    this.currentTime = 0;
    this.destination = {};
  }
  createOscillator() {
    return { connect() {}, start() {}, stop() {}, frequency: { value: 0 } };
  }
  createGain() {
    return {
      connect() {},
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    };
  }
}
definir('AudioContext', AudioContextStub);
```

- [ ] **Step 4: Criar `index.html`**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <title>Mistura!</title>
    <link rel="stylesheet" href="styles/base.css" />
    <link rel="stylesheet" href="styles/canvas.css" />
    <link rel="stylesheet" href="styles/drawer.css" />
    <link rel="stylesheet" href="styles/overlay.css" />
  </head>
  <body>
    <main id="jogo">
      <section id="canvas" class="canvas"></section>
      <button id="limpar" class="botao-limpar" type="button">Limpar canvas</button>
      <aside id="drawer" class="drawer"></aside>
    </main>
    <div id="overlay-raiz"></div>
    <script type="module" src="src/app.js"></script>
  </body>
</html>
```

- [ ] **Step 5: Criar `styles/base.css`**

```css
:root {
  --cor-fundo: #0e1726;
  --cor-canvas: #121d31;
  --cor-drawer: #0b1220;
  --cor-texto: #eaf0ff;
  --cor-borda: #24344f;
  --era-elementos: #4aa3ff;
  --era-natureza: #45c26b;
  --era-vida: #ff8a5c;
  --era-tecnologia: #b57cff;
  --era-cultura: #ffd25c;
  --era-ficcao: #ff5c8a;
}
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background: var(--cor-fundo);
  color: var(--cor-texto);
  overflow: hidden;
}
#jogo { position: relative; height: 100%; display: flex; }
.botao-limpar {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 5;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--cor-borda);
  background: #1b2942;
  color: var(--cor-texto);
  cursor: pointer;
}
```

- [ ] **Step 6: Criar `styles/canvas.css`, `styles/drawer.css`, `styles/overlay.css` como stubs**

`styles/canvas.css`:
```css
.canvas { position: relative; flex: 1; overflow: hidden; background: var(--cor-canvas); touch-action: none; }
.canvas-mundo { position: absolute; inset: 0; transform-origin: 0 0; }
.peca { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 8px; border-radius: 10px; background: #1b2942; border: 2px solid var(--cor-borda); cursor: grab; user-select: none; }
.peca .peca-icone { font-size: 28px; line-height: 1; }
.peca .peca-nome { font-size: 12px; }
.peca.arrastando { cursor: grabbing; opacity: 0.85; }
```

`styles/drawer.css`:
```css
.drawer { width: 280px; flex-shrink: 0; background: var(--cor-drawer); border-left: 1px solid var(--cor-borda); display: flex; flex-direction: column; }
.drawer-busca { margin: 10px; padding: 8px; border-radius: 8px; border: 1px solid var(--cor-borda); background: #0e1930; color: var(--cor-texto); }
.drawer-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 10px 10px; }
.drawer-chip { padding: 4px 8px; border-radius: 999px; border: 1px solid var(--cor-borda); background: transparent; color: var(--cor-texto); font-size: 12px; cursor: pointer; }
.drawer-chip[aria-pressed="true"] { background: #24344f; }
.drawer-contador { padding: 0 12px 8px; font-size: 12px; opacity: 0.7; }
.drawer-grade { flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 10px; }
.drawer-card { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px; border-radius: 10px; background: #16233c; border: 2px solid var(--cor-borda); cursor: grab; position: relative; }
.drawer-card .card-icone { font-size: 24px; }
.drawer-card .card-nome { font-size: 12px; text-align: center; }
.drawer-card[data-fonte="ia"]::after { content: "★"; position: absolute; top: 2px; right: 4px; font-size: 10px; color: var(--era-cultura); }
@media (max-width: 640px) {
  #jogo { flex-direction: column; }
  .drawer { width: auto; height: 44%; border-left: 0; border-top: 1px solid var(--cor-borda); }
  .drawer-grade { grid-template-columns: repeat(3, 1fr); }
}
```

`styles/overlay.css`:
```css
.descoberta-overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; background: rgba(4, 8, 16, 0.82); animation: aparecer 0.2s ease; }
@keyframes aparecer { from { opacity: 0; } to { opacity: 1; } }
.descoberta-cartao { text-align: center; max-width: 320px; padding: 24px; }
.descoberta-icone { font-size: 96px; line-height: 1; filter: drop-shadow(0 0 24px rgba(120, 180, 255, 0.8)); animation: pulsar 1s ease infinite alternate; }
img.descoberta-icone { width: 120px; height: 120px; }
@keyframes pulsar { from { transform: scale(1); } to { transform: scale(1.08); } }
.descoberta-selo { font-weight: 700; letter-spacing: 2px; color: var(--era-cultura); margin: 8px 0 0; }
.descoberta-nome { font-size: 28px; margin: 4px 0 8px; }
.descoberta-origem { opacity: 0.85; margin: 0 0 8px; }
.descoberta-texto { opacity: 0.9; }
.descoberta-fechar { margin-top: 16px; padding: 8px 16px; border-radius: 8px; border: 1px solid var(--cor-borda); background: #1b2942; color: var(--cor-texto); cursor: pointer; }
.icone-mini { width: 18px; height: 18px; vertical-align: middle; }
```

- [ ] **Step 7: Atualizar `.gitignore`**

```
node_modules/
.DS_Store
coverage/
```

- [ ] **Step 8: Rodar os testes (ainda sem casos)**

Run: `npm test`
Expected: `node --test` roda, encontra 0 testes, sai com código 0.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tests/_setup.js index.html styles/ .gitignore
git commit -m "chore: esqueleto do projeto e setup de testes"
```

---

### Task 2: `slug.js`

**Files:**
- Create: `src/engine/slug.js`
- Test: `tests/slug.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `slug(nome: string) -> string`. Minúsculas, sem acentos, `[^a-z0-9]` vira `-`, sem `-` nas pontas, sem `-` repetido.

- [ ] **Step 1: Escrever o teste que falha**

```js
// tests/slug.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { slug } from '../src/engine/slug.js';

test('minúsculas e espaços viram hífen', () => {
  assert.equal(slug('Homem Aranha'), 'homem-aranha');
});

test('remove acentos', () => {
  assert.equal(slug('Água'), 'agua');
  assert.equal(slug('Ação'), 'acao');
  assert.equal(slug('Pokémon'), 'pokemon');
});

test('colapsa separadores e apara as pontas', () => {
  assert.equal(slug('  Fogo +  Água  '), 'fogo-agua');
  assert.equal(slug('---teste---'), 'teste');
});

test('caracteres estranhos somem', () => {
  assert.equal(slug('C3PO!!! (robô)'), 'c3po-robo');
});

test('entrada não-string não quebra', () => {
  assert.equal(slug(123), '123');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test --import ./tests/_setup.js tests/slug.test.js`
Expected: FAIL — `Cannot find module '../src/engine/slug.js'`.

- [ ] **Step 3: Implementar**

```js
// src/engine/slug.js
export function slug(nome) {
  return String(nome)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test --import ./tests/_setup.js tests/slug.test.js`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/engine/slug.js tests/slug.test.js
git commit -m "feat: slug para gerar id de item a partir de nome pt_BR"
```

---

### Task 3: Dados semente

**Files:**
- Create: `src/data/textos.js`
- Create: `src/data/itens.js`
- Create: `src/data/combos.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `textos.js`: `export const T` — objeto com as chaves usadas pela UI: `seloNovo`, `fechar`, `buscar`, `contador(descobertos, total)`, `limparCanvas`, `confirmarLimpar`, `eras` (mapa era->rótulo), `nadaAconteceu`.
  - `itens.js`: `export const itens` — array de `{ id, nome, emoji, svg, era, base, ref }`.
  - `combos.js`: `export const combos` — array de `{ a, b, resultado, texto }`.

- [ ] **Step 1: Criar `src/data/textos.js`**

```js
export const T = {
  seloNovo: 'NOVO!',
  fechar: 'Fechar',
  buscar: 'Buscar descoberta...',
  limparCanvas: 'Limpar canvas',
  confirmarLimpar: 'Tirar tudo do canvas? As descobertas continuam na gaveta.',
  nadaAconteceu: 'Nada aconteceu...',
  contador: (descobertos, total) => `${descobertos} / ${total} descobertos`,
  eras: {
    elementos: 'Elementos',
    natureza: 'Natureza',
    vida: 'Vida',
    tecnologia: 'Tecnologia',
    cultura: 'Cultura',
    ficcao: 'Ficção',
  },
};
```

- [ ] **Step 2: Criar `src/data/itens.js`** (semente — todos com `svg: null` nesta fase)

```js
export const itens = [
  // elementos (base)
  { id: 'agua', nome: 'Água', emoji: '💧', svg: null, era: 'elementos', base: true, ref: null },
  { id: 'fogo', nome: 'Fogo', emoji: '🔥', svg: null, era: 'elementos', base: true, ref: null },
  { id: 'terra', nome: 'Terra', emoji: '🪨', svg: null, era: 'elementos', base: true, ref: null },
  { id: 'ar', nome: 'Ar', emoji: '💨', svg: null, era: 'elementos', base: true, ref: null },
  // elementos derivados
  { id: 'vapor', nome: 'Vapor', emoji: '♨️', svg: null, era: 'elementos', base: false, ref: null },
  { id: 'lava', nome: 'Lava', emoji: '🌋', svg: null, era: 'elementos', base: false, ref: null },
  { id: 'lama', nome: 'Lama', emoji: '🟤', svg: null, era: 'elementos', base: false, ref: null },
  { id: 'poeira', nome: 'Poeira', emoji: '🌫️', svg: null, era: 'elementos', base: false, ref: null },
  { id: 'energia', nome: 'Energia', emoji: '⚡', svg: null, era: 'elementos', base: false, ref: null },
  // natureza
  { id: 'pedra', nome: 'Pedra', emoji: '🪨', svg: null, era: 'natureza', base: false, ref: null },
  { id: 'chuva', nome: 'Chuva', emoji: '🌧️', svg: null, era: 'natureza', base: false, ref: null },
  { id: 'nuvem', nome: 'Nuvem', emoji: '☁️', svg: null, era: 'natureza', base: false, ref: null },
  { id: 'oceano', nome: 'Oceano', emoji: '🌊', svg: null, era: 'natureza', base: false, ref: null },
  { id: 'montanha', nome: 'Montanha', emoji: '⛰️', svg: null, era: 'natureza', base: false, ref: null },
  { id: 'planta', nome: 'Planta', emoji: '🌱', svg: null, era: 'natureza', base: false, ref: null },
  { id: 'arvore', nome: 'Árvore', emoji: '🌳', svg: null, era: 'natureza', base: false, ref: null },
  // vida
  { id: 'vida', nome: 'Vida', emoji: '🧬', svg: null, era: 'vida', base: false, ref: null },
  { id: 'bicho', nome: 'Bicho', emoji: '🐛', svg: null, era: 'vida', base: false, ref: null },
  { id: 'peixe', nome: 'Peixe', emoji: '🐟', svg: null, era: 'vida', base: false, ref: null },
  { id: 'passaro', nome: 'Pássaro', emoji: '🐦', svg: null, era: 'vida', base: false, ref: null },
  { id: 'humano', nome: 'Humano', emoji: '🧑', svg: null, era: 'vida', base: false, ref: null },
  // tecnologia
  { id: 'ferramenta', nome: 'Ferramenta', emoji: '🔨', svg: null, era: 'tecnologia', base: false, ref: null },
  { id: 'roda', nome: 'Roda', emoji: '🛞', svg: null, era: 'tecnologia', base: false, ref: null },
  { id: 'metal', nome: 'Metal', emoji: '⚙️', svg: null, era: 'tecnologia', base: false, ref: null },
  { id: 'eletricidade', nome: 'Eletricidade', emoji: '🔌', svg: null, era: 'tecnologia', base: false, ref: null },
  { id: 'robo', nome: 'Robô', emoji: '🤖', svg: null, era: 'tecnologia', base: false, ref: null },
  // cultura
  { id: 'cidade', nome: 'Cidade', emoji: '🏙️', svg: null, era: 'cultura', base: false, ref: null },
  { id: 'musica', nome: 'Música', emoji: '🎵', svg: null, era: 'cultura', base: false, ref: null },
  { id: 'historia', nome: 'História', emoji: '📖', svg: null, era: 'cultura', base: false, ref: null },
  // ficcao
  { id: 'heroi', nome: 'Herói', emoji: '🦸', svg: null, era: 'ficcao', base: false, ref: null },
  { id: 'teia', nome: 'Teia', emoji: '🕸️', svg: null, era: 'ficcao', base: false, ref: null },
  { id: 'aranha', nome: 'Aranha', emoji: '🕷️', svg: null, era: 'ficcao', base: false, ref: null },
  { id: 'homem-aranha', nome: 'Homem-Aranha', emoji: '🕷️', svg: null, era: 'ficcao', base: false, ref: 'homem-aranha' },
  { id: 'raio-eletrico', nome: 'Raio Elétrico', emoji: '🌩️', svg: null, era: 'ficcao', base: false, ref: null },
  { id: 'pikachu', nome: 'Pikachu', emoji: '⚡', svg: null, era: 'ficcao', base: false, ref: 'pokemon' },
];
```

- [ ] **Step 3: Criar `src/data/combos.js`** (todo `resultado`/`a`/`b` referencia um `id` acima)

```js
export const combos = [
  { a: 'agua', b: 'fogo', resultado: 'vapor', texto: 'Água quente vira vapor.' },
  { a: 'fogo', b: 'terra', resultado: 'lava', texto: 'A terra derrete com muito calor e vira lava.' },
  { a: 'agua', b: 'terra', resultado: 'lama', texto: 'Terra molhada vira lama.' },
  { a: 'ar', b: 'terra', resultado: 'poeira', texto: 'O vento levanta a terra seca em poeira.' },
  { a: 'ar', b: 'fogo', resultado: 'energia', texto: 'Ar e fogo juntos soltam energia.' },
  { a: 'ar', b: 'vapor', resultado: 'nuvem', texto: 'O vapor sobe e forma uma nuvem.' },
  { a: 'agua', b: 'nuvem', resultado: 'chuva', texto: 'A nuvem fica pesada e cai como chuva.' },
  { a: 'agua', b: 'agua', resultado: 'oceano', texto: 'Muita água junta forma o oceano.' },
  { a: 'lava', b: 'ar', resultado: 'pedra', texto: 'A lava esfria no ar e vira pedra.' },
  { a: 'pedra', b: 'pedra', resultado: 'montanha', texto: 'Pedra sobre pedra forma uma montanha.' },
  { a: 'chuva', b: 'terra', resultado: 'planta', texto: 'A chuva na terra faz a planta brotar.' },
  { a: 'planta', b: 'terra', resultado: 'arvore', texto: 'A planta cresce e vira uma árvore.' },
  { a: 'agua', b: 'energia', resultado: 'vida', texto: 'Energia na água acende a primeira vida.' },
  { a: 'vida', b: 'terra', resultado: 'bicho', texto: 'A vida na terra vira um bichinho.' },
  { a: 'vida', b: 'oceano', resultado: 'peixe', texto: 'A vida no oceano vira peixe.' },
  { a: 'bicho', b: 'ar', resultado: 'passaro', texto: 'O bicho ganha asas e voa como pássaro.' },
  { a: 'bicho', b: 'historia', resultado: 'humano', texto: 'O bicho aprende e conta histórias: é o humano.' },
  { a: 'vida', b: 'pedra', resultado: 'historia', texto: 'A vida deixa marcas na pedra: começa a história.' },
  { a: 'humano', b: 'pedra', resultado: 'ferramenta', texto: 'O humano lascou a pedra e fez uma ferramenta.' },
  { a: 'ferramenta', b: 'arvore', resultado: 'roda', texto: 'Com ferramenta e madeira, nasce a roda.' },
  { a: 'fogo', b: 'pedra', resultado: 'metal', texto: 'O fogo forte tira o metal da pedra.' },
  { a: 'energia', b: 'metal', resultado: 'eletricidade', texto: 'Energia correndo no metal vira eletricidade.' },
  { a: 'eletricidade', b: 'ferramenta', resultado: 'robo', texto: 'Ferramentas com eletricidade montam um robô.' },
  { a: 'humano', b: 'humano', resultado: 'cidade', texto: 'Muitos humanos juntos constroem uma cidade.' },
  { a: 'humano', b: 'passaro', resultado: 'musica', texto: 'O humano imita o canto do pássaro e faz música.' },
  { a: 'humano', b: 'historia', resultado: 'heroi', texto: 'As histórias inventam um herói.' },
  { a: 'aranha', b: 'teia', resultado: 'teia', texto: 'A aranha sempre tece mais teia.' },
  { a: 'bicho', b: 'teia', resultado: 'aranha', texto: 'O bicho que faz teia é a aranha.' },
  { a: 'heroi', b: 'aranha', resultado: 'homem-aranha', texto: 'Um herói picado por aranha: o Homem-Aranha!' },
  { a: 'homem-aranha', b: 'cidade', resultado: 'teia', texto: 'O Homem-Aranha balança pela cidade soltando teia.' },
  { a: 'energia', b: 'ar', resultado: 'raio-eletrico', texto: 'Energia no ar vira um raio elétrico.' },
  { a: 'bicho', b: 'raio-eletrico', resultado: 'pikachu', texto: 'Um bichinho cheio de eletricidade: o Pikachu!' },
  { a: 'pikachu', b: 'eletricidade', resultado: 'raio-eletrico', texto: 'O Pikachu solta um trovão.' },
  { a: 'roda', b: 'metal', resultado: 'cidade', texto: 'Rodas e metal levam gente e coisas: a cidade cresce.' },
  { a: 'nuvem', b: 'energia', resultado: 'raio-eletrico', texto: 'Energia na nuvem desce como raio.' },
  { a: 'oceano', b: 'fogo', resultado: 'vapor', texto: 'O fogo no oceano levanta muito vapor.' },
  { a: 'montanha', b: 'fogo', resultado: 'lava', texto: 'A montanha acorda como vulcão e escorre lava.' },
  { a: 'arvore', b: 'ferramenta', resultado: 'historia', texto: 'Da madeira sai o papel onde a história é escrita.' },
  { a: 'humano', b: 'metal', resultado: 'ferramenta', texto: 'O humano molda o metal em ferramentas melhores.' },
  { a: 'robo', b: 'historia', resultado: 'heroi', texto: 'Nas histórias, até um robô vira herói.' },
];
```

- [ ] **Step 4: Conferência rápida manual**

Run: `node -e "import('./src/data/itens.js').then(m=>console.log(m.itens.length)); import('./src/data/combos.js').then(m=>console.log(m.combos.length));"`
Expected: imprime `35` e `40` (ou os números atuais dos arrays). Sem erro de sintaxe.

- [ ] **Step 5: Commit**

```bash
git add src/data/
git commit -m "feat: dados semente (itens, combos, textos) em pt_BR"
```

---

### Task 4: `catalogo.js`

**Files:**
- Create: `src/engine/catalogo.js`
- Test: `tests/catalogo.test.js`

**Interfaces:**
- Consumes: `itens` de `src/data/itens.js`, `combos` de `src/data/combos.js`, `slug` de `src/engine/slug.js`.
- Produces:
  - `export const ERAS` — `['elementos','natureza','vida','tecnologia','cultura','ficcao']`.
  - `export function comboKey(idA, idB) -> string` — `[idA, idB].sort().join('+')`.
  - `export function criarCatalogo() -> catalogo` com:
    - `getItem(id) -> item | undefined`
    - `allItems() -> item[]`
    - `baseItems() -> item[]` (só `base === true`)
    - `findCombo(idA, idB) -> combo | undefined` (normaliza internamente)
    - `registrarItemIA({ nome, emoji, era }) -> item` — id via `slug(nome)`; se já existe, devolve o existente; `era` inválida cai em `'ficcao'`; `emoji` ausente vira `'✨'`; `base: false`, `ref: null`, `svg: null`.
    - `registrarComboIA(idA, idB, resultadoId, texto) -> void`

- [ ] **Step 1: Escrever o teste que falha**

```js
// tests/catalogo.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo, comboKey, ERAS } from '../src/engine/catalogo.js';

test('comboKey é simétrica', () => {
  assert.equal(comboKey('fogo', 'agua'), comboKey('agua', 'fogo'));
  assert.equal(comboKey('agua', 'fogo'), 'agua+fogo');
});

test('getItem e baseItems', () => {
  const cat = criarCatalogo();
  assert.equal(cat.getItem('agua').nome, 'Água');
  assert.equal(cat.getItem('nao-existe'), undefined);
  assert.ok(cat.baseItems().every((it) => it.base === true));
  assert.ok(cat.baseItems().length >= 4);
});

test('findCombo acha nos dois sentidos', () => {
  const cat = criarCatalogo();
  assert.equal(cat.findCombo('agua', 'fogo').resultado, 'vapor');
  assert.equal(cat.findCombo('fogo', 'agua').resultado, 'vapor');
  assert.equal(cat.findCombo('agua', 'agua').resultado, 'oceano');
  assert.equal(cat.findCombo('agua', 'robo'), undefined);
});

test('registrarItemIA cria e não duplica', () => {
  const cat = criarCatalogo();
  const a = cat.registrarItemIA({ nome: 'Dragão de Gelo', emoji: '🐉' });
  assert.equal(a.id, 'dragao-de-gelo');
  assert.equal(a.era, 'ficcao');
  assert.equal(a.base, false);
  const b = cat.registrarItemIA({ nome: 'Dragão de Gelo', emoji: '❄️' });
  assert.equal(b, a);
  assert.equal(cat.getItem('dragao-de-gelo'), a);
});

test('registrarItemIA sem emoji e era inválida', () => {
  const cat = criarCatalogo();
  const it = cat.registrarItemIA({ nome: 'Coisa', era: 'inventada' });
  assert.equal(it.emoji, '✨');
  assert.equal(it.era, 'ficcao');
});

test('registrarComboIA fica disponível em findCombo', () => {
  const cat = criarCatalogo();
  cat.registrarItemIA({ nome: 'Gelo', emoji: '🧊' });
  cat.registrarComboIA('agua', 'ar', 'gelo', 'Ar muito frio congela a água.');
  assert.equal(cat.findCombo('ar', 'agua').resultado, 'gelo');
});

test('ERAS tem as seis eras', () => {
  assert.deepEqual(ERAS, ['elementos', 'natureza', 'vida', 'tecnologia', 'cultura', 'ficcao']);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test --import ./tests/_setup.js tests/catalogo.test.js`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```js
// src/engine/catalogo.js
import { itens as itensBase } from '../data/itens.js';
import { combos as combosBase } from '../data/combos.js';
import { slug } from './slug.js';

export const ERAS = ['elementos', 'natureza', 'vida', 'tecnologia', 'cultura', 'ficcao'];

export function comboKey(idA, idB) {
  return [idA, idB].sort().join('+');
}

export function criarCatalogo() {
  const itens = new Map(itensBase.map((it) => [it.id, { ...it }]));
  const combos = new Map();
  for (const c of combosBase) {
    combos.set(comboKey(c.a, c.b), { ...c });
  }

  return {
    getItem: (id) => itens.get(id),
    allItems: () => [...itens.values()],
    baseItems: () => [...itens.values()].filter((it) => it.base === true),
    findCombo: (idA, idB) => combos.get(comboKey(idA, idB)),
    registrarItemIA({ nome, emoji, era } = {}) {
      const id = slug(nome);
      const existente = itens.get(id);
      if (existente) return existente;
      const novo = {
        id,
        nome: String(nome),
        emoji: emoji || '✨',
        svg: null,
        era: ERAS.includes(era) ? era : 'ficcao',
        base: false,
        ref: null,
      };
      itens.set(id, novo);
      return novo;
    },
    registrarComboIA(idA, idB, resultadoId, texto) {
      combos.set(comboKey(idA, idB), { a: idA, b: idB, resultado: resultadoId, texto });
    },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test --import ./tests/_setup.js tests/catalogo.test.js`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add src/engine/catalogo.js tests/catalogo.test.js
git commit -m "feat: catalogo de itens e combos com registro de itens da IA"
```

---

### Task 5: Testes de integridade dos dados

**Files:**
- Test: `tests/dados.test.js`

**Interfaces:**
- Consumes: `criarCatalogo`, `comboKey` de `src/engine/catalogo.js`; `itens`, `combos` dos dados.
- Produces: nenhuma API nova — trava a qualidade dos dados semente e de qualquer expansão futura.

- [ ] **Step 1: Escrever os testes**

```js
// tests/dados.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { itens } from '../src/data/itens.js';
import { combos } from '../src/data/combos.js';
import { criarCatalogo, comboKey, ERAS } from '../src/engine/catalogo.js';

test('todo id de item é único', () => {
  const vistos = new Set();
  for (const it of itens) {
    assert.ok(!vistos.has(it.id), `id repetido: ${it.id}`);
    vistos.add(it.id);
  }
});

test('todo item tem os campos obrigatórios e era válida', () => {
  for (const it of itens) {
    assert.equal(typeof it.id, 'string');
    assert.ok(it.nome, `sem nome: ${it.id}`);
    assert.ok(it.emoji || it.svg, `sem ícone: ${it.id}`);
    assert.ok(ERAS.includes(it.era), `era inválida em ${it.id}: ${it.era}`);
    assert.equal(typeof it.base, 'boolean');
  }
});

test('todo a/b/resultado de combo existe em itens', () => {
  const cat = criarCatalogo();
  for (const c of combos) {
    assert.ok(cat.getItem(c.a), `combo com 'a' inexistente: ${c.a}`);
    assert.ok(cat.getItem(c.b), `combo com 'b' inexistente: ${c.b}`);
    assert.ok(cat.getItem(c.resultado), `combo com resultado inexistente: ${c.resultado}`);
  }
});

test('todo combo curado tem texto não vazio', () => {
  for (const c of combos) {
    assert.ok(c.texto && c.texto.trim().length > 0, `combo sem texto: ${c.a}+${c.b}`);
  }
});

test('não há duas entradas para a mesma chave de combo', () => {
  const vistos = new Set();
  for (const c of combos) {
    const k = comboKey(c.a, c.b);
    assert.ok(!vistos.has(k), `chave de combo repetida: ${k}`);
    vistos.add(k);
  }
});

test('todo item não-base é alcançável a partir dos itens base', () => {
  const cat = criarCatalogo();
  const alcancavel = new Set(cat.baseItems().map((it) => it.id));
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const c of combos) {
      if (alcancavel.has(c.a) && alcancavel.has(c.b) && !alcancavel.has(c.resultado)) {
        alcancavel.add(c.resultado);
        mudou = true;
      }
    }
  }
  const inalcancaveis = cat.allItems()
    .filter((it) => !it.base && !alcancavel.has(it.id))
    .map((it) => it.id);
  assert.deepEqual(inalcancaveis, [], `itens inalcançáveis: ${inalcancaveis.join(', ')}`);
});

test('todo caminho de svg declarado aponta para arquivo existente', async () => {
  const { existsSync } = await import('node:fs');
  for (const it of itens) {
    if (it.svg) {
      assert.ok(existsSync(it.svg), `svg ausente: ${it.svg} (item ${it.id})`);
    }
  }
});
```

- [ ] **Step 2: Rodar**

Run: `node --test --import ./tests/_setup.js tests/dados.test.js`
Expected: PASS (7 testes). Se "itens inalcançáveis" aparecer, adicionar um combo em `src/data/combos.js` que produza aquele item a partir de itens já alcançáveis, e rodar de novo.

- [ ] **Step 3: Commit**

```bash
git add tests/dados.test.js
git commit -m "test: integridade dos dados (referências, unicidade, alcançabilidade)"
```

---

### Task 6: `storage.js`

**Files:**
- Create: `src/engine/storage.js`
- Test: `tests/storage.test.js`

**Interfaces:**
- Consumes: `indexedDB` global (fake nos testes), `localStorage` global, `catalogo` (para `saveInicial`).
- Produces:
  - `export const VERSAO_ATUAL = 1`
  - `export function saveInicial(catalogo) -> save` — `descobertos` com todo item base já marcado (`fonte: 'base'`, `via: null`), `canvas: []`, `ajustes: { som: true, iaLigada: false }`.
  - `export async function carregar(catalogo) -> save` — lê do IndexedDB (ou `localStorage`), aplica migrações; se não há save, devolve `saveInicial(catalogo)`.
  - `export async function salvar(save) -> void`
  - `export function criarAgendadorSalvar(getSave, ms = 400) -> () => void` — debounce que chama `salvar(getSave())`.

- [ ] **Step 1: Escrever os testes que falham**

```js
// tests/storage.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { criarCatalogo } from '../src/engine/catalogo.js';
import {
  saveInicial, carregar, salvar, criarAgendadorSalvar, VERSAO_ATUAL,
} from '../src/engine/storage.js';

function resetDB() {
  globalThis.indexedDB = new IDBFactory();
  globalThis.localStorage.clear();
}

test('saveInicial marca todos os itens base como descobertos', () => {
  const cat = criarCatalogo();
  const s = saveInicial(cat);
  assert.equal(s.versao, VERSAO_ATUAL);
  assert.deepEqual(s.canvas, []);
  assert.equal(s.ajustes.som, true);
  assert.equal(s.ajustes.iaLigada, false);
  for (const it of cat.baseItems()) {
    assert.ok(s.descobertos[it.id], `base não descoberto: ${it.id}`);
    assert.equal(s.descobertos[it.id].via, null);
    assert.equal(s.descobertos[it.id].fonte, 'base');
  }
});

test('carregar sem save devolve o inicial', async () => {
  resetDB();
  const cat = criarCatalogo();
  const s = await carregar(cat);
  assert.ok(s.descobertos.agua);
});

test('salvar e carregar preservam o estado (IndexedDB)', async () => {
  resetDB();
  const cat = criarCatalogo();
  const s = saveInicial(cat);
  s.descobertos.vapor = { em: 123, via: ['agua', 'fogo'], fonte: 'local' };
  s.canvas.push({ uid: 'u_1', id: 'agua', x: 10, y: 20 });
  await salvar(s);
  const lido = await carregar(cat);
  assert.deepEqual(lido.descobertos.vapor, { em: 123, via: ['agua', 'fogo'], fonte: 'local' });
  assert.deepEqual(lido.canvas, [{ uid: 'u_1', id: 'agua', x: 10, y: 20 }]);
});

test('fallback para localStorage quando não há indexedDB', async () => {
  resetDB();
  const semIDB = globalThis.indexedDB;
  globalThis.indexedDB = undefined;
  try {
    const cat = criarCatalogo();
    const s = saveInicial(cat);
    s.descobertos.lama = { em: 9, via: ['agua', 'terra'], fonte: 'local' };
    await salvar(s);
    const lido = await carregar(cat);
    assert.ok(lido.descobertos.lama);
  } finally {
    globalThis.indexedDB = semIDB;
  }
});

test('carregar aplica migração de versão antiga', async () => {
  resetDB();
  const cat = criarCatalogo();
  const antigo = { versao: 0, descobertos: {}, canvas: [], ajustes: {} };
  globalThis.localStorage.clear();
  globalThis.indexedDB = undefined;
  await salvar(antigo);
  const lido = await carregar(cat);
  assert.equal(lido.versao, VERSAO_ATUAL);
  globalThis.indexedDB = new IDBFactory();
});

test('agendador de salvar faz debounce', async () => {
  resetDB();
  let chamadas = 0;
  const orig = globalThis.indexedDB;
  globalThis.indexedDB = undefined;
  const save = { versao: VERSAO_ATUAL, descobertos: {}, canvas: [], ajustes: {} };
  const agendar = criarAgendadorSalvar(() => {
    chamadas += 1;
    return save;
  }, 50);
  agendar(); agendar(); agendar();
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(chamadas, 1);
  globalThis.indexedDB = orig;
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test --import ./tests/_setup.js tests/storage.test.js`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```js
// src/engine/storage.js
const DB_NOME = 'mistura';
const STORE = 'save';
const CHAVE = 'principal';
export const VERSAO_ATUAL = 1;

function temIndexedDB() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function abrir() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function lerCru() {
  if (!temIndexedDB()) {
    const txt = localStorage.getItem(DB_NOME);
    return txt ? JSON.parse(txt) : null;
  }
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(CHAVE);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function escreverCru(save) {
  if (!temIndexedDB()) {
    localStorage.setItem(DB_NOME, JSON.stringify(save));
    return;
  }
  const db = await abrir();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(save, CHAVE);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function saveInicial(catalogo) {
  const agora = Date.now();
  const descobertos = {};
  for (const it of catalogo.baseItems()) {
    descobertos[it.id] = { em: agora, via: null, fonte: 'base' };
  }
  return {
    versao: VERSAO_ATUAL,
    descobertos,
    canvas: [],
    ajustes: { som: true, iaLigada: false },
  };
}

// Migrações futuras: chave = versão de origem, valor = fn(save) -> save na versão seguinte.
const MIGRACOES = {};

function migrar(save) {
  let atual = save;
  while ((atual.versao ?? 0) < VERSAO_ATUAL) {
    const fn = MIGRACOES[atual.versao ?? 0];
    if (!fn) {
      atual.versao = VERSAO_ATUAL;
      if (!atual.ajustes) atual.ajustes = { som: true, iaLigada: false };
      break;
    }
    atual = fn(atual);
  }
  return atual;
}

export async function carregar(catalogo) {
  const cru = await lerCru();
  if (!cru) return saveInicial(catalogo);
  return migrar(cru);
}

export async function salvar(save) {
  await escreverCru(save);
}

export function criarAgendadorSalvar(getSave, ms = 400) {
  let t = null;
  return () => {
    clearTimeout(t);
    t = setTimeout(() => {
      Promise.resolve(salvar(getSave())).catch(() => {});
    }, ms);
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test --import ./tests/_setup.js tests/storage.test.js`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/engine/storage.js tests/storage.test.js
git commit -m "feat: persistencia com IndexedDB, fallback localStorage e migracao"
```

---

### Task 7: `state.js`

**Files:**
- Create: `src/engine/state.js`
- Test: `tests/state.test.js`

**Interfaces:**
- Consumes: um objeto `save` (de `storage.carregar`).
- Produces: `export function criarStore(save) -> store` com:
  - `on(evento, fn) -> desinscrever()`
  - `getSave() -> save` (referência viva; leitura)
  - `isDiscovered(id) -> boolean`
  - `listInstances() -> instancia[]` (cópia rasa do array)
  - `getInstance(uid) -> instancia | undefined`
  - `addInstance(id, x, y) -> instancia` (`{ uid, id, x, y }`); emite `instancia:criada`
  - `moveInstance(uid, x, y) -> void`; emite `instancia:movida`
  - `removeInstance(uid) -> void`; emite `instancia:removida`
  - `clearInstances() -> void`; emite `canvas:limpo`
  - `recordDiscovery(id, via, fonte) -> boolean` (true se era nova); emite `descoberta:nova` com `{ id, via, fonte }`
  - `setAjuste(chave, valor) -> void`; emite `ajuste:mudou`
  - Todo evento acima também dispara `estado:mudou` (usado pelo agendador de salvar).

- [ ] **Step 1: Escrever os testes que falham**

```js
// tests/state.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarStore } from '../src/engine/state.js';

function saveVazio() {
  return { versao: 1, descobertos: { agua: { em: 1, via: null, fonte: 'base' } },
    canvas: [], ajustes: { som: true, iaLigada: false } };
}

test('addInstance cria com uid único e emite evento', () => {
  const store = criarStore(saveVazio());
  const vistos = [];
  store.on('instancia:criada', (i) => vistos.push(i));
  const a = store.addInstance('agua', 10, 20);
  const b = store.addInstance('agua', 30, 40);
  assert.notEqual(a.uid, b.uid);
  assert.equal(store.listInstances().length, 2);
  assert.equal(vistos.length, 2);
});

test('moveInstance e removeInstance', () => {
  const store = criarStore(saveVazio());
  const a = store.addInstance('agua', 0, 0);
  store.moveInstance(a.uid, 99, 88);
  assert.deepEqual(
    [store.getInstance(a.uid).x, store.getInstance(a.uid).y], [99, 88],
  );
  let removida = null;
  store.on('instancia:removida', (i) => { removida = i; });
  store.removeInstance(a.uid);
  assert.equal(store.getInstance(a.uid), undefined);
  assert.equal(removida.uid, a.uid);
});

test('recordDiscovery só conta a primeira vez', () => {
  const store = criarStore(saveVazio());
  const eventos = [];
  store.on('descoberta:nova', (d) => eventos.push(d));
  assert.equal(store.isDiscovered('vapor'), false);
  assert.equal(store.recordDiscovery('vapor', ['agua', 'fogo'], 'local'), true);
  assert.equal(store.isDiscovered('vapor'), true);
  assert.equal(store.recordDiscovery('vapor', ['agua', 'fogo'], 'local'), false);
  assert.equal(eventos.length, 1);
  assert.deepEqual(eventos[0], { id: 'vapor', via: ['agua', 'fogo'], fonte: 'local' });
});

test('clearInstances esvazia o canvas mas não as descobertas', () => {
  const store = criarStore(saveVazio());
  store.addInstance('agua', 1, 1);
  store.recordDiscovery('vapor', ['agua', 'fogo'], 'local');
  store.clearInstances();
  assert.equal(store.listInstances().length, 0);
  assert.equal(store.isDiscovered('vapor'), true);
});

test('todo evento também dispara estado:mudou', () => {
  const store = criarStore(saveVazio());
  let contador = 0;
  store.on('estado:mudou', () => { contador += 1; });
  store.addInstance('agua', 0, 0);
  store.setAjuste('som', false);
  assert.ok(contador >= 2);
  assert.equal(store.getSave().ajustes.som, false);
});

test('on devolve função para desinscrever', () => {
  const store = criarStore(saveVazio());
  let n = 0;
  const off = store.on('instancia:criada', () => { n += 1; });
  store.addInstance('agua', 0, 0);
  off();
  store.addInstance('agua', 1, 1);
  assert.equal(n, 1);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test --import ./tests/_setup.js tests/state.test.js`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```js
// src/engine/state.js
export function criarStore(save) {
  const ouvintes = new Map();
  let uidSeq = 0;

  function on(evento, fn) {
    if (!ouvintes.has(evento)) ouvintes.set(evento, new Set());
    ouvintes.get(evento).add(fn);
    return () => ouvintes.get(evento)?.delete(fn);
  }

  function emit(evento, dados) {
    for (const fn of ouvintes.get(evento) ?? []) fn(dados);
    if (evento !== 'estado:mudou') {
      emit('estado:mudou', { evento, dados });
    }
  }

  function novoUid() {
    uidSeq += 1;
    return `u_${Date.now().toString(36)}_${uidSeq}`;
  }

  return {
    on,
    getSave: () => save,
    isDiscovered: (id) => Boolean(save.descobertos[id]),
    listInstances: () => save.canvas.slice(),
    getInstance: (uid) => save.canvas.find((i) => i.uid === uid),

    addInstance(id, x, y) {
      const inst = { uid: novoUid(), id, x, y };
      save.canvas.push(inst);
      emit('instancia:criada', inst);
      return inst;
    },

    moveInstance(uid, x, y) {
      const inst = save.canvas.find((i) => i.uid === uid);
      if (!inst) return;
      inst.x = x;
      inst.y = y;
      emit('instancia:movida', inst);
    },

    removeInstance(uid) {
      const idx = save.canvas.findIndex((i) => i.uid === uid);
      if (idx === -1) return;
      const [inst] = save.canvas.splice(idx, 1);
      emit('instancia:removida', inst);
    },

    clearInstances() {
      save.canvas = [];
      emit('canvas:limpo', null);
    },

    recordDiscovery(id, via, fonte) {
      if (save.descobertos[id]) return false;
      save.descobertos[id] = { em: Date.now(), via: via ?? null, fonte };
      emit('descoberta:nova', { id, via: via ?? null, fonte });
      return true;
    },

    setAjuste(chave, valor) {
      save.ajustes[chave] = valor;
      emit('ajuste:mudou', { chave, valor });
    },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test --import ./tests/_setup.js tests/state.test.js`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/engine/state.js tests/state.test.js
git commit -m "feat: store de estado com pub/sub, instancias e descobertas"
```

---

### Task 8: `ai/provider.js`

**Files:**
- Create: `src/ai/provider.js`
- Test: `tests/provider.test.js`

**Interfaces:**
- Consumes: `fetch` global (só em `criarProviderEndpoint`, não exercitado nesta fase).
- Produces:
  - `export const stubDesligado` — `{ async sugerirCombo() { return null; } }`.
  - `export function criarProviderEndpoint(url) -> provider` com `async sugerirCombo(itemA, itemB) -> { resultadoNome, emoji, texto } | null`. **Não é ligado no app nesta fase**; existe para a fase 2. Faz `POST` com `{ a: itemA.nome, b: itemB.nome }`, timeout de 8s, devolve `null` em erro/resposta inválida.

- [ ] **Step 1: Escrever os testes**

```js
// tests/provider.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { stubDesligado, criarProviderEndpoint } from '../src/ai/provider.js';

test('stub desligado sempre devolve null', async () => {
  assert.equal(await stubDesligado.sugerirCombo({ nome: 'A' }, { nome: 'B' }), null);
});

test('provider de endpoint normaliza a resposta', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ resultadoNome: 'Gelo', emoji: '🧊', texto: 'Ar frio congela.' }),
  });
  try {
    const p = criarProviderEndpoint('/api/combinar');
    const r = await p.sugerirCombo({ nome: 'Água' }, { nome: 'Ar' });
    assert.deepEqual(r, { resultadoNome: 'Gelo', emoji: '🧊', texto: 'Ar frio congela.' });
  } finally {
    globalThis.fetch = orig;
  }
});

test('provider de endpoint devolve null em resposta ruim', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
  try {
    const p = criarProviderEndpoint('/api/combinar');
    assert.equal(await p.sugerirCombo({ nome: 'A' }, { nome: 'B' }), null);
  } finally {
    globalThis.fetch = orig;
  }
});

test('provider de endpoint devolve null quando fetch falha', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('rede'); };
  try {
    const p = criarProviderEndpoint('/api/combinar');
    assert.equal(await p.sugerirCombo({ nome: 'A' }, { nome: 'B' }), null);
  } finally {
    globalThis.fetch = orig;
  }
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test --import ./tests/_setup.js tests/provider.test.js`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```js
// src/ai/provider.js
//
// Camada de IA. Nesta fase o app usa SEMPRE `stubDesligado`.
// `criarProviderEndpoint` fica pronto e documentado para a fase 2,
// quando existir um endpoint /api/combinar com guard-rails
// (prompt family-friendly fixo, lista de bloqueio, resposta pt_BR,
// timeout, fallback "nada aconteceu").

export const stubDesligado = {
  async sugerirCombo() {
    return null;
  },
};

export function criarProviderEndpoint(url) {
  return {
    async sugerirCombo(itemA, itemB) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ a: itemA.nome, b: itemB.nome }),
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) return null;
        const dados = await resp.json();
        if (!dados || !dados.resultadoNome) return null;
        return {
          resultadoNome: String(dados.resultadoNome),
          emoji: dados.emoji ? String(dados.emoji) : '✨',
          texto: String(dados.texto || ''),
        };
      } catch {
        return null;
      }
    },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test --import ./tests/_setup.js tests/provider.test.js`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/ai/provider.js tests/provider.test.js
git commit -m "feat: interface de IA com stub desligado e provider de endpoint (fase 2)"
```

---

### Task 9: `combinar.js`

**Files:**
- Create: `src/engine/combinar.js`
- Test: `tests/combinar.test.js`

**Interfaces:**
- Consumes: `catalogo` (Task 4), `aiProvider` (Task 8), `estaOnline: () => boolean`.
- Produces: `export function criarCombinador({ catalogo, aiProvider, estaOnline }) -> combinar`.
  - `combinar(idA, idB) -> Promise<Resultado>`
  - `Resultado` = `{ tipo: 'ok', item, combo, fonte }` (`fonte`: `'local'` | `'ia'`) **ou** `{ tipo: 'nada' }`.
  - Ordem: 1) `catalogo.findCombo` → `fonte: 'local'`. 2) senão, se `aiProvider && estaOnline()` → `aiProvider.sugerirCombo(itemA, itemB)`; se vier `{ resultadoNome, emoji, texto }`, registra item e combo no catálogo, devolve `fonte: 'ia'`. 3) senão → `{ tipo: 'nada' }`.
  - A decisão "é descoberta nova" NÃO é feita aqui — quem chama compara com `store.isDiscovered(item.id)`.

- [ ] **Step 1: Escrever os testes que falham**

```js
// tests/combinar.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo } from '../src/engine/catalogo.js';
import { criarCombinador } from '../src/engine/combinar.js';
import { stubDesligado } from '../src/ai/provider.js';

test('combo local é encontrado nos dois sentidos', async () => {
  const cat = criarCatalogo();
  const combinar = criarCombinador({
    catalogo: cat, aiProvider: stubDesligado, estaOnline: () => false,
  });
  const r1 = await combinar('agua', 'fogo');
  const r2 = await combinar('fogo', 'agua');
  assert.equal(r1.tipo, 'ok');
  assert.equal(r1.fonte, 'local');
  assert.equal(r1.item.id, 'vapor');
  assert.equal(r1.combo.texto, r2.combo.texto);
});

test('sem combo e offline devolve nada', async () => {
  const cat = criarCatalogo();
  const combinar = criarCombinador({
    catalogo: cat, aiProvider: stubDesligado, estaOnline: () => false,
  });
  assert.deepEqual(await combinar('robo', 'musica'), { tipo: 'nada' });
});

test('sem combo, online e IA sugere: cria item e combo com fonte ia', async () => {
  const cat = criarCatalogo();
  const aiProvider = {
    async sugerirCombo() {
      return { resultadoNome: 'Robô Musical', emoji: '🎸', texto: 'Um robô que toca música.' };
    },
  };
  const combinar = criarCombinador({ catalogo: cat, aiProvider, estaOnline: () => true });
  const r = await combinar('robo', 'musica');
  assert.equal(r.tipo, 'ok');
  assert.equal(r.fonte, 'ia');
  assert.equal(r.item.id, 'robo-musical');
  assert.equal(r.item.emoji, '🎸');
  assert.equal(r.combo.texto, 'Um robô que toca música.');
  // registrado: repetir acha como local
  const r2 = await combinar('musica', 'robo');
  assert.equal(r2.fonte, 'local');
  assert.equal(r2.item.id, 'robo-musical');
});

test('online mas IA devolve null: nada', async () => {
  const cat = criarCatalogo();
  const combinar = criarCombinador({
    catalogo: cat, aiProvider: stubDesligado, estaOnline: () => true,
  });
  assert.deepEqual(await combinar('robo', 'musica'), { tipo: 'nada' });
});

test('IA que lança erro cai em nada', async () => {
  const cat = criarCatalogo();
  const aiProvider = { async sugerirCombo() { throw new Error('falhou'); } };
  const combinar = criarCombinador({ catalogo: cat, aiProvider, estaOnline: () => true });
  assert.deepEqual(await combinar('robo', 'musica'), { tipo: 'nada' });
});

test('combo local tem prioridade sobre a IA', async () => {
  const cat = criarCatalogo();
  let chamouIA = false;
  const aiProvider = {
    async sugerirCombo() { chamouIA = true; return { resultadoNome: 'X', emoji: '❓', texto: '' }; },
  };
  const combinar = criarCombinador({ catalogo: cat, aiProvider, estaOnline: () => true });
  const r = await combinar('agua', 'fogo');
  assert.equal(r.fonte, 'local');
  assert.equal(chamouIA, false);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test --import ./tests/_setup.js tests/combinar.test.js`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```js
// src/engine/combinar.js
export function criarCombinador({ catalogo, aiProvider, estaOnline }) {
  return async function combinar(idA, idB) {
    const combo = catalogo.findCombo(idA, idB);
    if (combo) {
      return {
        tipo: 'ok',
        item: catalogo.getItem(combo.resultado),
        combo,
        fonte: 'local',
      };
    }

    if (aiProvider && estaOnline()) {
      const itemA = catalogo.getItem(idA);
      const itemB = catalogo.getItem(idB);
      let sugestao = null;
      try {
        sugestao = await aiProvider.sugerirCombo(itemA, itemB);
      } catch {
        sugestao = null;
      }
      if (sugestao && sugestao.resultadoNome) {
        const item = catalogo.registrarItemIA({
          nome: sugestao.resultadoNome,
          emoji: sugestao.emoji,
        });
        catalogo.registrarComboIA(idA, idB, item.id, sugestao.texto || '');
        return {
          tipo: 'ok',
          item,
          combo: { a: idA, b: idB, resultado: item.id, texto: sugestao.texto || '' },
          fonte: 'ia',
        };
      }
    }

    return { tipo: 'nada' };
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test --import ./tests/_setup.js tests/combinar.test.js`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/engine/combinar.js tests/combinar.test.js
git commit -m "feat: resolucao de combinacao (local, IA, nada)"
```

---

### Task 10: `descoberta.js` (overlay)

**Files:**
- Create: `src/ui/descoberta.js`
- Test: `tests/descoberta.test.js`

**Interfaces:**
- Consumes: `T` de `src/data/textos.js`; `document`, `AudioContext` globais.
- Produces: `export function mostrarDescoberta({ item, combo, catalogo, comSom }) -> Promise<void>`.
  - Monta `.descoberta-overlay` em `document.getElementById('overlay-raiz')` (ou `document.body` se não existir), com ícone grande (SVG se `item.svg`, senão `item.emoji`), selo `T.seloNovo`, `item.nome`, linha de origem `[ícone] NomeA + [ícone] NomeB` (se `combo`), `combo.texto`, e botão `T.fechar`.
  - Fecha em: clique em qualquer lugar do overlay, qualquer tecla, ou clique no botão. Ao fechar, remove o nó e resolve a Promise.
  - Se `comSom`, toca um bipe curto via `AudioContext` (try/catch — silencioso se falhar).

- [ ] **Step 1: Escrever o teste que falha**

```js
// tests/descoberta.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo } from '../src/engine/catalogo.js';
import { mostrarDescoberta } from '../src/ui/descoberta.js';

function limparRaiz() {
  document.body.innerHTML = '<div id="overlay-raiz"></div>';
}

test('mostra o overlay com nome, selo e origem', async () => {
  limparRaiz();
  const cat = criarCatalogo();
  const p = mostrarDescoberta({
    item: cat.getItem('vapor'),
    combo: cat.findCombo('agua', 'fogo'),
    catalogo: cat,
    comSom: false,
  });
  const over = document.querySelector('.descoberta-overlay');
  assert.ok(over, 'overlay no DOM');
  assert.match(over.textContent, /Vapor/);
  assert.match(over.textContent, /NOVO!/);
  assert.match(over.textContent, /Água/);
  assert.match(over.textContent, /Fogo/);
  // fecha com clique e resolve
  over.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await p;
  assert.equal(document.querySelector('.descoberta-overlay'), null);
});

test('fecha com tecla', async () => {
  limparRaiz();
  const cat = criarCatalogo();
  const p = mostrarDescoberta({
    item: cat.getItem('lava'), combo: cat.findCombo('fogo', 'terra'),
    catalogo: cat, comSom: true,
  });
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));
  await p;
  assert.equal(document.querySelector('.descoberta-overlay'), null);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test --import ./tests/_setup.js tests/descoberta.test.js`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```js
// src/ui/descoberta.js
import { T } from '../data/textos.js';

function iconeGrande(item) {
  if (item.svg) {
    return `<img class="descoberta-icone" src="${item.svg}" alt="" />`;
  }
  return `<div class="descoberta-icone">${item.emoji}</div>`;
}

function iconeMini(item) {
  if (!item) return '';
  if (item.svg) return `<img class="icone-mini" src="${item.svg}" alt="" />`;
  return `<span>${item.emoji}</span>`;
}

function tocarBipe() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    o.start();
    o.stop(ctx.currentTime + 0.3);
  } catch {
    /* sem som */
  }
}

export function mostrarDescoberta({ item, combo, catalogo, comSom }) {
  return new Promise((resolve) => {
    const raiz = document.getElementById('overlay-raiz') || document.body;
    const over = document.createElement('div');
    over.className = 'descoberta-overlay';
    over.setAttribute('role', 'dialog');
    over.setAttribute('aria-label', item.nome);
    over.tabIndex = -1;

    const paiA = combo ? catalogo.getItem(combo.a) : null;
    const paiB = combo ? catalogo.getItem(combo.b) : null;
    const origem = paiA && paiB
      ? `<p class="descoberta-origem">${iconeMini(paiA)} ${paiA.nome} + ${iconeMini(paiB)} ${paiB.nome}</p>`
      : '';

    over.innerHTML = `
      <div class="descoberta-cartao">
        ${iconeGrande(item)}
        <p class="descoberta-selo">${T.seloNovo}</p>
        <h2 class="descoberta-nome">${item.nome}</h2>
        ${origem}
        <p class="descoberta-texto">${combo && combo.texto ? combo.texto : ''}</p>
        <button type="button" class="descoberta-fechar">${T.fechar}</button>
      </div>`;

    function fechar() {
      over.removeEventListener('click', fechar);
      document.removeEventListener('keydown', fechar);
      over.remove();
      resolve();
    }

    over.addEventListener('click', fechar);
    document.addEventListener('keydown', fechar);
    raiz.appendChild(over);
    over.focus();
    if (comSom) tocarBipe();
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test --import ./tests/_setup.js tests/descoberta.test.js`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/ui/descoberta.js tests/descoberta.test.js
git commit -m "feat: overlay de destaque da nova descoberta"
```

---

### Task 11: `canvas.js`

**Files:**
- Create: `src/ui/canvas.js`
- Test: `tests/canvas.test.js`

**Interfaces:**
- Consumes: `store` (Task 7), `catalogo` (Task 4), `combinar` (Task 9); `document`.
- Produces: `export function montarCanvas({ raiz, store, catalogo, combinar, aoResultado }) -> api`.
  - `raiz`: elemento `.canvas`.
  - `aoResultado(resultado, contexto)`: callback chamado após cada tentativa de fusão. `resultado` é o retorno de `combinar`; `contexto` = `{ x, y, novo: boolean }` (posição da peça criada; `novo` vem de `!store.isDiscovered` medido ANTES de gravar).
  - `api.soltarItem(id, x, y) -> instancia` — cria peça na posição (coordenadas do mundo). Usado pela drawer.
  - `api.destruirTudo()` — remove todas as peças do DOM e chama `store.clearInstances()`.
  - `api.render()` — redesenha a partir de `store.listInstances()`.
  - Comportamento: renderiza uma `.peca` por instância (`data-uid`), posição por `left/top` no `.canvas-mundo`. Arrastar peça (pointer events) move via `store.moveInstance`. Ao soltar, se o centro da peça arrastada cai dentro do retângulo de outra peça, chama `combinar(idArrastada, idAlvo)`; em `tipo: 'ok'` remove as duas instâncias, cria a do resultado na posição média, grava descoberta com `store.recordDiscovery(item.id, [idA, idB], fonte)` e chama `aoResultado`. Em `tipo: 'nada'`, devolve a peça arrastada à posição inicial e chama `aoResultado`. Pan com arrastar no fundo; zoom com `wheel` (fator entre 0.4 e 2.5). Toque longo (500 ms) numa peça remove a instância.

- [ ] **Step 1: Escrever o teste que falha**

```js
// tests/canvas.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo } from '../src/engine/catalogo.js';
import { criarStore } from '../src/engine/state.js';
import { criarCombinador } from '../src/engine/combinar.js';
import { stubDesligado } from '../src/ai/provider.js';
import { montarCanvas } from '../src/ui/canvas.js';

function ambiente() {
  document.body.innerHTML = '<section id="canvas" class="canvas"></section>';
  const cat = criarCatalogo();
  const store = criarStore({
    versao: 1,
    descobertos: {
      agua: { em: 1, via: null, fonte: 'base' },
      fogo: { em: 1, via: null, fonte: 'base' },
    },
    canvas: [],
    ajustes: { som: false, iaLigada: false },
  });
  const combinar = criarCombinador({
    catalogo: cat, aiProvider: stubDesligado, estaOnline: () => false,
  });
  return { cat, store, combinar, raiz: document.getElementById('canvas') };
}

test('soltarItem cria uma peça no DOM e no store', () => {
  const { cat, store, combinar, raiz } = ambiente();
  const api = montarCanvas({ raiz, store, catalogo: cat, combinar, aoResultado() {} });
  api.soltarItem('agua', 100, 100);
  assert.equal(store.listInstances().length, 1);
  assert.equal(raiz.querySelectorAll('.peca').length, 1);
});

test('fundir duas peças sobrepostas gera o resultado e a descoberta', async () => {
  const { cat, store, combinar, raiz } = ambiente();
  const resultados = [];
  const api = montarCanvas({
    raiz, store, catalogo: cat, combinar,
    aoResultado: (r, ctx) => resultados.push({ r, ctx }),
  });
  const a = api.soltarItem('agua', 100, 100);
  const b = api.soltarItem('fogo', 100, 100); // mesma posição = sobreposto
  await api._fundirParaTeste(a.uid, b.uid);
  assert.ok(store.isDiscovered('vapor'));
  const ids = store.listInstances().map((i) => i.id);
  assert.deepEqual(ids, ['vapor']);
  assert.equal(resultados.at(-1).r.item.id, 'vapor');
  assert.equal(resultados.at(-1).ctx.novo, true);
});

test('destruirTudo limpa o canvas mas não as descobertas', async () => {
  const { cat, store, combinar, raiz } = ambiente();
  const api = montarCanvas({ raiz, store, catalogo: cat, combinar, aoResultado() {} });
  const a = api.soltarItem('agua', 10, 10);
  const b = api.soltarItem('fogo', 10, 10);
  await api._fundirParaTeste(a.uid, b.uid);
  api.soltarItem('agua', 200, 200);
  api.destruirTudo();
  assert.equal(store.listInstances().length, 0);
  assert.equal(raiz.querySelectorAll('.peca').length, 0);
  assert.ok(store.isDiscovered('vapor'));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test --import ./tests/_setup.js tests/canvas.test.js`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```js
// src/ui/canvas.js
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;
const TOQUE_LONGO_MS = 500;

export function montarCanvas({ raiz, store, catalogo, combinar, aoResultado }) {
  raiz.innerHTML = '';
  const mundo = document.createElement('div');
  mundo.className = 'canvas-mundo';
  raiz.appendChild(mundo);

  const vista = { x: 0, y: 0, escala: 1 };
  const pecas = new Map(); // uid -> elemento

  function aplicarVista() {
    mundo.style.transform =
      `translate(${vista.x}px, ${vista.y}px) scale(${vista.escala})`;
  }

  function elementoPeca(inst) {
    const item = catalogo.getItem(inst.id);
    const el = document.createElement('div');
    el.className = 'peca';
    el.dataset.uid = inst.uid;
    el.style.left = `${inst.x}px`;
    el.style.top = `${inst.y}px`;
    const icone = item.svg
      ? `<img class="peca-icone" src="${item.svg}" alt="" />`
      : `<span class="peca-icone">${item.emoji}</span>`;
    el.innerHTML = `${icone}<span class="peca-nome">${item.nome}</span>`;
    ligarArrasto(el, inst.uid);
    return el;
  }

  function render() {
    for (const el of pecas.values()) el.remove();
    pecas.clear();
    for (const inst of store.listInstances()) {
      const el = elementoPeca(inst);
      mundo.appendChild(el);
      pecas.set(inst.uid, el);
    }
  }

  function centro(uid) {
    const inst = store.getInstance(uid);
    const el = pecas.get(uid);
    if (!inst || !el) return null;
    return { x: inst.x + el.offsetWidth / 2, y: inst.y + el.offsetHeight / 2 };
  }

  function alvoSob(uidArrastada) {
    const c = centro(uidArrastada);
    if (!c) return null;
    for (const inst of store.listInstances()) {
      if (inst.uid === uidArrastada) continue;
      const el = pecas.get(inst.uid);
      if (!el) continue;
      const dentro =
        c.x >= inst.x && c.x <= inst.x + el.offsetWidth &&
        c.y >= inst.y && c.y <= inst.y + el.offsetHeight;
      if (dentro) return inst.uid;
    }
    return null;
  }

  async function fundir(uidArrastada, uidAlvo) {
    const a = store.getInstance(uidArrastada);
    const b = store.getInstance(uidAlvo);
    if (!a || !b) return;
    const px = (a.x + b.x) / 2;
    const py = (a.y + b.y) / 2;
    const resultado = await combinar(a.id, b.id);
    if (resultado.tipo === 'ok') {
      const novo = !store.isDiscovered(resultado.item.id);
      store.removeInstance(uidArrastada);
      store.removeInstance(uidAlvo);
      pecas.get(uidArrastada)?.remove();
      pecas.get(uidAlvo)?.remove();
      pecas.delete(uidArrastada);
      pecas.delete(uidAlvo);
      const inst = store.addInstance(resultado.item.id, px, py);
      const el = elementoPeca(inst);
      el.classList.add('surgindo');
      mundo.appendChild(el);
      pecas.set(inst.uid, el);
      store.recordDiscovery(resultado.item.id, [a.id, b.id], resultado.fonte);
      aoResultado(resultado, { x: px, y: py, novo });
    } else {
      aoResultado(resultado, { x: a.x, y: a.y, novo: false });
    }
  }

  function ligarArrasto(el, uid) {
    let arrastando = false;
    let inicio = null;
    let timerLongo = null;

    el.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      arrastando = true;
      el.setPointerCapture(ev.pointerId);
      el.classList.add('arrastando');
      const inst = store.getInstance(uid);
      inicio = { mx: ev.clientX, my: ev.clientY, x: inst.x, y: inst.y };
      timerLongo = setTimeout(() => {
        arrastando = false;
        store.removeInstance(uid);
        el.remove();
        pecas.delete(uid);
      }, TOQUE_LONGO_MS);
    });

    el.addEventListener('pointermove', (ev) => {
      if (!arrastando || !inicio) return;
      clearTimeout(timerLongo);
      const dx = (ev.clientX - inicio.mx) / vista.escala;
      const dy = (ev.clientY - inicio.my) / vista.escala;
      const nx = inicio.x + dx;
      const ny = inicio.y + dy;
      el.style.left = `${nx}px`;
      el.style.top = `${ny}px`;
      store.moveInstance(uid, nx, ny);
    });

    el.addEventListener('pointerup', async (ev) => {
      clearTimeout(timerLongo);
      if (!arrastando) return;
      arrastando = false;
      el.classList.remove('arrastando');
      el.releasePointerCapture(ev.pointerId);
      const alvo = alvoSob(uid);
      if (alvo) {
        await fundir(uid, alvo);
      }
    });
  }

  // pan e zoom no fundo
  let panInicio = null;
  raiz.addEventListener('pointerdown', (ev) => {
    if (ev.target !== raiz && ev.target !== mundo) return;
    panInicio = { mx: ev.clientX, my: ev.clientY, x: vista.x, y: vista.y };
  });
  raiz.addEventListener('pointermove', (ev) => {
    if (!panInicio) return;
    vista.x = panInicio.x + (ev.clientX - panInicio.mx);
    vista.y = panInicio.y + (ev.clientY - panInicio.my);
    aplicarVista();
  });
  raiz.addEventListener('pointerup', () => { panInicio = null; });
  raiz.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const passo = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
    vista.escala = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, vista.escala * passo));
    aplicarVista();
  }, { passive: false });

  render();
  aplicarVista();

  return {
    render,
    soltarItem(id, x, y) {
      const inst = store.addInstance(id, x, y);
      const el = elementoPeca(inst);
      mundo.appendChild(el);
      pecas.set(inst.uid, el);
      return inst;
    },
    destruirTudo() {
      for (const el of pecas.values()) el.remove();
      pecas.clear();
      store.clearInstances();
    },
    _fundirParaTeste: fundir,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test --import ./tests/_setup.js tests/canvas.test.js`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/ui/canvas.js tests/canvas.test.js
git commit -m "feat: canvas com arrastar, pan/zoom e fusao de pecas"
```

---

### Task 12: `drawer.js`

**Files:**
- Create: `src/ui/drawer.js`
- Test: `tests/drawer.test.js`

**Interfaces:**
- Consumes: `store` (Task 7), `catalogo` (Task 4), `T` de textos; `document`.
- Produces: `export function montarDrawer({ raiz, store, catalogo, aoEscolherItem }) -> api`.
  - `raiz`: elemento `.drawer`.
  - `aoEscolherItem(id)`: chamado quando um card é clicado (o app cria a instância no centro visível).
  - Renderiza: campo de busca (`.drawer-busca`, placeholder `T.buscar`), chips de era (`.drawer-chip`, rótulos de `T.eras`, multi-seleção via `aria-pressed`), contador (`.drawer-contador`, texto `T.contador(qtdDescobertos, qtdConhecidos)`), grade (`.drawer-grade`) de `.drawer-card` (com `data-id`, `data-fonte`, `data-era`).
  - Cards vêm de `store.getSave().descobertos` cruzado com `catalogo.getItem`. Ordena por era (ordem de `ERAS`) e depois por `descobertos[id].em`.
  - Busca: casa sem acento e sem caixa contra `item.nome` (reusar `slug` para normalizar).
  - Filtro: se um ou mais chips ativos, mostra só itens dessas eras.
  - `api.adicionarCard(id)` — insere/atualiza um card (usado pelo app após o overlay) e re-renderiza.
  - `api.render()` — re-render completo. Assina `store.on('descoberta:nova')` internamente? Não: o app controla a ordem (overlay primeiro). O drawer só re-renderiza quando o app chamar `adicionarCard`/`render`.
  - Arrastar um card dispara `dragstart` com `dataTransfer.setData('text/mistura-id', id)` (o canvas lê isso no `drop`); clique simples chama `aoEscolherItem(id)`.

- [ ] **Step 1: Escrever o teste que falha**

```js
// tests/drawer.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCatalogo } from '../src/engine/catalogo.js';
import { criarStore } from '../src/engine/state.js';
import { montarDrawer } from '../src/ui/drawer.js';

function ambiente() {
  document.body.innerHTML = '<aside id="drawer" class="drawer"></aside>';
  const cat = criarCatalogo();
  const store = criarStore({
    versao: 1,
    descobertos: {
      agua: { em: 1, via: null, fonte: 'base' },
      fogo: { em: 2, via: null, fonte: 'base' },
      vapor: { em: 3, via: ['agua', 'fogo'], fonte: 'local' },
    },
    canvas: [],
    ajustes: { som: false, iaLigada: false },
  });
  return { cat, store, raiz: document.getElementById('drawer') };
}

test('renderiza um card por item descoberto', () => {
  const { cat, store, raiz } = ambiente();
  montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  assert.equal(raiz.querySelectorAll('.drawer-card').length, 3);
  assert.match(raiz.querySelector('.drawer-contador').textContent, /3 \/ \d+ descobertos/);
});

test('busca filtra sem acento e sem caixa', () => {
  const { cat, store, raiz } = ambiente();
  montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  const busca = raiz.querySelector('.drawer-busca');
  busca.value = 'AGUA';
  busca.dispatchEvent(new window.Event('input', { bubbles: true }));
  const nomes = [...raiz.querySelectorAll('.drawer-card .card-nome')].map((n) => n.textContent);
  assert.deepEqual(nomes, ['Água']);
});

test('chip de era filtra', () => {
  const { cat, store, raiz } = ambiente();
  montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  const chipVida = [...raiz.querySelectorAll('.drawer-chip')]
    .find((c) => c.textContent === 'Vida');
  chipVida.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(raiz.querySelectorAll('.drawer-card').length, 0);
});

test('clique no card chama aoEscolherItem', () => {
  const { cat, store, raiz } = ambiente();
  let escolhido = null;
  montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem: (id) => { escolhido = id; } });
  raiz.querySelector('.drawer-card').dispatchEvent(
    new window.MouseEvent('click', { bubbles: true }),
  );
  assert.ok(escolhido);
});

test('adicionarCard insere um novo item', () => {
  const { cat, store, raiz } = ambiente();
  const api = montarDrawer({ raiz, store, catalogo: cat, aoEscolherItem() {} });
  store.recordDiscovery('lava', ['fogo', 'terra'], 'local');
  api.adicionarCard('lava');
  const nomes = [...raiz.querySelectorAll('.drawer-card .card-nome')].map((n) => n.textContent);
  assert.ok(nomes.includes('Lava'));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test --import ./tests/_setup.js tests/drawer.test.js`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```js
// src/ui/drawer.js
import { T } from '../data/textos.js';
import { ERAS } from '../engine/catalogo.js';
import { slug } from '../engine/slug.js';

export function montarDrawer({ raiz, store, catalogo, aoEscolherItem }) {
  raiz.innerHTML = `
    <input class="drawer-busca" type="search" placeholder="${T.buscar}" />
    <div class="drawer-chips"></div>
    <div class="drawer-contador"></div>
    <div class="drawer-grade"></div>`;

  const elBusca = raiz.querySelector('.drawer-busca');
  const elChips = raiz.querySelector('.drawer-chips');
  const elContador = raiz.querySelector('.drawer-contador');
  const elGrade = raiz.querySelector('.drawer-grade');

  const erasAtivas = new Set();

  for (const era of ERAS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'drawer-chip';
    chip.textContent = T.eras[era];
    chip.dataset.era = era;
    chip.setAttribute('aria-pressed', 'false');
    chip.addEventListener('click', () => {
      if (erasAtivas.has(era)) {
        erasAtivas.delete(era);
        chip.setAttribute('aria-pressed', 'false');
      } else {
        erasAtivas.add(era);
        chip.setAttribute('aria-pressed', 'true');
      }
      render();
    });
    elChips.appendChild(chip);
  }

  elBusca.addEventListener('input', render);

  function itensDescobertos() {
    const desc = store.getSave().descobertos;
    return Object.keys(desc)
      .map((id) => ({ item: catalogo.getItem(id), meta: desc[id] }))
      .filter((x) => x.item)
      .sort((a, b) => {
        const ea = ERAS.indexOf(a.item.era);
        const eb = ERAS.indexOf(b.item.era);
        if (ea !== eb) return ea - eb;
        return a.meta.em - b.meta.em;
      });
  }

  function render() {
    const termo = slug(elBusca.value || '');
    const lista = itensDescobertos().filter(({ item }) => {
      if (erasAtivas.size && !erasAtivas.has(item.era)) return false;
      if (termo && !slug(item.nome).includes(termo)) return false;
      return true;
    });

    elContador.textContent = T.contador(
      Object.keys(store.getSave().descobertos).length,
      catalogo.allItems().length,
    );

    elGrade.innerHTML = '';
    for (const { item, meta } of lista) {
      const card = document.createElement('div');
      card.className = 'drawer-card';
      card.dataset.id = item.id;
      card.dataset.era = item.era;
      card.dataset.fonte = meta.fonte;
      card.draggable = true;
      const icone = item.svg
        ? `<img class="card-icone" src="${item.svg}" alt="" />`
        : `<span class="card-icone">${item.emoji}</span>`;
      card.innerHTML = `${icone}<span class="card-nome">${item.nome}</span>`;
      card.addEventListener('click', () => aoEscolherItem(item.id));
      card.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData('text/mistura-id', item.id);
      });
      elGrade.appendChild(card);
    }
  }

  render();

  return {
    render,
    adicionarCard() {
      render();
    },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test --import ./tests/_setup.js tests/drawer.test.js`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/ui/drawer.js tests/drawer.test.js
git commit -m "feat: drawer com busca, filtro por era e contador"
```

---

### Task 13: `app.js` — ligar tudo

**Files:**
- Create: `src/app.js`
- Modify: `index.html` (já tem os pontos de montagem; sem mudança se Task 1 ficou correta)

**Interfaces:**
- Consumes: `criarCatalogo`, `carregar`, `saveInicial`, `criarAgendadorSalvar`, `criarStore`, `criarCombinador`, `stubDesligado`, `montarCanvas`, `montarDrawer`, `mostrarDescoberta`, `T`.
- Produces: nenhuma API — é o ponto de entrada. Sem teste automatizado; tem checklist de verificação manual.

- [ ] **Step 1: Implementar `src/app.js`**

```js
// src/app.js
import { criarCatalogo } from './engine/catalogo.js';
import { carregar, criarAgendadorSalvar } from './engine/storage.js';
import { criarStore } from './engine/state.js';
import { criarCombinador } from './engine/combinar.js';
import { stubDesligado } from './ai/provider.js';
import { montarCanvas } from './ui/canvas.js';
import { montarDrawer } from './ui/drawer.js';
import { mostrarDescoberta } from './ui/descoberta.js';
import { T } from './data/textos.js';

async function iniciar() {
  const catalogo = criarCatalogo();
  const save = await carregar(catalogo);
  const store = criarStore(save);

  const agendarSalvar = criarAgendadorSalvar(() => store.getSave(), 400);
  store.on('estado:mudou', agendarSalvar);

  // Nesta fase a IA fica desligada: stub + estaOnline sempre false.
  const combinar = criarCombinador({
    catalogo,
    aiProvider: stubDesligado,
    estaOnline: () => false,
  });

  const elCanvas = document.getElementById('canvas');
  const elDrawer = document.getElementById('drawer');
  const elLimpar = document.getElementById('limpar');

  let drawer;

  const canvas = montarCanvas({
    raiz: elCanvas,
    store,
    catalogo,
    combinar,
    aoResultado: async (resultado, ctx) => {
      if (resultado.tipo === 'ok' && ctx.novo) {
        await mostrarDescoberta({
          item: resultado.item,
          combo: resultado.combo,
          catalogo,
          comSom: store.getSave().ajustes.som,
        });
        drawer.adicionarCard(resultado.item.id);
      }
    },
  });

  drawer = montarDrawer({
    raiz: elDrawer,
    store,
    catalogo,
    aoEscolherItem: (id) => {
      const r = elCanvas.getBoundingClientRect();
      canvas.soltarItem(id, r.width / 2, r.height / 2);
    },
  });

  // soltar card no canvas via drag-and-drop nativo
  elCanvas.addEventListener('dragover', (ev) => ev.preventDefault());
  elCanvas.addEventListener('drop', (ev) => {
    ev.preventDefault();
    const id = ev.dataTransfer.getData('text/mistura-id');
    if (!id) return;
    const r = elCanvas.getBoundingClientRect();
    canvas.soltarItem(id, ev.clientX - r.left, ev.clientY - r.top);
  });

  elLimpar.textContent = T.limparCanvas;
  elLimpar.addEventListener('click', () => {
    if (window.confirm(T.confirmarLimpar)) {
      canvas.destruirTudo();
    }
  });

  canvas.render();
}

iniciar();
```

- [ ] **Step 2: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS em todos os arquivos (`slug`, `catalogo`, `dados`, `storage`, `state`, `provider`, `combinar`, `descoberta`, `canvas`, `drawer`).

- [ ] **Step 3: Verificação manual no navegador**

Run: `python -m http.server 8000` (ou `npx serve .`)
Abrir `http://localhost:8000` e conferir:
- [ ] A drawer mostra os 4 itens base (Água, Fogo, Terra, Ar) e o contador `4 / N descobertos`.
- [ ] Clicar em "Água" e em "Fogo" cria duas peças no canvas.
- [ ] Arrastar uma peça sobre a outra dispara o overlay escuro com "Vapor", selo "NOVO!", "Água + Fogo" e a frase de explicação.
- [ ] Clicar em qualquer lugar fecha o overlay e o card "Vapor" aparece na drawer.
- [ ] Repetir Água + Fogo cria "Vapor" de novo, sem overlay.
- [ ] Combinar dois itens sem receita (ex: Terra + Ar já tem; tentar Vapor + Vapor) devolve as peças sem erro.
- [ ] Recarregar a página mantém as descobertas e as peças no canvas.
- [ ] "Limpar canvas" pede confirmação e esvazia só o canvas.
- [ ] Buscar "agua" na drawer filtra; clicar num chip de era filtra.
- [ ] Desligar a rede (DevTools offline) e recarregar: tudo continua funcionando.

- [ ] **Step 4: Commit**

```bash
git add src/app.js
git commit -m "feat: app.js liga engine, canvas, drawer e overlay"
```

---

## Self-Review

**1. Cobertura do spec (seções da spec → tarefas):**

| Seção da spec | Tarefa(s) |
|---|---|
| 2. Stack e restrições (web puro, sem build, PWA) | Task 1 (PWA fica no Plano 2) |
| 3.1 Estrutura de arquivos | Task 1 + cada tarefa cria seu módulo |
| 3.2 Fluxo de dados | Task 13 (app.js orquestra) |
| 3.3 Pub/sub | Task 7 |
| 4.1 Item | Task 3, Task 4 |
| 4.2 Combo curado (chave simétrica, `texto` obrigatório) | Task 3, Task 4, Task 5 |
| 4.3 Save (um por família) | Task 6 |
| 4.4 Migração de save | Task 6 |
| 4.5 Alvo de conteúdo (~250/~700, Pokémon/Homem-Aranha SVG) | **Plano 2** (semente reduzida aqui) |
| 5.1 Canvas (pan/zoom, criar, mover, remover, limpar) | Task 11, Task 13 |
| 5.2 Fusão (ordem local→IA→nada) | Task 9, Task 11 |
| 5.3 Reações no canvas | Task 11 |
| 6. Overlay de descoberta | Task 10, Task 13 |
| 7. Drawer (busca, chips, contador, arrastar) | Task 12, Task 13 |
| 8. Árvore de descobertas | **Plano 2** |
| 9. Camada de IA (interface + stub + endpoint doc) | Task 8, Task 9 |
| 10. Offline / PWA (service worker, manifest) | **Plano 2** |
| 11. i18n (textos.js) | Task 3 |
| 12. Testes | Cada tarefa + Task 5 |
| 13. Fases | Plano 1 = fase 1 parcial; Plano 2 completa a fase 1 |

Lacunas conhecidas e deliberadas, todas no Plano 2: árvore de descobertas, service worker + manifest, expansão de conteúdo para ~250/~700 com os SVGs de Pokémon e Homem-Aranha, e a documentação de guard-rails do endpoint. O jogo do Plano 1 é jogável e persistente sem esses itens.

**2. Placeholders:** nenhum passo usa "TBD"/"depois"/"tratar edge cases" — todo passo de código tem bloco de código real e todo passo de teste tem os `assert` completos.

**3. Consistência de tipos:** `criarCatalogo`, `comboKey`, `ERAS`, `criarStore`, `criarCombinador`, `stubDesligado`/`criarProviderEndpoint`, `mostrarDescoberta`, `montarCanvas`, `montarDrawer`, `carregar`/`salvar`/`saveInicial`/`criarAgendadorSalvar` têm assinatura única e igual entre a definição e o uso em `app.js`. O formato de `Resultado` (`{tipo:'ok', item, combo, fonte}` | `{tipo:'nada'}`) é o mesmo em `combinar.js`, `canvas.js` e `app.js`. O evento `descoberta:nova` carrega `{ id, via, fonte }` em `state.js` e não é consumido por outro módulo com forma diferente (o app usa o retorno de `combinar`, não o evento, para o overlay).

---

## Execution Handoff

**Plano salvo em `docs/superpowers/plans/2026-09-05-mistura-nucleo.md`. Duas opções de execução:**

**1. Subagent-Driven (recomendado)** — um subagente novo por tarefa, revisão entre tarefas, iteração rápida.

**2. Inline Execution** — executa as tarefas nesta sessão com checkpoints de revisão.

**Qual abordagem?**
