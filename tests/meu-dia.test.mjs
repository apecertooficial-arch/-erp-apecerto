/* Meu Dia do corretor — a tela do app.
 * O teste mais importante e o primeiro: a copia da regra de grupos aqui tem
 * que concordar com a fonte canonica do CRM. Se divergirem, o corretor ve o
 * lead num bloco na home e noutro no CRM.
 *
 * A TELA foi reconstruida no desenho do prototipo e vive em TelaCorretor.tsx;
 * as regras puras dela, em telaCorretor.logica.ts. MeuDiaCorretor.tsx virou
 * casca fina. As garantias abaixo nao mudaram de conteudo -- so de arquivo e
 * de nome de classe.
 *
 * Importamos do .logica, nunca do .tsx: o strip-types do node nao entende JSX
 * e derrubaria a suite inteira antes do primeiro assert.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  montarBlocos, paraAtender, acaoDoItem, esperaHumana, saudacao,
  grupoDoItem as grupoLocal, grupoVisivel as visivelLocal, ORDEM_BLOCOS,
} from "../app/features/home/meuDia.logica.ts";
import { grupoDoItem as grupoCanon, grupoVisivel as visivelCanon } from "../app/features/crm-nova-era/lib/linguagem.ts";
import {
  iniciais, espera, filtrar, saudacaoHora, manchete, ehVencida,
} from "../app/features/home/telaCorretor.logica.ts";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const item = (id, prio, extra = {}) => ({
  negocio_id: id, lead_id: id, nome: `Lead ${id}`, etapa: "em_atendimento",
  motivo_prioridade: "Cliente respondeu — aguardando você", tempo_espera: 90,
  prioridade: prio, respondeu: true, telefone_normalizado: null, interesse_resumo: null,
  sara_orientacao_curta: null, proxima_acao_tipo: null, proxima_acao_prazo: null,
  outbound_real_confirmado: false, aguardando_sincronizacao: false,
  deep_link: `/crm?lead=${id}`, ...extra,
});

test("a copia da regra concorda com a fonte canonica", () => {
  for (const prioridade of [1, 2, 3, 6, 7, 9]) {
    for (const respondeu of [true, false]) {
      const i = { prioridade, respondeu, proxima_acao_em: null };
      assert.equal(grupoLocal(i), grupoCanon(i), `grupoDoItem divergiu em prioridade ${prioridade}`);
      assert.equal(visivelLocal(grupoLocal(i)), visivelCanon(grupoCanon(i)), "grupoVisivel divergiu");
    }
  }
});

test("tres blocos, na ordem do trabalho", () => {
  assert.deepEqual(ORDEM_BLOCOS, ["atenda_agora", "faca_combinado", "acompanhe"]);
  assert.deepEqual(montarBlocos([]).map((b) => b.titulo), ["Atenda agora", "Faça o combinado", "Acompanhe"]);
});

test("nenhum lead aparece em dois blocos", () => {
  const itens = [item(1, 1), item(2, 4), item(3, 9, { respondeu: true }), item(4, 9, { respondeu: false })];
  const blocos = montarBlocos(itens, 99);
  const ids = blocos.flatMap((b) => b.cards.map((c) => c.negocioId));
  assert.equal(ids.length, new Set(ids).size, "o mesmo negocio caiu em mais de um bloco");
  assert.equal(ids.length, itens.length, "algum lead sumiu");
});

test("mostra poucos, mas conta todos", () => {
  const itens = Array.from({ length: 19 }, (_, i) => item(i + 1, 1));
  const [agora] = montarBlocos(itens);
  assert.equal(agora.cards.length, 3);
  assert.equal(agora.total, 19);
});

test("\"Você tem X clientes\" conta so a urgencia", () => {
  const itens = [item(1, 1), item(2, 2), item(3, 5), item(4, 9, { respondeu: true })];
  assert.equal(paraAtender(itens), 2, "faca_combinado e acompanhe nao entram na chamada do topo");
});

test("acao principal: WhatsApp so com telefone valido no payload", () => {
  assert.equal(acaoDoItem(item(1, 1)), "atendimento");
  assert.equal(acaoDoItem(item(1, 1, { telefone_normalizado: "5511947292840" })), "whatsapp");
});

test("compromisso operacional vira Ver tarefa, nao conversa", () => {
  const tel = { telefone_normalizado: "5511947292840" };
  for (const t of ["agendar_visita", "coletar_documentos", "enviar_proposta", "assinatura_contrato"]) {
    assert.equal(acaoDoItem(item(1, 1, { ...tel, proxima_acao_tipo: t })), "tarefa", `"${t}" deveria ser tarefa`);
  }
  assert.equal(acaoDoItem(item(1, 1, { ...tel, proxima_acao_tipo: "entender_necessidade" })), "whatsapp");
});

test("card carrega nome, motivo, tempo e etapa", () => {
  const [b] = montarBlocos([item(7, 1, { tempo_espera: 130 })]);
  const c = b.cards[0];
  assert.equal(c.nome, "Lead 7");
  assert.equal(c.motivo, "Cliente respondeu — aguardando você");
  assert.equal(c.espera, "2h");
  assert.equal(c.etapa, "Em atendimento", "etapa tecnica nao pode vazar para a tela");
});

test("lead sem nome nao vira card em branco", () => {
  const [b] = montarBlocos([item(9, 1, { nome: "   " })]);
  assert.equal(b.cards[0].nome, "Atendimento 9");
});

test("acao vencida e marcada", () => {
  const vencida = item(1, 1, { proxima_acao_prazo: new Date(Date.now() - 3600e3).toISOString() });
  const futura = item(2, 1, { proxima_acao_prazo: new Date(Date.now() + 3600e3).toISOString() });
  assert.equal(montarBlocos([vencida])[0].cards[0].vencida, true);
  assert.equal(montarBlocos([futura])[0].cards[0].vencida, false);
});

test("tempo e saudacao em linguagem de gente", () => {
  assert.equal(esperaHumana(0), "agora");
  assert.equal(esperaHumana(45), "45 min");
  assert.equal(esperaHumana(60 * 26), "1d 2h");
  assert.equal(saudacao(8), "Bom dia");
  assert.equal(saudacao(14), "Boa tarde");
  assert.equal(saudacao(21), "Boa noite");
});

test("listas de 0, 3, 20 e muitos leads", () => {
  for (const n of [0, 3, 20, 500]) {
    const itens = Array.from({ length: n }, (_, i) => item(i + 1, (i % 9) + 1));
    const blocos = montarBlocos(itens);
    assert.equal(blocos.reduce((a, b) => a + b.total, 0), n);
    for (const b of blocos) assert.ok(b.cards.length <= 3, "nunca mais de 3 visiveis por bloco");
  }
});

/* ---------------- regras da tela nova ---------------- */

