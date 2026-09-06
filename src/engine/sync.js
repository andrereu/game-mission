// Sincronização entre aparelhos via Firebase Realtime Database.
// Sem dependência: fetch direto na REST do RTDB. Sem credencial no cliente —
// as rules do RTDB exigem um código de família >= 8 chars.
// Sincroniza `descobertos` (união), `itensIA`/`combosIA` (união, sem isso o
// aparelho B mostra ❔ pro que a IA criou no aparelho A) e a lista de perfis
// (união por id).
import { FIREBASE_DB_URL } from '../data/config.js';
import { lerChave, escreverChave, apagarChave } from './storage.js';

const CHAVE = 'sync';
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O,0,I,1

function bloco(n) {
  let s = '';
  for (let i = 0; i < n; i += 1) {
    s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return s;
}

export function gerarCodigo() {
  return `${bloco(4)}-${bloco(4)}`;
}

export function normalizarCodigo(c) {
  return String(c || '').trim().toUpperCase();
}

export async function carregarSync() {
  const cru = await lerChave(CHAVE);
  return { codigo: (cru && typeof cru.codigo === 'string') ? cru.codigo : null };
}

export async function definirCodigo(c) {
  await escreverChave(CHAVE, { codigo: normalizarCodigo(c) });
}

export async function desativar() {
  await apagarChave(CHAVE);
}

export function mesclarDescobertos(a = {}, b = {}) {
  const fora = { ...b, ...a }; // local (a) tem prioridade na forma do registro
  for (const id of Object.keys(fora)) {
    const ra = a[id];
    const rb = b[id];
    if (ra && rb) {
      // mantém o registro com o "em" mais antigo (a descoberta original)
      fora[id] = (rb.em != null && (ra.em == null || rb.em < ra.em)) ? rb : ra;
    }
  }
  return fora;
}

// itensIA/combosIA não têm "quando" pra desempatar (não é uma descoberta,
// é a definição do que a IA inventou): local tem prioridade, só complementa
// com o que o outro aparelho tem e o local ainda não viu.
export function mesclarMapaIA(a = {}, b = {}) {
  return { ...b, ...a };
}

export function mesclarPerfis(a = [], b = []) {
  const vistos = new Set(a.map((p) => p.id));
  const extras = (Array.isArray(b) ? b : []).filter((p) => p && p.id && !vistos.has(p.id));
  return [...a, ...extras];
}

function url(codigo, caminho) {
  return `${FIREBASE_DB_URL}/family_saves/${codigo}/${caminho}.json`;
}

export async function puxar(codigo, caminho) {
  try {
    const r = await fetch(url(codigo, caminho), { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const dados = await r.json();
    return dados ?? null;
  } catch {
    return null;
  }
}

export async function empurrar(codigo, caminho, valor) {
  try {
    const r = await fetch(url(codigo, caminho), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(valor),
      signal: AbortSignal.timeout(8000),
    });
    return Boolean(r && r.ok);
  } catch {
    return false;
  }
}

// Puxa remoto, mescla no local, grava local, empurra de volta.
// Faz a lista de perfis e o save do perfil ativo (só `descobertos`).
export async function sincronizar(codigo, {
  carregarPerfis, salvarPerfis, carregarSave, salvarSave, ativo,
} = {}) {
  if (!codigo) return { ok: false };

  const locais = await carregarPerfis();
  const remotos = await puxar(codigo, '_perfis');
  const lista = mesclarPerfis(locais.lista || [], remotos || []);
  if (lista.length !== (locais.lista || []).length) {
    await salvarPerfis({ lista, ativo: locais.ativo });
  }
  await empurrar(codigo, '_perfis', lista);

  const alvo = ativo || locais.ativo;
  if (alvo) {
    const local = await carregarSave(alvo);
    const remoto = await puxar(codigo, alvo);
    const descobertos = mesclarDescobertos(
      local.descobertos || {},
      (remoto && remoto.descobertos) || {},
    );
    const itensIA = mesclarMapaIA(local.itensIA || {}, (remoto && remoto.itensIA) || {});
    const combosIA = mesclarMapaIA(local.combosIA || {}, (remoto && remoto.combosIA) || {});
    local.descobertos = descobertos;
    local.itensIA = itensIA;
    local.combosIA = combosIA;
    await salvarSave(alvo, local);
    await empurrar(codigo, alvo, { descobertos, itensIA, combosIA });
  }

  return { ok: true, perfis: lista };
}
