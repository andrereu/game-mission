// Carta de Descoberta: abre ao tocar numa figurinha já descoberta no álbum.
// Mostra raridade, de onde o item veio, o que ele já gerou, e permite salvar
// uma imagem (Canvas 2D, sem backend) pra compartilhar fora do jogo.
const RARO_COR = {
  comum: '#7fa8d9', raro: '#4ad0e6', epico: '#b06bff', lendario: '#ffc94a',
};
const RARO_LABEL = {
  comum: 'Comum', raro: 'Raro', epico: 'Épico', lendario: 'Lendário',
};

// recorte sem a margem transparente do arquivo-mestre: dá mais presença
// visual à marca sem esticar o cartão (mesmo ativo usado na barra superior).
const LOGO_SRC = 'assets/cartas/logo-header.png';
const MASCOTE_SRC = 'assets/cartas/mascote.png';

function nomesDe(ids, catalogo) {
  return ids.map((id) => catalogo.getItem(id)?.nome).filter(Boolean);
}

function filhosDe(id, descobertos) {
  return Object.keys(descobertos).filter((outro) => {
    const via = descobertos[outro] && descobertos[outro].via;
    return Array.isArray(via) && via.includes(id);
  });
}

function iconeHTML(item) {
  return item.svg
    ? `<img class="carta-orbe-icone" src="${item.svg}" alt="" />`
    : `<span class="carta-orbe-icone">${item.emoji}</span>`;
}

// Dados prontos pra desenhar a carta de um item já descoberto — usado tanto
// pelo Álbum quanto pela animação de recompensa da 1ª descoberta (ver
// src/ui/descoberta-carta.js). Sem-spoiler: null se o item não foi descoberto.
export function calcularDadosCarta(id, { store, catalogo }) {
  const item = catalogo.getItem(id);
  if (!item) return null;
  const descobertos = store.getSave().descobertos;
  const meta = descobertos[id];
  if (!meta) return null;

  const raridade = catalogo.getRaridade(id);
  const descricao = catalogo.getDescricao(id);
  const pais = Array.isArray(meta.via) ? nomesDe(meta.via, catalogo) : null;
  const filhosIds = filhosDe(id, descobertos);
  const filhos = filhosIds.length ? nomesDe(filhosIds, catalogo) : null;
  const alemDoMapa = catalogo.ehAlemDoMapa(id); // já implica descoberto (meta existe)
  return {
    item, meta, raridade, descricao, pais, filhos, alemDoMapa,
  };
}

function blocoVia({ pais }, T) {
  if (!pais || !pais.length) {
    return `<div class="carta-bloco"><b>${T.cartaOrigem}</b>${T.cartaOrigemBase}</div>`;
  }
  return `<div class="carta-bloco"><b>${T.cartaVimDisso}</b>${pais.join(' + ')}</div>`;
}

function blocoCriei({ filhos }, T) {
  if (!filhos || !filhos.length) return '';
  return `<div class="carta-bloco"><b>${T.cartaCrieiIsso}</b>${filhos.join(', ')}</div>`;
}

function blocoAlemDoMapa({ alemDoMapa }, T) {
  if (!alemDoMapa) return '';
  return `<div class="carta-bloco carta-bloco-alem-mapa"><b>✦ ${T.alemDoMapaTitulo}</b>${T.alemDoMapaTexto}</div>`;
}

