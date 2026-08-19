/* Endpoint da Inteligência — um resumo agregado por tela, com escopo por papel.
 *
 * GET /api/inteligencia/:tela?periodo=30%20dias&dias=30&consent=&device=
 *
 * Regras (contrato Fase 1):
 *  · autentica a sessão do ERP no servidor (getUser);
 *  · aplica escopo por papel ANTES de consultar (Site = admin/gestor/marketing; Performance = admin/gestor);
 *  · chama a RPC com o TOKEN DO USUÁRIO (is_equipe() no banco é a 2ª trava; sem service_role no ERP);
 *  · valida/limita filtros e período;
 *  · devolve { data, meta } — meta traz período, fontes[], cobertura e avisos;
 *  · fonte ausente vira meta.fontes[].status = 'ausente' + motivo (a tela mostra —, nunca zero).
 */

import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { resolveEffectiveAccess } from "../../../lib/supabase/authz";
import {
  diasDoPeriodo, podeVerFamiliaSite, podeVerPerformance,
  TELAS_FAMILIA_PERFORMANCE, TELAS_FAMILIA_SITE,
} from "../../../lib/inteligencia/acesso";
import type { FonteMeta, MetaInteligencia } from "../../../lib/inteligencia/tipos";

export const dynamic = "force-dynamic";

const TELAS_SUPORTADAS = new Set(["privacidade", "digital", "empresa", "atendimento", "financeiro"]);
const CONSENT_VALIDOS = new Set(["essential", "analytics", "marketing"]);
const DEVICE_VALIDOS = new Set(["desktop", "mobile", "tablet"]);

type RpcResult = { data: unknown; error: { message: string } | null };

/* As RPCs intel_* são novas e ainda não estão no database.types gerado; chamamos
   por um wrapper com tipo estreito para não afrouxar o cliente inteiro. */
async function chamarRpc(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  fn: string,
  args: Record<string, unknown>,
): Promise<RpcResult> {
  const cliente = supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<RpcResult> };
  return cliente.rpc(fn, args);
}

function periodo(dias: number, rotulo: string): MetaInteligencia["periodo"] {
  const fim = new Date();
  const inicio = new Date(fim.getTime() - dias * 86_400_000);
  return { rotulo, dias, inicio: inicio.toISOString(), fim: fim.toISOString() };
}

function montarMeta(tela: string, dias: number, rotulo: string, fontes: FonteMeta[], cobertura: number | null, parcial: boolean, avisos: string[] = []): MetaInteligencia {
  return {
    tela,
    periodo: periodo(dias, rotulo),
    atualizadoEm: new Date().toISOString(),
    fontes,
    cobertura: cobertura === null ? null : `UTMs ${String(cobertura).replace(".", ",")}%`,
    avisos,
    parcial,
  };
}

