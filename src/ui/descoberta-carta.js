// Recompensa da 1ª descoberta de um item: a cartinha definitiva (mesmo
// componente do Álbum, ver src/ui/carta.js) aparece em destaque no centro,
// e depois de um instante — ou no toque da criança — "voa" até o botão do
// Álbum (ou até o cabeçalho do inventário, no Modo Pequenos, onde o Álbum
// fica escondido). O item já foi registrado no save antes disso (ver
// src/ui/canvas.js: recordDiscovery roda antes de aoResultado) — esta tela
// é só a celebração visual, nunca bloqueia persistência/drawer/álbum.
import { calcularDadosCarta, criarElementoCarta } from './carta.js';
import { animarVooParaDestino } from './voo-carta.js';
import { tocarBipe } from './descoberta.js';

const MS_ANTES_DE_VOAR = 1000;

// Mostra a carta em destaque; resolve com os elementos assim que ela deve
// começar a voar (toque da criança ou o tempo padrão passou).
function mostrarCartaEmDestaque({ dados, T, ms = MS_ANTES_DE_VOAR }) {
  return new Promise((resolve) => {
    const raiz = document.getElementById('overlay-raiz') || document.body;
    const overlay = document.createElement('div');
    overlay.className = 'descoberta-carta-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', dados.item.nome);

    const faixa = document.createElement('p');
    faixa.className = 'descoberta-carta-faixa';
    faixa.textContent = T.novaDescobertaFaixa;

    const cartaEl = criarElementoCarta(dados, { T, comRodape: false });

    let resolvido = false;
    function finalizar() {
      if (resolvido) return;
      resolvido = true;
      clearTimeout(timer);
      overlay.removeEventListener('click', finalizar);
      document.removeEventListener('keydown', finalizar);
      resolve({ overlay, cartaEl });
    }

    overlay.addEventListener('click', finalizar);
    document.addEventListener('keydown', finalizar);
    const timer = setTimeout(finalizar, ms);

    overlay.append(faixa, cartaEl);
    raiz.appendChild(overlay);
  });
}

// Orquestra tudo: mostra a carta, espera o toque/tempo, voa até o destino,
// resolve quando a animação (ou o fallback sem movimento) termina. Nunca
// rejeita — item sem dados (não deveria acontecer, já foi registrado antes
// de chamar isto) só resolve na hora.
export function mostrarRecompensaDescoberta({
  id, store, catalogo, T, destinoEl, comSom, ms,
}) {
  return new Promise((resolve) => {
    const dados = calcularDadosCarta(id, { store, catalogo });
    if (!dados) { resolve(); return; }
    if (comSom) tocarBipe();

    mostrarCartaEmDestaque({ dados, T, ms }).then(({ overlay, cartaEl }) => {
      overlay.classList.add('descoberta-carta-voando');
      overlay.querySelector('.descoberta-carta-faixa')?.remove();
      animarVooParaDestino({
        origemEl: cartaEl,
        destinoEl,
        aoTerminar: () => {
          overlay.remove();
          resolve();
        },
      });
    });
  });
}
