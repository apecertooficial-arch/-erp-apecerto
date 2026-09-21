import { createServerSupabaseClient } from "../../lib/supabase/server";
import { isInvalidSessionError } from "../../lib/supabase/auth-errors";

export const dynamic = "force-dynamic";

type CondominiumError = { code?: string } | null | undefined;

function falhaCondominio(error: CondominiumError, operacao: string) {
  const semPermissao = error?.code === "42501";
  console.error("condominio_operacao_falhou", {
    operacao,
    codigo: error?.code ?? "desconhecido",
  });
  return Response.json({
    error: semPermissao
      ? "Seu perfil não tem permissão para cadastrar condomínios."
      : "Não foi possível concluir o cadastro do condomínio agora.",
    erro: semPermissao ? "sem_permissao" : "falha_banco",
  }, { status: semPermissao ? 403 : 502 });
}

type CondominiumInput = {
  name?: string;
  zipCode?: string;
  address?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
};

function bearer(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const accessToken = bearer(request);
  if (!accessToken) return Response.json({ error: "Sessão necessária." }, { status: 401 });

  const supabase = createServerSupabaseClient(accessToken);
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError && isInvalidSessionError(authError)) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  if (authError) return falhaCondominio(authError, "autenticar");
  if (!authData.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  let body: CondominiumInput;
  try { body = await request.json() as CondominiumInput; }
  catch { return Response.json({ error: "Dados inválidos." }, { status: 400 }); }

  const name = clean(body.name);
  const address = clean(body.address);
  const city = clean(body.city);
  const state = clean(body.state).toUpperCase();
  if (!name || !address || !city || state.length !== 2) {
    return Response.json({ error: "Informe nome, endereço, cidade e UF do condomínio." }, { status: 422 });
  }

  const { data: duplicate, error: duplicateError } = await supabase
    .from("condominios")
    .select("id,nome,endereco,numero,cidade,uf")
    .ilike("nome", name)
    .ilike("cidade", city)
    .limit(1)
    .maybeSingle();
  if (duplicateError) return falhaCondominio(duplicateError, "buscar_duplicidade");
  if (duplicate) {
    return Response.json({ error: "Este condomínio já está cadastrado. Use a referência existente ao cadastrar a unidade.", erro: "duplicado", condominium: duplicate }, { status: 409 });
  }

  const { data, error } = await supabase.from("condominios").insert({
    nome: name,
    cep: clean(body.zipCode) || null,
    endereco: address,
    numero: clean(body.number) || null,
    complemento: clean(body.complement) || null,
    bairro: clean(body.neighborhood) || null,
    cidade: city,
    uf: state,
    created_by: authData.user.id,
  }).select("id,nome,endereco,numero,bairro,cidade,uf,cep").single();

  if (error?.code === "23505") return Response.json({ error: "Este condomínio já está cadastrado. Atualize a lista e use a referência existente.", erro: "duplicado" }, { status: 409 });
  if (error) return falhaCondominio(error, "cadastrar_condominio");
  if (!data) return falhaCondominio(null, "confirmar_cadastro");
  return Response.json({ ok: true, condominium: data }, { status: 201 });
}
