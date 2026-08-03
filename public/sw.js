// Service worker do ERP ApeCerto.
//
// REGRA DE OURO: nada que identifique cliente entra em cache. Conversas,
// telefones, leads, sessao e respostas do Supabase passam direto para a rede e
// nunca sao gravadas. O cache guarda apenas a casca publica do aplicativo.

const VERSAO = "apecerto-v2";
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

/* ==========================================================================
   AVISOS NO CELULAR (Web Push)
   ==========================================================================

   O corretor precisa saber do lead novo sem depender de abrir o aplicativo.
   Quem responde primeiro vende: o aviso existe para encurtar esse tempo.

   O QUE VEM NO PACOTE. Titulo curto, uma linha de corpo e o link da tela. NAO
   vem nome de cliente, telefone nem trecho de conversa -- o pacote passa por
   servidor de terceiro (Google, Mozilla, Apple) antes de chegar aqui, e o que
   nao viaja nao vaza. O nome do cliente o corretor le dentro do aplicativo,
   depois de tocar.

   O aviso tambem NAO muda nada: nao marca contato, nao inicia SLA, nao conclui
   tarefa. Ele so acorda a tela.
   ========================================================================== */

const AVISO_PADRAO = {
  title: "ApeCerto",
  body: "Abra o aplicativo para ver",
  url: "/notificacoes",
  tag: "ncrm",
};

/* O que exige acao AGORA: chega com som e vibracao, e cada ocorrencia vira um
   aviso proprio. Esta lista casa com TIPOS_URGENTES da entrega (edge function
   ncrm-web-push) -- chegar rapido e chegar mudo seria meio aviso.

   `retorno_proximo` e o combinado vencendo em 30 minutos (nome do vocabulario
   fechado de ncrm_notificacao); `acao_vencida` e o que ja venceu. Os dois
   fazem barulho porque prazo e compromisso com gente: o combinado que vence
   ainda da para cumprir, e o aviso quieto que o corretor ve as 18h nao serve
   para nada. */
const TAGS_URGENTES = [
  "primeira_abordagem_pendente",
  "cliente_respondeu",
  "retorno_proximo",
  "acao_vencida",
];

/* Pacote corrompido ou vazio nao pode derrubar o handler. Em push com
   userVisibleOnly o navegador COBRA uma notificacao visivel: se engolirmos o
   erro em silencio, o Chrome mostra "Este site foi atualizado em segundo plano"
   -- pior do que um aviso generico nosso. */
function lerPacote(evento) {
  try {
    const d = evento.data ? evento.data.json() : null;
    if (!d || typeof d !== "object") return AVISO_PADRAO;
    return {
      title: typeof d.title === "string" && d.title.trim() ? d.title.slice(0, 80) : AVISO_PADRAO.title,
      body: typeof d.body === "string" ? d.body.slice(0, 160) : "",
      // So caminho interno: URL absoluta vinda do pacote abriria site de fora.
      url: typeof d.url === "string" && d.url.startsWith("/") ? d.url : AVISO_PADRAO.url,
      tag: typeof d.tag === "string" && d.tag ? d.tag.slice(0, 40) : AVISO_PADRAO.tag,
    };
  } catch {
    return AVISO_PADRAO;
  }
}

self.addEventListener("push", (evento) => {
  const aviso = lerPacote(evento);

  /* Dois leads novos seguidos precisam virar DOIS avisos, nao um substituindo o
     outro em silencio -- por isso a tag ganha timestamp no que e urgente. Ja
     os avisos de gestao colapsam por tipo, de proposito. */
  const urgente = TAGS_URGENTES.includes(aviso.tag);

  evento.waitUntil(
    self.registration.showNotification(aviso.title, {
      body: aviso.body,
      icon: "/icons/icone-192.png",
      badge: "/icons/icone-192.png",
      tag: urgente ? `${aviso.tag}-${Date.now()}` : aviso.tag,
      renotify: urgente,
      requireInteraction: false,
      /* Barulho e parte do aviso urgente: vibracao dupla + o som padrao do
         aparelho (silent: false garante o som; o navegador nao deixa escolher
         QUAL som, e esta certo -- o toque do sistema e o que o corretor ja
         reconhece). O que nao e urgente chega quieto. */
      vibrate: urgente ? [180, 80, 180] : undefined,
      silent: urgente ? false : undefined,
      data: { url: aviso.url },
    }),
  );
});

/* Tocar no aviso leva DIRETO para a tela do lead.
   Se o aplicativo ja estiver aberto, reaproveita a janela e navega nela: abrir
   uma segunda aba do mesmo app confunde e perde o estado da fila. */
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || "/notificacoes";

  evento.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const j of janelas) {
      if (new URL(j.url).origin !== self.location.origin) continue;
      await j.focus();
      // navigate pode falhar em janela sem controle do worker; o foco ja valeu.
      if ("navigate" in j) { try { await j.navigate(destino); } catch { /* segue focado */ } }
      return;
    }
    await self.clients.openWindow(destino);
  })());
});

/* O navegador pode trocar a inscricao sozinho (renovacao de chave, limpeza).
   Sem tratar isso, o aparelho para de receber e ninguem percebe -- o corretor
   simplesmente deixa de ser avisado. Reinscrevemos com a mesma chave e avisamos
   a pagina, que reenvia ao servidor quando houver sessao. */
self.addEventListener("pushsubscriptionchange", (evento) => {
  evento.waitUntil((async () => {
    try {
      const antiga = evento.oldSubscription || (await self.registration.pushManager.getSubscription());
      const chave = antiga && antiga.options && antiga.options.applicationServerKey;
      if (!chave) return;
      const nova = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chave,
      });
      const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const j of janelas) j.postMessage({ tipo: "PUSH_REINSCRITO", endpoint: nova.endpoint });
    } catch {
      /* Sem rede ou sem permissao: a tela do Meu Dia detecta na proxima
         abertura e oferece ligar de novo. Nao ha o que fazer aqui. */
    }
  })());
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

  /* A inscricao de push tambem sai no logout. Deixar ficar entregaria aviso do
     corretor anterior no aparelho de quem logar depois -- vazamento de carteira
     por descuido. Fica ANTES do recache de proposito: e limpeza de dado, e
     limpeza de dado nunca depende de a rede estar boa. */
  try {
    const sub = await self.registration.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch { /* sem inscricao ou sem permissao: nada a desfazer */ }

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
