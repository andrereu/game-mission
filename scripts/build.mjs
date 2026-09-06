// Monta dist/ só com o que o jogo precisa em produção: sem testes, sem
// node_modules, sem docs. É o que a Netlify publica (ver netlify.toml).
// Uso: `node scripts/build.mjs`.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const dist = `${raiz}dist`;

const ARQUIVOS = ['index.html', 'manifest.webmanifest', 'sw.js', 'vercel.json'];
const PASTAS = ['styles', 'src', 'assets'];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);

for (const f of ARQUIVOS) cpSync(`${raiz}${f}`, `${dist}/${f}`);
for (const p of PASTAS) cpSync(`${raiz}${p}`, `${dist}/${p}`, { recursive: true });

console.log('dist/ pronto:', [...ARQUIVOS, ...PASTAS.map((p) => `${p}/`)].join(' '));
