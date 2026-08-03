/* Ficha do lead no celular — print 06.
 *
 * Dois testes carregam o peso desta suíte:
 *
 *   1. "a cópia de espera concorda com a fonte canônica" — fichaLead.logica
 *      não pode importar valor de outro módulo (o strip-types do node só
 *      apaga `import type`), então ela carrega uma cópia. Cópia sem teste
 *      é divergência marcada para acontecer: duas telas escrevendo "24h" e
 *      "1 d" para o mesmo lead.
 *
 *   2. "REGRESSÃO: tocar num lead não pode recarregar a página" — abrir
 *      lead com `location.assign('/crm?lead=N')` recarregava o documento,
 *      caía no CRM de desktop, baixava ~1,8 MB e, quando o negócio não
 *      estava naquele payload, morria num `if (!deal) return;` mudo. Do
 *      lado do corretor: "cliquei e não abriu". Se alguém reintroduzir
 *      esse caminho, a suíte cai aqui e não em produção.
 *
 * Importamos do .logica, nunca do .tsx: o strip-types não entende JSX e
 * derrubaria a suíte antes do primeiro assert. O que é do .tsx é
 * conferido como TEXTO.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ABAS_FICHA, ABA_INICIAL, esperaCurta, estadoWhatsapp, etapaHumana, evidencia,
  lerConversa, lerDetalhe, linhasDeDados, oQueFazerAgora, porQueAgora,
  prazoHumano, quandoHumano, rotuloEvento, telefoneExibicao,
} from "../app/features/crm-nova-era/fichaLead.logica.ts";
import { espera } from "../app/features/home/telaCorretor.logica.ts";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const FICHA = "../app/features/crm-nova-era/FichaLeadMobile.tsx";
const LISTA = "../app/features/crm-nova-era/TelaCrmMobile.tsx";

const item = (extra = {}) => ({
  negocio_id: 7, nome: "Camila Aragão", telefone_normalizado: "5511988882869",
  interesse_resumo: "Moema Pássaros", motivo_prioridade: "Cliente respondeu — aguardando você",
  prioridade: 1, respondeu: true, etapa: "em_atendimento", tempo_espera: 1440,
  sara_orientacao_curta: "Confirmar o valor com condomínio e propor visita",
  proxima_acao_prazo: null, outbound_real_confirmado: false, aguardando_sincronizacao: false,
  ...extra,
});

/* ---------------- a cópia amarrada ---------------- */

test("a cópia de espera concorda com a fonte canônica", () => {
  const casos = [-5, 0, 1, 12, 45, 59, 60, 90, 120, 1439, 1440, 2879, 2880, 4320, 10080, 99999];
  for (const m of casos) {
    assert.equal(esperaCurta(m), espera(m), `divergiu em ${m} minutos`);
  }
});

/* ---------------- telefone ---------------- */

test("telefone sai do E.164 no formato que se lê", () => {
  assert.equal(telefoneExibicao("5511988882869"), "(11) 98888-2869");
  assert.equal(telefoneExibicao("551133334444"), "(11) 3333-4444", "fixo de 8 dígitos também");
});

test("telefone quebrado vira nulo, nunca meio número", () => {
  for (const ruim of [null, undefined, "", "5511", "999", "abc", "5511988882869123"]) {
    assert.equal(telefoneExibicao(ruim), null, `deveria recusar: ${ruim}`);
  }
});

/* ---------------- etapa ---------------- */

test("etapa técnica não chega na tela", () => {
  assert.equal(etapaHumana("em_atendimento"), "Em atendimento");
  assert.equal(etapaHumana("PRIMEIRO_CONTATO"), "Primeiro contato");
  assert.equal(etapaHumana(null), "Sem etapa");
  assert.equal(etapaHumana("  "), "Sem etapa");
});

/* ---------------- prazo ---------------- */

