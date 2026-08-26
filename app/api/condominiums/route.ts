import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

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
  if (authError || !authData.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

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
  if (duplicateError) return Response.json({ error: duplicateError.message }, { status: 502 });
  if (duplicate) {
    return Response.json({ error: "Este condomínio já está cadastrado. Use a referência existente ao cadastrar a unidade.", condominium: duplicate }, { status: 409 });
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

  if (error) {
    const forbidden = error.code === "42501";
    return Response.json({ error: forbidden ? "Seu perfil não tem permissão para cadastrar condomínios." : error.message }, { status: forbidden ? 403 : 502 });
  }
  return Response.json({ ok: true, condominium: data }, { status: 201 });
}
