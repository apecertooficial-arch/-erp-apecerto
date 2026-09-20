import React from "react";
import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import { ConnectionsWorkspace } from "../../app/features/settings/ConnectionsWorkspace";

const painel = {
  pode_ver_tudo: true,
  contagens: {
    total: 3,
    conectadas: 2,
    conectando: 0,
    desconectadas: 1,
    desconhecidas: 0,
    arquivadas: 0,
    em_quarentena: 0,
    sincronizacao_fresca: true,
    ultimo_snapshot_completo_em: "2026-09-20T15:00:00.000Z",
  },
  sessoes: [
    { sessao_id: 1, provider_session_id: "sessao-demo-1", nome: "Equipe Alfa", estado: "connected", estado_em: "2026-09-20T15:00:00.000Z", sincronizacao_fresca: true, em_quarentena: false, corretor_id: 1, corretor_nome: "Corretora Alfa", legado_instancia_id: 101 },
    { sessao_id: 2, provider_session_id: "sessao-demo-2", nome: "Equipe Beta", estado: "connected", estado_em: "2026-09-20T15:00:00.000Z", sincronizacao_fresca: true, em_quarentena: false, corretor_id: 2, corretor_nome: "Corretor Beta", legado_instancia_id: 102 },
    { sessao_id: 3, provider_session_id: "sessao-demo-3", nome: "Plantão", estado: "disconnected", estado_em: "2026-09-20T14:00:00.000Z", sincronizacao_fresca: true, em_quarentena: false, corretor_id: null, corretor_nome: null, legado_instancia_id: 103 },
  ],
  arquivadas: [],
  modo: "harness",
  gerado_em: "2026-09-20T15:00:00.000Z",
};

const log = document.createElement("script");
log.id = "connections-harness-log";
log.type = "application/json";
log.textContent = "[]";
document.head.append(log);
const requests: Array<{ method: string; path: string }> = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = input instanceof Request ? input : null;
  const method = String(init?.method ?? request?.method ?? "GET").toUpperCase();
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
  requests.push({ method, path: url.pathname });
  log.textContent = JSON.stringify(requests);
  if (url.origin !== window.location.origin || url.pathname !== "/api/connections") return json({ error: "Rede fora do harness bloqueada." }, 405);
  if (method === "GET") return json({ painel });
  if (method === "POST") return json({ result: { status: "connected", conectada: true, confirmacaoAutomaticaComprovada: false, qrCodeImage: null } });
  return json({ error: "Método bloqueado." }, 405);
};

document.documentElement.dataset.connectionsHarness = "sanitizado";
createRoot(document.getElementById("root")!).render(<ConnectionsWorkspace accessToken="harness-test-only" />);
