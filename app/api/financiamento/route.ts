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

const hexToken = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

/* GET ?leadId= — fichas do lead (RLS limita ao corretor dono / admin / gerente). */
export async function GET(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const leadId = Number(new URL(request.url).searchParams.get("leadId"));
  if (!Number.isSafeInteger(leadId) || leadId <= 0) return Response.json({ error: "Lead inválido." }, { status: 400 });
  const { data, error } = await auth.supabase
    .from("financiamento_fichas")
    .select("id,status,link_token,comprador_nome,telefone,email,renda,valor_imovel,valor_entrada,valor_financiar,estado_civil,conjuge_nome,conjuge_renda,conjuge_email,enviada_em,aberta_em,preenchida_em,criado_em")
    .eq("lead_id", leadId as never)
    .order("criado_em", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json({ fichas: data ?? [] });
}

/* POST { action: "linkFicha", leadId } — devolve o token do link público da ficha.
   Reaproveita a ficha aberta do lead (se houver); senão cria uma nova pré-preenchida. */
export async function POST(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  if (body.action !== "linkFicha") return Response.json({ error: "Ação não reconhecida." }, { status: 400 });
  const leadId = Number(body.leadId);
  const dealId = Number(body.dealId);
  if (!Number.isSafeInteger(leadId) || leadId <= 0) return Response.json({ error: "Lead inválido." }, { status: 400 });

  // Regra de negócio: a ficha só sai com um produto associado (negócio ou vínculo do lead).
  let productId: string | null = null;
  if (Number.isSafeInteger(dealId) && dealId > 0) {
    const { data: dealRow } = await auth.supabase.from("negocios").select("empreendimento_id").eq("id", dealId).maybeSingle();
    productId = (dealRow as { empreendimento_id?: string | null } | null)?.empreendimento_id ?? null;
  }
  if (!productId) {
    const { data: linkRow } = await auth.supabase.from("lead_produtos").select("empreendimento_id").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    productId = (linkRow as { empreendimento_id?: string | null } | null)?.empreendimento_id ?? null;
  }
  if (!productId) return Response.json({ error: "Associe um produto a este lead antes de enviar a ficha de financiamento." }, { status: 422 });
  const { data: product } = await auth.supabase.from("empreendimentos").select("nome,preco").eq("id", productId).maybeSingle();

  // Ficha existente ainda não concluída → reaproveita o mesmo link.
  const { data: existing } = await auth.supabase
    .from("financiamento_fichas")
    .select("id,link_token,status")
    .eq("lead_id", leadId as never)
    .neq("status", "concluida")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.link_token) return Response.json({ token: existing.link_token, status: existing.status, reused: true });

  const [{ data: lead }, { data: broker }] = await Promise.all([
    auth.supabase.from("leads").select("id,nome,telefone,email").eq("id", leadId).maybeSingle(),
    auth.supabase.from("corretores").select("id").eq("usuario_id", auth.user.id).maybeSingle(),
  ]);
  if (!lead) return Response.json({ error: "Lead não encontrado." }, { status: 404 });

  const token = hexToken();
  const { error } = await auth.supabase.from("financiamento_fichas").insert({
    created_by: auth.user.id,
    corretor_id: broker?.id ?? null,
    lead_id: leadId,
    comprador_nome: lead.nome ?? null,
    telefone: lead.telefone ?? null,
    email: lead.email ?? null,
    produto: (product as { nome?: string | null } | null)?.nome ?? null,
    valor_imovel: (product as { preco?: number | null } | null)?.preco ?? null,
    status: "enviada",
    link_token: token,
    enviada_em: new Date().toISOString(),
  } as never);
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json({ token, status: "enviada", reused: false });
}
