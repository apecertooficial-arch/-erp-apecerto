import React from "react";
import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import "../../app/styles/app-mobile.css";
import "../../app/styles/apecerto-identidade.css";
import "../../app/styles/redesign-apecerto.css";
import "../../app/styles/redesign-apecerto-menu.css";
import "../../app/styles/app-mobile-aprovado.css";
import "../../app/styles/app-mobile-gestor.css";
import "../../app/styles/funil.css";
import { ErpShell } from "../../app/features/system/ErpShell";
import { ErpSessionCtx, type ErpSessionValue, type SessionProfile } from "../../app/features/system/ErpSession";
import PaginaCrm from "../../app/(erp)/crm/page";
import { leads, payloadNormal, payloadVazio, vendasVazias } from "./fixtures";

type Papel = "admin" | "gestor" | "corretor";
type Estado = "normal" | "loading" | "vazio" | "erro" | "offline" | "negado";
type RegistroRede = { method: string; path: string; blocked: boolean };
type RegistroConsole = { level: "error" | "warning"; message: string };

const parametros = new URLSearchParams(window.location.search);
const papel = (parametros.get("role") ?? "corretor") as Papel;
const estado = (parametros.get("state") ?? "normal") as Estado;
const gravadorVisivel = parametros.get("evidence") === "1";
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
  if (url.pathname === "/api/funil2") {
    if (estado === "loading") return new Promise<Response>(() => undefined);
    if (estado === "offline") throw new TypeError("Sem conexão no harness visual.");
    if (estado === "erro") return json({ error: "Falha sanitizada ao carregar o Funil." }, 502);
    if (url.searchParams.has("historicoLeadId")) return json({ eventos: payloadNormal.eventos, notas: payloadNormal.notas });
    return json(estado === "vazio" ? payloadVazio : payloadNormal);
  }
  if (url.pathname === "/api/funil2/conversa") {
    return json({
      mensagens: [],
      instancias: [{ id: "instancia-teste", rotulo: "WhatsApp de teste", telefone: "••••0000", status: "conectado", atual: true }],
      historicoCompleto: true,
    });
  }
  if (url.pathname === "/api/funil2/carteira") {
    return json({ leads: leads.slice(0, 8).map((lead) => ({ id: lead.id, nome: lead.nome, telefoneMascarado: "••••0000", negocioId: lead.origem_negocio_id, corretorNome: lead.corretor_nome })), pagina: 1, curta: false, temMais: false });
  }
  if (url.pathname === "/api/crm/sales") return json(vendasVazias);
  registro.blocked = true;
  sincronizarLogRede();
  return json({ error: "Leitura fora do inventário do harness." }, 404);
};

const permissoesBase = {
  crm: ["ver"], leads: ["ver"], pipeline: ["ver"], dashboard: ["ver"],
  calendario: ["ver"], notificacoes: ["ver"], produtos: ["ver"], configuracoes: ["ver"],
};

const perfil: SessionProfile = {
  userId: `usuario-${papel}-teste`,
  email: `${papel}@example.invalid`,
  name: papel === "admin" ? "Admin teste" : papel === "gestor" ? "Gestor teste" : "Corretor teste",
  role: papel,
  perfil: papel === "gestor" ? "gestor_comercial" : papel,
  active: true,
  brokerId: papel === "admin" ? null : 7,
  online: true,
  permissoes: estado === "negado" ? {} : permissoesBase,
};

const contexto: ErpSessionValue = {
  accessToken: "harness-test-only",
  profile: perfil,
  perfilCarregado: true,
  estado: "live",
  role: papel,
  isManager: papel !== "corretor",
  permissoes: perfil.permissoes ?? null,
  badges: {},
  publicarBadge: () => undefined,
  recarregarPerfil: async () => undefined,
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

createRoot(document.getElementById("root")!).render(
  <ErpSessionCtx.Provider value={contexto}>
    <ErpShell><PaginaCrm /></ErpShell>
  </ErpSessionCtx.Provider>,
);
