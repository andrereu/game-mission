export function criarStore(save) {
  const ouvintes = new Map();
  let uidSeq = 0;

  function on(evento, fn) {
    if (!ouvintes.has(evento)) ouvintes.set(evento, new Set());
    ouvintes.get(evento).add(fn);
    return () => ouvintes.get(evento)?.delete(fn);
  }

  function emit(evento, dados) {
    for (const fn of ouvintes.get(evento) ?? []) fn(dados);
    if (evento !== 'estado:mudou') {
      emit('estado:mudou', { evento, dados });
    }
  }

  function novoUid() {
    uidSeq += 1;
    return `u_${Date.now().toString(36)}_${uidSeq}`;
  }

  return {
    on,
    getSave: () => save,
    isDiscovered: (id) => Boolean(save.descobertos[id]),
    listInstances: () => save.canvas.slice(),
    getInstance: (uid) => save.canvas.find((i) => i.uid === uid),

    addInstance(id, x, y) {
      const inst = { uid: novoUid(), id, x, y };
      save.canvas.push(inst);
      emit('instancia:criada', inst);
      return inst;
    },

    moveInstance(uid, x, y) {
      const inst = save.canvas.find((i) => i.uid === uid);
      if (!inst) return;
      inst.x = x;
      inst.y = y;
      emit('instancia:movida', inst);
    },

    removeInstance(uid) {
      const idx = save.canvas.findIndex((i) => i.uid === uid);
      if (idx === -1) return;
      const [inst] = save.canvas.splice(idx, 1);
      emit('instancia:removida', inst);
    },

    clearInstances() {
      save.canvas = [];
      emit('canvas:limpo', null);
    },

    recordDiscovery(id, via, fonte) {
      if (save.descobertos[id]) return false;
      save.descobertos[id] = { em: Date.now(), via: via ?? null, fonte };
      emit('descoberta:nova', { id, via: via ?? null, fonte });
      return true;
    },

    setAjuste(chave, valor) {
      save.ajustes[chave] = valor;
      emit('ajuste:mudou', { chave, valor });
    },
  };
}
