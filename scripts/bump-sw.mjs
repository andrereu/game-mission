// Sobe a versão do cache no sw.js: 'mistura-vN' -> 'mistura-v(N+1)'.
// Isso força os aparelhos que já instalaram o PWA a pegarem os arquivos novos.
// Uso: `node scripts/bump-sw.mjs`  (chamado por `npm run deploy`).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RE = /'mistura-v(\d+)'/;

export function proximaVersao(texto) {
  const achou = texto.match(RE);
  if (!achou) {
    throw new Error("sw.js: não achei a linha da VERSAO ('mistura-vN').");
  }
  const n = Number(achou[1]);
  const de = `mistura-v${n}`;
  const para = `mistura-v${n + 1}`;
  return { texto: texto.replace(RE, `'${para}'`), de, para };
}

// roda só quando chamado direto (não quando importado por um teste)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const caminho = fileURLToPath(new URL('../sw.js', import.meta.url));
  const { texto, de, para } = proximaVersao(readFileSync(caminho, 'utf8'));
  writeFileSync(caminho, texto);
  console.log(`sw.js: ${de} -> ${para}`);
}
