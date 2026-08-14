/* Regressao: a tela offline sumia do cache depois do logout e nao voltava.
 *
 * Este teste NAO procura texto no fonte -- ele EXECUTA o public/sw.js num
 * escopo de service worker falso e percorre a sequencia real:
 * instalar -> logout limpa cache -> visitar /offline.html -> ficar sem rede ->
 * navegar. Se o comportamento mudar, o teste quebra mesmo que o codigo continue
 * "parecendo" certo.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ORIGEM = "https://apecerto-erp.onrender.com";

/* ---- CacheStorage minimo, so o que o sw.js usa ---- */
function criarCaches(buscar) {
  const armazem = new Map();
  const fazCache = (nome) => {
    if (!armazem.has(nome)) armazem.set(nome, new Map());
    const m = armazem.get(nome);
    return {
      // addAll de verdade busca na rede e e ATOMICO: se um item falhar, nada entra.
      addAll: async (urls) => {
        const baixados = await Promise.all(urls.map(async (u) => [u, await buscar(ORIGEM + u)]));
        baixados.forEach(([u, res]) => m.set(u, { corpo: `conteudo de ${u}`, ok: true, res }));
      },
      put: async (req, res) => m.set(typeof req === "string" ? req : req.url.replace(ORIGEM, ""), res),
      match: async (req) => m.get(typeof req === "string" ? req : req.url.replace(ORIGEM, "")) ?? undefined,
      keys: async () => [...m.keys()].map((u) => ({ url: ORIGEM + u })),
    };
  };
  return {
    armazem,
    api: {
      open: async (n) => fazCache(n),
      keys: async () => [...armazem.keys()],
      delete: async (n) => armazem.delete(n),
      match: async (req) => {
        for (const m of armazem.values()) {
          const hit = m.get(typeof req === "string" ? req : req.url.replace(ORIGEM, ""));
          if (hit) return hit;
        }
        return undefined;
      },
    },
  };
}

/* ---- sobe o sw.js num escopo falso e devolve os controles ---- */
function subirSW() {
  const ouvintes = {};
  const pedidosDeRede = [];
  const rede = { caiu: false }; // vira true quando quisermos simular estar sem sinal

  const fetchFalso = async (req) => {
    const url = typeof req === "string" ? req : req.url;
    pedidosDeRede.push(url.replace(ORIGEM, ""));
    if (rede.caiu) throw new TypeError("Failed to fetch");
    return { ok: true, corpo: `da rede: ${url}`, clone() { return { ...this }; } };
  };

  const caches = criarCaches(fetchFalso);

  const escopo = {
    self: {
      addEventListener: (nome, fn) => { ouvintes[nome] = fn; },
      location: { origin: ORIGEM },
      skipWaiting: () => {},
      clients: { claim: async () => {} },
    },
    caches: caches.api,
    fetch: fetchFalso,
    URL,
    Promise, console,
  };
  escopo.globalThis = escopo;
  vm.createContext(escopo);
  vm.runInContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), escopo);
  return { ouvintes, caches, pedidosDeRede, rede };
}

/* MessagePort de mentira: guarda o que o worker respondeu pela porta de volta. */
function criarPorta() {
  const recebidas = [];
  return { porta: { postMessage: (m) => recebidas.push(m) }, recebidas };
}

/* Dispara o handler de message e espera o waitUntil terminar -- e assim que o
   navegador se comporta, e e o que garante que a resposta so vem no fim. */
async function mandarMensagem(sw, dados, porta) {
  const e = { data: dados, ports: porta ? [porta] : [], esperas: [] };
  e.waitUntil = (p) => e.esperas.push(p);
  sw.ouvintes.message(e);
  await Promise.all(e.esperas);
  return e;
}

const evento = () => {
  const e = { esperas: [], respostas: [] };
  e.waitUntil = (p) => e.esperas.push(p);
  e.respondWith = (p) => e.respostas.push(p);
  return e;
};

async function pedir(sw, caminho, { modo = "cors", metodo = "GET" } = {}) {
  const e = evento();
  e.request = { url: ORIGEM + caminho, method: metodo, mode: modo };
  sw.ouvintes.fetch(e);
  await Promise.all(e.esperas);
  return e.respostas.length ? await e.respostas[0].catch(() => null) : undefined;
}

const nomesNoCache = async (sw) => {
  const n = (await sw.caches.api.keys())[0];
  return n ? (await (await sw.caches.api.open(n)).keys()).map((r) => r.url.replace(ORIGEM, "")) : [];
};

/* ================= a sequencia inteira ================= */

