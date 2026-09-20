import React from "react";
import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import "../../app/styles/apecerto-identidade.css";
import "../../app/styles/redesign-apecerto.css";
import "../../app/styles/app-mobile.css";
import "../../app/styles/app-mobile-aprovado.css";
import "../../app/styles/tela-avisos.css";
import { NotificationsWorkspace } from "../../app/features/notifications/NotificationsWorkspace";

const itens = [
  { id: 501, tipo: "canal_indisponivel", prioridade: 1, titulo: "Canal indisponível", detalhe: "Corrija a conexão antes da próxima abordagem.", negocio_id: 104, deep_link: "/negocio/104", criada_em: "2026-09-19T12:10:00Z", vista_em: null, resolvida_em: null },
  { id: 502, tipo: "lead_quente", prioridade: 1, titulo: "Lead com alta intenção", detalhe: "Priorize este atendimento enquanto o interesse está ativo.", negocio_id: 106, deep_link: "/negocio/106", criada_em: "2026-09-19T12:30:00Z", vista_em: null, resolvida_em: null },
  { id: 503, tipo: "presenca_pendente", prioridade: 1, titulo: "Confirmação de presença pendente", detalhe: "Confirme que está no escritório para continuar na distribuição.", negocio_id: null, deep_link: "/meu-dia", criada_em: "2026-09-19T12:40:00Z", vista_em: null, resolvida_em: null },
  { id: 504, tipo: "visita_feedback_pendente", prioridade: 2, titulo: "Visita sem feedback", detalhe: "Registre o resultado para a gestão acompanhar.", negocio_id: 102, deep_link: "/negocio/102", criada_em: "2026-09-19T11:00:00Z", vista_em: null, resolvida_em: null },
  { id: 505, tipo: "lead_em_atendimento", prioridade: 2, titulo: "Lead em atendimento", detalhe: "Acompanhe a conversa e confirme o próximo passo.", negocio_id: 105, deep_link: "/negocio/105", criada_em: "2026-09-19T12:20:00Z", vista_em: null, resolvida_em: null },
];

const eventos: Array<{ method: string; path: string }> = [];
const log = document.createElement("script");
log.id = "alertas-harness-log";
log.type = "application/json";
log.textContent = "[]";
log.dataset.consoleLog = "[]";
document.head.append(log);

const registrarConsole = (level: string, values: unknown[]) => {
  const atual = JSON.parse(log.dataset.consoleLog ?? "[]") as unknown[];
  atual.push({ level, message: values.map(String).join(" ").slice(0, 500) });
  log.dataset.consoleLog = JSON.stringify(atual);
};
const erroOriginal = console.error.bind(console);
const avisoOriginal = console.warn.bind(console);
console.error = (...values) => { registrarConsole("error", values); erroOriginal(...values); };
console.warn = (...values) => { registrarConsole("warning", values); avisoOriginal(...values); };
window.addEventListener("error", (event) => registrarConsole("error", [event.message]));
window.addEventListener("unhandledrejection", (event) => registrarConsole("error", [event.reason]));

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = input instanceof Request ? input : null;
  const method = String(init?.method ?? request?.method ?? "GET").toUpperCase();
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
  if (url.origin !== window.location.origin || url.pathname !== "/api/notificacoes") throw new Error("Rede fora do harness bloqueada.");
  eventos.push({ method, path: url.pathname });
  log.textContent = JSON.stringify(eventos);
  return new Response(JSON.stringify(method === "GET" ? { ok: true, itens } : { ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
};

document.documentElement.dataset.alertasHarness = "sanitizado";
createRoot(document.getElementById("root")!).render(
  <main style={{ minHeight: "100vh", background: "var(--surface-page, #f7f7fb)", padding: "24px" }}>
    <NotificationsWorkspace
      accessToken="harness-only"
      onNavigate={(href) => { document.documentElement.dataset.lastNotificationNavigation = href; }}
    />
  </main>,
);