test("iniciais nunca ficam em branco", () => {
  assert.equal(iniciais("Camila Aragão"), "CA");
  assert.equal(iniciais("Rodrigo dos Santos Sampaio"), "RS");
  assert.equal(iniciais("Ana"), "AN");
  assert.equal(iniciais("   "), "?", "lead sem nome nao pode virar bolinha vazia");
  assert.equal(iniciais(null), "?");
});

test("tempo de espera encurta conforme cresce", () => {
  assert.equal(espera(12), "12 min");
  assert.equal(espera(0), "0 min");
  assert.equal(espera(60 * 24), "24h");
  assert.equal(espera(60 * 24 * 3), "3 d", "depois de dois dias o minuto nao interessa");
  assert.equal(espera(-5), "0 min", "tempo negativo nao existe na tela");
});

test("saudacao da tela nova bate com a antiga", () => {
  for (const h of [0, 8, 11, 12, 17, 18, 23]) assert.equal(saudacaoHora(h), saudacao(h));
});

test("manchete fala de gente, no singular e no plural", () => {
  assert.equal(manchete(0, true), "Carregando sua fila…");
  assert.equal(manchete(0, false), "Ninguém esperando agora");
  assert.equal(manchete(1, false), "1 pessoa espera você agora");
  assert.equal(manchete(4, false), "4 pessoas esperam você agora");
});

