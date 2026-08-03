/* Inicio do celular e casca do aplicativo.
 * Regras puras testadas direto; o resto e afirmado sobre o fonte, com
 * assercoes precisas (nao "contem a palavra").
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { montarGrupos, tempoHumano } from "../app/features/home/seuDia.logica.ts";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const RESPONDEU = "Cliente respondeu — aguardando você";
const NOVO = "Lead novo sem primeira atuação";
const agora = Date.now();
const emMin = (m) => new Date(agora + m * 60000).toISOString();

const item = (n, motivo, extra = {}) => ({
  negocio_id: n, lead_nome: `Lead ${n}`, motivo, espera_min: 30, prioridade: 1,
  respondeu: motivo === RESPONDEU, proxima_acao_titulo: null, proxima_acao_em: null, ...extra,
});

/* ---------------- Seu dia ---------------- */

test("os cinco grupos existem, na ordem operacional", () => {
  const g = montarGrupos([], [], []);
  assert.deepEqual(g.map((x) => x.chave), ["responderam", "novos", "vencidas", "compromissos", "tarefas"]);
});

test("no maximo tres itens por grupo, mas o total e o real", () => {
  const fila = Array.from({ length: 19 }, (_, i) => item(i + 1, RESPONDEU));
  const [responderam] = montarGrupos(fila, [], []);
  assert.equal(responderam.itens.length, 3, "mostrar 19 cards nao ajuda ninguem a trabalhar");
  assert.equal(responderam.total, 19, "o contador tem que dizer a verdade");
});

test("separa por motivo exato do banco", () => {
  const fila = [item(1, RESPONDEU), item(2, NOVO), item(3, NOVO)];
  const g = montarGrupos(fila, [], []);
  assert.equal(g[0].total, 1);
  assert.equal(g[1].total, 2);
});

test("motivo desconhecido nao vira numero errado", () => {
  // Se o banco mudar o texto, o grupo esvazia -- nunca conta a coisa errada.
  const g = montarGrupos([item(1, "Algum motivo novo do banco")], [], []);
  assert.equal(g[0].total, 0);
  assert.equal(g[1].total, 0);
});

test("acao vencida conta pelo horario, nao pelo texto", () => {
  const fila = [item(1, RESPONDEU, { proxima_acao_em: emMin(-60) }), item(2, RESPONDEU, { proxima_acao_em: emMin(60) })];
  const vencidas = montarGrupos(fila, [], [])[2];
  assert.equal(vencidas.total, 1);
  assert.equal(vencidas.itens[0].id, "1");
});

test("compromissos de hoje excluem outro dia", () => {
  // Meio-dia evita que o teste atravesse a meia-noite conforme o horario em
  // que o CI roda. A regra exercitada continua sendo o dia civil local.
  const meioDia = new Date();
  meioDia.setHours(12, 0, 0, 0);
  const outroDia = new Date(meioDia);
  outroDia.setDate(outroDia.getDate() + 1);
  const hoje = [
    item(1, "x", { proxima_acao_em: meioDia.toISOString() }),
    item(2, "x", { proxima_acao_em: outroDia.toISOString() }),
  ];
  assert.equal(montarGrupos([], hoje, [])[3].total, 1);
});

test("tarefa concluida nao aparece como vencida", () => {
  const tarefas = [
    { id: 1, titulo: "A", vencimento: new Date(agora - 86400000).toISOString(), concluida: false },
    { id: 2, titulo: "B", vencimento: new Date(agora - 86400000).toISOString(), concluida: true },
    { id: 3, titulo: "C", vencimento: new Date(agora + 86400000).toISOString(), concluida: false },
  ];
  const g = montarGrupos([], [], tarefas)[4];
  assert.equal(g.total, 1);
  assert.equal(g.itens[0].nome, "A");
});

test("card sempre tem nome, motivo e tempo", () => {
  const g = montarGrupos([item(1, RESPONDEU, { proxima_acao_titulo: "Entender necessidade" })], [], [])[0];
  const c = g.itens[0];
  assert.equal(c.nome, "Lead 1");
  assert.equal(c.motivo, "Entender necessidade");
  assert.ok(c.tempo.length > 0);
});

test("lead sem nome nao vira card em branco", () => {
  const g = montarGrupos([item(1, RESPONDEU, { lead_nome: "  " })], [], [])[0];
  assert.equal(g.itens[0].nome, "Lead sem nome");
});