test("sequencia: instala, logout limpa, /offline.html volta, offline serve a pagina", async () => {
  const sw = subirSW();

  // 1. service worker instalado
  const inst = evento();
  sw.ouvintes.install(inst);
  await Promise.all(inst.esperas);
  assert.ok((await nomesNoCache(sw)).includes("/offline.html"), "install precisa pre-cachear a tela offline");

  // 2. logout limpa os caches do ApeCerto (o que limparDadosLocais faz)
  for (const n of await sw.caches.api.keys()) {
    if (n.includes("apecerto")) await sw.caches.api.delete(n);
  }
  assert.equal((await sw.caches.api.keys()).length, 0, "logout deve mesmo esvaziar");

  // 3. acessar /offline.html
  await pedir(sw, "/offline.html");

  // 4. o arquivo volta ao cache -- era exatamente isto que nao acontecia
  assert.ok((await nomesNoCache(sw)).includes("/offline.html"),
    "depois do logout, visitar /offline.html tem que recolocar o arquivo no cache");

  // 5. simular offline -- mesmo service worker, mesma sessao, so o sinal cai
  sw.rede.caiu = true;

  // 6. navegacao recebe a pagina offline
  const resposta = await pedir(sw, "/crm", { modo: "navigate" });
  assert.ok(resposta, "sem rede, a navegacao tem que receber alguma resposta");
  assert.match(String(resposta.corpo ?? ""), /offline\.html/,
    "sem rede, a navegacao tem que cair na tela offline");
});

test("recache de /offline.html nao abre porta para dado autenticado", async () => {
  const sw = subirSW();
  const i = evento(); sw.ouvintes.install(i); await Promise.all(i.esperas);

  const privados = [
    "/api/session", "/api/performance?periodo=mes", "/api/funil2",
    "/auth/v1/token", "/rest/v1/leads", "/functions/v1/enviar-whatsapp", "/realtime/v1/websocket",
  ];
  for (const p of privados) await pedir(sw, p);

  const cache = await nomesNoCache(sw);
  for (const p of privados) {
    assert.ok(!cache.some((c) => c.startsWith(p.split("?")[0])), `${p} entrou no cache`);
  }
  assert.deepEqual(
    cache.filter((c) => /api|auth|rest|functions|realtime|supabase/i.test(c)), [],
    "nenhuma rota autenticada pode estar no cache",
  );
});

test("so /offline.html exato entra; caminho parecido nao", async () => {
  const sw = subirSW();
  const i = evento(); sw.ouvintes.install(i); await Promise.all(i.esperas);
  for (const n of await sw.caches.api.keys()) await sw.caches.api.delete(n);

  for (const p of ["/offline.html.bak", "/leads/offline.html", "/offline.htmlx"]) await pedir(sw, p);
  const cache = await nomesNoCache(sw);
  assert.deepEqual(cache.filter((c) => c !== "/offline.html"), [],
    "a comparacao e de caminho exato; nada parecido pode entrar");
});

test("mutacao nunca e servida nem gravada no cache", async () => {
  const sw = subirSW();
  const i = evento(); sw.ouvintes.install(i); await Promise.all(i.esperas);
  const r = await pedir(sw, "/offline.html", { metodo: "POST" });
  assert.equal(r, undefined, "o service worker nao pode responder a POST");
});


/* ============ o fluxo REAL de logout, sem ninguem visitar /offline.html ============ */

test("logout: LIMPAR_TUDO apaga e recria a tela offline sozinho", async () => {
  const sw = subirSW();
  const i = evento(); sw.ouvintes.install(i); await Promise.all(i.esperas);
  assert.ok((await nomesNoCache(sw)).includes("/offline.html"));

  // suja o cache com casca publica extra, para provar que a limpeza acontece
  const c = await sw.caches.api.open("estatico-apecerto-v1");
  await c.put("/icons/icone-512.png", { corpo: "x" });

  const { porta, recebidas } = criarPorta();
  await mandarMensagem(sw, "LIMPAR_TUDO", porta);

  const depois = await nomesNoCache(sw);
  assert.deepEqual(depois, ["/offline.html"],
    "depois do logout o cache tem que conter a tela offline e SO ela");
  // objeto vem do contexto do vm: comparar campo a campo, nao por prototipo
  assert.equal(recebidas.length, 1, "o worker precisa confirmar, e so uma vez");
  assert.equal(recebidas[0].tipo, "LIMPEZA_CONCLUIDA");
  assert.equal(recebidas[0].recacheado, true);

  // e a tela offline realmente serve uma navegacao sem rede
  sw.rede.caiu = true;
  const resposta = await pedir(sw, "/crm", { modo: "navigate" });
  assert.match(String(resposta?.corpo ?? ""), /offline\.html/,
    "sem rede, a navegacao tem que receber a tela offline recriada no logout");
});

