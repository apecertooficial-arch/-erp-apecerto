import { createServerSupabaseClient } from "../../lib/supabase/server";
import { papelNoGrupo } from "../../lib/papeis";

export const dynamic = "force-dynamic";

type ErroFinanciamento = { code?: string; message?: string } | null | undefined;

function falhaFinanciamento(error: ErroFinanciamento, operacao: string) {
  const semPermissao = error?.code === "42501" || /permission|policy|acesso negado/i.test(error?.message ?? "");
  console.error("financiamento_operacao_falhou", {
    operacao,
    codigo: error?.code ?? "desconhecido",
  });
  return Response.json({
    error: semPermissao
      ? "Você não tem permissão para consultar estas fichas."
      : "Não foi possível carregar as fichas de financiamento no momento.",
    erro: semPermissao ? "sem_permissao" : "falha_banco",
  }, { status: semPermissao ? 403 : 502 });
}

async function autenticar(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { status: "missing" as const };
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error } = await supabase.auth.getUser(token);
  if (error) return { status: "auth_error" as const, error };
  if (!auth.user) return { status: "invalid" as const };
  return { status: "ok" as const, supabase, user: auth.user };
}

export async function GET(request: Request) {
  const auth = await autenticar(request);
  if (auth.status === "missing") return Response.json({ error: "Sessão ausente." }, { status: 401 });
  if (auth.status === "invalid") return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  if (auth.status === "auth_error") return falhaFinanciamento(auth.error, "autenticar");

  const { data: profile, error: profileError } = await auth.supabase
    .from("usuarios").select("role,ativo").eq("id", auth.user.id).maybeSingle();
  if (profileError) return falhaFinanciamento(profileError, "carregar_perfil");
  if (!profile?.ativo) return Response.json({ error: "Seu perfil não possui acesso ao financiamento.", erro: "perfil_sem_acesso" }, { status: 403 });

  const canManage = papelNoGrupo(profile.role, "gestao");
  let query = auth.supabase
    .from("financiamento_fichas")
    .select("id,comprador_nome,telefone,produto,unidade,status,renda,valor_imovel,valor_entrada,valor_financiar,link_token,criado_em,preenchida_em,concluida_em");

  if (!canManage) {
    const { data: brokers, error: brokersError } = await auth.supabase
      .from("corretores")
      .select("id")
      .eq("usuario_id", auth.user.id)
      .eq("ativo", true);
    if (brokersError) return falhaFinanciamento(brokersError, "carregar_vinculo_corretor");
    const brokerIds = (brokers ?? []).map((broker) => broker.id);
    if (!brokerIds.length) return Response.json({ error: "Seu perfil não está vinculado a um corretor ativo.", erro: "perfil_sem_vinculo" }, { status: 403 });
    query = query.or(`corretor_id.in.(${brokerIds.join(",")}),created_by.eq.${auth.user.id}`);
  }

  const { data, error } = await query
    .order("criado_em", { ascending: false })
    .limit(500);
  if (error) return falhaFinanciamento(error, "carregar_fichas");

  return Response.json({ fichas: data ?? [] });
}
