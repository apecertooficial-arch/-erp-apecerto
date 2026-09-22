import React from "react";
import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import "../../app/styles/app-mobile.css";
import "../../app/styles/apecerto-identidade.css";
import "../../app/styles/redesign-apecerto.css";
import "../../app/styles/redesign-apecerto-menu.css";
import "../../app/styles/app-mobile-aprovado.css";
import "../../app/styles/app-mobile-gestor.css";
import "../../app/styles/redesign-apecerto-calendario.css";
import "../../app/styles/funil.css";
import { ErpShell } from "../../app/features/system/ErpShell";
import { ErpSessionCtx, type ErpSessionValue, type SessionProfile } from "../../app/features/system/ErpSession";
import PaginaCrm from "../../app/(erp)/crm/page";
import { CalendarWorkspace } from "../../app/features/calendar/CalendarWorkspace";
import { TelaAgendaMobile } from "../../app/features/calendar/TelaAgendaMobile";
import { SaraTasksMobile } from "../../app/features/tasks/SaraTasksMobile";
import { NotificationsWorkspace } from "../../app/features/notifications/NotificationsWorkspace";
import { TeamWorkspace } from "../../app/features/team/TeamWorkspace";
import { PermissionsWorkspace } from "../../app/features/permissions/PermissionsWorkspace";
import { ApproachesWorkspace } from "../../app/features/approaches/ApproachesWorkspace";
import { Funil2Mobile } from "../../app/features/funil-2/Funil2Mobile";
import { LiveChatWorkspace } from "../../app/features/chat/LiveChatWorkspace";
import { SalesProcessView } from "../../app/features/sales/SalesProcessWorkspace";
import { leads, payloadNormal, payloadVazio, vendasVazias } from "./fixtures";

type Papel = "admin" | "gestor" | "corretor";
type Estado = "normal" | "loading" | "vazio" | "erro" | "invalido" | "offline" | "negado" | "sessao";
type RegistroRede = { method: string; path: string; blocked: boolean };
type RegistroConsole = { level: "error" | "warning"; message: string };

// O shell real decide o item ativo pela rota. Normalizar o runner para /crm
// evita uma evidência visual falsa em que o Kanban aparece com "Início" ativo.
if (window.location.pathname !== "/crm") window.history.replaceState(null, "", `/crm${window.location.search}`);

