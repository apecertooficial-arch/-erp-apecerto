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

// Atualizacao controlada: so troca de versao quando a pagina manda.
self.addEventListener("message", (evento) => {
  if (evento.data === "ATUALIZAR_AGORA") self.skipWaiting();
  if (evento.data === "LIMPAR_TUDO") {
    // Logout: remove resquicio do usuario anterior, mas SO dos caches deste app.
    // Apagar caches.keys() inteiro atingiria qualquer cache da origem.
    caches.keys().then((nomes) =>
      Promise.all(nomes.filter((n) => n.includes("apecerto")).map((n) => caches.delete(n))),
    );
  }
});
