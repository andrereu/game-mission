// Service worker da Misturária
// install: pré-cacheia todo o app-shell (HTML, CSS, módulos, dados, ícones).
// fetch: cache-first para estático mesmo-origem; rede direta para /api/.
// activate: apaga versões antigas do cache.

const VERSAO = 'mistura-v23';

const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',

  'styles/base.css',
  'styles/canvas.css',
  'styles/drawer.css',
  'styles/overlay.css',
  'styles/arvore.css',
  'styles/perfis.css',
  'styles/ajustes.css',
  'styles/modos.css',
  'styles/eras.css',
  'styles/barra.css',
  'styles/carta.css',

  'src/app.js',
  'src/ai/provider.js',
  'src/data/combos.js',
  'src/data/config.js',
  'src/data/itens.js',
  'src/data/modos.js',
  'src/data/textos.js',
  'src/engine/catalogo.js',
  'src/engine/combinar.js',
  'src/engine/eras.js',
  'src/engine/perfis.js',
  'src/engine/raridade.js',
  'src/engine/slug.js',
  'src/engine/state.js',
  'src/engine/storage.js',
  'src/engine/sync.js',
  'src/ui/arvore.js',
  'src/ui/canvas.js',
  'src/ui/carta.js',
  'src/ui/descoberta.js',
  'src/ui/desfazer.js',
  'src/ui/drawer.js',
  'src/ui/era-nova.js',
  'src/ui/eras.js',
  'src/ui/ajustes.js',
  'src/ui/panzoom.js',
  'src/ui/perfis.js',
  'src/ui/rede.js',
  'src/ui/atualizacao.js',

  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon-32.png',
  'assets/icons/favicon-16.png',

  'assets/svg/pikachu.svg',
  'assets/svg/raichu.svg',
  'assets/svg/pokebola.svg',
  'assets/svg/homem-aranha.svg',
  'assets/svg/venom.svg',
  'assets/svg/duende-verde.svg',

  'assets/cartas/logo.png',
  'assets/cartas/mascote.png',
  'assets/cartas/logo-completo.png',
  'assets/cartas/mascote-busto.png',
  'assets/cartas/mascote-feliz.png',
  'assets/cartas/mascote-pensando.png',

  'assets/decor/nebulosa.png',
  'assets/decor/planeta.png',
  'assets/decor/asteroides.png',
  'assets/decor/estrelas.png',
  'assets/decor/elementos-decorativos.png',
  'assets/decor/orbe-dourada.png',
  'assets/decor/orbe-galaxia.png',
  'assets/decor/estrela.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSAO).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(
        chaves.filter((c) => c !== VERSAO).map((c) => caches.delete(c)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // deixa a rede cuidar
  if (url.pathname.startsWith('/api/')) return; // IA (fase 2): sempre rede

  evento.respondWith(
    caches.match(req).then((achado) => {
      if (achado) return achado;
      return fetch(req)
        .then((resp) => {
          // guarda cópias de estático que apareça em runtime
          if (resp.ok && resp.type === 'basic') {
            const copia = resp.clone();
            caches.open(VERSAO).then((cache) => cache.put(req, copia));
          }
          return resp;
        })
        .catch(() => caches.match('index.html')); // navegação offline sem cache exato
    }),
  );
});
