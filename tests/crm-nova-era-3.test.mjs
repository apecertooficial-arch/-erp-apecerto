/* CRM Nova Era 3.0 — as regras que não podem quebrar.
 *
 * Testes puros: sem rede, sem banco, sem navegador. Os arquivos .tsx entram
 * como TEXTO (o Node não transforma JSX) — e é de propósito: várias regras
 * desta entrega são "isto NÃO pode existir no código", e a leitura do fonte é
 * a forma honesta de prender isso.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ABAS_3, abasVisiveis, abaDaUrl, podeVerGestao,
  TERMOS_FORA_DA_VISAO_DO_CORRETOR,
} from "../app/features/crm-nova-era-3/lib/navegacao.ts";
import {
  MOMENTOS, ORDEM_MOMENTOS, ehMomentoValido, momentosBatemComODominio,
} from "../app/features/crm-nova-era-3/lib/momentos.ts";
import {
  ORDEM_SECOES, SECAO_TITULO, montarSecoes, secaoDoItem, unificarPorCliente,
  totalParaAtender, botaoPrincipal, chaveCliente,
} from "../app/features/crm-nova-era-3/lib/meuDia3.ts";
import { grupoDoItem, grupoVisivel } from "../app/features/crm-nova-era/lib/linguagem.ts";
import { slaDoLead, tomDoSla } from "../app/features/crm-nova-era-3/lib/sla3.ts";
import { ORDEM_FICHA, TITULO_BLOCO, prepararChamada, frasedaSituacao } from "../app/features/crm-nova-era-3/lib/ficha3.ts";
import {
  ACOES_SARA, normalizarSara, proximaAcaoSugerida,
  SARA_PODE_ENVIAR, SARA_PODE_MOVER_ETAPA,
} from "../app/features/crm-nova-era-3/lib/sara3.ts";
import { fotoDoLead, interesseDoLead, imoveisDoLead } from "../app/features/crm-nova-era-3/lib/adapter3.ts";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const base = "../app/features/crm-nova-era-3/";

const ARQUIVOS_DO_CORRETOR = [
  "Crm3Workspace.tsx",
  "components/MeuDia3.tsx",
  "components/Funil3.tsx",
  "components/Card3.tsx",
  "components/Ficha3.tsx",
  "components/Sara3.tsx",
  "components/FormAcao3.tsx",
  "components/Avisos3.tsx",
  "lib/navegacao.ts",
  "lib/momentos.ts",
  "lib/meuDia3.ts",
  "lib/ficha3.ts",
  "lib/sla3.ts",
  "lib/sara3.ts",
];

const item = (id, prioridade, extra = {}) => ({
  negocio_id: id,
  lead_nome: `Cliente ${id}`,
  etapa: "em_atendimento",
  temperatura: "morno",
  corretor_nome: "Ana",
  proxima_acao_titulo: "Ligar de volta",
  proxima_acao_em: null,
  prioridade,
  motivo: "Cliente respondeu",
  espera_min: 90,
  respondeu: true,
  ...extra,
});

/* ============================ NAVEGAÇÃO ============================ */

test("oito abas, nesta ordem", () => {
  assert.deepEqual(ABAS_3.map((a) => a.chave), [
    "meu_dia", "funil", "leads", "visitas", "esteira", "agenda", "avisos", "gestao",
  ]);
  assert.deepEqual(ABAS_3.map((a) => a.titulo), [
    "Meu Dia", "Funil", "Leads", "Visitas", "Esteira de Vendas", "Agenda", "Avisos", "Gestão",
  ]);
});

test("Gestão é a única aba restrita, e o corretor não a vê", () => {
  assert.deepEqual(ABAS_3.filter((a) => a.restrita).map((a) => a.chave), ["gestao"]);
  assert.equal(podeVerGestao("corretor"), false);
  assert.equal(podeVerGestao("admin"), true);
  assert.equal(podeVerGestao(null), false);
  assert.equal(abasVisiveis("corretor").length, 7);
  assert.equal(abasVisiveis("admin").length, 8);
  assert.ok(!abasVisiveis("corretor").some((a) => a.chave === "gestao"));
});

