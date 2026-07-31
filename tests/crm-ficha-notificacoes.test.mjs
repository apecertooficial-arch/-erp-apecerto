/* PR A, continuacao: CRM mobile, ficha e notificacoes. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { montarSecoes, agrupar, ordenar, contarNaoLidasUteis, precisaConfirmar, especieDe, baldeDe } from "../app/features/notifications/notificacoes.logica.ts";
import { grupoVisivel, grupoDoItem } from "../app/features/crm-nova-era/lib/linguagem.ts";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const agora = Date.now();
const iso = (min) => new Date(agora - min * 60000).toISOString();
const av = (id, cat, min, extra = {}) => ({ id, category: cat, title: `t${id}`, context: "c", when: iso(min), dealId: null, count: 1, ...extra });

/* ---------------- NOTIFICACOES ---------------- */

test("631 avisos nao viram 631 na tela", () => {
  const muitos = Array.from({ length: 631 }, (_, i) => av(`x${i}`, "desatualizados", i + 5, { dealId: i }));
  const r = montarSecoes(muitos, { lidas: [], soNaoLidas: true, pagina: 1 });
  assert.equal(r.mostrando, 20, "a primeira carga tem que ser 20");
  assert.equal(r.total, 631);
  assert.equal(r.temMais, 611);
});

test("carregar mais soma de 20 em 20", () => {
  const muitos = Array.from({ length: 631 }, (_, i) => av(`x${i}`, "desatualizados", i + 5, { dealId: i }));
  assert.equal(montarSecoes(muitos, { lidas: [], soNaoLidas: true, pagina: 2 }).mostrando, 40);
  assert.equal(montarSecoes(muitos, { lidas: [], soNaoLidas: true, pagina: 32 }).mostrando, 631);
});

test("listas de 0, 1 e 20 nao quebram", () => {
  for (const n of [0, 1, 20]) {
    const l = Array.from({ length: n }, (_, i) => av(`y${i}`, "leads", i + 1, { dealId: i }));
    const r = montarSecoes(l, { lidas: [], soNaoLidas: true, pagina: 1 });
    assert.equal(r.total, n);
    assert.equal(r.mostrando, Math.min(n, 20));
  }
});

test("prioridade segue a ordem pedida", () => {
  const l = [
    av("s", "sistema", 1, { especie: "sistema" }),
    av("t", "tarefas", 1, { especie: "tarefa" }),
    av("v", "leads", 1, { especie: "visita_proxima" }),
    av("a", "leads", 1, { especie: "acao_vencida" }),
    av("n", "leads", 1, { especie: "lead_novo" }),
    av("r", "mensagens", 1, { especie: "respondeu" }),
  ];
  assert.deepEqual(ordenar(l).map((x) => x.id), ["r", "n", "a", "v", "t", "s"]);
});

test("agrupa duplicados do mesmo lead e ocorrencia", () => {
  // Era assim que 631 apareciam: o titulo carrega o tempo, entao o mesmo
  // problema virava um aviso novo a cada envelhecimento.
  const l = [
    { ...av("stale-9a", "desatualizados", 100, { dealId: 9 }), title: "Lead parado: Ana (2 dias)" },
    { ...av("stale-9b", "desatualizados", 50, { dealId: 9 }), title: "Lead parado: Ana (3 dias)" },
  ];
  const g = agrupar(l);
  assert.equal(g.length, 1, "mesmo lead + mesma especie = um aviso");
  assert.equal(g[0].count, 2);
  assert.match(g[0].title, /3 dias/, "fica com o mais recente");
});

test("badge conta so nao lidas uteis", () => {
  const l = [
    av("r1", "mensagens", 1, { dealId: 1, especie: "respondeu" }),
    av("r2", "mensagens", 2, { dealId: 2, especie: "respondeu" }),
    av("s1", "sistema", 3, { especie: "sistema" }),
  ];
  assert.equal(contarNaoLidasUteis(l, []), 2, "sistema e historico, nao aviso operacional");
  assert.equal(contarNaoLidasUteis(l, ["r1"]), 1);
});

test("Agora / Hoje / Anteriores", () => {
  assert.equal(baldeDe(av("a", "leads", 10)), "agora");
  assert.equal(baldeDe(av("h", "leads", 300)), "hoje");
  assert.equal(baldeDe(av("v", "leads", 60 * 40)), "anteriores");
});

test("marcar tudo pede confirmacao quando sao muitos", () => {
  assert.equal(precisaConfirmar(5), false);
  assert.equal(precisaConfirmar(21), true);
});

test("padrao inicial e nao lidas, e o lido some da lista", () => {
  const l = [av("a", "leads", 1, { dealId: 1 }), av("b", "leads", 2, { dealId: 2 })];
  assert.equal(montarSecoes(l, { lidas: ["a"], soNaoLidas: true, pagina: 1 }).total, 1);
  assert.equal(montarSecoes(l, { lidas: ["a"], soNaoLidas: false, pagina: 1 }).total, 2);
});