test("a confirmacao vem DEPOIS do recache, nunca antes", async () => {
  const sw = subirSW();
  const i = evento(); sw.ouvintes.install(i); await Promise.all(i.esperas);

  const ordem = [];
  const cacheReal = sw.caches.api.open;
  sw.caches.api.open = async (n) => {
    const c = await cacheReal(n);
    const addAllReal = c.addAll;
    c.addAll = async (u) => { await addAllReal(u); ordem.push("recache"); };
    return c;
  };
  const { porta, recebidas } = criarPorta();
  const portaQueAnota = { postMessage: (m) => { ordem.push("confirmacao"); porta.postMessage(m); } };
  await mandarMensagem(sw, "LIMPAR_TUDO", portaQueAnota);

  assert.deepEqual(ordem, ["recache", "confirmacao"],
    "confirmar antes de recachear devolveria a pagina a uma corrida");
  assert.equal(recebidas[0].recacheado, true);
});

test("rede fora durante o recache: logout conclui e nao mente sobre o cache", async () => {
  const sw = subirSW();
  const i = evento(); sw.ouvintes.install(i); await Promise.all(i.esperas);

  // simula sessao anterior no cache, para conferir que ela sai mesmo assim
  const c = await sw.caches.api.open("estatico-apecerto-v1");
  await c.put("/icons/icone-192.png", { corpo: "do usuario anterior" });

  sw.rede.caiu = true; // cai ANTES do logout
  const { porta, recebidas } = criarPorta();
  await mandarMensagem(sw, "LIMPAR_TUDO", porta);

  assert.equal(recebidas.length, 1, "sem resposta, a pagina ficaria pendurada ate o limite de tempo");
  assert.equal(recebidas[0].tipo, "LIMPEZA_CONCLUIDA");
  assert.equal(recebidas[0].recacheado, false,
    "falha de rede nao pode ser reportada como cache recriado");
  assert.deepEqual(await nomesNoCache(sw), [],
    "nada pode sobrar do usuario anterior, mesmo com o recache falhando");
});

test("o recache nao traz sessao, API nem dado do usuario", async () => {
  const sw = subirSW();
  const i = evento(); sw.ouvintes.install(i); await Promise.all(i.esperas);

  const { porta } = criarPorta();
  await mandarMensagem(sw, "LIMPAR_TUDO", porta);

  const cache = await nomesNoCache(sw);
  assert.deepEqual(cache, ["/offline.html"], "a casca minima e so a tela offline");
  assert.deepEqual(cache.filter((p) => /api|auth|rest|functions|realtime|supabase|session|login/i.test(p)), []);

  // e continua fechado depois: chamar rota privada nao a coloca no cache
  for (const p of ["/api/session", "/auth/v1/token", "/rest/v1/leads"]) await pedir(sw, p);
  assert.deepEqual(await nomesNoCache(sw), ["/offline.html"]);
});

/* ============ lado da pagina: o logout espera a confirmacao ============ */

test("limparDadosLocais espera o worker antes de devolver", () => {
  const src = readFileSync(new URL("../app/components/RegistroPwa.tsx", import.meta.url), "utf8");
  assert.match(src, /const confirmacao = await pedirLimpezaAoServiceWorker\(\)/,
    "sem await, o reload do logout corre com a limpeza");
  assert.match(src, /worker\.postMessage\("LIMPAR_TUDO", \[canal\.port2\]\)/,
    "precisa mandar a porta de volta, senao nao ha como confirmar");
  assert.match(src, /setTimeout\(\(\) => resolve\(null\), LIMITE_CONFIRMACAO_MS\)/,
    "worker travado nao pode pendurar o logout");
  // storage limpo em bloco proprio: falha de cache nao pode pular isso
  const depoisDoCache = src.slice(src.indexOf("if (!confirmacao)"));
  assert.match(depoisDoCache, /localStorage\.removeItem/);
  assert.match(depoisDoCache, /sessionStorage\.removeItem/);
});

test("o logout so recarrega depois de aguardar a limpeza", () => {
  const src = readFileSync(new URL("../app/components/ProfilePanel.tsx", import.meta.url), "utf8");
  const i = src.indexOf("await limparDadosLocais()");
  const j = src.indexOf("window.location.replace");
  assert.ok(i > -1 && j > i, "recarregar antes de aguardar a limpeza recria a corrida");
});
