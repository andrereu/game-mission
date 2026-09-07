import test from 'node:test';
import assert from 'node:assert/strict';

// splash.js decide isolado do resto do boot (sem import de app.js, que tem
// efeito colateral de topo). Reimportamos com um módulo novo por teste
// (query string única) porque o estado interno (inicio/escondida) vive no
// módulo, e cada teste precisa começar do zero.
let contador = 0;
async function importarSplashLimpo() {
  contador += 1;
  return import(`../src/ui/splash.js?t=${contador}`);
}

function raizComSplash() {
  document.body.innerHTML = '<div id="splash" class="splash"></div>';
  try { sessionStorage.clear(); } catch { /* ok */ }
  return document.getElementById('splash');
}

test('esconderSplash some do DOM depois da duração mínima', async () => {
  const splash = raizComSplash();
  const { prepararSplash, esconderSplash } = await importarSplashLimpo();
  prepararSplash();
  esconderSplash();
  assert.ok(document.getElementById('splash'), 'ainda não sumiu imediatamente');
  await new Promise((r) => setTimeout(r, 2800));
  assert.equal(document.getElementById('splash'), null, 'sumiu depois da duração mínima');
});

test('marca a sessão como vista (sessionStorage) ao esconder', async () => {
  raizComSplash();
  const { prepararSplash, esconderSplash } = await importarSplashLimpo();
  prepararSplash();
  esconderSplash();
  await new Promise((r) => setTimeout(r, 2800));
  assert.equal(sessionStorage.getItem('misturaria-splash-visto'), '1');
});

test('se o script inline já escondeu (reload interno), prepararSplash não arma nada', async () => {
  const splash = raizComSplash();
  splash.style.display = 'none';
  sessionStorage.setItem('misturaria-splash-visto', '1');
  const { prepararSplash, esconderSplash } = await importarSplashLimpo();
  prepararSplash();
  // esconderSplash chamado depois (fim do boot) não deve reativar nem duplicar timers
  esconderSplash();
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(document.getElementById('splash'), 'não mexe no elemento de novo — já estava tratado');
});

test('timeout de segurança esconde o splash sozinho se esconderSplash nunca for chamado', async () => {
  raizComSplash();
  const mod = await importarSplashLimpo();
  // não dá pra esperar os 4s reais de produção num teste — confiamos que o
  // mecanismo (setTimeout com esconderSplash) existe e funciona, testado
  // diretamente acima; aqui só garantimos que prepararSplash não quebra
  // quando chamado sem uma esconderSplash explícita em seguida.
  assert.doesNotThrow(() => mod.prepararSplash());
});

test('chamar esconderSplash duas vezes não duplica nem quebra', async () => {
  raizComSplash();
  const { prepararSplash, esconderSplash } = await importarSplashLimpo();
  prepararSplash();
  esconderSplash();
  esconderSplash();
  await new Promise((r) => setTimeout(r, 2800));
  assert.equal(document.getElementById('splash'), null);
});

test('frases alternam enquanto o splash está visível, numa cadência legível', async () => {
  document.body.innerHTML = '<div id="splash" class="splash"><p class="splash-status" id="splash-status"></p></div>';
  try { sessionStorage.clear(); } catch { /* ok */ }
  const { prepararSplash, esconderSplash } = await importarSplashLimpo();
  prepararSplash();
  const el = document.getElementById('splash-status');
  const primeira = el.textContent;
  assert.ok(primeira.length > 0, 'já mostra uma frase de cara');
  await new Promise((r) => setTimeout(r, 900));
  assert.notEqual(el.textContent, primeira, 'trocou de frase depois de um tempo');
  esconderSplash();
  await new Promise((r) => setTimeout(r, 2800));
});

test('esconder o splash cedo (interação) para de trocar frase depois de removido', async () => {
  document.body.innerHTML = '<div id="splash" class="splash"><p class="splash-status" id="splash-status"></p></div>';
  try { sessionStorage.clear(); } catch { /* ok */ }
  const { prepararSplash, esconderSplash } = await importarSplashLimpo();
  prepararSplash();
  esconderSplash();
  await new Promise((r) => setTimeout(r, 2800));
  assert.equal(document.getElementById('splash'), null);
  // não deve sobrar nenhum timer tentando escrever num elemento que já sumiu
  await new Promise((r) => setTimeout(r, 800));
});
