import React from "react";
import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import "../../app/styles/app-mobile-gestor.css";
import { InicioGestaoMobile } from "../../app/features/home/InicioGestaoMobile";

const estado = new URLSearchParams(window.location.search).get("state") ?? "normal";
const payload = {
  summary: { acoes_vencidas: 12, clientes_aguardando: 8, clientes_criticos: 3, visitas_sem_feedback: 4, corretores_ativos: 3 },
  team: [
    { corretor_id: 7, nome: "Corretora Alfa", online: true, no_escritorio: true, carteira_ativa: 34, acoes_vencidas: 7, clientes_aguardando: 5, clientes_criticos: 2, carteira_trabalhada: 22, pct_carteira_trabalhada: 64.7 },
    { corretor_id: 8, nome: "Corretor Beta", online: false, no_escritorio: true, carteira_ativa: 28, acoes_vencidas: 5, clientes_aguardando: 3, clientes_criticos: 1, carteira_trabalhada: 21, pct_carteira_trabalhada: 75 },
    { corretor_id: 9, nome: "Corretora Gama", online: false, no_escritorio: false, carteira_ativa: 19, acoes_vencidas: 0, clientes_aguardando: 0, clientes_criticos: 0, carteira_trabalhada: 18, pct_carteira_trabalhada: 94.7 },
  ],
  generated_at: "2026-09-20T12:00:00.000Z",
};
const requests: Array<{ method: string; path: string; blocked: boolean }> = [];
const log = document.createElement("script");
log.id = "inicio-gestao-harness-log";
log.type = "application/json";
log.textContent = "[]";
document.head.append(log);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = input instanceof Request ? input : null;
  const method = String(init?.method ?? request?.method ?? "GET").toUpperCase();
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
  const item = { method, path: `${url.pathname}${url.search}`, blocked: false };
  requests.push(item);
  log.textContent = JSON.stringify(requests);
  if (method !== "GET" || url.origin !== window.location.origin || url.pathname !== "/api/central-comando" || url.searchParams.get("section") !== "gestao-mobile") {
    item.blocked = true;
    log.textContent = JSON.stringify(requests);
    return json({ error: "Rede fora do harness bloqueada." }, 405);
  }
  if (estado === "erro") return json({ error: "Indicadores temporariamente indisponíveis." }, 502);
  if (estado === "vazio") return json({ ...payload, summary: { ...payload.summary, acoes_vencidas: 0, clientes_aguardando: 0, clientes_criticos: 0, visitas_sem_feedback: 0 }, team: [] });
  return json(payload);
};

document.documentElement.dataset.inicioGestaoHarness = "sanitizado";
createRoot(document.getElementById("root")!).render(
  <InicioGestaoMobile accessToken="harness-test-only" nome="Gestor Demonstração" onIr={(path) => { document.documentElement.dataset.destino = path; }} />,
);