test("deep-link não vira porta dos fundos para a Gestão", () => {
  assert.equal(abaDaUrl("gestao", "corretor"), "meu_dia");
  assert.equal(abaDaUrl("gestao", "admin"), "gestao");
  assert.equal(abaDaUrl("inexistente", "admin"), "meu_dia");
  assert.equal(abaDaUrl(null, "admin"), "meu_dia");
  assert.equal(abaDaUrl("visitas", "corretor"), "visitas");
});

test("jargão técnico não aparece na tela de quem atende", () => {
  // navegacao.ts é onde a lista PROIBIDA está declarada — varrer o próprio
  // dicionário seria acusar o dicionário de conter as palavras que ele proíbe.
  for (const arquivo of ARQUIVOS_DO_CORRETOR.filter((a) => a !== "lib/navegacao.ts")) {
    const fonte = ler(base + arquivo);
    // Só o que é TEXTO VISÍVEL importa: comentários explicam a regra e podem citar o termo.
    const visiveis = fonte
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//") && !l.trimStart().startsWith("/*"))
      .join("\n")
      .toLowerCase();
    for (const termo of TERMOS_FORA_DA_VISAO_DO_CORRETOR) {
      assert.ok(!visiveis.includes(termo), `"${termo}" apareceu em ${arquivo}`);
    }
  }
});

/* ============================ FUNIL ============================ */

test("quatro momentos, e a tela concorda com o domínio", () => {
  assert.equal(MOMENTOS.length, 4);
  assert.deepEqual([...ORDEM_MOMENTOS], ["novo", "tentando_contato", "em_atendimento", "em_acompanhamento"]);
  assert.ok(momentosBatemComODominio(), "a apresentação divergiu das COLUNAS do domínio");
});

test("visita e proposta nunca viram coluna", () => {
  assert.equal(ehMomentoValido("visita"), false);
  assert.equal(ehMomentoValido("proposta"), false);
  assert.equal(ehMomentoValido("visita_agendada"), false);
  assert.equal(ehMomentoValido("novo"), true);
});

/* ============================ MEU DIA ============================ */

test("três seções, na ordem do trabalho", () => {
  assert.deepEqual([...ORDEM_SECOES], ["atender_agora", "fazer_hoje", "acompanhar_depois"]);
  assert.deepEqual(montarSecoes([]).map((b) => b.titulo), ["Faça agora", "Fazer hoje", "Monitorados pela Sara"]);
  assert.equal(SECAO_TITULO.atender_agora, "Faça agora");
});

test("a seção concorda com a partição canônica do domínio", () => {
  for (const prioridade of [1, 2, 3, 4, 5, 6, 7, 9]) {
    for (const respondeu of [true, false]) {
      const i = { prioridade, respondeu, proxima_acao_em: null };
      const canonico = grupoVisivel(grupoDoItem(i));
      const traduzido = { atenda_agora: "atender_agora", faca_combinado: "fazer_hoje", acompanhe: "acompanhar_depois" }[canonico];
      assert.equal(secaoDoItem(i), traduzido, `divergiu na prioridade ${prioridade}`);
    }
  }
});

test("UM CLIENTE APARECE UMA ÚNICA VEZ", () => {
  const itens = [
    item(1, 1),
    item(2, 3, { lead_nome: "Cliente 1" }), // mesmo cliente, outro atendimento
    item(3, 1, { lead_nome: "Outro" }),
  ];
  const blocos = montarSecoes(itens);
  const nomes = blocos.flatMap((b) => b.cartoes.map((c) => c.nome));
  assert.equal(nomes.length, new Set(nomes).size, "o mesmo cliente apareceu duas vezes");
  assert.equal(nomes.length, 2);
  const [primeiro] = blocos[0].cartoes;
  assert.equal(primeiro.outrosAtendimentos, 1, "o segundo atendimento do cliente sumiu sem deixar contagem");
});

test("cliente sem nome não é confundido com outro sem nome", () => {
  const a = item(1, 1, { lead_nome: null });
  const b = item(2, 1, { lead_nome: "" });
  assert.notEqual(chaveCliente(a), chaveCliente(b));
  assert.equal(unificarPorCliente([a, b]).length, 2);
});

