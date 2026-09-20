import React from "react";
import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import { CampaignWorkspace } from "../../app/features/campaigns/CampaignWorkspace";

const estado = new URLSearchParams(window.location.search).get("state") ?? "normal";
const payload = {
  leads: [{ id: 701, nome: "Cliente Demonstração", telefone: "11900000000", tags: ["interesse-sanitizado"], status: "ativo", origem: "site", corretor_id: 7, disparo_optout: false }],
  deals: [{ id: 801, lead_id: 701, stage_id: 31, empreendimento_id: "produto-sanitizado-1", status: "aberto" }],
  stages: [{ id: 31, nome: "contato", rotulo: "Em contato", pipeline_id: 3, ordem: 1 }, { id: 32, nome: "retorno", rotulo: "Aguardando retorno", pipeline_id: 3, ordem: 2 }],
  approaches: [{ id: 41, nome: "Primeiro contato", mensagens: [{ name: "send-text-message", options: { text: "Olá {primeiro_nome}." } }], produto_id: null, ativo: true, ordem: 1 }],
  products: [{ id: "produto-sanitizado-1", nome: "Residencial Horizonte", bairro: "Bairro Demonstração", status: "publicado" }],
  recent: [],
  instances: [{ id: 51, nome: "Canal de demonstração", conectada: true, corretor_id: 7 }],
  brokers: [{ id: 7, nome: "Corretora Demonstração", apelido: "Corretora" }],
  instanceLinks: [{ corretor_id: 7, instancia_id: 51 }],
};

const requests: Array<{ method: string; path: string; blocked: boolean }> = [];
const log = document.createElement("script");
log.id = "campaigns-harness-log";
log.type = "application/json";
log.textContent = "[]";
document.head.append(log);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = input instanceof Request ? input : null;
  const method = String(init?.method ?? request?.method ?? "GET").toUpperCase();
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
  const item = { method, path: url.pathname, blocked: false };
  requests.push(item); log.textContent = JSON.stringify(requests);
  if (url.origin !== window.location.origin || url.pathname !== "/api/campaigns" || method !== "GET") {
    item.blocked = true; log.textContent = JSON.stringify(requests); return json({ error: "Harness visual: mutação bloqueada." }, 405);
  }
  if (estado === "erro") return json({ error: "Não foi possível carregar os disparos no momento." }, 502);
  if (estado === "vazio") return json({ ...payload, leads: [], deals: [], approaches: [], recent: [] });
  return json(payload);
};

document.documentElement.dataset.campaignsHarness = "sanitizado";
createRoot(document.getElementById("root")!).render(<CampaignWorkspace accessToken="harness-test-only" />);
