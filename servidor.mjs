// Servidor estático mínimo para rodar a Misturária localmente.
// Sem dependências: usa só a biblioteca padrão do Node. Funciona 100% offline.
//   node servidor.mjs
// Depois abra http://localhost:4173 no navegador.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('.', import.meta.url));
const PORTA = Number(process.env.PORT) || 4173;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const servidor = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let caminho = normalize(join(RAIZ, url === '/' ? '/index.html' : url));

    // Não deixa sair da pasta do projeto.
    if (!caminho.startsWith(RAIZ)) {
      res.writeHead(403).end('Acesso negado');
      return;
    }

    const dados = await readFile(caminho);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(caminho)] || 'application/octet-stream' });
    res.end(dados);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Não encontrado');
  }
});

servidor.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  A porta ${PORTA} já está em uso.`);
    console.error('  O jogo talvez já esteja rodando: abra http://localhost:' + PORTA);
    console.error(`  Ou use outra porta:  set PORT=4174 && npm start\n`);
    process.exit(1);
  }
  throw err;
});

servidor.listen(PORTA, () => {
  console.log(`\n  Misturária rodando em  http://localhost:${PORTA}\n`);
  console.log('  Abra esse endereço no navegador. Para parar: Ctrl+C.\n');
});