test("acento e caixa não criam cliente novo", () => {
  const a = item(1, 1, { lead_nome: "José da Silva" });
  const b = item(2, 5, { lead_nome: "jose da silva" });
  assert.equal(unificarPorCliente([a, b]).length, 1);
});

test("a chamada do topo conta só a urgência, já sem repetição", () => {
  const itens = [item(1, 1), item(2, 1, { lead_nome: "Cliente 1" }), item(3, 2), item(4, 5), item(5, 9, { respondeu: true })];
  assert.equal(totalParaAtender(itens), 2);
});

test("a ordem do banco é preservada dentro da seção", () => {
  const itens = [item(10, 1), item(11, 1), item(12, 1)];
  const [agora] = montarSecoes(itens);
  assert.deepEqual(agora.cartoes.map((c) => c.negocioId), [10, 11, 12]);
});

test("cada item tem um botão principal, e só um", () => {
  const [bloco] = montarSecoes([item(1, 1)]);
  const botao = botaoPrincipal(bloco.cartoes[0]);
  assert.equal(botao.acao, "abrir_atendimento");
  assert.equal(botao.rotulo, "Atender agora");
});

test("o cartão traduz a próxima ação livre para a conduta oficial", () => {
  const [bloco] = montarSecoes([item(1, 1, { espera_min: 125 })]);
  const c = bloco.cartoes[0];
  assert.equal(c.nome, "Cliente 1");
  assert.equal(c.corretor, "Ana");
  assert.equal(c.motivo, "Cliente respondeu");
  assert.equal(c.tempo, "2h 5min");
  assert.equal(c.proximaAcao, "Responder o cliente");
  assert.equal(c.momento, "Em atendimento");
  assert.equal(c.acaoCodigo, "RESPONDER_CLIENTE");
});

/* ============================ SLA ============================ */

const T0 = "2026-07-31T12:00:00.000Z";
const emMinutos = (m) => new Date(Date.parse(T0) + m * 60000);
const leadNovo = { momento: "novo", criadoEm: T0, ultimaInteracaoEm: null, tentativasFeitas: 0, telefone: "11987654321" };

test("o relógio começa na distribuição e ainda está no prazo em 2 minutos", () => {
  const sla = slaDoLead(leadNovo, null, emMinutos(2));
  assert.equal(sla.estado, "chame_agora");
  assert.equal(tomDoSla(sla), "verde");
});

test("passou de 5 minutos sem confirmação: atrasado", () => {
  const sla = slaDoLead(leadNovo, null, emMinutos(9));
  assert.equal(sla.estado, "atrasado");
  assert.equal(tomDoSla(sla), "vermelho");
});

test("ABRIR O WHATSAPP NÃO ENCERRA O SLA", () => {
  const sla = slaDoLead(leadNovo, emMinutos(1), emMinutos(2));
  assert.equal(sla.estado, "aguardando_confirmacao");
  assert.notEqual(sla.estado, "confirmado");
});

test("o SLA encerra quando o outbound confirmado move o lead de Novo", () => {
  const confirmado = {
    momento: "tentando_contato", criadoEm: T0,
    ultimaInteracaoEm: emMinutos(3).toISOString(), tentativasFeitas: 1, telefone: "11987654321",
  };
  const sla = slaDoLead(confirmado, emMinutos(1), emMinutos(30));
  assert.equal(sla.estado, "confirmado");
  assert.equal(sla.minutos, 3);
});

test("telefone inválido vira correção de cadastro, não cobrança de SLA", () => {
  const sla = slaDoLead({ ...leadNovo, telefone: "123" }, null, emMinutos(30));
  assert.equal(sla.estado, "nao_se_aplica");
  assert.equal(tomDoSla(sla), "neutro");
});

/* ============================ FICHA ============================ */

test("a ficha prioriza trabalho e esconde detalhes, nesta ordem", () => {
  assert.deepEqual([...ORDEM_FICHA], [
    "cliente_situacao", "acoes_principais", "proxima_acao", "historico",
    "dados", "imoveis", "linha_do_tempo", "andamento_externo",
  ]);
  assert.equal(ORDEM_FICHA.length, 8);
  for (const bloco of ORDEM_FICHA) assert.ok(TITULO_BLOCO[bloco], `bloco ${bloco} sem título`);
});