// Constrói o elemento `.carta` — o MESMO componente/markup em qualquer
// contexto (Álbum ou animação de recompensa). `comRodape:false` omite os
// botões (usado no flash de 1ª descoberta, que é efêmero e voa antes que dê
// tempo de exportar imagem).
export function criarElementoCarta(dados, { T, comRodape = true }) {
  const {
    item, meta, raridade, descricao, alemDoMapa,
  } = dados;

  const carta = document.createElement('div');
  carta.className = `carta raridade-${raridade}`;
  carta.style.setProperty('--cor-raro', RARO_COR[raridade]);
  carta.innerHTML = `
    <span class="selo-raridade">${RARO_LABEL[raridade]}</span>
    <div class="carta-topo"><img class="carta-logo" src="${LOGO_SRC}" alt="Misturária" /></div>
    <div class="carta-orbe-area">
      <div class="anel-orbita"></div>
      <span class="orbe orbe-carta" data-era="${item.era}"${meta.fonte === 'ia' ? ' data-fonte="ia"' : ''}${alemDoMapa ? ` data-alem="mapa" title="${T.alemDoMapaTitulo}: ${T.alemDoMapaTexto}"` : ''}>${iconeHTML(item)}</span>
    </div>
    <div class="carta-nome">${item.nome}${alemDoMapa ? `<span class="sr-only"> — ${T.alemDoMapaTitulo}</span>` : ''}</div>
    <div class="carta-era">${(T.eras[item.era] || item.era)}${meta.fonte === 'ia' ? ` · ${T.cartaCriadoPelaIA}` : ''}</div>
    <div class="carta-bloco"><b>${T.cartaSobre}</b>${descricao}</div>
    ${blocoVia(dados, T)}
    ${blocoCriei(dados, T)}
    ${blocoAlemDoMapa(dados, T)}
    ${comRodape ? `
    <div class="carta-rodape">
      <img class="carta-mascote" src="${MASCOTE_SRC}" alt="" />
      <div class="carta-botoes">
        <button type="button" class="carta-btn carta-btn-exportar">${T.cartaSalvarImagem}</button>
        <button type="button" class="carta-btn carta-btn-fechar">${T.fechar}</button>
      </div>
    </div>
    <div class="carta-status"></div>` : ''}
  `;

  if (comRodape) {
    carta.querySelector('.carta-btn-exportar')
      .addEventListener('click', () => exportarImagem(dados, carta));
  }
  return carta;
}

// Mini-figurinha do miolo do Álbum: réplica compacta da METADE SUPERIOR da
// carta grande aprovada (spec §3, contrato visual imutável). Contém, nesta
// ordem: moldura/brilho da raridade num cartão ~3:4 · wordmark real Misturária
// no topo · selo visível da raridade no canto superior direito · medalhão
// circular com o ícone/emoji real do item · nome centralizado · era em caixa
// alta no rodapé. NÃO contém Sobre/Origem/Criei isso, mascote, Salvar imagem,
// Fechar nem qualquer botão interno. Tocar nela abre a carta grande já
// existente (ver montarCartaOverlay) — nunca amplia a própria miniatura.
export function criarFigurinhaCompacta(dados, { T }) {
  const {
    item, meta, raridade, alemDoMapa,
  } = dados;
  const eraOrbe = item.ia ? 'ia' : item.era;
  const eraRodape = item.ia ? T.albumIARodape : (T.eras[item.era] || item.era).toUpperCase();
  const selo = RARO_LABEL[raridade].toUpperCase();
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `figurinha-mini raridade-${raridade}`;
  el.style.setProperty('--cor-raro', RARO_COR[raridade]);
  el.dataset.id = item.id;
  el.setAttribute('aria-label', `${item.nome} — ${RARO_LABEL[raridade]}`);
  el.innerHTML = `
    <img class="figurinha-mini-logo" src="${LOGO_SRC}" alt="Misturária" />
    <span class="figurinha-mini-selo">${selo}</span>
    <span class="orbe orbe-figurinha-mini" data-era="${eraOrbe}"${meta.fonte === 'ia' ? ' data-fonte="ia"' : ''}${alemDoMapa ? ` data-alem="mapa" title="${T.alemDoMapaTitulo}"` : ''}>${iconeHTML(item)}</span>
    <span class="figurinha-mini-nome">${item.nome}</span>
    <span class="figurinha-mini-era">${eraRodape}</span>
  `;
  return el;
}