function ok(data: unknown, meta: MetaInteligencia) {
  return Response.json({ data, meta }, { headers: { "cache-control": "private, max-age=60" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tela = url.pathname.split("/").filter(Boolean).pop() ?? "";

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  if (!TELAS_SUPORTADAS.has(tela)) return Response.json({ error: `Tela '${tela}' ainda não conectada ao dado real.` }, { status: 404 });

  const supabase = createServerSupabaseClient(token);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  // Escopo por papel ANTES de consultar.
  const acesso = await resolveEffectiveAccess(supabase, authData.user.id);
  if (!acesso.role) return Response.json({ error: "Perfil não encontrado." }, { status: 403 });
  if (TELAS_FAMILIA_SITE.has(tela) && !podeVerFamiliaSite(acesso.role, acesso.permissions)) {
    return Response.json({ error: "Sem permissão para a família Site e marketing." }, { status: 403 });
  }
  if (TELAS_FAMILIA_PERFORMANCE.has(tela) && !podeVerPerformance(acesso.role)) {
    return Response.json({ error: "Sem permissão para a família Performance." }, { status: 403 });
  }

  // Período e filtros validados/limitados.
  const rotulo = url.searchParams.get("periodo") ?? "30 dias";
  const diasParam = Number(url.searchParams.get("dias"));
  const dias = Number.isFinite(diasParam) && diasParam > 0 ? Math.min(Math.trunc(diasParam), 365) : diasDoPeriodo(rotulo);
  const consentBruto = url.searchParams.get("consent");
  const deviceBruto = url.searchParams.get("device");
  const consent = consentBruto && CONSENT_VALIDOS.has(consentBruto) ? consentBruto : null;
  const device = deviceBruto && DEVICE_VALIDOS.has(deviceBruto) ? deviceBruto : null;

  try {
    if (tela === "privacidade") {
      const { data, error } = await chamarRpc(supabase, "intel_privacidade", { p_days: dias, p_consent: consent, p_device: device });
      if (error) throw new Error(error.message);
      const cobertura = (data as { cobertura_utm?: number | null } | null)?.cobertura_utm ?? null;
      const meta = montarMeta(tela, dias, rotulo, [
        { nome: "Coleta própria (site-track)", status: "ok" },
        { nome: "Google Tag", status: "ausente", motivo: "integração não conectada à Inteligência" },
        { nome: "Microsoft Clarity", status: "ausente", motivo: "integração não conectada à Inteligência" },
        { nome: "Sincronização CRM", status: "ausente", motivo: "integração não conectada à Inteligência" },
      ], cobertura, false);
      return ok(data, meta);
    }

    if (tela === "empresa") {
      const { data, error } = await chamarRpc(supabase, "intel_visao_ceo", { p_days: dias });
      if (error) throw new Error(error.message);
      const meta = montarMeta(tela, dias, rotulo, [
        { nome: "leads / negócios (Funil 2.0)", status: "ok" },
        { nome: "vendas / comissões / metas", status: "ok" },
        { nome: "SLA (wa_mensagens)", status: "parcial", motivo: "backlog recente; % dentro do SLA ainda não definido" },
        { nome: "valor de pipeline", status: "ausente", motivo: "campo de valor ausente no Funil 2.0" },
        { nome: "previsão ponderada", status: "ausente", motivo: "sem probabilidade por etapa" },
      ], null, true, [
        "Escopo do funil: Funil 2.0 (operação). % no SLA, previsão ponderada e valor de pipeline seguem como —.",
      ]);
      return ok(data, meta);
    }

    if (tela === "atendimento") {
      const { data, error } = await chamarRpc(supabase, "intel_atendimento", { p_days: dias });
      if (error) throw new Error(error.message);
      const meta = montarMeta(tela, dias, rotulo, [
        { nome: "wa_mensagens (fila e espera)", status: "ok" },
        { nome: "leads / negócios", status: "ok" },
        { nome: "% dentro do SLA de 5 min", status: "ausente", motivo: "sem marco de 1º contato; usamos o tempo de espera do backlog" },
        { nome: "escala / ponto", status: "ausente", motivo: "não integrado" },
      ], null, true, ["Fila viva. % no SLA e taxa de resposta seguem como —."]);
      return ok(data, meta);
    }

    if (tela === "financeiro") {
      const { data, error } = await chamarRpc(supabase, "intel_financeiro", { p_days: dias });
      if (error) throw new Error(error.message);
      const meta = montarMeta(tela, dias, rotulo, [
        { nome: "vendas / comissões / pagamentos", status: "ok" },
        { nome: "custos diretos", status: "parcial", motivo: "lançados por venda, quando existem" },
        { nome: "impostos e despesas fixas", status: "ausente", motivo: "não integrados — sem lucro líquido" },
      ], null, true, ["Contribuição estimada não é lucro líquido."]);
      return ok(data, meta);
    }

    // digital — parcial: só a parte de telemetria de site.
    const { data, error } = await chamarRpc(supabase, "intel_visao_digital", { p_days: dias });
    if (error) throw new Error(error.message);
    const cobertura = (data as { cobertura_utm?: number | null } | null)?.cobertura_utm ?? null;
    const meta = montarMeta(tela, dias, rotulo, [
      { nome: "Coleta própria (site-track)", status: "ok" },
      { nome: "GA4", status: "ausente", motivo: "GA4_PROPERTY_ID/serviço não confirmados" },
      { nome: "CRM Funil 2.0", status: "ausente", motivo: "negócio/venda ainda não ligados à Inteligência" },
    ], cobertura, true, ["KPIs de CRM (leads, negócios, visitas, pipeline, comissões, Sara) ficam como — até a fonte ser conectada."]);
    return ok(data, meta);
  } catch (e) {
    const meta = montarMeta(tela, dias, rotulo, [{ nome: "fonte", status: "ausente", motivo: e instanceof Error ? e.message : "fonte não respondeu" }], null, true, ["Fonte não respondeu — a tela mantém o layout e mostra — nos valores."]);
    return Response.json({ data: null, meta }, { status: 502 });
  }
}
