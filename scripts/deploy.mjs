// "Publicar": sobe a versão do cache do sw, comita tudo que estiver pendente e
// dá push. A Vercel (conectada ao GitHub) builda e publica sozinha.
// Uso: npm run deploy
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: raiz, stdio: 'inherit' });
const gitSaida = (...args) => execFileSync('git', args, { cwd: raiz }).toString().trim();

execFileSync('node', ['scripts/bump-sw.mjs'], { cwd: raiz, stdio: 'inherit' });

git('add', '-A');

if (!gitSaida('status', '--porcelain')) {
  console.log('nada para publicar.');
  process.exit(0);
}

git('commit', '-m', 'chore: publica');
git('push');
console.log('\npush feito. A Vercel builda e publica em ~1 min.');
