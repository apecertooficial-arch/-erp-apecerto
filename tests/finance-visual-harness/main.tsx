import React from "react";
import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import "../../app/styles/apecerto-identidade.css";
import "../../app/styles/redesign-apecerto-produtos-financeiro.css";
import "../../app/styles/redesign-apecerto-financeiro-abas.css";
import { FinanceWorkspace, type FinanceData } from "../../app/features/finance/FinanceWorkspace";

type Estado = "normal" | "vazio" | "erro" | "offline" | "loading" | "metaserror";
const estado = (new URLSearchParams(window.location.search).get("state") ?? "normal") as Estado;
const payload: FinanceData = {
  sales: [{ id: "venda-teste-1", created_at: "2026-09-02T12:00:00Z", data_venda: "2026-09-02", data_conclusao: "2026-09-05", empreendimento_id: "produto-teste-1", empreendimento_nome: "Residencial Horizonte", unidade_id: "unidade-teste-1", unidade_rotulo: "Unidade 82", cliente_nome: "Cliente sanitizado", proprietario_nome: null, vgv: 1250000, custos: 0, forma_pgto: "Financiamento", percentual_comissao: 0.05, status: "concluida", obs: null }],
  details: [{ id: "venda-teste-1", data_venda: "2026-09-02", empreendimento: "Residencial Horizonte", unidade: "Unidade 82", bairro: "Bairro sanitizado", incorporadora: "Incorporadora sanitizada", vgv: 1250000, percentual_comissao: 0.05, comissao_bruta: 62500, comissao_corretores: 25000, comissao_executivo: 6250, comissao_apecerto: 31250, indicacao: 0, corretores: "Corretora Alfa", forma_pgto: "Financiamento", status: "concluida", obs: null }],
  commissions: [{ id: "comissao-teste-1", venda_id: "venda-teste-1", beneficiario_id: "usuario-corretor-teste", papel: "corretor", valor_calculado: 25000, valor_final: 25000, override_motivo: null, created_at: "2026-09-05T12:00:00Z" }],
  receipts: [],
  cash: [],
  users: [{ id: "usuario-corretor-teste", nome: "Corretora Alfa", role: "corretor", ativo: true }],
  brokers: [{ id: 7, nome: "Corretora Alfa", usuario_id: "usuario-corretor-teste", online: true, ativo: true }],
  goals: [{ corretor_id: 7, nome: "Meta setembro", meta_vgv: 1800000, atualizado_em: "2026-09-01T12:00:00Z" }],
  leads: [],
  deals: [{ id: 801, lead_id: 701, corretor_id: 7, venda_id: "venda-teste-1", status: "ganho", valor: 1250000, criado_em: "2026-08-20T12:00:00Z" }],
  empreendimentos: [],
  categorias: [],
  rankingVgv: [{ corretor_id: "usuario-corretor-teste", corretor: "Corretora Alfa", vendas: 1, vgv: 1250000 }],
  payouts: [{ id: "repasse-teste-1", venda_id: "venda-teste-1", comissao_id: "comissao-teste-1", beneficiario_id: "usuario-corretor-teste", papel: "corretor", valor: 10000, ordem: 1, data_prevista: "2026-09-10", data_pagamento: "2026-09-10", status: "pago", observacao: null, lancamento_id: "caixa-teste-1", created_at: "2026-09-05T12:00:00Z" }],
  extratos: [],
  extratoLinhas: [],
};

const requisicoes: Array<{ method: string; path: string; blocked: boolean }> = [];
const registro = document.createElement("script");
registro.id = "finance-harness-log";
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
  if (url.pathname === "/api/metas") {
    if (estado === "metaserror") return json({ error: "Não foi possível carregar as metas no momento." }, 502);
    return json({ metas: [{ id: "meta-teste-1", corretor_id: 7, periodo_tipo: "mensal", ano: 2026, periodo: 9, meta_vgv: 1800000, meta_vendas: 2 }] });
  }
  if (url.pathname !== "/api/finance") return json({ error: "Leitura fora do inventário." }, 404);
  if (estado === "loading") return new Promise<Response>(() => undefined);
  if (estado === "offline") throw new TypeError("Sem conexão no harness visual.");
  if (estado === "erro") return json({ error: "Não foi possível carregar o financeiro no momento." }, 502);
  if (estado === "vazio") return json({ ...payload, sales: [], details: [], commissions: [], deals: [], rankingVgv: [], payouts: [] });
  return json(payload);
};

createRoot(document.getElementById("root")!).render(
  estado === "metaserror"
    ? <FinanceWorkspace accessToken="harness-test-only" sessionRole="admin" perfil="admin" sessionUserId="usuario-admin-teste" />
    : <FinanceWorkspace accessToken="harness-test-only" sessionRole="corretor" perfil="corretor" sessionUserId="usuario-corretor-teste" />,
);
