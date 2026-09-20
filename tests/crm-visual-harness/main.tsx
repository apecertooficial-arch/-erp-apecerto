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
import { leads, payloadNormal, payloadVazio, vendasVazias } from "./fixtures";

type Papel = "admin" | "gestor" | "corretor";
type Estado = "normal" | "loading" | "vazio" | "erro" | "offline" | "negado";
type RegistroRede = { method: string; path: string; blocked: boolean };
type RegistroConsole = { level: "error" | "warning"; message: string };

const parametros = new URLSearchParams(window.location.search);
const papel = (parametros.get("role") ?? "corretor") as Papel;
const estado = (parametros.get("state") ?? "normal") as Estado;
const tela = parametros.get("screen") ?? "desktop-crm";
const gravadorVisivel = parametros.get("evidence") === "1";
const estadoAudio = parametros.get("audio") ?? "indisponivel";
const qualidadeExemplo = parametros.get("quality") === "sample";
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
  leads: [], deals: [], cards: [], products: [], visits: [], tasks: [],
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
    return json(payloadAgenda);
  }
  if (url.pathname === "/api/funil2") {
    if (estado === "loading") return new Promise<Response>(() => undefined);
    if (estado === "offline") throw new TypeError("Sem conexão no harness visual.");
    if (estado === "erro") return json({ error: "Falha sanitizada ao carregar o Funil." }, 502);
    if (url.searchParams.has("historicoLeadId")) return json({ eventos: payloadNormal.eventos, notas: payloadNormal.notas });
    return json(estado === "vazio" ? payloadVazio : payloadNormal);
  }
  if (url.pathname === "/api/funil2/conversa") return json({ mensagens: [], instancias: [{ id: "instancia-teste", rotulo: "WhatsApp de teste", telefone: "••••0000", status: "conectado", atual: true }], historicoCompleto: true });
  if (url.pathname === "/api/funil2/carteira") return json({ leads: leads.slice(0, 8).map((lead) => ({ id: lead.id, nome: lead.nome, telefoneMascarado: "••••0000", negocioId: lead.origem_negocio_id, corretorNome: lead.corretor_nome })), pagina: 1, curta: false, temMais: false });
  if (url.pathname === "/api/crm/sales") return json(vendasVazias);
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
  ? <TelaAgendaMobile accessToken="harness-test-only" role={papel} />
  : tela === "agenda-manager"
    ? <ErpShell><CalendarWorkspace accessToken="harness-test-only" /></ErpShell>
    : <ErpShell><PaginaCrm /></ErpShell>;
createRoot(document.getElementById("root")!).render(<ErpSessionCtx.Provider value={contexto}>{app}</ErpSessionCtx.Provider>);
