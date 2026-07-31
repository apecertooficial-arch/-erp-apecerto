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
function criarCaches() {
  const armazem = new Map();
  const fazCache = (nome) => {
    if (!armazem.has(nome)) armazem.set(nome, new Map());
    const m = armazem.get(nome);
    return {
      addAll: async (urls) => urls.forEach((u) => m.set(u, { corpo: `conteudo de ${u}`, ok: true })),
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
  const caches = criarCaches();
  const pedidosDeRede = [];
  const rede = { caiu: false }; // vira true quando quisermos simular estar sem sinal

  const fetchFalso = async (req) => {
    const url = typeof req === "string" ? req : req.url;
    pedidosDeRede.push(url.replace(ORIGEM, ""));
    if (rede.caiu) throw new TypeError("Failed to fetch");
    return { ok: true, corpo: `da rede: ${url}`, clone() { return { ...this }; } };
  };

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
    "/api/session", "/api/performance?periodo=mes", "/api/crm",
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