test("a ficha expõe os três comandos principais e concentra atualizações no menu", () => {
  const ficha = ler(base + "components/Ficha3.tsx");
  assert.match(ficha, /WhatsApp/);
  assert.match(ficha, /Agendar visita/);
  assert.match(ficha, /Lançar negociação/);
  assert.match(ficha, /ncrm3-atualizar-menu/);
  assert.match(ficha, /Marcar ação como feita/);
  assert.doesNotMatch(ficha, /AÇÕES AVANÇADAS/);
});

test("chamar no WhatsApp abre o app, tem alternativa e não preenche texto", () => {
  const c = prepararChamada("(11) 98765-4321");
  assert.equal(c.ok, true);
  assert.equal(c.app, "whatsapp://send?phone=5511987654321");
  assert.equal(c.fallback, "https://wa.me/5511987654321");
  assert.ok(!c.app.includes("text="), "o ERP não pode pré-preencher a mensagem");
  assert.ok(!c.fallback.includes("text="), "o ERP não pode pré-preencher a mensagem");
});

test("o clique do WhatsApp não encerra SLA nem move o momento", () => {
  const c = prepararChamada("11987654321");
  assert.equal(c.encerraSla, false);
  assert.equal(c.moveMomento, false);
  assert.equal(c.textoPreenchido, false);
});

test("telefone impossível explica o que fazer, em vez de abrir o app", () => {
  const c = prepararChamada("999");
  assert.equal(c.ok, false);
  assert.ok(c.explicacao.length > 0);
  assert.ok(c.dica.includes("cadastro"));
});

test("a situação do cliente é dita sem jargão", () => {
  assert.equal(frasedaSituacao({ respondeu: false, respostaPendenteCorretor: false }), "Aguardando a resposta do cliente");
  assert.equal(frasedaSituacao({ respondeu: true, respostaPendenteCorretor: true }), "Cliente respondeu e está aguardando você");
  assert.match(frasedaSituacao({ respondeu: true, respostaPendenteCorretor: false, visitaAgendadaEm: T0 }), /Pipe de Visitas/);
  assert.match(frasedaSituacao({ respondeu: true, respostaPendenteCorretor: false, proposta: { valor: 1 } }), /Esteira de Vendas/);
});

/* ============================ SARA ============================ */

test("a Sara não envia e não move etapa", () => {
  assert.equal(SARA_PODE_ENVIAR, false);
  assert.equal(SARA_PODE_MOVER_ETAPA, false);
});

test("três decisões humanas: usar, ajustar, não faz sentido", () => {
  assert.deepEqual(ACOES_SARA.map((a) => a.decisao), ["aceita", "ajustada", "rejeitada"]);
  assert.deepEqual(ACOES_SARA.map((a) => a.rotulo), ["Usar orientação", "Ajustar", "Não faz sentido"]);
});

test("a Sara mostra os oito campos combinados", () => {
  const s = normalizarSara({
    evidencias: ["quer 3 quartos", "  "],
    temperatura: "quente",
    proxima_acao: "Ligar hoje à tarde",
    prazo_sugerido: "2026-08-01T14:00:00.000Z",
    perguntas_faltantes: ["qual o valor de entrada?"],
    roteiro_ligacao: ["cumprimentar", "confirmar bairro"],
    whatsapp_sugerido: "Oi! Consegui separar duas opções.",
    risco_abandono: "medio",
    confianca: 0.82,
  });
  assert.deepEqual(s.evidencias, ["quer 3 quartos"]);
  assert.equal(s.momentoSugerido, "quente");
  assert.equal(s.proximaAcao, "Ligar hoje à tarde");
  assert.equal(s.prazo, "2026-08-01T14:00:00.000Z");
  assert.deepEqual(s.perguntasFaltantes, ["qual o valor de entrada?"]);
  assert.equal(s.roteiro.length, 2);
  assert.equal(s.textoParaCopiar, "Oi! Consegui separar duas opções.");
  assert.equal(s.risco, "medio");
  assert.equal(s.confiancaPct, 82);
});