const parametros = new URLSearchParams(window.location.search);
const papel = (parametros.get("role") ?? "corretor") as Papel;
const estado = (parametros.get("state") ?? "normal") as Estado;
const tela = parametros.get("screen") ?? "desktop-crm";
if (tela === "crm-mobile" || tela === "meu-dia-mobile" || tela === "agenda-mobile") {
  const estiloMobile = document.createElement("style");
  estiloMobile.textContent = ".ape-app,.ape-agenda{display:block!important}";
  document.head.append(estiloMobile);
}
const gravadorVisivel = parametros.get("evidence") === "1";
const estadoAudio = parametros.get("audio") ?? "indisponivel";
const qualidadeExemplo = parametros.get("quality") === "sample";
const corretorEmFoco = parametros.get("broker");
const saraPendente = parametros.get("sara") === "pendente";
const historicoInvalido = parametros.get("history") === "invalido";
const carteiraInvalida = parametros.get("legacy") === "invalido";
const conversaInvalida = parametros.get("conversation") === "invalido";
const pendenciasAgendaInvalidas = parametros.get("agendaPending") === "invalido";
const opcoesClienteInvalidas = parametros.get("clientOptions") === "invalido";
const duplicidadeClienteInvalida = parametros.get("clientDuplicate") === "invalido";
const preparacaoNegociacaoInvalida = parametros.get("salesPrepare") === "invalido";
const horariosVisitaInvalidos = parametros.get("visitSlots") === "invalido";
const atualizacaoLeadInvalida = parametros.get("leadUpdate") === "invalido";
const resultadoAcaoInvalido = parametros.get("actionResult") === "invalido";
const resultadoAtualizacaoInvalido = parametros.get("patchResult") === "invalido";
const payloadMobileInvalido = parametros.get("mobilePayload") === "invalido";
const disponibilidadeGerenteInvalida = parametros.get("managerAvailability") === "invalido";
const resultadoTagInvalido = parametros.get("tagResult") === "invalido";
const criacaoClienteInvalida = parametros.get("clientCreate") === "invalido";
const criacaoAgendaOffline = parametros.get("agendaCreate") === "offline";
const visitaChatInvalida = parametros.get("chatVisit") === "invalido";
const payloadChatInvalido = parametros.get("chatPayload") === "invalido";
const agendamentosChatInvalidos = parametros.get("chatScheduled") === "invalido";
const resultadoAcaoChatInvalido = parametros.get("chatAction") === "invalido";
const cancelamentoChatInvalido = parametros.get("chatCancel") === "invalido";
const envioChatInvalido = parametros.get("chatSend") === "invalido";
const payloadVendasInvalido = parametros.get("salesPayload") === "invalido";
const criacaoVendaInvalida = parametros.get("salesCreate") === "invalido";
const movimentoVendaInvalido = parametros.get("salesMove") === "invalido";
const escritaVendaInvalida = parametros.get("salesWrite") === "invalido";
const vendaEsteiraDetalhe = parametros.has("salesMove") || parametros.has("salesWrite");
const relogioNoLimite = parametros.get("clock") === "limite";
const payloadTarefas = tela === "tarefas-mobile" && parametros.get("volume") === "alto" ? {
  ...payloadNormal,
  leads: Array.from({ length: 32 }, (_, indice) => ({
    ...payloadNormal.leads[0]!, id: `lead-tarefa-${indice}`, lead_id: 7000 + indice,
    origem_negocio_id: 8000 + indice, nome: `Cliente sanitizado ${indice + 1}`,
    etapa: indice === 31 ? "pescado" : payloadNormal.leads[0]!.etapa,
    proxima_acao_em: new Date(Date.now() - (indice + 1) * 60_000).toISOString(),
  })),
} : null;
const payloadSaraPendente = {
  ...payloadNormal,
  leads: payloadNormal.leads.map((lead, indice) => indice === 0 ? {
    ...lead,
    ultima_reavaliacao_sara_em: "2026-09-20T12:00:00Z",
    ultima_reavaliacao_resumo: "A ação foi confirmada; a Sara revisou o laboratório e manteve a conduta atual.",
  } : lead),
  eventos: [{
    id: 99,
    funil_lead_id: payloadNormal.leads[0]?.id,
    tipo: "sara_reavaliou",
    titulo: "Sara reavaliou a cópia",
    detalhe: "A conduta foi mantida após a ação de demonstração.",
    payload: {},
    criado_em: "2026-09-20T12:00:00Z",
  }, ...payloadNormal.eventos],
};
const payloadRelogioNoLimite = {
  ...payloadNormal,
  leads: [{
    ...payloadNormal.leads.find((lead) => lead.etapa === "em_atendimento")!,
    id: "lead-relogio-teste",
    nome: "Cliente relógio sanitizado",
    proxima_acao_em: new Date(Date.now() + 5_000).toISOString(),
  }],
};
const pendenciasAgenda = [
  { id: "10000000-0000-4000-8000-000000000001", data: "2026-08-17", hora: "10:00", tipo: "visita", cliente: "Cliente sanitizado 1", local: "Local sanitizado", produto: "Produto Alfa", negocio_id: 101, status: "realizada", corretor: "Corretora Alfa", corretor_id: 7, meu: papel === "corretor", faltam_min: -47_000, com_gerente: true, gerente_id: 1 },
  { id: "10000000-0000-4000-8000-000000000002", data: "2026-08-23", hora: "14:30", tipo: "visita", cliente: "Cliente sanitizado 2", local: "Local sanitizado", produto: "Produto Beta", negocio_id: 102, status: "agendada", corretor: "Corretora Alfa", corretor_id: 7, meu: papel === "corretor", faltam_min: -38_000, com_gerente: false, gerente_id: null },
  { id: "10000000-0000-4000-8000-000000000003", data: "2026-09-12", hora: "09:00", tipo: "visita", cliente: "Cliente sanitizado 3", local: "Local sanitizado", produto: "Produto Gama", negocio_id: 103, status: "cancelada", corretor: "Corretor Beta", corretor_id: 8, meu: false, faltam_min: -10_000, com_gerente: true, gerente_id: 1 },
];
const payloadAgenda = {
  ok: true, periodo: "mes", dia: "2026-09-19", inicio: "2026-09-01", fim: "2026-09-30",
  total: 0, itens: [], pendencias_resultado: pendenciasAgenda,
  resumo_resultados: { total: 3, pendentes: 3, passadas_sem_desfecho: 1, realizadas_sem_feedback: 1, canceladas_sem_motivo: 1, justificadas: 0, futuras: 0 },
  performance_feedback: papel === "corretor" ? { status: "restrito", itens: [] } : qualidadeExemplo ? {
    status: "ok", historico_total: 14, estruturados_total: 14, legados_total: 0, feedback_visita_min: 120,
    itens: [
      { corretor_id: 7, corretor: "Corretora Alfa", feedbacks: 8, nota_media: 9.4, resposta_media_min: 74, abaixo_minimo: 0, dentro_prazo_percentual: 87.5 },
      { corretor_id: 8, corretor: "Corretor Beta", feedbacks: 6, nota_media: 9.0, resposta_media_min: 138, abaixo_minimo: 0, dentro_prazo_percentual: 66.7 },
    ],
  } : { status: "ok", historico_total: 94, estruturados_total: 0, legados_total: 94, feedback_visita_min: 120, itens: [] },
  brokers: [{ id: 7, nome: "Corretora Alfa" }, { id: 8, nome: "Corretor Beta" }],
  leads: [{ id: 501, nome: "Cliente agenda sanitizado" }], deals: [{ id: 601, lead_id: 501, corretor_id: 7 }], cards: [], products: [{ id: "produto-agenda", nome: "Produto Alfa" }], visits: [{
    id: "30000000-0000-4000-8000-000000000001", lead_id: 1, negocio_id: 101, corretor_id: 7,
    cliente_nome: "Cliente agenda sanitizado", produto: "Produto Alfa", empreendimento_id: null,
    data: "2026-09-21", hora_inicio: "10:00:00", hora_fim: "11:00:00", local: "Local sanitizado",
    observacoes: null, com_gerente: true, gerente_id: 1, status: "confirmada",
  }], tasks: [],
  gerentes: [{ id: 1, nome: "Gerente sanitizado", geral: true, corretor_id: null }], role: papel,
};
const requisicoes: RegistroRede[] = [];
const mensagensConsole: RegistroConsole[] = [];
const fetchNativoDoRunner = window.fetch.bind(window);
const logRede = document.createElement("script");
logRede.id = "crm-harness-network-log";
logRede.type = "application/json";
logRede.textContent = "[]";
logRede.dataset.consoleLog = "[]";
document.head.append(logRede);
const sincronizarLogRede = () => { logRede.textContent = JSON.stringify(requisicoes); };
const registrarConsole = (level: RegistroConsole["level"], valores: unknown[]) => {
  mensagensConsole.push({ level, message: valores.map((valor) => valor instanceof Error ? valor.message : String(valor)).join(" ").slice(0, 500) });
  logRede.dataset.consoleLog = JSON.stringify(mensagensConsole);
};
const consoleErrorNativo = console.error.bind(console);
const consoleWarnNativo = console.warn.bind(console);
console.error = (...valores) => { registrarConsole("error", valores); consoleErrorNativo(...valores); };
console.warn = (...valores) => { registrarConsole("warning", valores); consoleWarnNativo(...valores); };
window.addEventListener("error", (evento) => registrarConsole("error", [evento.error ?? evento.message]));
window.addEventListener("unhandledrejection", (evento) => registrarConsole("error", [evento.reason]));

