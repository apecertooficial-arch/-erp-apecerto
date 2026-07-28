/**
 * API do CRM Nova Era — LEITURA (ncrm_estado/evento/proposta) e AÇÕES via RPCs ncrm_*.
 * ---------------------------------------------------------------------------
 * Segurança:
 *  - Sempre com o JWT do usuário (createServerSupabaseClient(token)) => RLS decide o que ele vê.
 *  - Escrita SOMENTE por RPC ncrm_* (nunca UPDATE/INSERT direto nas tabelas ncrm_*).
 *  - service_role NUNCA é usado aqui (as RPCs de automação são service_role-only e ficam fora).
 *  - A autorização real (corretor/gestor/admin) é reforçada no banco (pode_operar_negocio, fail-closed).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

function tokenDe(request: Request): string | null {
  const a = request.headers.get("authorization");
  return a?.startsWith("Bearer ") ? a.slice(7) : null;
}

/** Nota: as tabelas ncrm_* ainda não constam em database.types.ts. As chamadas ncrm usam um
 * cliente reinterpretado como SupabaseClient (sem tipos): a segurança é do banco (RLS + RPC fail-closed). */

const EMBED =
  "negocio_id,etapa,respondeu,resposta_pendente,aguardando_automacao,tentativas_feitas," +
  "proxima_acao_tipo,proxima_acao_titulo,proxima_acao_em,ultima_interacao_em,temperatura," +
  "saida,saida_em,visita_id,proposta_id,descarte_motivo,descarte_detalhe,versao,atualizado_em," +
  "msg_automatica_em,primeira_resposta_em," +
  "negocios(id,status,lead_id,corretor_id,leads(nome,telefone,email),corretores(id,nome))";

export async function GET(request: Request) {
  const token = tokenDe(request);
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const db = supabase as unknown as SupabaseClient;

  const url = new URL(request.url);
  const negocio = url.searchParams.get("negocio");

  // ---- Detalhe de um lead (estado + eventos + propostas) ----
  if (negocio) {
    const nid = Number(negocio);
    if (!Number.isFinite(nid)) return Response.json({ error: "negocio inválido" }, { status: 400 });
    const [{ data: estado, error: e1 }, { data: eventos, error: e2 }, { data: propostas, error: e3 }] =
      await Promise.all([
        db.from("ncrm_estado").select(EMBED).eq("negocio_id", nid).maybeSingle(),
        db
          .from("ncrm_evento")
          .select("id,tipo,numero_tentativa,canal,resultado,payload,origem,criado_em,estado_versao_apos")
          .eq("negocio_id", nid)
          .order("id", { ascending: true })
          .limit(500),
        db
          .from("ncrm_proposta")
          .select("id,status,valor,data_proposta,motivo_encerramento,criada_em,encerrada_em,versao")
          .eq("negocio_id", nid)
          .order("criada_em", { ascending: false }),
      ]);
    if (e1 || e2 || e3) return Response.json({ error: e1?.message || e2?.message || e3?.message }, { status: 502 });
    if (!estado) return Response.json({ error: "Lead não visível ou inexistente." }, { status: 404 });
    return Response.json({ estado, eventos: eventos ?? [], propostas: propostas ?? [] });
  }

  // ---- Quadro / saídas / tudo (paginado) ----
  const scope = url.searchParams.get("scope") ?? "board"; // board | saidas | all
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "60"), 1), 200);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? "0"), 0);

  let q = db.from("ncrm_estado").select(EMBED, { count: "exact" });
  if (scope === "board") q = q.is("saida", null);
  else if (scope === "saidas") q = q.not("saida", "is", null);
  q = q
    .order("proxima_acao_em", { ascending: true, nullsFirst: false })
    .order("negocio_id", { ascending: true })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await q;
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json({
    itens: data ?? [],
    total: count ?? (data?.length ?? 0),
    offset,
    limit,
    temMais: (count ?? 0) > offset + (data?.length ?? 0),
  });
}

