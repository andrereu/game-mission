// Service worker da Misturária
// install: pré-cacheia todo o app-shell (HTML, CSS, módulos, dados, ícones).
// fetch: cache-first para estático mesmo-origem; rede direta para /api/.
// activate: apaga versões antigas do cache.

const VERSAO = 'mistura-v48';

const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',

  'styles/base.css',
  'styles/canvas.css',
  'styles/drawer.css',
  'styles/overlay.css',
  'styles/arvore.css',
  'styles/diorama.css',
  'styles/perfis.css',
  'styles/ajustes.css',
  'styles/modos.css',
  'styles/album.css',
  'styles/barra.css',
  'styles/carta.css',
  'styles/splash.css',

  'src/app.js',
  'src/ai/provider.js',
  'src/audio/audioService.js',
  'src/data/avatares.js',
  'src/data/combos.js',
  'src/data/config.js',
  'src/data/itens.js',
  'src/data/modos.js',
  'src/data/textos.js',
  'src/engine/alemDoMapa.js',
  'src/engine/catalogo.js',
  'src/engine/combinar.js',
  'src/engine/diorama.js',
  'src/engine/eras.js',
  'src/engine/perfis.js',
  'src/engine/raridade.js',
  'src/engine/slug.js',
  'src/engine/state.js',
  'src/engine/storage.js',
  'src/engine/sync.js',
  'src/ui/alemDoMapaUI.js',
  'src/ui/arvore.js',
  'src/ui/canvas.js',
  'src/ui/carta.js',
  'src/ui/convite-ia.js',
  'src/ui/descoberta.js',
  'src/ui/descoberta-carta.js',
  'src/ui/voo-carta.js',
  'src/ui/desfazer.js',
  'src/ui/diorama.js',
  'src/ui/diorama-mundo.js',
  'src/ui/drawer.js',
  'src/ui/era-nova.js',
  'src/ui/album.js',
  'src/ui/splash.js',
  'src/ui/ajustes.js',
  'src/ui/panzoom.js',
  'src/ui/perfis.js',
  'src/ui/rede.js',
  'src/ui/atualizacao.js',
  'src/ui/avatarSvg.js',

  'assets/icons/icon-192-v2.png',
  'assets/icons/icon-512-v2.png',
  'assets/icons/icon-maskable-512-v2.png',
  'assets/icons/apple-touch-icon-v2.png',
  'assets/icons/favicon-32-v2.png',
  'assets/icons/favicon-16-v2.png',

  'assets/svg/pikachu.svg',
  'assets/svg/raichu.svg',
  'assets/svg/pokebola.svg',
  'assets/svg/homem-aranha.svg',
  'assets/svg/venom.svg',
  'assets/svg/duende-verde.svg',

  'assets/cartas/logo.png',
  'assets/cartas/logo-header.png',
  'assets/cartas/mascote.png',
  'assets/cartas/logo-completo.png',
  'assets/cartas/mascote-busto.png',
  'assets/cartas/mascote-feliz.png',
  'assets/cartas/mascote-pensando.png',

  'assets/decor/nebulosa.png',
  'assets/decor/planeta.png',
  'assets/decor/asteroides.png',
  'assets/decor/estrelas.png',

  'assets/diorama/terreno-master.png',
  'assets/diorama/agua-layer.png',
  'assets/diorama/vegetacao-layer.png',
  'assets/diorama/vegetacao-broto.png',
  'assets/diorama/vegetacao-jovem.png',
  'assets/diorama/vegetacao-arvore.png',
  'assets/diorama/vegetacao-rala.png',
  'assets/diorama/agua-nascente.png',
  'assets/diorama/agua-cachoeira-forte.png',
  'assets/diorama/civilizacao-fogueira.png',
  'assets/diorama/civilizacao-casa.png',
  'assets/diorama/vida-borboleta.png',
  'assets/diorama/vida-bicho.png',
  'assets/diorama/vida-passaro.png',
  'assets/diorama/cosmico-fenomeno.png',
  'assets/diorama/tecnologia-ferramenta.png',
  'assets/diorama/tecnologia-engrenagem.png',
  'assets/diorama/tecnologia-observatorio.png',
  'assets/diorama/tecnologia-foguete.png',
  'assets/diorama/civilizacao-ponte.png',
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