if (estado === "offline") Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = input instanceof Request ? input : null;
  const method = String(init?.method ?? request?.method ?? "GET").toUpperCase();
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
  const registro = { method, path: `${url.pathname}${url.search}`, blocked: false };
  requisicoes.push(registro);
  sincronizarLogRede();
  if (method !== "GET") {
    const corpo = typeof init?.body === "string" ? JSON.parse(init.body) as { action?: string; nome?: string; telefone?: string; email?: string; cpfCnpj?: string; endereco?: string } : {};
    if (method === "POST" && url.pathname === "/api/funil2" && corpo.action === "visitaDisponibilidade") {
      return json(horariosVisitaInvalidos ? { horarios: "indisponivel" } : { horarios: [
        { inicio: "10:00", fim: "11:00", estado: "disponivel" },
        { inicio: "11:00", fim: "12:00", estado: "indisponivel" },
      ] });
    }
    if (method === "PATCH" && url.pathname === "/api/funil2/clientes" && corpo.action === "atualizar") {
      return json(atualizacaoLeadInvalida ? {} : { lead: {
        nome: corpo.nome, telefone: corpo.telefone || null, email: corpo.email || null,
        cpf_cnpj: corpo.cpfCnpj || null, endereco: corpo.endereco || null, atualizado_em: "2026-09-21T18:00:00Z",
      } });
    }
    if (method === "POST" && url.pathname === "/api/funil2/clientes" && corpo.action === "criar") return json(criacaoClienteInvalida
      ? { funilLeadId: "identidade-invalida" }
      : { funilLeadId: "40000000-0000-4000-8000-000000000001" });
    if (method === "POST" && url.pathname === "/api/funil2" && corpo.action === "salvarNota" && resultadoAcaoInvalido) return json({});
    if (method === "POST" && url.pathname === "/api/funil2" && corpo.action === "associarTag") return json(resultadoTagInvalido ? {} : { ok: true, resultado: { ok: true } });
    if (method === "PATCH" && url.pathname === "/api/funil2" && corpo.action === "atualizarTemperatura") return json(resultadoAtualizacaoInvalido ? {} : { ok: true, resultado: { ok: true } });
    if ((method === "PATCH" || method === "POST") && url.pathname === "/api/agenda" && corpo.action === "gerenteDisponibilidade") return json(disponibilidadeGerenteInvalida ? {} : { conflitos: [], gerente_id: 1 });
    if ((method === "PATCH" || method === "POST") && url.pathname === "/api/agenda" && corpo.action === "createVisit") {
      if (criacaoAgendaOffline) throw new TypeError("Sem conexão no harness visual.");
      return json(visitaChatInvalida ? {} : { success: true, message: "Visita agendada com sucesso." });
    }
    if (method === "POST" && url.pathname === "/api/live-chat" && corpo.action === "listScheduled") return json(agendamentosChatInvalidos ? {} : { agendadas: parametros.has("chatCancel") ? [{ id: 701, texto: "Retorno sanitizado", tipo: "text", quando: "2026-09-22T15:00:00Z", status: "agendado" }] : [] });
    if (method === "POST" && url.pathname === "/api/live-chat" && corpo.action === "cancelScheduled") return json(cancelamentoChatInvalido ? {} : { success: true });
    if (method === "POST" && url.pathname === "/api/live-chat" && corpo.action === "send") return json(envioChatInvalido ? {} : { success: true });
    if (method === "PATCH" && url.pathname === "/api/crm/sales" && corpo.action === "create") return json(criacaoVendaInvalida ? {} : { success: true, saleId: "venda-teste" });
    if (method === "PATCH" && url.pathname === "/api/crm/sales" && corpo.action === "move") return json(movimentoVendaInvalido ? {} : { success: true, stage: "doc_comp" });
    if (method === "PATCH" && url.pathname === "/api/crm/sales" && corpo.action === "addObs") return json(escritaVendaInvalida ? {} : { success: true });
    if (method === "POST" && url.pathname === "/api/live-chat" && corpo.action) return json(resultadoAcaoChatInvalido ? {} : { success: true });
    registro.blocked = true;
    sincronizarLogRede();
    return json({ error: "Harness visual: mutações são bloqueadas." }, 405);
  }
  if (url.origin !== window.location.origin) {
    registro.blocked = true;
    sincronizarLogRede();
    throw new TypeError("Harness visual: domínio externo bloqueado.");
  }
  if (url.pathname === "/api/agenda") {
    if (estado === "loading") return new Promise<Response>(() => undefined);
    if (estado === "offline") throw new TypeError("Sem conexão no harness visual.");
    if (estado === "invalido") return json({});
    if (url.searchParams.has("feedbackAudioVisitaId")) {
      if (estadoAudio === "indisponivel") return json({ ok: true, disponivel: false, audios: [] });
      const audios = estadoAudio === "transcrito" ? [{
        id: "20000000-0000-4000-8000-000000000001", status: "transcrito",
        transcricao: "O cliente visitou com a esposa, gostou da planta e pediu uma nova simulação de entrada para amanhã.",
        erro_codigo: null, criado_em: "2026-09-19T12:00:00Z", atualizado_em: "2026-09-19T12:01:00Z",
      }] : [{
        id: "20000000-0000-4000-8000-000000000001",
        status: estadoAudio === "falhou" ? "falhou" : "transcrevendo", transcricao: null,
        erro_codigo: estadoAudio === "falhou" ? "transcricao_indisponivel" : null,
        criado_em: "2026-09-19T12:00:00Z", atualizado_em: "2026-09-19T12:00:10Z",
      }];
      return json({ ok: true, disponivel: true, audios });
    }
    if (estado === "erro") return json({ ...payloadAgenda, pendencias_resultado: [], resumo_resultados: {}, pendencias_resultado_erro: "Não foi possível verificar os resultados pendentes." });
    return json(pendenciasAgendaInvalidas ? { ...payloadAgenda, pendencias_resultado: undefined } : payloadAgenda);
  }
  if (url.pathname === "/api/funil2") {
    if (estado === "loading") return new Promise<Response>(() => undefined);
    if (estado === "offline") throw new TypeError("Sem conexão no harness visual.");
    if (estado === "erro") return json({ error: "Falha sanitizada ao carregar o Funil." }, 502);
    if (estado === "sessao") return json({ error: "Sessão expirada." }, 401);
    if (estado === "invalido") return json({});
    if (url.searchParams.has("historicoLeadId")) return json(historicoInvalido ? {} : { eventos: saraPendente ? payloadSaraPendente.eventos : payloadNormal.eventos, notas: payloadNormal.notas });
    return json(payloadMobileInvalido ? { ...payloadNormal, momentos: undefined } : estado === "vazio" ? payloadVazio : payloadTarefas ?? (relogioNoLimite ? payloadRelogioNoLimite : saraPendente ? payloadSaraPendente : payloadNormal));
  }
  if (url.pathname === "/api/notificacoes") return json(estado === "invalido" ? {} : { notificacoes: [] });
  if (url.pathname === "/api/crm/sales") return json(payloadVendasInvalido ? {} : {
    sales: vendaEsteiraDetalhe ? [{ id: "venda-teste", created_at: "2026-09-21T12:00:00Z", data_venda: "2026-09-21", cliente_nome: "Cliente venda sanitizado", empreendimento_id: "produto-teste", empreendimento_nome: "Produto sanitizado", vgv: 350000, forma_pgto: null, status: "em_andamento", obs: null }] : [],
    processes: vendaEsteiraDetalhe ? [{ id: "processo-teste", venda_id: "venda-teste", negocio_id: 801, etapa: "inicio", tipo_venda: "construtora", responsavel_usuario_id: null, prazo_em: null, atualizado_em: "2026-09-21T12:00:00Z", aprovacao_status: "aprovada" }] : [],
    brokers: vendaEsteiraDetalhe ? [{ id: 7, nome: "Corretor teste", usuario_id: null, online: true }] : [],
    deals: parametros.has("salesCreate") || vendaEsteiraDetalhe ? [{ id: 801, venda_id: vendaEsteiraDetalhe ? "venda-teste" : null, lead_id: 501, corretor_id: 7, empreendimento_id: "produto-teste", valor: 350000, status: "aberto" }] : [],
    leads: parametros.has("salesCreate") || vendaEsteiraDetalhe ? [{ id: 501, nome: "Cliente venda sanitizado", telefone: "••••0000", corretor_id: 7, origem: "teste", tags: [], extras: null }] : [],
    products: parametros.has("salesCreate") || vendaEsteiraDetalhe ? [{ id: "produto-teste", nome: "Produto sanitizado", cidade: "São Paulo", bairro: "Centro", preco: 350000, status: "disponivel" }] : [],
  });
  if (url.pathname === "/api/live-chat") return json(url.searchParams.has("conversationId") ? { messages: [] } : payloadChatInvalido ? {} : {
    conversations: [{ id: "conversa-teste", contato_id: "contato-teste", instancia_id: "instancia-teste", status: "aberta", ultima_msg_em: "2026-09-21T12:00:00Z", origem: "WhatsApp" }],
    contacts: [{ id: "contato-teste", nome: "Cliente chat sanitizado", telefone: "5511999990000", lead_id: 501 }],
    instances: [{ id: "instancia-teste", session_id: "sessao-teste", rotulo: "WhatsApp teste", status: "conectada", corretor_id: 7 }],
    dapi: [{ id: 901, instancia_dapi: "sessao-teste", nome: "WhatsApp teste", conectada: true }], latest: {}, leads: [{ id: 501, nome: "Cliente chat sanitizado", telefone: "5511999990000", email: null, corretor_id: 7, origem: "WhatsApp", tags: [] }],
    deals: [{ id: 601, lead_id: 501, corretor_id: 7, stage_id: 1, empreendimento_id: null, valor: null, status: "aberto" }],
    brokers: [{ id: 7, nome: "Corretor teste", usuario_id: null, online: true }], products: [], media: [], activities: [], approaches: [], stages: [],
  });
  if (url.pathname === "/api/team") return json(estado === "invalido" ? {} : { users: [], brokers: [], instances: [], links: [], audits: [] });
  if (url.pathname === "/api/permissions") return json(estado === "invalido" ? {} : { perfis: [], usuarios: [] });
  if (url.pathname === "/api/approaches") return json(estado === "invalido" ? {} : { approaches: [], products: [] });
  if (url.pathname === "/api/funil2/conversa") return json(conversaInvalida ? {} : { mensagens: [], instancias: [{ id: "instancia-teste", rotulo: "WhatsApp de teste", telefone: "••••0000", status: "conectado", atual: true }], historicoCompleto: true });
  if (url.pathname === "/api/funil2/clientes" && url.searchParams.get("modo") === "opcoes") return json(opcoesClienteInvalidas ? {} : { corretores: [{ corretor_id: 7, nome: "Corretor teste", is_self: true }], corretorProprioId: 7, podeEscolher: false });
  if (url.pathname === "/api/funil2/clientes" && url.searchParams.get("modo") === "duplicidade") return json(duplicidadeClienteInvalida ? {} : { duplicado: false, lead: null, funilLeadId: null });
  if (url.pathname === "/api/funil2/carteira") return json(carteiraInvalida ? {} : { leads: leads.slice(0, 8).map((lead) => ({
    lead_id: lead.lead_id, negocio_id: lead.origem_negocio_id, nome: lead.nome, telefone: "••••0000",
    corretor_id: lead.corretor_id, corretor_nome: lead.corretor_nome, criado_em: lead.criado_em,
    ultima_mensagem_em: null, mensagens: 0,
  })), curta: false });
  if (url.pathname === "/api/crm/sales") return json(preparacaoNegociacaoInvalida && url.searchParams.get("modo") === "prepararSolicitacao"
    ? {}
    : url.searchParams.get("modo") === "prepararSolicitacao"
      ? { ...vendasVazias, products: [{ id: "produto-teste", nome: "Produto teste", origem: "catalogo", bairro: "Moema", cidade: "São Paulo" }] }
      : vendasVazias);
  registro.blocked = true;
  sincronizarLogRede();
  return json({ error: "Leitura fora do inventário do harness." }, 404);
};