test("prazo fala em hoje, amanhã e vencido", () => {
  const agora = new Date(2026, 6, 31, 9, 0, 0);
  assert.equal(prazoHumano(new Date(2026, 6, 31, 12, 0, 0).toISOString(), agora), "Hoje, até 12h");
  assert.equal(prazoHumano(new Date(2026, 6, 31, 12, 30, 0).toISOString(), agora), "Hoje, até 12h30");
  assert.equal(prazoHumano(new Date(2026, 7, 1, 10, 0, 0).toISOString(), agora), "Amanhã, até 10h");
  assert.equal(prazoHumano(new Date(2026, 6, 31, 7, 0, 0).toISOString(), agora), "Venceu 2h atrás");
});

test("sem prazo é sem prazo, não é data inventada", () => {
  assert.equal(prazoHumano(null), "Sem prazo");
  assert.equal(prazoHumano("não é data"), "Sem prazo");
});

/* ---------------- Sara e evidência ---------------- */

test("evidência é fato observável, não opinião", () => {
  assert.equal(evidencia(item({ respondeu: true, tempo_espera: 1440 })), "Respondeu há 24h");
  assert.equal(evidencia(item({ respondeu: false, tempo_espera: 45 })), "Sem resposta há 45 min");
});

test("a Sara fala; calada, o motivo da fila fala", () => {
  assert.equal(oQueFazerAgora(item()), "Confirmar o valor com condomínio e propor visita");
  assert.equal(
    oQueFazerAgora(item({ sara_orientacao_curta: null })),
    "Cliente respondeu — aguardando você",
    "sem orientação, o motivo da fila assume",
  );
  assert.equal(
    oQueFazerAgora(item({ sara_orientacao_curta: null, motivo_prioridade: "" })),
    "Retomar o atendimento",
    "nunca pode ficar em branco",
  );
});

test("o motivo não se repete embaixo da orientação", () => {
  assert.equal(porQueAgora(item()), "Cliente respondeu — aguardando você");
  assert.equal(porQueAgora(item({ sara_orientacao_curta: null })), null, "sem Sara, não duplica");
  const igual = item({ sara_orientacao_curta: "Cliente respondeu — aguardando você" });
  assert.equal(porQueAgora(igual), null, "texto idêntico não vira duas linhas");
});

/* ---------------- WhatsApp honesto ---------------- */

test("abrir o WhatsApp NÃO é ter falado com o cliente", () => {
  assert.equal(estadoWhatsapp(item(), false), "pronto");
  assert.equal(estadoWhatsapp(item(), true), "aguardando", "o toque só registra intenção");
  assert.equal(estadoWhatsapp(item({ aguardando_sincronizacao: true }), false), "aguardando");
});

test("só a confirmação do servidor vira verde", () => {
  const confirmado = item({ outbound_real_confirmado: true });
  assert.equal(estadoWhatsapp(confirmado, true), "confirmado", "confirmação real apaga o aviso local");
  assert.equal(estadoWhatsapp(confirmado, false), "confirmado");
});

/* ---------------- histórico sem vocabulário técnico ---------------- */

test("evento conhecido vira frase de gente", () => {
  assert.equal(rotuloEvento("mensagem_recebida"), "Cliente respondeu");
  assert.equal(rotuloEvento("VISITA_AGENDADA"), "Visita agendada");
});

test("REGRA: tipo desconhecido nunca vaza vocabulário técnico", () => {
  /* Lista fechada e não prettificação de texto cru: um `ingest_retry` novo
     no banco não pode aparecer na tela do corretor amanhã. */
  for (const tecnico of ["ingest_retry", "rpc_falhou", "runner_tick", "observer_x", "piloto_y", null, ""]) {
    assert.equal(rotuloEvento(tecnico), "Atualização do atendimento", `vazou: ${tecnico}`);
  }
});

test("data curta é a que cabe na linha", () => {
  assert.equal(quandoHumano(new Date(2026, 6, 30, 17, 42, 0).toISOString()), "30/07 · 17:42");
  assert.equal(quandoHumano(null), "");
  assert.equal(quandoHumano("nada"), "");
});

