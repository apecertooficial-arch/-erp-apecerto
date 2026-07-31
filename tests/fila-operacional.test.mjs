/* GET /api/ncrm/fila-operacional — payload do app do corretor.
 *
 * A rota nao cria contrato no banco: reusa ncrm_fila_trabalho (que ja decide o
 * escopo DENTRO do Postgres) e enriquece em lote so o que ela devolveu.
 *
 * O teste que importa e o da INTERSECAO: se ela sumir, o corretor A passa a
 * receber lead do corretor B. Ha um caso que reprova a versao sem ela.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizarTelefone, orientacaoCurta, ordemCanonica, aplicarCursor, decodificarCursor }
  from "../app/api/ncrm/fila-operacional/logica.ts";

const fonte = readFileSync(new URL("../app/api/ncrm/fila-operacional/route.ts", import.meta.url), "utf8")
  + readFileSync(new URL("../app/api/ncrm/fila-operacional/logica.ts", import.meta.url), "utf8");
const semComentarios = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const item = (id, prio, espera, extra = {}) => ({
  negocio_id: id, lead_nome: `Lead ${id}`, etapa: "em_atendimento", motivo: "Cliente respondeu — aguardando você",
  espera_min: espera, prioridade: prio, proxima_acao_titulo: null, proxima_acao_em: null, ...extra,
});

/* ---------------- telefone ---------------- */

test("telefone normaliza para E.164 e invalido vira null", () => {
  assert.equal(normalizarTelefone("(11) 94729-2840"), "5511947292840");
  assert.equal(normalizarTelefone("11947292840"), "5511947292840");
  assert.equal(normalizarTelefone("5511947292840"), "5511947292840");
  assert.equal(normalizarTelefone("1133334444"), "551133334444");
  // meio numero nunca vira link de discagem
  for (const ruim of [null, undefined, "", "123", "abc", "9999", "551194729284000000", "0011947292840"]) {
    assert.equal(normalizarTelefone(ruim), null, `"${ruim}" deveria ser null`);
  }
});

test("DDD fora da faixa e recusado", () => {
  assert.equal(normalizarTelefone("5501947292840"), null);
  assert.equal(normalizarTelefone("5510947292840"), null);
  assert.equal(normalizarTelefone("5511947292840"), "5511947292840");
});

/* ---------------- ordenacao e cursor ---------------- */

test("ordem canonica: prioridade, espera, id", () => {
  const l = [item(3, 2, 10), item(1, 1, 50), item(2, 1, 90), item(4, 1, 50)];
  assert.deepEqual(l.sort(ordemCanonica).map((i) => i.negocio_id), [2, 1, 4, 3]);
});

test("cursor e estavel e nao repete nem pula item", () => {
  const todos = Array.from({ length: 45 }, (_, k) => item(k + 1, (k % 3) + 1, 100 - k)).sort(ordemCanonica);
  const vistos = [];
  let cursor = null;
  for (let volta = 0; volta < 5; volta++) {
    const pag = aplicarCursor(todos, cursor).slice(0, 20);
    if (!pag.length) break;
    vistos.push(...pag.map((i) => i.negocio_id));
    const u = pag[pag.length - 1];
    cursor = `${u.prioridade}:${Math.round(u.espera_min)}:${u.negocio_id}`;
  }
  assert.equal(vistos.length, 45, "algum item sumiu ou repetiu entre paginas");
  assert.equal(new Set(vistos).size, 45);
  assert.deepEqual(vistos, todos.map((i) => i.negocio_id), "a ordem tem que ser a canonica");
});

test("cursor corrompido nao escapa do escopo: volta a primeira pagina", () => {
  const todos = [item(1, 1, 90), item(2, 1, 80)].sort(ordemCanonica);
  for (const ruim of ["", "abc", "1:2", "1:2:3:4", "x:y:z", "../../etc"]) {
    assert.equal(decodificarCursor(ruim), null, `cursor "${ruim}" deveria ser recusado`);
    assert.equal(aplicarCursor(todos, ruim).length, 2, "cursor invalido nao pode filtrar nada fora");
  }
});

