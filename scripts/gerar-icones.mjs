// Gera os ícones PNG do PWA a partir da arte do blob (assets/icons/icon.svg),
// aproximada com primitivas analíticas — sem dependência externa.
// Rode: `node scripts/gerar-icones.mjs`
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
  ihdr[8] = 8;
  ihdr[9] = 6;
  const linhas = Buffer.alloc(altura * (1 + largura * 4));
  for (let y = 0; y < altura; y++) {
    linhas[y * (1 + largura * 4)] = 0;
    rgba.copy(linhas, y * (1 + largura * 4) + 1, y * largura * 4, (y + 1) * largura * 4);
  }
  return Buffer.concat([
    assinatura,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(linhas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- cor ---------------------------------------------------------------
const hex = (s) => [
  parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16),
];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function sobre(base, cor, alfa) {
  return [
    base[0] * (1 - alfa) + cor[0] * alfa,
    base[1] * (1 - alfa) + cor[1] * alfa,
    base[2] * (1 - alfa) + cor[2] * alfa,
  ];
}

const PARADAS = [
  [0.00, hex('#2f63e0')],
  [0.46, hex('#3d63d8')],
  [0.54, hex('#e63b3b')],
  [0.80, hex('#ff9a34')],
  [1.00, hex('#ffd25c')],
];
function corBlob(t) {
  const c = clamp(t);
  for (let i = 1; i < PARADAS.length; i++) {
    if (c <= PARADAS[i][0]) {
      const [p0, k0] = PARADAS[i - 1];
      const [p1, k1] = PARADAS[i];
      return lerp(k0, k1, (c - p0) / (p1 - p0));
    }
  }
  return PARADAS[PARADAS.length - 1][1];
}

const FUNDO_TOPO = hex('#1a2140');
const FUNDO_BASE = hex('#0e1430');
const BRANCO = [255, 255, 255];
const ESCURO = hex('#16224a');

// cobertura de uma borda: 1 dentro de `limite`, 0 além de `limite + rampa`
function cobre(dist, limite, rampa) {
  return clamp((limite - dist) / rampa + 0.5);
}

function desenhar(tam, maskable) {
  const S = tam;
  const rgba = Buffer.alloc(S * S * 4);

  const raio = maskable ? 0.30 : 0.335;
  const cx = S * 0.5;
  const cy = S * 0.53;
  const rx = S * raio;
  const ry = S * (raio + 0.04);
  const rampaBlob = 2 / rx; // ~2px de antialias no espaço normalizado

  const placaInset = S * 0.045;
  const placaR = S * 0.22;

  const olhoRx = S * 0.086;
  const olhoRy = S * 0.094;
  const olhoY = S * 0.53;
  const olhos = [S * 0.422, S * 0.612];

  const sorrisoCx = cx;
  const sorrisoCy = S * 0.60;
  const sorrisoR = S * 0.135;
  const sorrisoW = S * 0.024;

  const glowCx = S * 0.37;
  const glowCy = S * 0.43;
  const glowR = S * 0.16;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // fundo (gradiente vertical)
      let cor = lerp(FUNDO_TOPO, FUNDO_BASE, y / S);

      // alpha da placa: full bleed no maskable; cantos transparentes no "any"
      let alfa;
      if (maskable) {
        alfa = 1;
      } else {
        const px = clamp(x, placaInset + placaR, S - placaInset - placaR);
        const py = clamp(y, placaInset + placaR, S - placaInset - placaR);
        alfa = cobre(Math.hypot(x - px, y - py), placaR, 2);
      }

      // blob
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      const aBlob = cobre(d, 1, rampaBlob);
      if (aBlob > 0) {
        const t = ((x - (cx - rx)) / (2 * rx) + (y - (cy - ry)) / (2 * ry)) / 2;
        let c = corBlob(t);
        const dg = Math.hypot(x - glowCx, y - glowCy);
        if (dg < glowR) c = sobre(c, [255, 248, 224], 0.32 * (1 - dg / glowR));
        cor = sobre(cor, c, aBlob);
      }

      // olhos brancos
      for (const ox of olhos) {
        const de = Math.hypot((x - ox) / olhoRx, (y - olhoY) / olhoRy);
        cor = sobre(cor, BRANCO, cobre(de, 1, 2 / olhoRx));
      }
      // pupilas
      for (const ox of olhos) {
        const dp = Math.hypot(x - (ox + S * 0.018), y - (olhoY + S * 0.014));
        cor = sobre(cor, ESCURO, cobre(dp, S * 0.04, 1.5));
      }
      // brilhinho
      for (const ox of olhos) {
        const db = Math.hypot(x - (ox + S * 0.03), y - (olhoY - S * 0.006));
        cor = sobre(cor, BRANCO, cobre(db, S * 0.014, 1));
      }

      // sorriso (arco inferior)
      if (y > sorrisoCy - 1 && Math.abs(x - sorrisoCx) < sorrisoR * 0.95) {
        const ds = Math.abs(Math.hypot(x - sorrisoCx, y - sorrisoCy) - sorrisoR);
        cor = sobre(cor, ESCURO, cobre(ds, sorrisoW, 1.5));
      }

      const o = (y * S + x) * 4;
      rgba[o] = Math.round(clamp(cor[0], 0, 255));
      rgba[o + 1] = Math.round(clamp(cor[1], 0, 255));
      rgba[o + 2] = Math.round(clamp(cor[2], 0, 255));
      rgba[o + 3] = Math.round(clamp(alfa, 0, 1) * 255);
    }
  }
  return png(S, S, rgba);
}

mkdirSync(DESTINO, { recursive: true });
writeFileSync(DESTINO + 'icon-192.png', desenhar(192, false));
writeFileSync(DESTINO + 'icon-512.png', desenhar(512, false));
writeFileSync(DESTINO + 'icon-maskable-512.png', desenhar(512, true));
console.log('ícones gerados em assets/icons/');
