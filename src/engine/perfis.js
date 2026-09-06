// Perfis por criança: cada um tem o save próprio na chave `save:<id>`.
// O índice fica na chave `perfis` -> { versao, lista: [{id,nome,cor}], ativo }.
import { lerChave, escreverChave, apagarChave } from './storage.js';
import { normalizarModo, MODO_PADRAO } from '../data/modos.js';

const CHAVE_INDICE = 'perfis';
const CHAVE_LEGADA = 'principal';
const VERSAO = 1;

export function chaveSave(id) {
  return `save:${id}`;
}

function novoId() {
  try {
    if (globalThis.crypto?.randomUUID) return `p_${crypto.randomUUID()}`;
  } catch {
    /* segue pro fallback */
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizar(cru) {
  if (cru && Array.isArray(cru.lista)) {
    return { versao: VERSAO, lista: cru.lista, ativo: cru.ativo ?? null };
  }
  return null;
}

async function gravarIndice(estado) {
  await escreverChave(CHAVE_INDICE, estado);
  return estado;
}

// Lê o índice. Na primeira vez, se houver um save antigo em `principal`,
// transforma num perfil "Jogo 1" apontando para `save:<id>` com aquele progresso.
export async function carregarPerfis() {
  const existente = normalizar(await lerChave(CHAVE_INDICE));
  if (existente) return existente;

  const legado = await lerChave(CHAVE_LEGADA);
  if (legado && typeof legado === 'object') {
    const perfil = { id: novoId(), nome: 'Jogo 1', cor: '#4aa3ff', modo: MODO_PADRAO };
    await escreverChave(chaveSave(perfil.id), legado);
    return gravarIndice({ versao: VERSAO, lista: [perfil], ativo: perfil.id });
  }

  return { versao: VERSAO, lista: [], ativo: null };
}

export async function salvarPerfis({ lista = [], ativo = null } = {}) {
  await gravarIndice({ versao: VERSAO, lista, ativo });
}

export async function criarPerfil(nome, cor, modo) {
  const estado = await carregarPerfis();
  const perfil = {
    id: novoId(),
    nome: String(nome || 'Sem nome').trim() || 'Sem nome',
    cor: cor || '#4aa3ff',
    modo: normalizarModo(modo),
  };
  estado.lista.push(perfil);
  await gravarIndice(estado);
  return perfil;
}

export async function editarPerfil(id, campos = {}) {
  const estado = await carregarPerfis();
  const perfil = estado.lista.find((p) => p.id === id);
  if (!perfil) return null;
  if (campos.nome != null) perfil.nome = String(campos.nome).trim() || perfil.nome;
  if (campos.cor != null) perfil.cor = campos.cor;
  if (campos.modo != null) perfil.modo = normalizarModo(campos.modo);
  await gravarIndice(estado);
  return perfil;
}

export async function definirAtivo(id) {
  const estado = await carregarPerfis();
  if (!estado.lista.some((p) => p.id === id)) return;
  estado.ativo = id;
  await gravarIndice(estado);
}

export async function apagarPerfil(id) {
  const estado = await carregarPerfis();
  estado.lista = estado.lista.filter((p) => p.id !== id);
  if (estado.ativo === id) {
    estado.ativo = estado.lista[0]?.id ?? null;
  }
  await apagarChave(chaveSave(id));
  await gravarIndice(estado);
}