test("sem sugestão, a Sara não inventa nada", () => {
  assert.equal(normalizarSara(null), null);
  assert.equal(normalizarSara(undefined), null);
});

test("a próxima ação sugerida respeita a possibilidade mais forte", () => {
  assert.equal(proximaAcaoSugerida({ possibilidade_proposta: "alta" }), "preparar_proposta");
  assert.equal(proximaAcaoSugerida({ possibilidade_visita: "alta" }), "agendar_visita");
  assert.equal(proximaAcaoSugerida({}), "entender_necessidade");
});

/* ============================ CADASTRO DO LEAD ============================ */

test("foto e interesse saem do cadastro, sem invenção", () => {
  assert.equal(fotoDoLead({ foto_url: "https://x/y.png" }), "https://x/y.png");
  assert.equal(fotoDoLead({ contato: { avatar: "https://a/b.jpg" } }), "https://a/b.jpg");
  assert.equal(fotoDoLead({ foto_url: "javascript:alert(1)" }), null);
  assert.equal(fotoDoLead(null), null);
  assert.equal(interesseDoLead({ interesse: "2 quartos na Zona Sul" }), "2 quartos na Zona Sul");
  assert.equal(interesseDoLead({}), null);
});

test("imóveis vazios não viram linha fantasma", () => {
  assert.deepEqual(imoveisDoLead(null), []);
  assert.deepEqual(imoveisDoLead([{ empreendimento_id: "a", empreendimentos: null }]), []);
  assert.deepEqual(
    imoveisDoLead([{ empreendimento_id: "a", empreendimentos: { id: "a", nome: "Edifício X", bairro: "Centro", cidade: "SP" } }]),
    [{ id: "a", nome: "Edifício X", bairro: "Centro", cidade: "SP" }],
  );
});

/* ============================ O QUE O CÓDIGO NÃO PODE TER ============================ */

test("o CRM 3.0 não tem caminho para enviar mensagem", () => {
  const proibidos = [/dapi/i, /\/enviar/i, /sendtext/i, /send_message/i, /messages\/send/i];
  for (const arquivo of ARQUIVOS_DO_CORRETOR) {
    const fonte = ler(base + arquivo);
    for (const re of proibidos) {
      assert.ok(!re.test(fonte), `${arquivo} tem caminho de envio (${re})`);
    }
  }
});

test("esta frente não encosta em app, PWA, manifest, service worker nem Web Push", () => {
  const proibidos = [/serviceworker/i, /manifest\.json/i, /webpush/i, /pushmanager/i, /beforeinstallprompt/i];
  for (const arquivo of [...ARQUIVOS_DO_CORRETOR, "estilos.ts", "lib/adapter3.ts", "components/Gestao3.tsx"]) {
    const fonte = ler(base + arquivo);
    for (const re of proibidos) assert.ok(!re.test(fonte), `${arquivo} encostou em ${re}`);
  }
});

test("a Sara não tem execute em lugar nenhum da 3.0", () => {
  for (const arquivo of ARQUIVOS_DO_CORRETOR) {
    const fonte = ler(base + arquivo);
    assert.ok(!/sara\/(execute|executar)/i.test(fonte), `${arquivo} chama execute da Sara`);
  }
});

