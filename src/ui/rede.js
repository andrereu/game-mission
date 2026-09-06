// Indicador simples de rede ao lado do nome do perfil.
// Reflete navigator.onLine e reage aos eventos online/offline.

export function montarStatusRede({ el, T }) {
  function atualizar() {
    const on = window.navigator.onLine !== false;
    el.dataset.online = on ? 'sim' : 'nao';
    el.textContent = on ? T.online : T.offline;
    el.title = on ? T.online : T.offline;
  }

  window.addEventListener('online', atualizar);
  window.addEventListener('offline', atualizar);
  atualizar();

  return {
    atualizar,
    destruir() {
      window.removeEventListener('online', atualizar);
      window.removeEventListener('offline', atualizar);
    },
  };
}