test("a tela usa a logica e desambigua o botao Lida", () => {
  const w = ler("../app/features/notifications/NotificationsWorkspace.tsx");
  assert.match(w, /montarSecoes\(/);
  assert.match(w, /useState\(true\)/, "o padrao tem que comecar em nao lidas");
  assert.match(w, /Marcar como lida/);
  assert.ok(!/>Lida</.test(w), 'o botao ambiguo "Lida" nao pode voltar');
  assert.match(w, /publicarBadge\("Notificações"/, "o badge precisa de publisher real");
  assert.match(w, /notif-mais/, "precisa de Carregar mais");
  assert.match(w, /notif-esqueleto/, "precisa de esqueleto");
  assert.match(w, /Tentar novamente/);
});

/* ---------------- CRM MOBILE ---------------- */

test("painel tecnico saiu da tela de quem atende", () => {
  const c = ler("../app/features/crm-nova-era/CrmNovaEraLiveWorkspace.tsx");
  const topo = c.slice(c.indexOf('className="nova-crm-toolbar"'), c.indexOf("{erro &&"));
  for (const proibido of ["IngestAdminControl", "FaseBanner"]) {
    assert.ok(!topo.includes(proibido), `${proibido} nao pode aparecer na barra operacional`);
  }
  assert.match(c, /aba === "operacao" && ehAdmin && \(/, "esses controles vivem na area administrativa");
});

test("navegacao do celular e Meu dia / Quadro / Mais", () => {
  const c = ler("../app/features/crm-nova-era/CrmNovaEraLiveWorkspace.tsx");
  assert.match(c, /ncrm-seg-mais/);
  assert.match(c, /ncrm-mais-folha/);
  const css = ler("../app/styles/app-mobile.css");
  assert.match(css, /\.ncrm-seg-extra \{ display: none !important; \}/, "Treinamento e Visao gerencial saem da barra no celular");
});

test("Meu Dia comeca com 20 e nao repete lead em duas listas", () => {
  const m = ler("../app/features/crm-nova-era/components/MeuDia.tsx");
  assert.match(m, /useState\(20\)/);
  assert.match(m, /slice\(0, limite\)/);
  assert.match(m, /ncrm-dia-mais/);
  // grupoVisivel e uma particao: cada item cai em exatamente um bloco.
  const grupos = ["atenda_agora", "faca_hoje", "agendados", "aguardando_cliente"];
  const destinos = grupos.map((g) => grupoVisivel(g));
  assert.equal(destinos.length, grupos.length);
  for (const d of destinos) assert.ok(["atenda_agora", "faca_combinado", "acompanhe"].includes(d));
});

test("Meu Dia nao baixa /api/crm", () => {
  const m = ler("../app/features/crm-nova-era/components/MeuDia.tsx");
  assert.ok(!/\/api\/crm/.test(m), "1,8 MB para montar uma fila de 20 nao se justifica");
  assert.match(m, /\/api\/ncrm\/fila/);
});

test("busca acessivel na fila, sem zoom no iOS", () => {
  const m = ler("../app/features/crm-nova-era/components/MeuDia.tsx");
  assert.match(m, /aria-label="Buscar na fila"/);
  const css = ler("../app/styles/app-mobile.css");
  const bloco = css.slice(css.indexOf(".ncrm-dia-busca"), css.indexOf(".ncrm-dia-mais"));
  assert.match(bloco, /font-size: 16px/, "abaixo de 16px o iOS dá zoom no campo");
  assert.match(bloco, /min-height: 44px/);
});

/* ---------------- FICHA ---------------- */

test("ficha em tela inteira, com voltar, abas e acao fixa", () => {
  const css = ler("../app/styles/app-mobile.css");
  const f = css.slice(css.indexOf(".ncrm-ficha {"), css.indexOf("/* --- NOTIFICACOES --- */"));
  assert.match(f, /position: fixed; inset: 0/, "tela inteira");
  assert.match(f, /\.ncrm-ficha-voltar/);
  assert.match(f, /\.ncrm-ficha-abas/);
  assert.match(f, /env\(safe-area-inset-top/);
  assert.match(f, /env\(safe-area-inset-bottom/);
  assert.match(f, /\.ncrm-ficha-acao \{[^}]*position: fixed/s, "WhatsApp fixo embaixo");
  // Um scroll so: o corpo rola, a barra de acao nao.
  assert.match(f, /\.ncrm-ficha-corpo \{[^}]*overflow-y: auto/s);
});

test("nenhum overflow-x escondendo quebra nas telas novas", () => {
  const css = ler("../app/styles/app-mobile.css");
  const novo = css.slice(css.indexOf("CRM, FICHA E NOTIFICACOES NO CELULAR"));
  assert.ok(!/overflow-x:\s*hidden/.test(novo),
    "esconder o estouro mascara o layout quebrado em vez de corrigir");
  assert.match(novo, /overflow-wrap: anywhere/, "texto longo quebra em vez de estourar");
});

test("nada das telas novas vaza para o desktop", () => {
  const css = ler("../app/styles/app-mobile.css");
  const novo = css.slice(css.indexOf("CRM, FICHA E NOTIFICACOES NO CELULAR"));
  const foraDeMedia = novo.slice(0, novo.indexOf("@media"));
  assert.ok(!/min-height|position: fixed|grid-template/.test(foraDeMedia),
    "regra de layout fora de @media atingiria o desktop");
});