test("filtro Agora so traz quem espera de verdade", () => {
  const itens = [item(1, 1), item(2, 2), item(3, 5), item(4, 7)];
  assert.equal(filtrar(itens, "agora").length, 2, "prioridade 1 e 2 e quem espera agora");
  assert.equal(filtrar(itens, "todos").length, 4);
  /* Hoje CONTEM Agora: quem espera agora tambem e coisa de hoje. Se nao
     contivesse, o corretor trocaria para "Hoje" e perderia os urgentes. */
  assert.ok(filtrar(itens, "hoje").length >= filtrar(itens, "agora").length);
});

test("vencida marca cadencia e proxima acao atrasadas", () => {
  assert.equal(ehVencida(item(1, 3)), true);
  assert.equal(ehVencida(item(2, 5)), true);
  assert.equal(ehVencida(item(3, 1)), false);
});

/* ---------------- a tela ---------------- */

const TELA = "../app/features/home/TelaCorretor.tsx";

test("o Inicio do app nao replica a fila nem a gestao do funil antigo", () => {
  const home = ler("../app/features/home/HomeWorkspace.tsx");
  const celular = home.slice(home.indexOf("if (ehCelular === true)"), home.indexOf("if (ehCelular === null)"));
  assert.match(celular, /InicioApp/, "o Inicio precisa ter identidade propria do aplicativo");
  assert.ok(!/MeuDiaCorretor|hm-gestao/.test(celular), "Inicio nao pode parecer o funil antigo");
  assert.ok(!/hv2-hero|Abrir Financeiro/.test(celular), "meta e Financeiro nao aparecem na tela do corretor");
});

