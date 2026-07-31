// enviar-whatsapp — envio de texto por uma instancia.
//
// v5 (IDOR): ate a v4 esta funcao recebia instancia_id no body e enviava por ela,
// sem verificar nada. verify_jwt=true garantia apenas que havia UM usuario logado,
// nao que aquele usuario tivesse direito aquela instancia: qualquer corretor podia
// enviar pela instancia de qualquer outro, e bastava iterar ids para descobri-las.
//
// Agora a instancia e resolvida no servidor a partir de quem o usuario realmente e
// (ncrm_resolver_envio_autorizado). O instancia_id do body virou apenas um pedido:
// corretor usa a propria; admin, diretor e gerente respondem pela operacao.
// A autoridade do piloto (ncrm_pode_enviar_pelo_erp) e consultada em seguida.
//
// Sem callers conhecidos no repositorio. Mantida por precaucao, mas fechada.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  try {
    // Quem esta falando? verify_jwt garante um JWT valido; aqui exigimos que ele
    // represente uma PESSOA. A anon key nao tem usuario e nao passa.
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!jwt) return Response.json({ erro: "nao_autorizado" }, { status: 401 });

    const { data: u, error: eU } = await supa.auth.getUser(jwt);
    if (eU || !u?.user?.id) return Response.json({ erro: "nao_autorizado" }, { status: 401 });

    const { instancia_id, to, text } = await req.json();
    if (!to || !text) return Response.json({ erro: "faltam to ou text" }, { status: 400 });

    // O servidor decide a instancia. O pedido do body e so um pedido.
    const { data: aut } = await supa.rpc("ncrm_resolver_envio_autorizado", {
      p_user_id: u.user.id,
      p_telefone: String(to),
      p_instancia_id: instancia_id ? Number(instancia_id) : null,
    });
    const a: any = aut ?? {};
    if (a.decisao !== "permitir") {
      return Response.json({ erro: "sem_permissao", motivo: a.motivo ?? null }, { status: 403 });
    }

    // Abordagem humana: o ERP nao envia por corretor do piloto.
    const { data: dec } = await supa.rpc("ncrm_pode_enviar_pelo_erp", {
      p_corretor_id: a.corretor_id ?? null,
      p_negocio_id: null,
      p_lead_id: null,
      p_telefone: String(to),
    });
    if ((dec as any)?.decisao && (dec as any).decisao !== "permitir") {
      return Response.json({ erro: "envio_bloqueado", motivo: (dec as any).motivo ?? null }, { status: 409 });
    }

    const instAutorizada = a.instancia_id;
    if (!instAutorizada) return Response.json({ erro: "instancia_nao_resolvida" }, { status: 422 });

    const { data: inst } = await supa
      .from("instancias").select("instancia_dapi").eq("id", instAutorizada).single();
    if (!inst) return Response.json({ erro: "instância não encontrada" }, { status: 404 });

    const { data: cred } = await supa
      .from("instancias_credenciais").select("apikey").eq("instancia_id", instAutorizada).single();
    if (!cred) return Response.json({ erro: "chave não cadastrada" }, { status: 404 });

    const r = await fetch("https://api.d-api.cloud/api/v1/messages/send/text", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": cred.apikey },
      body: JSON.stringify({ sessionId: inst.instancia_dapi, to, text }),
    });
    const resultado = await r.json().catch(() => ({}));
    return Response.json({ status: r.status, resultado }, { status: r.ok ? 200 : r.status });
  } catch (err) {
    return Response.json({ erro: String(err) }, { status: 500 });
  }
});