test("tempo em linguagem de gente", () => {
  assert.equal(tempoHumano(0), "agora");
  assert.equal(tempoHumano(45), "45 min");
  assert.equal(tempoHumano(120), "2h");
  assert.equal(tempoHumano(60 * 26), "1d 2h");
  assert.equal(tempoHumano(60 * 24), "1d");
});

/* ---------------- custo de rede ---------------- */

test("o celular nao busca /api/crm no Inicio", () => {
  const home = ler("../app/features/home/HomeWorkspace.tsx");
  const seuDia = ler("../app/features/home/SeuDia.tsx");
  assert.ok(/if \(!ehDesktop\) return;/.test(home),
    "sem essa guarda o celular baixa 1,8 MB e joga fora");
  const posGuarda = home.indexOf("if (!ehDesktop) return;");
  assert.ok(home.indexOf('"/api/crm"') > posGuarda, "/api/crm tem que ficar depois da guarda");
  // procura CHAMADA, nao mencao: o comentario do arquivo cita /api/crm de proposito
  const chamadas = [...seuDia.matchAll(/fetch\(|buscar\("([^"]+)"/g)].map((m) => m[1]).filter(Boolean);
  assert.ok(!chamadas.some((c) => c.includes("/api/crm")), `a tela do celular busca ${chamadas.join(", ")}`);
  assert.ok(/\/api\/ncrm\/fila/.test(seuDia), "a fila e a fonte barata e ja escopada por papel");
});

test("tarefas vem em segunda onda, sem segurar a primeira pintura", () => {
  const seuDia = ler("../app/features/home/SeuDia.tsx");
  assert.ok(/if \(fila === null\) return;/.test(seuDia),
    "/api/projects (222 KB) so pode ser buscado depois que a fila pintou");
});

/* ---------------- casca ---------------- */

test("cabecalho nao repete o titulo do modulo", () => {
  const shell = ler("../app/features/system/ErpShell.tsx");
  assert.ok(/moduloAtual === "Início" \?/.test(shell),
    "no Inicio o cabecalho vira saudacao; nos outros, o nome do modulo");
});

test("badge so aparece com numero real", () => {
  const shell = ler("../app/features/system/ErpShell.tsx");
  assert.ok(/naoLidas > 0 && <b/.test(shell), "zero nao pode virar bolinha decorativa");
  assert.ok(/\(badges\[m\] \?\? 0\) > 0 &&/.test(shell), "idem na barra inferior");
  assert.ok(/badges\["Notificações"\] \?\? 0/.test(shell), "o numero vem do que os modulos publicam");
});

test("sino e perfil tem alvo de toque e rotulo", () => {
  const css = ler("../app/styles/app-mobile.css");
  const i = css.indexOf(".amt-sino, .amt-perfil");
  const bloco = css.slice(i, css.indexOf("}", i));
  assert.match(bloco, /min-width: 44px/);
  assert.match(bloco, /min-height: 44px/);
  const shell = ler("../app/features/system/ErpShell.tsx");
  assert.match(shell, /aria-label=\{rotuloSino\}/);
  assert.match(shell, /aria-label="Abrir meu perfil"/);
});

test("nada do Inicio do celular vaza para o desktop", () => {
  const css = ler("../app/styles/app-mobile.css");
  const trecho = css.slice(css.indexOf("INICIO DO CELULAR"));
  // A unica regra fora de media query e a que ESCONDE por padrao.
  const foraDeMedia = trecho.slice(0, trecho.indexOf("@media"));
  assert.match(foraDeMedia, /\.home-mobile \{ display: none; \}/);
  assert.ok(!/min-height|grid-template|padding:/.test(foraDeMedia),
    "regra de layout fora de @media atingiria o desktop");
});

test("atalhos grandes levam aos quatro destinos pedidos", () => {
  const seuDia = ler("../app/features/home/SeuDia.tsx");
  for (const destino of ["/crm?vista=meu-dia", "/agenda", "/produtos", "/notificacoes"]) {
    assert.ok(seuDia.includes(destino), `falta o atalho para ${destino}`);
  }
  assert.ok(!/destino: "\/financeiro"/.test(seuDia),
    "Financeiro nao pode ser acao principal do corretor");
});
