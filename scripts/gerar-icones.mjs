// Gera os ícones do PWA sem dependência externa.
// A arte é só retângulo arredondado + três círculos que se misturam, então dá
// para rasterizar analiticamente (sem parser de SVG). Rode: `node scripts/gerar-icones.mjs`.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DESTINO = fileURLToPath(new URL('../assets/icons/', import.meta.url));

// --- PNG mínimo (RGBA, 8 bits, sem filtro) ---------------------------------
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo, dados) {
  const nome = Buffer.from(tipo, 'ascii');
  const tam = Buffer.alloc(4);
  tam.writeUInt32BE(dados.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([nome, dados])), 0);
  return Buffer.concat([tam, nome, dados, crc]);
}

function png(largura, altura, rgba) {
  const assinatura = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  const linhas = Buffer.alloc(altura * (1 + largura * 4));
  for (let y = 0; y < altura; y++) {
    linhas[y * (1 + largura * 4)] = 0; // filtro "none"
    rgba.copy(linhas, y * (1 + largura * 4) + 1, y * largura * 4, (y + 1) * largura * 4);
  }
  return Buffer.concat([
    assinatura,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(linhas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- cor / composição -----------------------------------------------------
const hex = (s) => [
  parseInt(s.slice(1, 3), 16),
  parseInt(s.slice(3, 5), 16),
  parseInt(s.slice(5, 7), 16),
];

function sobrepor(base, cor, alfa) {
  return [
    Math.round(base[0] * (1 - alfa) + cor[0] * alfa),
    Math.round(base[1] * (1 - alfa) + cor[1] * alfa),
    Math.round(base[2] * (1 - alfa) + cor[2] * alfa),
  ];
}

const FUNDO = hex('#0e1726');
const PLACA = hex('#2c3c59');
const BOLHAS = [hex('#4aa3ff'), hex('#45c26b'), hex('#ff5c8a')];

function desenhar(tam, zonaSegura) {
  const rgba = Buffer.alloc(tam * tam * 4);
  const r = zonaSegura ? tam * 0.30 : tam * 0.34; // raio das bolhas
  const cx = tam / 2;
  // três centros num triângulo, dentro da zona segura se maskable
  const d = zonaSegura ? tam * 0.13 : tam * 0.15;
  const centros = [
    [cx - d, cx - d * 0.6],
    [cx + d, cx - d * 0.6],
    [cx, cx + d],
  ];
  const placaInset = zonaSegura ? tam * 0.16 : tam * 0.09;
  const placaRaio = tam * 0.20;

  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      let cor = FUNDO;
      // placa arredondada
      const px = Math.min(Math.max(x, placaInset + placaRaio), tam - placaInset - placaRaio);
      const py = Math.min(Math.max(y, placaInset + placaRaio), tam - placaInset - placaRaio);
      const dentroPlaca =
        x >= placaInset && x <= tam - placaInset &&
        y >= placaInset && y <= tam - placaInset &&
        Math.hypot(x - px, y - py) <= placaRaio + 0.5;
      if (dentroPlaca) cor = PLACA;
      // bolhas translúcidas que se misturam
      for (let i = 0; i < 3; i++) {
        const dist = Math.hypot(x - centros[i][0], y - centros[i][1]);
        if (dist <= r) {
          const borda = Math.min(1, (r - dist) / 6); // antialias simples
          cor = sobrepor(cor, BOLHAS[i], 0.55 * borda);
        }
      }
      const o = (y * tam + x) * 4;
      rgba[o] = cor[0];
      rgba[o + 1] = cor[1];
      rgba[o + 2] = cor[2];
      rgba[o + 3] = 255;
    }
  }
  return png(tam, tam, rgba);
}

mkdirSync(DESTINO, { recursive: true });
writeFileSync(DESTINO + 'icon-192.png', desenhar(192, false));
writeFileSync(DESTINO + 'icon-512.png', desenhar(512, false));
writeFileSync(DESTINO + 'icon-maskable-512.png', desenhar(512, true));
console.log('ícones gerados em assets/icons/');
