import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

async function authClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase, user: data.user };
}

const stages = ["inicio", "doc_comp", "doc_vend", "contrato", "minuta_cnd", "minuta_env", "pagamento", "registrada"];

export async function GET(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const [sales, processes, deals, leads, products, brokers] = await Promise.all([
    auth.supabase.from("vendas").select("id,created_at,data_venda,empreendimento_id,empreendimento_nome,unidade_id,vgv,forma_pgto,status,obs").order("created_at", { ascending: false }),
    auth.supabase.from("venda_processos").select("id,venda_id,negocio_id,etapa,tipo_venda,responsavel_usuario_id,prazo_em,observacoes,criado_em,atualizado_em"),
    auth.supabase.from("negocios").select("id,venda_id,lead_id,corretor_id,empreendimento_id,valor,status"),
    auth.supabase.from("leads").select("id,nome,telefone,email,corretor_id"),
    auth.supabase.from("empreendimentos").select("id,nome,origem,bairro,cidade").order("nome"),
    auth.supabase.rpc("listar_corretores_transferencia"),
  ]);
  const error = [sales, processes, deals, leads, products, brokers].find((item) => item.error)?.error;
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json({ sales: sales.data ?? [], processes: processes.data ?? [], deals: deals.data ?? [], leads: leads.data ?? [], products: products.data ?? [], brokers: brokers.data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action || "");
  if (action === "move") {
    const processId = String(body.processId || "");
    const stage = String(body.stage || "");
    if (!processId || !stages.includes(stage)) return Response.json({ error: "Etapa inválida." }, { status: 422 });
    const update = stage === "registrada"
      ? { etapa: stage, atualizado_em: new Date().toISOString(), prazo_em: null }
      : { etapa: stage, atualizado_em: new Date().toISOString() };
    const { error } = await auth.supabase.from("venda_processos").update(update).eq("id", processId);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }
  if (action === "assign") {
    const processId = String(body.processId || "");
    const userId = body.userId ? String(body.userId) : null;
    const { error } = await auth.supabase.from("venda_processos").update({ responsavel_usuario_id: userId, atualizado_em: new Date().toISOString() }).eq("id", processId);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }
  if (action === "create") {
    const dealId = Number(body.dealId);
    const productId = String(body.productId || "");
    const vgv = Number(body.vgv);
    if (!Number.isSafeInteger(dealId) || !productId || !Number.isFinite(vgv) || vgv <= 0) return Response.json({ error: "Selecione o negócio, o produto e informe o valor." }, { status: 422 });
    const [{ data: deal }, { data: product }] = await Promise.all([
      auth.supabase.from("negocios").select("id,lead_id,empreendimento_id").eq("id", dealId).maybeSingle(),
      auth.supabase.from("empreendimentos").select("id,nome,origem").eq("id", productId).maybeSingle(),
    ]);
    if (!deal || !product) return Response.json({ error: "Negócio ou produto não encontrado." }, { status: 404 });
    const { data: sale, error: saleError } = await auth.supabase.from("vendas").insert({ data_venda: new Date().toISOString().slice(0, 10), empreendimento_id: product.id, empreendimento_nome: product.nome, vgv, forma_pgto: String(body.payment || "") || null, status: "pendente", obs: String(body.notes || "") || null }).select("id").single();
    if (saleError || !sale) return Response.json({ error: saleError?.message || "Não foi possível criar a venda." }, { status: 502 });
    const { error: dealError } = await auth.supabase.from("negocios").update({ venda_id: sale.id }).eq("id", deal.id);
    const { error: processError } = await auth.supabase.from("venda_processos").insert({ venda_id: sale.id, negocio_id: deal.id, etapa: "inicio", tipo_venda: product.origem === "terceiros" ? "revenda" : "construtora", criado_por: auth.user.id });
    if (dealError || processError) return Response.json({ error: dealError?.message || processError?.message }, { status: 502 });
    return Response.json({ success: true, saleId: sale.id });
  }
  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}
