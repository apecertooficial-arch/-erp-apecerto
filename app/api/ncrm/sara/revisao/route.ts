/**
 * Sara — FILA DE REVISÃO + PLACAR (Fase 1 do item 1).
 *
 * GET -> { ok, itens[], placar } com o JWT real do usuário. Admin apenas: as
 * duas RPCs checam can_manage_all() DENTRO do banco. Nada de service_role aqui.
 *
 * Por que uma rota nova em vez de reusar /api/ncrm/sara/analise:
 *   `ncrm_sara_analises_recentes` devolve o log cru — repete o mesmo negócio
 *   várias vezes, não traz o nome do lead nem a etapa REAL de agora, e não diz
 *   se a transição sugerida é permitida. Serve para auditoria, não para revisar.
 *
 * Esta rota é LEITURA. A decisão vive em /api/ncrm/sara/decidir.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

function tokenDe(request: Request): string | null {
  const a = request.headers.get("authorization");
  return a?.startsWith("Bearer ") ? a.slice(7) : null;
}

export async function GET(request: Request) {
  const token = tokenDe(request);
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });

  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  const db = supabase as unknown as SupabaseClient;
  const params = new URL(request.url).searchParams;
  const limite = Math.min(200, Math.max(1, Number(params.get("limit") ?? "50") || 50));

  const [fila, placar] = await Promise.all([
    db.rpc("ncrm_sara_revisao_fila", { p_limite: limite }),
    db.rpc("ncrm_sara_placar", { p_amostra_minima: 50, p_taxa_minima: 0.85 }),
  ]);

  if (fila.error) return Response.json({ ok: false, error: "Falha ao carregar a fila de revisão." }, { status: 502 });

  const rf = (fila.data ?? {}) as { ok?: boolean; erro?: string; itens?: unknown[] };
  if (rf.ok === false) {
    return Response.json({ ok: false, erro: rf.erro }, { status: rf.erro === "sem_permissao" ? 403 : 409 });
  }

  /* O placar é acessório: se falhar, a fila ainda serve para revisar. */
  const rp = (placar.error ? {} : (placar.data ?? {})) as { ok?: boolean };

  return Response.json({
    ok: true,
    itens: rf.itens ?? [],
    placar: rp.ok === true ? rp : null,
  });
}