/* ---------------- leitura defensiva do detalhe ---------------- */

test("embed do banco pode vir objeto OU lista de um — a ficha aguenta as duas", () => {
  const comObjeto = { estado: { negocios: { leads: { origem: "Anúncio Jamaris" }, corretores: { nome: "Samuel" } } } };
  const comLista = { estado: [{ negocios: [{ leads: [{ origem: "Anúncio Jamaris" }], corretores: [{ nome: "Samuel" }] }] }] };
  for (const j of [comObjeto, comLista]) {
    const d = lerDetalhe(j);
    assert.equal(d.corretor, "Samuel");
    assert.equal(d.origem, "Anúncio Jamaris");
  }
});

test("detalhe vazio não explode e não inventa campo", () => {
  for (const j of [null, undefined, {}, { estado: null }, "texto"]) {
    const d = lerDetalhe(j);
    assert.equal(d.corretor, null);
    assert.deepEqual(d.eventos, []);
  }
});

test("histórico vem do mais recente para o mais antigo", () => {
  const j = { eventos: [
    { id: 1, tipo: "lead_recebido", criado_em: new Date(2026, 6, 29, 10, 0).toISOString() },
    { id: 2, tipo: "mensagem_recebida", criado_em: new Date(2026, 6, 30, 17, 42).toISOString() },
  ] };
  const { eventos } = lerDetalhe(j);
  assert.equal(eventos[0].rotulo, "Cliente respondeu", "na rua ninguém rola até o fim para ver o que é de agora");
  assert.equal(eventos[1].rotulo, "Cliente chegou");
});

/* ---------------- linhas da aba Dados ---------------- */

test("campo vazio não vira linha em branco", () => {
  const semNada = linhasDeDados(item({ interesse_resumo: null }), null);
  assert.deepEqual(semNada, [], "cartão sem dado é cartão sem linha, não linha sem valor");

  const cheio = linhasDeDados(item(), { corretor: "Samuel", origem: "Anúncio Jamaris", email: null, primeiraResposta: null, eventos: [] });
  assert.deepEqual(cheio.map((l) => l.k), ["Corretor", "Origem", "Interesse"]);
});

/* ---------------- conversa ---------------- */

test("conversa separa o que é meu do que é do cliente", () => {
  const msgs = lerConversa({ mensagens: [
    { id: 1, direcao: "in", conteudo: "O condomínio está incluso?", criado_em: new Date(2026, 6, 30, 10, 12).toISOString() },
    { id: 2, direcao: "out", conteudo: "Vou confirmar agora.", criado_em: new Date(2026, 6, 30, 10, 20).toISOString() },
  ] });
  assert.equal(msgs[0].minha, false);
  assert.equal(msgs[1].minha, true);
  assert.equal(msgs[0].quando, "30/07 · 10:12");
});

test("áudio e imagem viram rótulo, não bolha vazia", () => {
  const msgs = lerConversa({ mensagens: [
    { id: 1, direcao: "in", tipo: "audio", conteudo: null },
    { id: 2, direcao: "in", tipo: "texto", conteudo: null },
  ] });
  assert.equal(msgs.length, 1, "texto vazio some; mídia fica com o rótulo dela");
  assert.equal(msgs[0].texto, "[audio]");
});

/* ---------------- as abas ---------------- */

test("as quatro abas do print, na ordem do print", () => {
  assert.deepEqual(ABAS_FICHA.map((a) => a.rotulo), ["Conversa", "Sara", "Dados", "Histórico"]);
  assert.equal(ABA_INICIAL, "dados", "abre onde está o telefone: é a pergunta mais comum na rua");
});

test("Funil, Leads e Visitas abrem as telas 3.0 reais no celular", () => {
  const lista = ler(LISTA);
  const gate = ler("../app/features/crm-nova-era/CrmNovaEraGate.tsx");
  assert.match(lista, /\/crm\?crm=nova-era&aba=\$\{chave\}/);
  assert.ok(!lista.includes('/crm?vista=quadro'), "o link antigo voltava para Meu Dia");
  assert.match(gate, /pedeWorkspace3/);
  assert.match(gate, /entrouNoWorkspace3 && podeLive/);
  assert.match(gate, /<Crm3Workspace/);
});

