import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

async function authClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase, user: data.user };
}

const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const [sales, details, commissions, receipts, cash, users, brokers, goals, leads, deals] = await Promise.all([
    auth.supabase.from("vendas").select("id,created_at,data_venda,empreendimento_id,empreendimento_nome,unidade_id,vgv,custos,forma_pgto,percentual_comissao,status,obs").order("data_venda", { ascending: false }),
    auth.supabase.from("v_vendas_detalhe").select("id,data_venda,empreendimento,unidade,bairro,incorporadora,vgv,percentual_comissao,comissao_bruta,comissao_corretores,comissao_executivo,comissao_apecerto,indicacao,corretores,forma_pgto,status,obs"),
    auth.supabase.from("comissoes").select("id,venda_id,beneficiario_id,papel,valor_calculado,valor_final,override_motivo,created_at"),
    auth.supabase.from("recebimentos").select("id,venda_id,numero_parcela,valor_total,data_prevista,data_recebimento,status,created_at").order("data_prevista", { ascending: true }),
    auth.supabase.from("lancamentos_caixa").select("id,venda_id,recebimento_id,data,tipo,categoria,descricao,valor,origem,papel,created_at").order("data", { ascending: false }).limit(2000),
    auth.supabase.from("usuarios").select("id,nome,role,ativo"),
    auth.supabase.from("corretores").select("id,nome,usuario_id,online,ativo").eq("ativo", true),
    auth.supabase.from("metas_corretor").select("nome,meta_vgv,atualizado_em"),
    auth.supabase.from("leads").select("id,nome,origem,criado_em,corretor_id"),
    auth.supabase.from("negocios").select("id,lead_id,corretor_id,venda_id,status,valor,criado_em"),
  ]);
  const firstError = [sales, details, commissions, receipts, cash, users, brokers, goals, leads, deals].find((result) => result.error)?.error;
  if (firstError) return Response.json({ error: firstError.message }, { status: 502 });
  const saleById = new Map((sales.data ?? []).map((sale) => [sale.id, sale]));
  const reconciledReceipts = (receipts.data ?? []).map((receipt) => {
    const sale = saleById.get(receipt.venda_id);
    if (sale?.status !== "pago") return receipt;
    return {
      ...receipt,
      status: "recebido",
      data_recebimento: receipt.data_recebimento || sale.data_venda,
    };
  });
  return Response.json({ sales: sales.data ?? [], details: details.data ?? [], commissions: commissions.data ?? [], receipts: reconciledReceipts, cash: cash.data ?? [], users: users.data ?? [], brokers: brokers.data ?? [], goals: goals.data ?? [], leads: leads.data ?? [], deals: deals.data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const action = clean(body.action, 40);

  if (action === "createCash") {
    const type = clean(body.type, 10);
    const category = clean(body.category, 100);
    const date = clean(body.date, 10);
    const value = Number(body.value);
    if (!['entrada', 'saida'].includes(type) || !category || !date || !Number.isFinite(value) || value <= 0) return Response.json({ error: "Preencha tipo, categoria, data e valor." }, { status: 422 });
    const { error } = await auth.supabase.from("lancamentos_caixa").insert({ tipo: type as "entrada" | "saida", categoria: category, data: date, valor: value, descricao: clean(body.description, 500) || null, origem: "erp", venda_id: clean(body.saleId, 50) || null });
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "createReceipt") {
    const saleId = clean(body.saleId, 50); const value = Number(body.value); const due = clean(body.due, 10); const installment = Number(body.installment);
    if (!saleId || !Number.isFinite(value) || value <= 0 || !due || !Number.isSafeInteger(installment) || installment < 1) return Response.json({ error: "Informe venda, parcela, vencimento e valor." }, { status: 422 });
    const { error } = await auth.supabase.from("recebimentos").insert({ venda_id: saleId, numero_parcela: installment, valor_total: value, data_prevista: due, status: "pendente" });
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "settleReceipt") {
    const receiptId = clean(body.receiptId, 50); const received = body.received !== false;
    if (!receiptId) return Response.json({ error: "Recebimento inválido." }, { status: 422 });
    const { error } = await auth.supabase.from("recebimentos").update({ status: received ? "recebido" : "pendente", data_recebimento: received ? new Date().toISOString().slice(0, 10) : null }).eq("id", receiptId);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "updateSale") {
    const saleId = clean(body.saleId, 50); const status = clean(body.status, 20); const percent = Number(body.percent);
    if (!saleId || !['pendente', 'concluido', 'pago', 'distrato'].includes(status) || !Number.isFinite(percent) || percent < 0 || percent > 100) return Response.json({ error: "Dados da venda inválidos." }, { status: 422 });
    const { error } = await auth.supabase.from("vendas").update({ status: status as "pendente" | "concluido" | "pago" | "distrato", percentual_comissao: percent / 100, forma_pgto: clean(body.payment, 100) || null, obs: clean(body.notes, 1000) || null }).eq("id", saleId);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    if (status === "pago") {
      const { error: receiptError } = await auth.supabase.from("recebimentos").update({ status: "recebido", data_recebimento: new Date().toISOString().slice(0, 10) }).eq("venda_id", saleId).neq("status", "recebido");
      if (receiptError) return Response.json({ error: `Venda atualizada, mas a baixa das parcelas falhou: ${receiptError.message}` }, { status: 502 });
    }
    return Response.json({ success: true });
  }
  if (action === "deleteSale") {
    const saleId = clean(body.saleId, 50);
    if (!saleId) return Response.json({ error: "Venda inválida." }, { status: 422 });
    const { data: me } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
    if (!me || !["admin", "gestor", "executivo"].includes(me.role)) return Response.json({ error: "Apenas administradores podem apagar vendas." }, { status: 403 });
    await auth.supabase.from("comissoes").delete().eq("venda_id", saleId);
    await auth.supabase.from("recebimentos").delete().eq("venda_id", saleId);
    await auth.supabase.from("lancamentos_caixa").update({ venda_id: null }).eq("venda_id", saleId);
    await auth.supabase.from("negocios").update({ venda_id: null }).eq("venda_id", saleId);
    const { error } = await auth.supabase.from("vendas").delete().eq("id", saleId);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    return Response.json({ success: true });
  }
  if (action === "addCommission" || action === "updateCommission" || action === "deleteCommission") {
    const { data: me } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
    if (!me || !["admin", "gestor", "executivo"].includes(me.role)) return Response.json({ error: "Apenas administradores podem editar comissões." }, { status: 403 });

    if (action === "addCommission") {
      const vendaId = clean(body.saleId, 50); const papel = clean(body.papel, 40) || "outro"; const valor = Number(body.valor);
      const beneficiarioId = clean(body.beneficiarioId, 60) || null;
      if (!vendaId || !Number.isFinite(valor)) return Response.json({ error: "Informe a venda e o valor." }, { status: 422 });
      const { error } = await auth.supabase.from("comissoes").insert({ venda_id: vendaId, papel, valor_final: valor, valor_calculado: valor, beneficiario_id: beneficiarioId });
      return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
    }
    if (action === "updateCommission") {
      const id = clean(body.commissionId, 60); const valor = Number(body.valor);
      if (!id || !Number.isFinite(valor)) return Response.json({ error: "Comissão inválida." }, { status: 422 });
      const { error } = await auth.supabase.from("comissoes").update({ valor_final: valor }).eq("id", id);
      return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
    }
    const id = clean(body.commissionId, 60);
    if (!id) return Response.json({ error: "Comissão inválida." }, { status: 422 });
    const { error } = await auth.supabase.from("comissoes").delete().eq("id", id);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  return Response.json({ error: "Ação financeira desconhecida." }, { status: 400 });
}