const permissoesBase = { crm: ["ver"], leads: ["ver"], pipeline: ["ver"], dashboard: ["ver"], calendario: ["ver"], notificacoes: ["ver"], produtos: ["ver"], configuracoes: ["ver"] };
const perfil: SessionProfile = {
  userId: `usuario-${papel}-teste`, email: `${papel}@example.invalid`,
  name: papel === "admin" ? "Admin teste" : papel === "gestor" ? "Gestor teste" : "Corretor teste",
  role: papel, perfil: papel === "gestor" ? "gestor_comercial" : papel, active: true,
  brokerId: papel === "admin" ? null : 7, online: true, permissoes: estado === "negado" ? {} : permissoesBase,
};
const contexto: ErpSessionValue = {
  accessToken: "harness-test-only", profile: perfil, perfilCarregado: true, estado: "live", role: papel,
  isManager: papel !== "corretor", permissoes: perfil.permissoes ?? null, badges: {},
  publicarBadge: () => undefined, recarregarPerfil: async () => undefined,
};

document.documentElement.dataset.crmHarness = "visual-sintetico";
document.documentElement.dataset.crmHarnessRole = papel;
document.documentElement.dataset.crmHarnessState = estado;
const transferenciaEvidencia = document.createElement("output");
transferenciaEvidencia.id = "crm-harness-evidence-transfer";
transferenciaEvidencia.style.cssText = gravadorVisivel
  ? "position:fixed;z-index:99999;inset:16px;width:calc(100vw - 32px);height:calc(100vh - 32px);display:grid;gap:8px;padding:16px;background:white"
  : "position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden";