test("Esteira e Agenda usam a visão oficial; Leads e Visitas são telas nativas do protótipo", () => {
  /* Decisão de 31/07 (prints-apecerto/crm-desktop 03 e 04): Leads e Visitas
     ganharam telas próprias da 3.0 — etapa do funil novo e agenda comercial no
     desenho aprovado. Esteira e Agenda continuam montando as oficiais. */
  const casca = ler(base + "Crm3Workspace.tsx");
  assert.match(casca, /import \{ CrmWorkspace, LeadChatDrawer,/);
  for (const view of ['view: "sales"', 'view: "agenda"']) {
    assert.ok(casca.includes(view), `a aba oficial ${view} sumiu`);
  }
  assert.match(casca, /import \{ Leads3 \}/, "a tela nativa de Leads sumiu");
  assert.match(casca, /import \{ Visitas3 \}/, "a tela nativa de Visitas sumiu");
  assert.ok(!/leads: \{ view:/.test(casca), "Leads nao deve mais montar a tabela antiga");
});

test("o card abre o mini chat real do CRM antigo em modo somente leitura", () => {
  const casca = ler(base + "Crm3Workspace.tsx");
  const card = ler(base + "components/Card3.tsx");
  const legado = ler("../app/features/crm/CrmWorkspace.tsx");
  assert.ok(card.includes("💬 Chat"), "o acesso direto ao histórico sumiu do card");
  assert.match(casca, /onChat=\{\(id\) => void abrirChat\(id\)\}/);
  assert.match(casca, /<LeadChatDrawer[\s\S]*?readOnly/);
  assert.match(legado, /readOnly\?: boolean/);
  assert.match(legado, /Somente leitura · responda pelo WhatsApp do celular/);
  assert.match(legado, /useLeadCopiloto\(accessToken, lead\.nome \|\| "", !readOnly\)/,
    "abrir histórico não pode disparar o copiloto legado");
});

test("o card e uma ordem de trabalho: momento, ação e prazo", () => {
  const card = ler(base + "components/Card3.tsx");
  for (const rotulo of ["MOMENTO", "PRÓXIMA AÇÃO", "PRAZO"]) assert.ok(card.includes(rotulo));
  assert.ok(!card.includes("ncrm3-chips"), "temperatura e SLA voltaram a competir com a ordem principal");
  assert.ok(!card.includes("conduta.objetivo"), "o objetivo longo voltou ao card compacto");
});

test("o recorte do Pipe de Visitas nao cria segunda esteira nem segunda tabela", () => {
  const css = ler(base + "estilos.ts");
  assert.match(css, /\.ncrm3-so-visitas \.crm-agenda-grid > \.agenda-panel:not\(\.visits\) \{ display:none; \}/);
  assert.match(css, /\.ncrm3-oficial \.crm-command-bar \{ display:none; \}/);
});

/* ============================ RESPONSIVIDADE ============================ */

test("o CSS cobre tablet, 430 px e 390 px, e a ficha vira tela cheia", () => {
  const css = ler(base + "estilos.ts");
  assert.match(css, /@media \(max-width:1180px\)/, "faltou o corte de tablet");
  assert.match(css, /@media \(max-width:900px\)/, "faltou o corte de celular grande (430px)");
  assert.match(css, /@media \(max-width:460px\)/, "faltou o corte de celular pequeno (390px)");
  const celular = css.slice(css.indexOf("@media (max-width:900px)"));
  assert.match(celular, /\.ncrm3-ficha \{ position:fixed; inset:0;[^}]*width:100vw/, "a ficha não vira tela cheia no celular");
  assert.match(celular, /\.ncrm3-quadro \{ grid-template-columns:1fr; \}/, "o quadro não vira uma coluna no celular");
});

test("nada no 3.0 força largura maior que a tela", () => {
  const css = ler(base + "estilos.ts");
  assert.match(css, /\.ncrm3, \.ncrm3-conteudo, \.ncrm3-quadro, \.ncrm3-coluna, \.ncrm3-card, \.ncrm3-item \{ max-width:100%; \}/);
  assert.ok(!/min-width:\s*[5-9]\d\dpx/.test(css), "existe min-width que estoura o celular");
});

test("o 3.0 herda a identidade do CRM atual, não uma paleta nova", () => {
  const css = ler(base + "estilos.ts");
  for (const variavel of ["var(--orange)", "var(--line)", "var(--surface)", "var(--muted)", "var(--sunken)", "var(--radius-pill)"]) {
    assert.ok(css.includes(variavel), `o 3.0 deixou de usar ${variavel} do design system`);
  }
  const casca = ler(base + "Crm3Workspace.tsx");
  for (const classe of ["crm-v2", "crm-v2-header", "crm-eyebrow", "crm-command-bar", "crm-search-v2"]) {
    assert.ok(casca.includes(classe), `a casca não reaproveitou .${classe} do CRM atual`);
  }
  const card = ler(base + "components/Card3.tsx");
  assert.ok(card.includes("lead-avatar"), "o card não usa o avatar do CRM atual");
});