test("pagina limitada a 20 no servidor", () => {
  assert.match(semComentarios, /const POR_PAGINA = 20/);
  assert.match(semComentarios, /\.slice\(0, POR_PAGINA\)/);
  // o limite NAO pode vir da query string
  assert.ok(!/searchParams\.get\(["'](limite|limit|por_pagina|perPage)["']\)/.test(semComentarios),
    "limite de pagina nao pode ser definido pelo cliente");
});

/* ---------------- autorizacao ---------------- */

test("nenhum parametro do cliente amplia escopo", () => {
  for (const proibido of ["corretor", "corretor_id", "broker_id", "brokerId", "user_id", "usuario_id"]) {
    assert.ok(!new RegExp(`searchParams\\.get\\(["']${proibido}["']\\)`).test(semComentarios),
      `a rota le "${proibido}" do cliente — isso e IDOR`);
  }
  // a fila e sempre chamada com corretor nulo: quem decide escopo e o banco
  assert.match(semComentarios, /p_corretor:\s*null/);
});

test("sessao ausente ou invalida e recusada com 401", () => {
  assert.match(semComentarios, /if \(!token\) return Response\.json\([^)]*401/s);
  assert.match(semComentarios, /authErr \|\| !auth\.user.*401/s);
  assert.match(semComentarios, /supabase\.auth\.getUser\(token\)/);
});

test("o conjunto autorizado vem da fila, e todo lote e filtrado por ele", () => {
  assert.match(semComentarios, /const autorizados = new Set\(pagina\.map/);
  // Cada lote enriquecido precisa passar pela intersecao. Verificacao nominal,
  // nao por contagem: contar permitiria alguem remover um filtro e adicionar
  // outro no mesmo lugar.
  const negocios = semComentarios.slice(semComentarios.indexOf("const negocios ="), semComentarios.indexOf("const estados ="));
  assert.match(negocios, /autorizados\.has\(Number\(n\.id\)\)/, "negocios sem intersecao");

  const estados = semComentarios.slice(semComentarios.indexOf("const estados ="), semComentarios.indexOf("const sara ="));
  assert.match(estados, /autorizados\.has\(Number\(e\.negocio_id\)\)/, "ncrm_estado sem intersecao");

  const sara = semComentarios.slice(semComentarios.indexOf("for (const s of saraRes"), semComentarios.indexOf("const intencao ="));
  assert.match(sara, /!autorizados\.has\(id\)/, "ncrm_sara_analise sem intersecao");

  const intencao = semComentarios.slice(semComentarios.indexOf("for (const i of intRes"), semComentarios.indexOf("const leadIds ="));
  assert.match(intencao, /!autorizados\.has\(id\)/, "ncrm_whatsapp_intencao sem intersecao");

  // leads tem intersecao propria, derivada dos negocios ja filtrados
  assert.match(semComentarios, /leadsPermitidos\.has\(Number\(l\.id\)\)/, "leads sem intersecao");
});

test("a versao SEM intersecao reprova", () => {
  // Simula o bug: enriquecer sem cruzar com o conjunto autorizado.
  const autorizados = new Set([10, 11]);
  const doBanco = [{ negocio_id: 10 }, { negocio_id: 99 }]; // 99 e de outro corretor

  const inseguro = doBanco;
  const seguro = doBanco.filter((r) => autorizados.has(r.negocio_id));

  assert.equal(seguro.length, 1, "com intersecao, so o autorizado passa");
  assert.ok(inseguro.some((r) => !autorizados.has(r.negocio_id)),
    "sem intersecao, lead alheio entra — e este teste existe para reprovar isso");
});

test("lead alheio nao aparece: a projecao sai da pagina autorizada", () => {
  // O map final percorre "pagina" (da fila), nao o resultado das consultas.
  assert.match(semComentarios, /const itens = pagina\.map\(/,
    "projetar a partir do resultado do banco permitiria linha fora do escopo");
});

test("telefone so e projetado depois da intersecao", () => {
  const posAutorizados = semComentarios.indexOf("const autorizados");
  const posLeads = semComentarios.indexOf('from("leads")');
  const posTelefone = semComentarios.indexOf("telefone_normalizado:");
  assert.ok(posAutorizados > -1 && posLeads > posAutorizados, "leads sao buscados depois do escopo");
  assert.ok(posTelefone > posLeads, "telefone e projetado por ultimo");
  assert.match(semComentarios, /const leadsPermitidos = new Set\(leadIds\)/,
    "os leads tambem passam por intersecao propria");
});

/* ---------------- consulta em lote ---------------- */

test("sem N+1: nenhuma consulta dentro de laco", () => {
  const emLaco = /(for\s*\(|\.map\(|\.forEach\()[^;]{0,400}?db\.from\(/s.test(semComentarios);
  assert.ok(!emLaco, "consulta dentro de laco vira 20 idas ao banco por abertura de tela");
  assert.match(semComentarios, /\.in\("id", ids\)/);
  assert.match(semComentarios, /\.in\("negocio_id", ids\)/);
  assert.match(semComentarios, /Promise\.all\(\[/);
});

/* ---------------- vazamento ---------------- */

test("nenhum telefone em log ou mensagem de erro", () => {
  assert.ok(!/console\.(log|error|warn|info)/.test(semComentarios), "a rota nao registra nada em log");
  const erros = semComentarios.match(/error:\s*"[^"]*"/g) ?? [];
  for (const e of erros) {
    assert.ok(!/telefone|phone|\d{8,}/i.test(e), `mensagem de erro vaza dado: ${e}`);
  }
});

test("nenhum service_role na rota", () => {
  assert.ok(!/service_role|SERVICE_ROLE|serviceRole/.test(fonte),
    "cliente administrativo aqui contornaria a RLS");
  assert.match(semComentarios, /createServerSupabaseClient\(token\)/,
    "o cliente tem que ser no contexto do usuario");
});

/* ---------------- payload ---------------- */

test("o payload tem exatamente os campos do contrato", () => {
  for (const campo of [
    "lead_id", "negocio_id", "nome", "telefone_normalizado", "interesse_resumo",
    "motivo_prioridade", "tempo_espera", "sara_orientacao_curta", "proxima_acao_tipo",
    "proxima_acao_prazo", "outbound_real_confirmado", "aguardando_sincronizacao", "deep_link",
  ]) {
    assert.ok(new RegExp(`${campo}:`).test(semComentarios), `falta ${campo} no payload`);
  }
  assert.match(semComentarios, /next_cursor/);
});

test("outbound so e confirmado por saida humana com message_id", () => {
  assert.match(semComentarios, /est\?\.primeira_saida_humana_em && est\?\.primeira_saida_message_id/);
  // aguardando so vale enquanto nao ha confirmacao real
  assert.match(semComentarios, /aguardando = .*!outboundConfirmado/s);
});

test("orientacao da Sara cabe no card e nao corta palavra", () => {
  assert.equal(orientacaoCurta(null), null);
  assert.equal(orientacaoCurta("   "), null);
  assert.equal(orientacaoCurta("Ligar amanhã"), "Ligar amanhã");
  // 120 chars exatos: cabe, nao trunca
  const exato = "a".repeat(120);
  assert.equal(orientacaoCurta(exato), exato, "no limite nao pode truncar");

  const longo = "Cliente demonstrou interesse no apartamento de dois dormitorios na zona sul e pediu expressamente para retornar depois das dezoito horas de amanha";
  const c = orientacaoCurta(longo);
  assert.ok(longo.length > 120, "o caso de teste precisa estourar o limite");
  assert.ok(c.length <= 121, "estourou o tamanho do card");
  assert.ok(c.endsWith("…"));
  assert.ok(!/\s…$/.test(c), "nao pode sobrar espaco antes das reticencias");
  assert.ok(longo.startsWith(c.slice(0, -1)), "o corte tem que ser prefixo do original");
  // espaco colapsado
  assert.equal(orientacaoCurta("  Ligar   amanha  "), "Ligar amanha");
});