transferenciaEvidencia.innerHTML = '<input id="crm-harness-evidence-name" aria-label="Nome da evidência do harness"><textarea id="crm-harness-evidence-body" aria-label="Conteúdo da evidência do harness"></textarea><span id="crm-harness-evidence-status">idle</span><button id="crm-harness-evidence-save" type="button">Salvar evidência do harness</button>';
transferenciaEvidencia.querySelector("button")?.addEventListener("click", () => {
  const nome = document.querySelector<HTMLInputElement>("#crm-harness-evidence-name")?.value ?? "";
  const corpo = document.querySelector<HTMLTextAreaElement>("#crm-harness-evidence-body")?.value ?? "";
  const status = document.querySelector("#crm-harness-evidence-status");
  const binario = atob(corpo);
  const conteudo = Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0));
  if (status) status.textContent = "saving";
  void fetchNativoDoRunner(`http://127.0.0.1:4181/?name=${encodeURIComponent(nome)}`, { method: "POST", body: conteudo.buffer as ArrayBuffer })
    .then((resposta) => { if (status) status.textContent = String(resposta.status); })
    .catch(() => { if (status) status.textContent = "error"; });
});
document.body.append(transferenciaEvidencia);

const app = tela === "agenda-mobile"
  ? <TelaAgendaMobile accessToken="harness-test-only" role={papel} corretorIdInicial={corretorEmFoco} />
  : tela === "meu-dia-mobile"
    ? <Funil2Mobile accessToken="harness-test-only" nome="Corretor teste" modo="inicio" onIr={() => undefined} />
  : tela === "crm-mobile"
    ? <Funil2Mobile accessToken="harness-test-only" nome="Corretor teste" modo="crm" onIr={() => undefined} />
  : tela === "chat"
    ? <ErpShell><LiveChatWorkspace accessToken="harness-test-only" /></ErpShell>
  : tela === "sales"
    ? <ErpShell><SalesProcessView accessToken="harness-test-only" sessionRole={papel} /></ErpShell>
  : tela === "avisos-mobile"
    ? <NotificationsWorkspace accessToken="harness-test-only" />
  : tela === "tarefas-mobile"
    ? <SaraTasksMobile accessToken="harness-test-only" />
  : tela === "agenda-manager"
    ? <ErpShell><CalendarWorkspace accessToken="harness-test-only" corretorIdInicial={corretorEmFoco} /></ErpShell>
  : tela === "team"
    ? <ErpShell><TeamWorkspace accessToken="harness-test-only" /></ErpShell>
  : tela === "permissions"
    ? <ErpShell><PermissionsWorkspace accessToken="harness-test-only" /></ErpShell>
  : tela === "approaches"
    ? <ErpShell><ApproachesWorkspace accessToken="harness-test-only" /></ErpShell>
    : <ErpShell><PaginaCrm /></ErpShell>;
createRoot(document.getElementById("root")!).render(<ErpSessionCtx.Provider value={contexto}>{app}</ErpSessionCtx.Provider>);
