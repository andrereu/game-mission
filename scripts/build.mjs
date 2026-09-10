// Monta dist/ só com o que o jogo precisa em produção: sem testes, sem
// node_modules, sem docs. É o que a Netlify publica (ver netlify.toml).
// Uso: `node scripts/build.mjs`.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const dist = `${raiz}dist`;

const ARQUIVOS = ['index.html', 'manifest.webmanifest', 'sw.js', 'vercel.json'];
const PASTAS = ['styles', 'src', 'assets'];

// Assets da primeira implementação do Álbum que não são mais referenciados
// pelo runtime V2. Permanecem versionados no repositório como histórico, mas
// não devem ocupar espaço em cada deployment.
const ALBUM_LEGADO = [
  'cultura-desktop.png',
  'cultura-mobile.png',
  'elementos-desktop.png',
  'elementos-mobile.png',
  'ficcao-desktop.png',
  'ficcao-mobile.png',
  'ia-desktop.png',
  'ia-mobile.png',
  'natureza-desktop.png',
  'natureza-mobile.png',
  'tecnologia-desktop.png',
  'tecnologia-mobile.png',
  'vida-desktop.png',
  'vida-mobile.png',
];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);

for (const f of ARQUIVOS) cpSync(`${raiz}${f}`, `${dist}/${f}`);
for (const p of PASTAS) cpSync(`${raiz}${p}`, `${dist}/${p}`, { recursive: true });

for (const f of ALBUM_LEGADO) {
  rmSync(`${dist}/assets/album/${f}`, { force: true });
}

console.log('dist/ pronto:', [...ARQUIVOS, ...PASTAS.map((p) => `${p}/`)].join(' '));
console.log(`assets legados do Álbum excluídos do deploy: ${ALBUM_LEGADO.length}`);
