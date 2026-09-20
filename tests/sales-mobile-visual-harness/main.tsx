import React from "react";
import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import "../../app/styles/apecerto-identidade.css";
import "../../app/styles/funil.css";
import "../../app/styles/redesign-apecerto-esteira.css";
import { MobileCrmNavigation } from "../../app/features/funil-2/MobileCrmNavigation";
import { SalesProcessView } from "../../app/features/sales/SalesProcessWorkspace";

const estado = new URLSearchParams(window.location.search).get("state") ?? "normal";
const payload = {
  sales: [{ id: "venda-teste-1", created_at: "2026-09-18T12:00:00Z", data_venda: "2026-09-18", cliente_nome: "Cliente sanitizado", empreendimento_id: "produto-teste-1", empreendimento_nome: "Residencial Horizonte", vgv: 1250000, forma_pgto: "Financiamento", status: "ativa", obs: null }],
  processes: [{ id: "processo-teste-1", venda_id: "venda-teste-1", negocio_id: 801, etapa: "doc_comp", tipo_venda: "revenda", responsavel_usuario_id: "usuario-teste-1", prazo_em: "2026-09-23T12:00:00Z", atualizado_em: "2026-09-19T12:00:00Z", aprovacao_status: "aprovada" }],
  deals: [{ id: 801, venda_id: "venda-teste-1", lead_id: 701, corretor_id: 7, empreendimento_id: "produto-teste-1", valor: 1250000, status: "ganho" }],
  leads: [{ id: 701, nome: "Cliente sanitizado", telefone: null, email: null, corretor_id: 7, tags: ["Financiamento"], extras: null }],
  products: [{ id: "produto-teste-1", nome: "Residencial Horizonte", origem: "captacao", bairro: "Bairro sanitizado", cidade: "São Paulo" }],
  brokers: [{ id: 7, nome: "Corretora Alfa", usuario_id: "usuario-teste-1", online: true }],
  stages: [], etapaDocs: [], anexos: [], users: [], history: [], verificacoes: [], solicitacoes: [], docModelo: [], condicoes: [], comissao: [], comissaoParcelas: [], observacoes: [], pipelines: [], pipelineStages: [], partes: [], anexoEventos: [],
};

const requisicoes: Array<{ method: string; path: string; blocked: boolean }> = [];
const registro = document.createElement("script");
registro.id = "sales-harness-log";
registro.type = "application/json";
registro.textContent = "[]";
document.head.append(registro);
const atualizarRegistro = () => { registro.textContent = JSON.stringify(requisicoes); };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = input instanceof Request ? input : null;
  const method = String(init?.method ?? request?.method ?? "GET").toUpperCase();
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
  const item = { method, path: `${url.pathname}${url.search}`, blocked: false };
  requisicoes.push(item);
  atualizarRegistro();
  if (method !== "GET" || url.origin !== window.location.origin) {
    item.blocked = true;
    atualizarRegistro();
    return json({ error: "Harness visual: operação bloqueada." }, 405);
  }
  if (url.pathname !== "/api/crm/sales") return json({ error: "Leitura fora do inventário." }, 404);
  if (estado === "loading") return new Promise<Response>(() => undefined);
  if (estado === "offline") throw new TypeError("Sem conexão no harness visual.");
  if (estado === "erro") return json({ error: "Não foi possível carregar a Esteira no momento." }, 502);
  return json(payload);
};

function Harness() {
  return <main className="funil-oficial ape-app modo-crm" aria-label="Esteira de vendas">
    <header className="ape-abertura"><span className="ape-sobrancelha">CRM</span><h1 className="ape-manchete">Esteira de vendas</h1></header>
    <MobileCrmNavigation areaAtual="vendas" onIr={() => undefined} />
    <section className="ape-mobile-esteira"><SalesProcessView accessToken="harness-test-only" sessionRole="admin" /></section>
  </main>;
}

createRoot(document.getElementById("root")!).render(<Harness />);
