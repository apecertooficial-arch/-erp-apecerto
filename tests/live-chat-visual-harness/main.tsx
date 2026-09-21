import React from "react";
import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import { LiveChatWorkspace, type ChatData } from "../../app/features/chat/LiveChatWorkspace";

type Estado = "normal" | "vazio" | "erro" | "agendamentos-erro" | "mensagens-invalido";
const estado = (new URLSearchParams(window.location.search).get("state") ?? "normal") as Estado;
const agora = "2026-09-20T14:00:00Z";
const payload: ChatData = {
  conversations: [{ id: "conversa-sanitizada-1", contato_id: "contato-sanitizado-1", instancia_id: "instancia-sanitizada-1", status: "aberta", ultima_msg_em: agora, origem: "site" }],
  contacts: [{ id: "contato-sanitizado-1", nome: "Cliente Demonstração", telefone: "11900000000", lead_id: 701 }],
  instances: [{ id: "instancia-sanitizada-1", session_id: "sessao-sanitizada-1", rotulo: "Atendimento principal", status: "conectada", corretor_id: 7 }],
  dapi: [{ id: 11, instancia_dapi: "sessao-sanitizada-1", nome: "Canal de teste", conectada: true }],
  latest: { "conversa-sanitizada-1": { id: "mensagem-sanitizada-2", conversa_id: "conversa-sanitizada-1", direcao: "entrada", tipo: "texto", conteudo: "Gostaria de agendar uma visita.", criado_em: agora, status: "recebida" } },
  leads: [{ id: 701, nome: "Cliente Demonstração", telefone: "11900000000", email: "cliente@example.invalid", corretor_id: 7, origem: "site", tags: ["interesse-sanitizado"] }],
  deals: [{ id: 801, lead_id: 701, corretor_id: 7, stage_id: 3, empreendimento_id: "produto-sanitizado-1", valor: 1250000, status: "aberto" }],
  brokers: [{ id: 7, nome: "Corretora Demonstração", usuario_id: "usuario-sanitizado-1", online: true }],
  products: [{ id: "produto-sanitizado-1", nome: "Residencial Horizonte", bairro: "Bairro Demonstração", cidade: "São Paulo", preco: 1250000, status: "publicado" }],
  media: [],
  activities: [{ id: 901, lead_id: 701, tipo: "observacao", texto: "Retornar com opções de horários.", criado_em: agora }],
  approaches: [{ id: 31, nome: "Primeiro contato", mensagens: [], produto_id: null }],
  stages: [{ id: 3, nome: "visita", rotulo: "Visita", ordem: 3 }],
};
const mensagens = [
  { id: "mensagem-sanitizada-1", conversa_id: "conversa-sanitizada-1", direcao: "saida", tipo: "texto", conteudo: "Olá! Como posso ajudar?", criado_em: "2026-09-20T13:58:00Z", status: "entregue" },
  payload.latest["conversa-sanitizada-1"],
];

const requisicoes: Array<{ method: string; path: string; action: string | null; blocked: boolean }> = [];
const log = document.createElement("script");
log.id = "live-chat-harness-log";
log.type = "application/json";
log.textContent = "[]";
document.head.append(log);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = input instanceof Request ? input : null;
  const method = String(init?.method ?? request?.method ?? "GET").toUpperCase();
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
  let action: string | null = null;
  if (typeof init?.body === "string") action = String((JSON.parse(init.body) as { action?: unknown }).action ?? "") || null;
  const item = { method, path: `${url.pathname}${url.search}`, action, blocked: false };
  requisicoes.push(item);
  log.textContent = JSON.stringify(requisicoes);
  if (url.origin !== window.location.origin || url.pathname !== "/api/live-chat") {
    item.blocked = true; log.textContent = JSON.stringify(requisicoes); return json({ error: "Rede fora do harness bloqueada." }, 405);
  }
  if (method === "GET") {
    if (estado === "erro" && !url.searchParams.has("conversationId")) return json({ error: "Não foi possível carregar o chat no momento." }, 502);
    if (url.searchParams.has("conversationId")) return json(estado === "mensagens-invalido" ? {} : { messages: mensagens });
    return json(estado === "vazio" ? { ...payload, conversations: [], contacts: [], latest: {}, leads: [], deals: [], activities: [] } : payload);
  }
  if (method === "POST" && action === "listScheduled") {
    if (estado === "agendamentos-erro") return json({ error: "Não foi possível carregar os agendamentos." }, 502);
    return json({ agendadas: [] });
  }
  item.blocked = true; log.textContent = JSON.stringify(requisicoes);
  return json({ error: "Harness visual: mutação bloqueada." }, 405);
};

document.documentElement.dataset.liveChatHarness = "sanitizado";
createRoot(document.getElementById("root")!).render(<LiveChatWorkspace accessToken="harness-test-only" />);