/* ====================================================================
   A TRAVA: o caminho do toque
   ==================================================================== */

test("REGRESSÃO: tocar num lead não pode recarregar a página", () => {
  const c = ler(LISTA);
  const semComentarios = c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(
    !/location\.assign\(`\/crm\?lead=/.test(semComentarios),
    "abrir lead por location.assign recarrega o documento e cai no CRM de desktop",
  );
  assert.match(semComentarios, /FichaLeadMobile/, "a lista tem que montar a ficha do celular");
});

test("REGRESSÃO: a ficha do celular não baixa /api/crm", () => {
  const c = ler(FICHA);
  assert.ok(!/["'`]\/api\/crm/.test(c), "/api/crm devolve ~1,8 MB e não cabe no 4G da rua");
  assert.match(c, /\/api\/ncrm\?negocio=/, "detalhe vem da rota do CRM novo");
  assert.match(c, /\/api\/ncrm\/conversa\?negocio=/, "conversa vem da rota própria");
});

test("a ficha abre o WhatsApp com link real e fallback", () => {
  const c = ler(FICHA);
  assert.match(c, /href=\{`whatsapp:\/\/send\?phone=\$\{item\.telefone_normalizado\}`\}/);
  assert.match(c, /href=\{`https:\/\/wa\.me\/\$\{item\.telefone_normalizado\}`\}/, "fallback wa.me visível");
  assert.match(c, /marcarWhatsappAberto\(item\.negocio_id\)/, "o clique só registra intenção");
});

test("o toque na ficha não afirma que houve contato", () => {
  const c = ler(FICHA);
  const semComentarios = c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/Contato realizado|Contato feito/i.test(semComentarios), 'nunca "contato realizado" só pelo toque');
  assert.match(semComentarios, /aguardando sincronização/);
});

test("nada de vocabulário técnico no que é renderizado", () => {
  const c = ler(FICHA);
  const semComentarios = c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const termo of ["piloto", "RPC", "ingest", "runner", "observer"]) {
    assert.ok(!new RegExp(`>[^<]*${termo}`, "i").test(semComentarios), `"${termo}" não pode aparecer na ficha`);
  }
});

test("a ficha é somente leitura: não envia nem muda etapa", () => {
  const c = ler(FICHA);
  const semComentarios = c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/method:\s*["']P(OST|ATCH|UT)["']/i.test(semComentarios), "a ficha do celular só lê");
});

test("nada da ficha vaza para o desktop", () => {
  const css = ler("../app/styles/tela-crm.css");
  /* Sem os comentários antes de fatiar: uma citação de media query na
     documentação cortaria a fatia antes da regra e derrubaria o teste
     sem nenhum CSS ter mudado. */
  const limpo = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const fora = limpo.slice(0, limpo.indexOf("@media"));
  assert.match(fora, /\.cm-wrap \{ display: none; \}/);
  assert.ok(!/min-height|grid-template|padding:/.test(fora), "só as regras de ocultar podem viver fora");
  assert.match(limpo, /\.fl-wrap \{ display: none; \}/, "a ficha também não pode vazar");
});

test("alvo de toque grande na ficha", () => {
  const css = ler("../app/styles/tela-crm.css");
  assert.match(css, /\.fl-cta \{[^}]*min-height: 54px/s, "o botão do WhatsApp é o alvo do polegar");
  assert.match(css, /\.fl-voltar \{[^}]*min-height: 44px/s, "voltar também precisa de alvo");
  assert.match(css, /\.fl-fallback \{[^}]*min-height: 44px/s);
  assert.match(css, /overflow-wrap: anywhere/, "texto da Sara não pode empurrar a tela para o lado");
});