export function montarCartaOverlay({ raiz, store, catalogo, T }) {
  let overlay = null;

  function fechar() {
    if (!overlay) return;
    document.removeEventListener('keydown', aoTeclar);
    overlay.remove();
    overlay = null;
  }

  function aoTeclar(ev) {
    if (ev.key === 'Escape') fechar();
  }

  function abrir(id) {
    const dados = calcularDadosCarta(id, { store, catalogo });
    if (!dados) return;

    fechar();
    overlay = document.createElement('div');
    overlay.className = 'carta-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', dados.item.nome);
    const cartaEl = criarElementoCarta(dados, { T, comRodape: true });
    overlay.appendChild(cartaEl);

    overlay.querySelector('.carta-btn-fechar').addEventListener('click', fechar);
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) fechar(); });
    document.addEventListener('keydown', aoTeclar);
    (raiz || document.body).appendChild(overlay);
  }

  return { abrir, fechar };
}

// ---------------- exportação em imagem (Canvas 2D, sem backend) ----------------

function carregarImagem(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function arredondado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexParaRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function corAlpha(hex, a) {
  const [r, g, b] = hexParaRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function quebrarTexto(ctx, texto, maxW) {
  const palavras = texto.split(' ');
  const linhas = [];
  let atual = '';
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(teste).width > maxW && atual) {
      linhas.push(atual);
      atual = p;
    } else {
      atual = teste;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

async function exportarImagem(dados, overlay) {
  const status = overlay.querySelector('.carta-status');
  status.textContent = 'Gerando imagem…';
  try {
    await exportarImagemInterno(dados, status);
  } catch (err) {
    console.error(err);
    status.textContent = 'Não foi possível gerar a imagem.';
  }
}

async function exportarImagemInterno(dados, status) {
  const {
    item, meta, raridade, descricao, pais, filhos,
  } = dados;
  const cor = RARO_COR[raridade];

  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 1260;
  canvas.className = 'carta-canvas-export';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  try {
    ctx.clearRect(0, 0, W, H);
    const fundo = ctx.createLinearGradient(0, 0, W * 0.3, H);
    fundo.addColorStop(0, '#0b1024');
    fundo.addColorStop(0.55, '#070a18');
    fundo.addColorStop(1, '#040611');
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, W, H);

    function nebula(cx, cy, r, alpha) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, corAlpha(cor, alpha));
      g.addColorStop(1, corAlpha(cor, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    nebula(W * 0.2, H * 0.1, W * 0.55, 0.3);
    nebula(W * 0.85, H * 0.8, W * 0.6, 0.22);
    nebula(W * 0.5, H * 1.02, W * 0.7, 0.16);

    let seed = 42;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    ctx.fillStyle = '#fff';
    const nEstrelas = raridade === 'lendario' ? 140 : 80;
    for (let i = 0; i < nEstrelas; i += 1) {
      const x = rnd() * W;
      const y = rnd() * H;
      const r = rnd() * 1.6 + 0.4;
      ctx.globalAlpha = rnd() * 0.6 + 0.3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.shadowColor = corAlpha(cor, 0.9);
    ctx.shadowBlur = 60;
    ctx.strokeStyle = cor;
    ctx.lineWidth = 6;
    arredondado(ctx, 14, 14, W - 28, H - 28, 46);
    ctx.stroke();
    ctx.restore();
    arredondado(ctx, 14, 14, W - 28, H - 28, 46);
    ctx.save();
    ctx.clip();

    try {
      const logo = await carregarImagem(LOGO_SRC);
      const lw = 360;
      const lh = lw * (logo.height / logo.width);
      ctx.drawImage(logo, W / 2 - lw / 2, 50, lw, lh);
    } catch { /* segue sem o logo se falhar em carregar */ }

    ctx.font = '700 24px system-ui, sans-serif';
    ctx.textAlign = 'right';
    const label = RARO_LABEL[raridade].toUpperCase();
    const padX = 22;
    const tw = ctx.measureText(label).width;
    const selo = {
      x: W - 60 - tw - padX * 2, y: 150, w: tw + padX * 2, h: 42,
    };
    ctx.save();
    ctx.shadowColor = corAlpha(cor, 0.8);
    ctx.shadowBlur = 20;
    const gradSelo = ctx.createLinearGradient(selo.x, 0, selo.x + selo.w, 0);
    gradSelo.addColorStop(0, corAlpha(cor, 0.55));
    gradSelo.addColorStop(1, cor);
    ctx.fillStyle = gradSelo;
    arredondado(ctx, selo.x, selo.y, selo.w, selo.h, 21);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#08101f';
    ctx.textAlign = 'center';
    ctx.fillText(label, selo.x + selo.w / 2, selo.y + 28);

    const ocx = W / 2;
    const ocy = 420;
    const orr = 150;
    const nucleo = ctx.createRadialGradient(ocx - orr * 0.3, ocy - orr * 0.3, orr * 0.1, ocx, ocy, orr);
    nucleo.addColorStop(0, corAlpha(cor, 0.9));
    nucleo.addColorStop(0.55, corAlpha(cor, 0.35));
    nucleo.addColorStop(1, '#0a0f1c');
    ctx.save();
    ctx.shadowColor = corAlpha(cor, 0.8);
    ctx.shadowBlur = 70;
    ctx.fillStyle = nucleo;
    ctx.beginPath();
    ctx.arc(ocx, ocy, orr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 5;
    ctx.strokeStyle = cor;
    ctx.beginPath();
    ctx.arc(ocx, ocy, orr, 0, Math.PI * 2);
    ctx.stroke();

    if (item.svg) {
      try {
        const img = await carregarImagem(item.svg);
        const s = orr * 1.05;
        ctx.drawImage(img, ocx - s / 2, ocy - s / 2, s, s);
      } catch { /* segue sem o ícone se falhar em carregar */ }
    } else {
      ctx.font = `${orr * 1.1}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.emoji, ocx, ocy + 8);
      ctx.textBaseline = 'alphabetic';
    }

    ctx.textAlign = 'center';
    ctx.font = '800 56px system-ui, sans-serif';
    ctx.shadowColor = corAlpha(cor, 0.7);
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#eaf0ff';
    ctx.fillText(item.nome, W / 2, 640);
    ctx.shadowBlur = 0;
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillStyle = '#a9bce0';
    ctx.fillText(`${item.era}${meta.fonte === 'ia' ? ' · criado pela IA' : ''}`.toUpperCase(), W / 2, 674);

    let y = 720;
    function bloco(titulo, corpo) {
      const bx = 60;
      const bw = W - 120;
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = corAlpha('#8fa3d6', 1);
      ctx.fillText(titulo.toUpperCase(), bx + 20, y + 30);
      ctx.font = '400 20px system-ui, sans-serif';
      ctx.fillStyle = '#cdd8f5';
      const linhas = quebrarTexto(ctx, corpo, bw - 40);
      let ly = y + 62;
      for (const linha of linhas) { ctx.fillText(linha, bx + 20, ly); ly += 27; }
      const altura = 50 + linhas.length * 27;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      ctx.strokeStyle = 'rgba(255,255,255,.12)';
      ctx.lineWidth = 1.5;
      arredondado(ctx, bx, y, bw, altura, 16);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      y += altura + 22;
    }

    bloco('Sobre', descricao);
    bloco(pais && pais.length ? 'Vim disso' : 'Origem', pais && pais.length ? pais.join(' + ') : 'Item base — descoberto desde o início.');
    if (filhos && filhos.length) bloco('Criei isso', filhos.join(', '));

    try {
      const mascote = await carregarImagem(MASCOTE_SRC);
      const mh = 104;
      const mw = mh * (mascote.width / mascote.height);
      ctx.drawImage(mascote, 56, H - mh - 46, mw, mh);
    } catch { /* segue sem o mascote se falhar em carregar */ }

    ctx.font = 'italic 400 16px system-ui, sans-serif';
    ctx.fillStyle = '#5f6f9c';
    ctx.textAlign = 'right';
    ctx.fillText('misturaria.app', W - 56, H - 56);

    ctx.restore();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) { status.textContent = 'Falha ao gerar imagem.'; return; }

    const file = new File([blob], `misturaria-${item.id}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Descobri ${item.nome} no Misturária!` });
        status.textContent = 'Compartilhado!';
        return;
      } catch {
        // usuário cancelou o share, ou sem suporte real: cai no download abaixo
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `misturaria-${item.id}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    status.textContent = 'Imagem salva!';
  } finally {
    canvas.remove();
  }
}
