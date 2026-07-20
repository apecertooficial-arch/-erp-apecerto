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
  const [sales, details, commissions, receipts, cash, users, brokers, goals, leads, deals, empreendimentos, categorias, rankingVgv] = await Promise.all([
    auth.supabase.from("vendas").select("id,created_at,data_venda,empreendimento_id,empreendimento_nome,unidade_id,vgv,custos,forma_pgto,percentual_comissao,status,obs").order("data_venda", { ascending: false }),
    auth.supabase.from("v_vendas_detalhe").select("id,data_venda,empreendimento,unidade,bairro,incorporadora,vgv,percentual_comissao,comissao_bruta,comissao_corretores,comissao_executivo,comissao_apecerto,indicacao,corretores,forma_pgto,status,obs"),
    auth.supabase.from("comissoes").select("id,venda_id,beneficiario_id,papel,valor_calculado,valor_final,override_motivo,created_at"),
    auth.supabase.from("recebimentos").select("id,venda_id,numero_parcela,valor_total,data_prevista,data_recebimento,status,created_at").order("data_prevista", { ascending: true }),
    auth.supabase.from("lancamentos_caixa").select("id,venda_id,recebimento_id,data,tipo,categoria,descricao,valor,origem,papel,beneficiario_id,comissao_id,natureza,created_at").order("data", { ascending: false }).limit(2000),
    auth.supabase.from("usuarios").select("id,nome,role,ativo"),
    auth.supabase.from("corretores").select("id,nome,usuario_id,online,ativo").eq("ativo", true),
    auth.supabase.from("metas_corretor").select("nome,meta_vgv,atualizado_em"),
    auth.supabase.from("leads").select("id,nome,origem,criado_em,corretor_id"),
    auth.supabase.from("negocios").select("id,lead_id,corretor_id,venda_id,status,valor,criado_em"),
    auth.supabase.from("empreendimentos").select("id,nome,bairro,cidade").order("nome", { ascending: true }),
    auth.supabase.from("categorias_caixa").select("id,nome,tipo,natureza,cor,ordem").eq("ativo", true).order("tipo", { ascending: true }).order("ordem", { ascending: true }),
    auth.supabase.from("vw_ranking_vgv").select("corretor_id,corretor,vendas,vgv").order("vgv", { ascending: false }),
  ]);
  const firstError = [sales, details, commissions, receipts, cash, users, brokers, goals, leads, deals, empreendimentos, categorias].find((result) => result.error)?.error;
  if (firstError) return Response.json({ error: firstError.message }, { status: 502 });
  // Segurança: o corretor NUNCA pode ver valores totais/brutos de comissão — apenas a comissão que é dele (comissoes já é filtrada por RLS).
  // Removemos os campos brutos da resposta para que o navegador do corretor nem receba esses números.
  const { data: me } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
  const isBroker = !me || me.role === "corretor";
  const safeSales = isBroker
    ? (sales.data ?? []).map((sale) => ({ ...sale, percentual_comissao: null }))
    : (sales.data ?? []);
  const safeDetails = isBroker
    ? (details.data ?? []).map((detail) => ({ ...detail, percentual_comissao: null, comissao_bruta: null, comissao_corretores: null, comissao_executivo: null, comissao_apecerto: null, indicacao: null }))
    : (details.data ?? []);
  const saleById = new Map(safeSales.map((sale) => [sale.id, sale]));
  const reconciledReceipts = (receipts.data ?? []).map((receipt) => {
    const sale = saleById.get(receipt.venda_id);
    if (sale?.status !== "pago") return receipt;
    return {
      ...receipt,
      status: "recebido",
      data_recebimento: receipt.data_recebimento || sale.data_venda,
    };
  });
  return Response.json({ sales: safeSales, details: safeDetails, commissions: commissions.data ?? [], receipts: reconciledReceipts, cash: cash.data ?? [], users: users.data ?? [], brokers: brokers.data ?? [], goals: goals.data ?? [], leads: leads.data ?? [], deals: deals.data ?? [], empreendimentos: empreendimentos.data ?? [], categorias: categorias.data ?? [], rankingVgv: rankingVgv.data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const action = clean(body.action, 40);

  if (action === "createCategory" || action === "renameCategory" || action === "removeCategory") {
    const { data: me } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
    if (!me || !["admin", "gestor", "executivo"].includes(me.role)) return Response.json({ error: "Apenas administradores podem gerenciar categorias." }, { status: 403 });
    const validNatureza = (value: string) => ["normal", "comissao_recebida", "comissao_paga"].includes(value) ? value : "normal";
    if (action === "createCategory") {
      const nome = clean(body.nome, 80);
      const tipo = clean(body.tipo, 10);
      if (!nome || !["entrada", "saida", "ambos"].includes(tipo)) return Response.json({ error: "Informe o nome e o tipo da categoria." }, { status: 422 });
      const { error } = await auth.supabase.from("categorias_caixa").insert({ nome, tipo: tipo as "entrada" | "saida", natureza: validNatureza(clean(body.natureza, 30)), cor: clean(body.cor, 20) || null, ordem: 99 } as never);
      return error ? Response.json({ error: /duplicate|unique/i.test(error.message) ? "Já existe uma categoria com esse nome." : error.message }, { status: 502 }) : Response.json({ success: true });
    }
    if (action === "renameCategory") {
      const id = clean(body.categoryId, 60);
      const patch: Record<string, unknown> = {};
      if (typeof body.nome === "string" && body.nome.trim()) patch.nome = clean(body.nome, 80);
      if (["entrada", "saida", "ambos"].includes(clean(body.tipo, 10))) patch.tipo = clean(body.tipo, 10);
      if (typeof body.natureza === "string") patch.natureza = validNatureza(clean(body.natureza, 30));
      if (typeof body.cor === "string") patch.cor = clean(body.cor, 20) || null;
      if (!id || Object.keys(patch).length === 0) return Response.json({ error: "Informe a categoria e o que alterar." }, { status: 422 });
      const { error } = await auth.supabase.from("categorias_caixa").update(patch as never).eq("id", id);
      return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
    }
    const id = clean(body.categoryId, 60);
    if (!id) return Response.json({ error: "Categoria inválida." }, { status: 422 });
    const { error } = await auth.supabase.from("categorias_caixa").update({ ativo: false }).eq("id", id);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "createSale") {
    const dataVenda = clean(body.dataVenda, 10);
    const vgv = Number(body.vgv);
    const percentRaw = Number(body.percent);
    const custos = Number(body.custos);
    if (!dataVenda || !Number.isFinite(vgv) || vgv <= 0) return Response.json({ error: "Informe a data e o VGV da venda." }, { status: 422 });
    const validStatus = ["pendente", "concluido", "pago", "distrato"];
    const status = validStatus.includes(clean(body.status, 20)) ? clean(body.status, 20) : "pendente";
    const empreendimentoId = clean(body.empreendimentoId, 60) || null;
    const corretorPrincipal = Number(body.corretorId);
    const documentos = Array.isArray(body.documentos)
      ? (body.documentos as unknown[]).filter((doc) => doc && typeof doc === "object").map((doc) => {
          const d = doc as Record<string, unknown>;
          return { nome: clean(d.nome, 200), path: clean(d.path, 1000), bucket: clean(d.bucket, 60) || "esteira-docs" };
        }).filter((doc) => doc.path).slice(0, 30)
      : [];

    const saleInsert: Record<string, unknown> = {
      data_venda: dataVenda,
      vgv,
      custos: Number.isFinite(custos) && custos >= 0 ? custos : 0,
      percentual_comissao: Number.isFinite(percentRaw) && percentRaw >= 0 && percentRaw <= 100 ? percentRaw / 100 : null,
      forma_pgto: clean(body.payment, 100) || null,
      status: status as "pendente" | "concluido" | "pago" | "distrato",
      obs: clean(body.notes, 1000) || null,
      empreendimento_id: empreendimentoId,
      empreendimento_nome: clean(body.empreendimentoNome, 200) || null,
      unidade_rotulo: clean(body.unidade, 120) || null,
      cliente_nome: clean(body.clienteNome, 200) || null,
      proprietario_nome: clean(body.proprietarioNome, 200) || null,
      corretor_id: Number.isSafeInteger(corretorPrincipal) && corretorPrincipal > 0 ? corretorPrincipal : null,
      documentos,
    };
    const { data: created, error: saleError } = await auth.supabase.from("vendas").insert(saleInsert as never).select("id").single();
    if (saleError || !created) return Response.json({ error: saleError?.message || "Não foi possível criar a venda." }, { status: 502 });
    const saleId = created.id as string;

    const brokerRows = Array.isArray(body.brokers)
      ? (body.brokers as unknown[]).filter((b) => b && typeof b === "object").map((b) => {
          const row = b as Record<string, unknown>;
          const fracao = Number(row.fracao);
          return {
            venda_id: saleId,
            corretor_id: clean(row.corretorId, 60) || null,
            corretor_nome: clean(row.corretorNome, 200) || null,
            fracao: Number.isFinite(fracao) && fracao > 0 ? fracao : 1,
            eh_indicador: row.ehIndicador === true,
          };
        }).filter((row) => row.corretor_id || row.corretor_nome)
      : [];
    if (brokerRows.length) {
      const { error } = await auth.supabase.from("venda_corretores").insert(brokerRows);
      if (error) return Response.json({ error: `Venda criada, mas falha ao vincular corretores: ${error.message}`, saleId }, { status: 502 });
    }

    const commissionRows = Array.isArray(body.commissions)
      ? (body.commissions as unknown[]).filter((c) => c && typeof c === "object").map((c) => {
          const row = c as Record<string, unknown>;
          const valor = Number(row.valor);
          return {
            venda_id: saleId,
            papel: clean(row.papel, 40) || "corretor",
            beneficiario_id: clean(row.beneficiarioId, 60) || null,
            valor_final: Number.isFinite(valor) ? valor : 0,
            valor_calculado: Number.isFinite(valor) ? valor : 0,
          };
        }).filter((row) => row.valor_final > 0)
      : [];
    if (commissionRows.length) {
      const { error } = await auth.supabase.from("comissoes").insert(commissionRows as never);
      if (error) return Response.json({ error: `Venda criada, mas falha ao lançar comissões: ${error.message}`, saleId }, { status: 502 });
    }

    const receiptRows = Array.isArray(body.receipts)
      ? (body.receipts as unknown[]).filter((r) => r && typeof r === "object").map((r, index) => {
          const row = r as Record<string, unknown>;
          const valor = Number(row.valor);
          const parcela = Number(row.numeroParcela);
          return {
            venda_id: saleId,
            numero_parcela: Number.isSafeInteger(parcela) && parcela > 0 ? parcela : index + 1,
            valor_total: Number.isFinite(valor) ? valor : 0,
            data_prevista: clean(row.dataPrevista, 10) || null,
            status: "pendente",
          };
        }).filter((row) => row.valor_total > 0)
      : [];
    if (receiptRows.length) {
      const { error } = await auth.supabase.from("recebimentos").insert(receiptRows);
      if (error) return Response.json({ error: `Venda criada, mas falha ao gerar parcelas: ${error.message}`, saleId }, { status: 502 });
    }

    return Response.json({ success: true, saleId });
  }

  if (action === "createCash") {
    const type = clean(body.type, 10);
    const category = clean(body.category, 100);
    const date = clean(body.date, 10);
    const value = Number(body.value);
    if (!['entrada', 'saida'].includes(type) || !category || !date || !Number.isFinite(value) || value <= 0) return Response.json({ error: "Preencha tipo, categoria, data e valor." }, { status: 422 });
    const saleId = clean(body.saleId, 50) || null;
    const receiptId = clean(body.receiptId, 50) || null;
    const commissionId = clean(body.commissionId, 60) || null;
    const beneficiarioId = clean(body.beneficiarioId, 60) || null;
    const papelRaw = clean(body.papel, 40);
    const papel = ['corretor', 'executivo', 'indicacao', 'apecerto'].includes(papelRaw) ? papelRaw : null;
    const naturezaRaw = clean(body.natureza, 30);
    const natureza = ["normal", "comissao_recebida", "comissao_paga"].includes(naturezaRaw) ? naturezaRaw : "normal";
    const insert: Record<string, unknown> = { tipo: type as "entrada" | "saida", categoria: category, data: date, valor: value, descricao: clean(body.description, 500) || null, origem: "erp", venda_id: saleId, recebimento_id: receiptId, comissao_id: commissionId, beneficiario_id: beneficiarioId, papel, natureza };
    const { error } = await auth.supabase.from("lancamentos_caixa").insert(insert as never);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    if (receiptId && body.settleReceipt === true) {
      const { error: settleError } = await auth.supabase.from("recebimentos").update({ status: "recebido", data_recebimento: date }).eq("id", receiptId).neq("status", "recebido");
      if (settleError) return Response.json({ error: `Lançamento salvo, mas a baixa da parcela falhou: ${settleError.message}` }, { status: 502 });
    }
    return Response.json({ success: true });
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