test("Inicio do app delega o Meu Dia ao Funil 2 mobile e mantém Avisos acessível", () => {
  const inicio = ler("../app/features/home/InicioApp.tsx");
  const funil2Mobile = ler("../app/features/funil-2/Funil2Mobile.tsx");
  assert.match(inicio, /<Funil2Mobile[\s\S]*modo="inicio"/);
  assert.match(funil2Mobile, /fetch\("\/api\/funil2"/);
  assert.ok(funil2Mobile.includes("/notificacoes"));
  assert.ok(!`${inicio}\n${funil2Mobile}`.includes("/financeiro"));
});

test("barra do aplicativo fala Meu Dia, CRM e Calendário", () => {
  const rotas = ler("../app/features/system/erp-routes.ts");
  assert.match(rotas, /rotuloCurto: "Meu Dia"/);
  assert.match(rotas, /rotuloCurto: "Calendário"/);
});

test("Sara fica acima da barra inferior no celular", () => {
  const sara = ler("../app/components/SaraWidget.tsx");
  assert.match(sara, /@media\(max-width:900px\).*#sara-fab\{[^}]*bottom:calc\(70px/s);
});

test("avisos do Funil 2 nunca abrem automaticamente e ficam compactos no celular", () => {
  const funil = ler("../app/features/funil-2/Funil2Workspace.tsx");
  const css = ler("../app/features/funil-2/estilos.ts");
  assert.match(funil, /useState\(false\)/, "o sino começa fechado");
  assert.match(css, /\.f2-avisos-pop\{position:fixed;left:auto;right:12px[^}]*max-height:58vh/,
    "o painel não pode tomar a tela inteira");
});

test("o toque no card nao afirma que houve contato", () => {
  const c = ler(TELA);
  // Frase alinhada a spec da Entrega 2.
  assert.match(c, /aguardando sincronização/);
  // Olha o que e RENDERIZADO: o comentario do arquivo cita a frase proibida de
  // proposito, para explicar por que ela nao existe.
  const semComentarios = c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/Contato realizado|Contato feito/i.test(semComentarios), 'nunca "contato realizado" so pelo toque');
  assert.match(c, /whatsappAbertoEm/, "o estado vem do registro local de intencao, nao de envio");
});

test("a tela nao baixa /api/crm", () => {
  const c = ler(TELA);
  assert.ok(!/\/api\/crm/.test(c));
  assert.match(c, /\/api\/ncrm\/fila/);
});

test("nada da tela do corretor vaza para o desktop", () => {
  const css = ler("../app/styles/tela-corretor.css");
  const fora = css.slice(0, css.indexOf("@media"));
  assert.match(fora, /\.tc-wrap \{ display: none; \}/);
  assert.ok(!/min-height|grid-template|padding:/.test(fora), "so a regra de ocultar pode viver fora do @media");
});

test("alvo principal grande e sem overflow escondido", () => {
  const css = ler("../app/styles/tela-corretor.css");
  assert.match(css, /\.tc-cta \{[^}]*min-height: 52px/s);
  assert.match(css, /\.tc-fallback \{[^}]*min-height: 44px/s, "o fallback tambem precisa de alvo de toque");
  assert.ok(!/overflow-x:\s*hidden/.test(css));
  assert.match(css, /overflow-wrap: anywhere/, "texto da Sara nao pode empurrar a tela para o lado");
});

/* ---------------- Entrega 2: WhatsApp no card ---------------- */

test("o card usa a fila-operacional, nao a fila crua", () => {
  const c = ler(TELA);
  assert.match(c, /\/api\/ncrm\/fila-operacional/);
  assert.ok(!/fila\?filtro=/.test(c), "a fila crua nao tem telefone nem Sara");
});

test("WhatsApp e link real com fallback, e o clique so registra intencao", () => {
  const c = ler(TELA);
  assert.match(c, /href=\{`whatsapp:\/\/send\?phone=\$\{i\.telefone_normalizado\}`\}/);
  assert.match(c, /href=\{`https:\/\/wa\.me\/\$\{i\.telefone_normalizado\}`\}/, "fallback wa.me visivel");
  assert.match(c, /marcarWhatsappAberto\(i\.negocio_id\)/);
  // o clique nao pode disparar rede nem escrita
  const onClicks = [...c.matchAll(/onClick=\{\(\) => ([^}]+)\}/g)].map((m) => m[1]);
  for (const h of onClicks) {
    assert.ok(!/fetch|post|update|concluir|etapa/i.test(h), `onClick faz mais que registrar intencao: ${h}`);
  }
});

test("aguardando sincronizacao: servidor OU local, e outbound real apaga", () => {
  const c = ler(TELA);
  assert.match(c, /!i\.outbound_real_confirmado && \(i\.aguardando_sincronizacao \|\| abriuLocal\)/);
  assert.match(c, /limparWhatsappAberto\(i\.negocio_id\)/, "confirmacao real limpa o aviso local");
  assert.match(c, /WhatsApp aberto — aguardando sincronização/);
});

test("sem <a> dentro de <button>: o corpo e a acao sao irmaos", () => {
  const c = ler(TELA);
  const corpo = c.slice(c.indexOf("tc-card-corpo"), c.indexOf("</button>", c.indexOf("tc-card-corpo")));
  assert.ok(!corpo.includes("<a"), "link dentro de botao e HTML invalido e quebra leitor de tela");
});

test("card mostra interesse e orientacao da Sara quando existem", () => {
  const c = ler(TELA);
  assert.match(c, /i\.interesse_resumo && <span className="tc-sub"/);
  assert.match(c, /i\.sara_orientacao_curta && \(/);
  assert.match(c, /className="tc-sara"/);
});

test("a Sara aparece rotulada, sem vocabulario tecnico", () => {
  const c = ler(TELA);
  assert.match(c, /Sara · o que fazer/, "o bloco roxo precisa dizer de quem e a orientacao");
  const semComentarios = c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const termo of ["piloto", "RPC", "ingest", "runner", "observer"]) {
    assert.ok(!new RegExp(`>[^<]*${termo}`, "i").test(semComentarios), `"${termo}" nao pode aparecer na tela do corretor`);
  }
});
