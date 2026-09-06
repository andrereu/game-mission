const DB_NOME = 'mistura';
const STORE = 'save';
const CHAVE_PADRAO = 'principal';
export const VERSAO_ATUAL = 1;

function temIndexedDB() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

// localStorage guarda um item por chave. A chave 'principal' mantém o nome
// histórico ('mistura') para não quebrar saves já gravados; o resto é prefixado.
function chaveLocal(chave) {
  return chave === CHAVE_PADRAO ? DB_NOME : `${DB_NOME}:${chave}`;
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

function lerIDB(chave) {
  return abrir().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(chave);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  }));
}

function escreverIDB(chave, valor) {
  return abrir().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(valor, chave);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

function apagarIDB(chave) {
  return abrir().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(chave);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

function lerLocal(chave) {
  try {
    const txt = localStorage.getItem(chaveLocal(chave));
    if (!txt) return null;
    return JSON.parse(txt);
  } catch {
    return null; // sem storage ou JSON corrompido: trata como "sem save"
  }
}

// --- API crua por chave (usada por perfis.js; sem catálogo, sem migração) ---

export async function lerChave(chave) {
  if (temIndexedDB()) {
    try {
      return await lerIDB(chave);
    } catch {
      /* private browsing, cota, bloqueio: cai no localStorage */
    }
  }
  return lerLocal(chave);
}

export async function escreverChave(chave, valor) {
  if (temIndexedDB()) {
    try {
      await escreverIDB(chave, valor);
      return;
    } catch {
      /* cai no localStorage */
    }
  }
  try {
    localStorage.setItem(chaveLocal(chave), JSON.stringify(valor));
  } catch {
    /* nada a fazer: o jogo continua só em memória */
  }
}

export async function apagarChave(chave) {
  if (temIndexedDB()) {
    try {
      await apagarIDB(chave);
      return;
    } catch {
      /* cai no localStorage */
    }
  }
  try {
    localStorage.removeItem(chaveLocal(chave));
  } catch {
    /* nada a fazer */
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
    itensIA: {},
    combosIA: {},
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
export async function carregar(catalogo, chave = CHAVE_PADRAO) {
  try {
    const cru = await lerChave(chave);
    if (!cru || typeof cru !== 'object') return saveInicial(catalogo);
    const save = migrar(cru);
    // saves gravados antes de existir esse campo (versão já é a atual, não passa pela migração)
    save.itensIA ??= {};
    save.combosIA ??= {};
    return save;
  } catch {
    return saveInicial(catalogo);
  }
}

export async function salvar(save, chave = CHAVE_PADRAO) {
  await escreverChave(chave, save);
}

export function criarAgendadorSalvar(getSave, ms = 400, chave = CHAVE_PADRAO) {
  let t = null;
  return () => {
    clearTimeout(t);
    t = setTimeout(() => {
      Promise.resolve(salvar(getSave(), chave)).catch(() => {});
    }, ms);
  };
}
