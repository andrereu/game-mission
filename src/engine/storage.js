const DB_NOME = 'mistura';
const STORE = 'save';
const CHAVE = 'principal';
export const VERSAO_ATUAL = 1;

function temIndexedDB() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function abrir() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function lerCru() {
  if (!temIndexedDB()) {
    const txt = localStorage.getItem(DB_NOME);
    return txt ? JSON.parse(txt) : null;
  }
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(CHAVE);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function escreverCru(save) {
  if (!temIndexedDB()) {
    localStorage.setItem(DB_NOME, JSON.stringify(save));
    return;
  }
  const db = await abrir();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(save, CHAVE);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function saveInicial(catalogo) {
  const agora = Date.now();
  const descobertos = {};
  for (const it of catalogo.baseItems()) {
    descobertos[it.id] = { em: agora, via: null, fonte: 'base' };
  }
  return {
    versao: VERSAO_ATUAL,
    descobertos,
    canvas: [],
    ajustes: { som: true, iaLigada: false },
  };
}

// Migrações futuras: chave = versão de origem, valor = fn(save) -> save na versão seguinte.
const MIGRACOES = {};

function migrar(save) {
  let atual = save;
  while ((atual.versao ?? 0) < VERSAO_ATUAL) {
    const fn = MIGRACOES[atual.versao ?? 0];
    if (!fn) {
      atual.versao = VERSAO_ATUAL;
      if (!atual.ajustes) atual.ajustes = { som: true, iaLigada: false };
      break;
    }
    atual = fn(atual);
  }
  return atual;
}

export async function carregar(catalogo) {
  const cru = await lerCru();
  if (!cru) return saveInicial(catalogo);
  return migrar(cru);
}

export async function salvar(save) {
  await escreverCru(save);
}

export function criarAgendadorSalvar(getSave, ms = 400) {
  let t = null;
  return () => {
    clearTimeout(t);
    t = setTimeout(() => {
      Promise.resolve(salvar(getSave())).catch(() => {});
    }, ms);
  };
}
