// Service worker do ERP ApeCerto.
//
// REGRA DE OURO: nada que identifique cliente entra em cache. Conversas,
// telefones, leads, sessao e respostas do Supabase passam direto para a rede e
// nunca sao gravadas. O cache guarda apenas a casca publica do aplicativo.

const VERSAO = "apecerto-v1";
const CACHE_ESTATICO = `estatico-${VERSAO}`;
const OFFLINE = "/offline.html";

// Unico conteudo que pode ser guardado: nao tem dado pessoal nenhum.
const PRECACHE = [OFFLINE, "/manifest.webmanifest", "/icons/icone-192.png", "/icons/icone-512.png"];

// Qualquer coisa sob estes caminhos e privada e jamais vai para o cache.
const PRIVADO = [/^\/api\//i, /supabase/i, /\/auth\//i, /\/rest\/v1\//i, /\/functions\/v1\//i, /\/realtime\//i];

function ehPrivado(url) {
  return PRIVADO.some((re) => re.test(url.pathname) || re.test(url.hostname));
}

/* Casca publica cacheavel. Tudo aqui e conteudo fixo do aplicativo: nao ha
   como um dado de cliente cair nesta lista.
   Os tres primeiros sao versionados de fato (nome muda a cada build).

   OFFLINE e a excecao consciente: nao e versionado, mas precisa estar aqui.
   Ele so entrava no cache pelo addAll(PRECACHE) do evento install, que NAO roda
   de novo para um service worker ja instalado. Depois do logout -- que apaga os
   caches do ApeCerto de proposito -- a tela offline sumia e nao voltava, entao
   quem ficasse sem sinal via a tela de erro do navegador em vez dela. Estando
   aqui, a primeira visita a /offline.html recoloca o arquivo no cache.

   Comparacao exata de caminho, nunca prefixo: "/offline.html" e so ele mesmo. */
function ehEstaticoVersionado(url) {
  return url.pathname.startsWith("/_next/static/")
    || url.pathname.startsWith("/icons/")
    || url.pathname === "/manifest.webmanifest"
    || url.pathname === OFFLINE;
}

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(CACHE_ESTATICO).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE_ESTATICO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Dado privado: rede sempre, sem cache, sem fallback com conteudo antigo.
  if (ehPrivado(url)) return;

  // Estatico versionado: cache primeiro, porque o nome do arquivo muda a cada build.
  if (ehEstaticoVersionado(url)) {
    evento.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copia = res.clone(); caches.open(CACHE_ESTATICO).then((c) => c.put(req, copia)); }
        return res;
      })),
    );
    return;
  }

  // Navegacao: rede primeiro. Sem rede, mostra a tela offline (sem dado nenhum).
  if (req.mode === "navigate") {
    evento.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
  }
});

/* Casca minima recriada depois do logout.
   So a tela offline. Nada aqui identifica ninguem, e nada aqui exige sessao. */
const PUBLICO_MINIMO = [OFFLINE];

/* Logout: apaga o que e deste app e recria a casca publica.
 *
 * A ORDEM importa mais que o resultado do recache. Apagamos primeiro: se a rede
 * estiver fora e o recache falhar, o dado do usuario anterior ja saiu do
 * aparelho de qualquer jeito. O contrario -- tentar recriar antes de apagar --
 * deixaria dado do usuario anterior no aparelho quando a rede falhasse.
 *
 * Devolve se conseguiu recriar. Nunca inventa sucesso: sem rede volta false, e
 * quem pediu decide o que fazer com isso.
 */
async function limparERecriar() {
  const nomes = await caches.keys();
  await Promise.all(nomes.filter((n) => n.includes("apecerto")).map((n) => caches.delete(n)));

  try {
    const c = await caches.open(CACHE_ESTATICO);
    // addAll e atomico: se qualquer item falhar, NADA entra. Sem cache pela metade.
    await c.addAll(PUBLICO_MINIMO);
    return true;
  } catch {
    return false;
  }
}

// Atualizacao controlada: so troca de versao quando a pagina manda.
self.addEventListener("message", (evento) => {
  if (evento.data === "ATUALIZAR_AGORA") self.skipWaiting();

  if (evento.data === "LIMPAR_TUDO") {
    const porta = evento.ports && evento.ports[0];
    /* Confirma SO no fim, e SEMPRE -- inclusive quando falha. A pagina espera
       esta resposta antes de recarregar; ficar em silencio penduraria o logout
       ate o limite de tempo dela. */
    const responder = (recacheado) => { if (porta) porta.postMessage({ tipo: "LIMPEZA_CONCLUIDA", recacheado }); };
    const tarefa = limparERecriar().then(responder, () => responder(false));
    // waitUntil impede o navegador de matar o worker no meio da limpeza.
    if (evento.waitUntil) evento.waitUntil(tarefa);
  }
});