/** Mapa ação -> (nome da RPC, construtor de args a partir do body). RPC-only. */
type Ctx = { negocio_id: number; versao: number; idem: string; b: Record<string, unknown> };
const ACOES: Record<string, { rpc: string; args: (c: Ctx) => Record<string, unknown> }> = {
  registrarTentativa: {
    rpc: "ncrm_registrar_tentativa",
    args: ({ negocio_id, versao, idem, b }) => ({
      p_negocio_id: negocio_id,
      p_versao: versao,
      p_canal: b.canal,
      p_resultado: b.resultado,
      p_obs: b.obs ?? null,
      // Sem resposta: o banco IGNORA estes campos e calcula pela cadência. Com resposta: exige ação comercial.
      p_proxima_tipo: b.proximaTipo ?? null,
      p_proxima_titulo: b.proximaTitulo ?? null,
      p_proxima_em: b.proximaEm ?? null,
      p_idem: idem,
    }),
  },
  concluirAcao: {
    rpc: "ncrm_concluir_acao",
    args: ({ negocio_id, versao, idem, b }) => ({
      p_negocio_id: negocio_id, p_versao: versao, p_resultado: b.resultado, p_obs: b.obs ?? null,
      p_proxima_tipo: b.proximaTipo, p_proxima_titulo: b.proximaTitulo, p_proxima_em: b.proximaEm, p_idem: idem,
    }),
  },
  saidaVisita: {
    rpc: "ncrm_saida_visita",
    args: ({ negocio_id, versao, idem, b }) => ({ p_negocio_id: negocio_id, p_versao: versao, p_visita_id: b.visitaId, p_idem: idem }),
  },
  saidaProposta: {
    rpc: "ncrm_saida_proposta",
    args: ({ negocio_id, versao, idem, b }) => ({
      p_negocio_id: negocio_id, p_versao: versao, p_empreendimento_id: b.empreendimentoId ?? null,
      p_unidade_id: b.unidadeId ?? null, p_valor: b.valor, p_data: b.data ?? new Date().toISOString(),
      p_obs: b.obs ?? null, p_idem: idem,
    }),
  },
  propostaTransicao: {
    rpc: "ncrm_proposta_transicao",
    args: ({ idem, b }) => ({ p_proposta_id: b.propostaId, p_versao_prop: b.versaoProp, p_novo_status: b.novoStatus, p_motivo: b.motivo ?? null, p_idem: idem }),
  },
  saidaDescarte: {
    rpc: "ncrm_saida_descarte",
    args: ({ negocio_id, versao, idem, b }) => ({ p_negocio_id: negocio_id, p_versao: versao, p_motivo: b.motivo, p_detalhe: b.detalhe ?? null, p_idem: idem }),
  },
  saidaNutricao: {
    rpc: "ncrm_saida_nutricao",
    args: ({ negocio_id, versao, idem, b }) => ({ p_negocio_id: negocio_id, p_versao: versao, p_motivo: b.motivo ?? null, p_idem: idem }),
  },
  reativar: {
    rpc: "ncrm_reativar",
    args: ({ negocio_id, versao, idem, b }) => ({
      p_negocio_id: negocio_id, p_versao: versao, p_motivo: b.motivo, p_etapa: b.etapa,
      p_proxima_tipo: b.proximaTipo, p_proxima_titulo: b.proximaTitulo, p_proxima_em: b.proximaEm, p_idem: idem,
    }),
  },
  reativarAposProposta: {
    rpc: "ncrm_reativar_apos_proposta",
    args: ({ negocio_id, versao, idem, b }) => ({
      p_negocio_id: negocio_id, p_versao: versao, p_motivo: b.motivo, p_etapa: b.etapa,
      p_proxima_tipo: b.proximaTipo, p_proxima_titulo: b.proximaTitulo, p_proxima_em: b.proximaEm, p_idem: idem,
    }),
  },
};

const ERRO_HUMANO: Record<string, string> = {
  sem_permissao: "Você não tem permissão para operar este lead.",
  versao_conflito: "O lead mudou enquanto você agia. Recarregue e tente de novo.",
  estado_em_saida: "Este lead já saiu do quadro (visita/proposta/descarte).",
  cadencia_encerrada: "O cliente já respondeu — a prospecção foi encerrada.",
  cadencia_esgotada: "Cadência esgotada. Avalie descarte ou nutrição.",
  proxima_acao_obrigatoria: "Defina a próxima ação comercial.",
  proxima_acao_fora_do_fluxo: "A próxima ação não pertence ao fluxo permitido.",
  proxima_acao_em_no_passado: "O prazo da próxima ação não pode estar no passado.",
  visita_invalida: "Visita inválida ou não pertence a este lead.",
  ja_em_saida: "O lead já está em uma saída.",
  lead_nao_respondeu: "Conclua a ação apenas após o cliente responder.",
  nao_autenticado: "Sessão inválida. Faça login novamente.",
  idempotency_key_obrigatoria: "Falha técnica de idempotência. Tente novamente.",
};

export async function PATCH(request: Request) {
  const token = tokenDe(request);
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const db = supabase as unknown as SupabaseClient;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }
  const action = String(body.action ?? "");
  const def = ACOES[action];
  if (!def) return Response.json({ error: "Ação desconhecida." }, { status: 400 });

  const negocio_id = Number(body.negocioId);
  const versao = Number(body.versao);
  // idempotência determinística por (ação, negócio, cliente) — o cliente pode enviar a sua própria.
  const idem = String(body.idem ?? `ui:${action}:${negocio_id}:${crypto.randomUUID()}`);

  const args = def.args({ negocio_id, versao, idem, b: body });
  const { data, error } = await db.rpc(def.rpc, args);
  if (error) return Response.json({ error: error.message }, { status: 502 });

  const res = (data ?? {}) as { ok?: boolean; erro?: string };
  if (res.ok === false) {
    return Response.json(
      { ok: false, erro: res.erro, mensagem: (res.erro && ERRO_HUMANO[res.erro]) || "Ação não permitida." },
      { status: 409 },
    );
  }
  return Response.json({ ok: true, resultado: data });
}
