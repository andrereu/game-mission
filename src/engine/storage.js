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

// Uma única conexão por página: abrir() em toda leitura/escrita vazava conexões.
let dbPromise = null;
let dbFactory = null;

function abrir() {
  // se o indexedDB do ambiente trocou (testes), descarta a conexão memoizada
  if (dbFactory !== indexedDB) {
    dbPromise = null;
    dbFactory = indexedDB;
  }
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('indexedDB bloqueado'));
  }).catch((err) => {
    dbPromise = null; // permite nova tentativa depois
    throw err;
  });
  return dbPromise;
}

function lerIDB() {
  return abrir().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(CHAVE);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  }));
}

function lerLocal() {
  try {
    const txt = localStorage.getItem(DB_NOME);
    if (!txt) return null;
    return JSON.parse(txt);
  } catch {
    return null; // sem storage ou JSON corrompido: trata como "sem save"
  }
}

async function lerCru() {
  if (temIndexedDB()) {
    try {
      return await lerIDB();
    } catch {
      /* private browsing, cota, bloqueio: cai no localStorage */
    }
  }
  return lerLocal();
}

async function escreverCru(save) {
  if (temIndexedDB()) {
    try {
      const db = await abrir();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(save, CHAVE);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return;
    } catch {
      /* cai no localStorage */
    }
  }
  try {
    localStorage.setItem(DB_NOME, JSON.stringify(save));
  } catch {
    /* nada a fazer: o jogo continua só em memória */
  }
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
      atual.ajustes = { som: true, iaLigada: false, ...atual.ajustes };
      break;
    }
    atual = fn(atual);
  }
  return atual;
}

// Nunca rejeita: no pior caso devolve um save novo em folha.
export async function carregar(catalogo) {
  try {
    const cru = await lerCru();
    if (!cru || typeof cru !== 'object') return saveInicial(catalogo);
    return migrar(cru);
  } catch {
    return saveInicial(catalogo);
  }
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
