/* Endpoint da Inteligência — um resumo agregado por tela, com escopo por papel.
 *
 * GET /api/inteligencia/:tela?periodo=30%20dias&dias=30&consent=&device=
 */

import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { resolveEffectiveAccess } from "../../../lib/supabase/authz";
import {
  diasDoPeriodo, podeVerFamiliaSite, podeVerPerformance,
  TELAS_FAMILIA_PERFORMANCE, TELAS_FAMILIA_SITE,
} from "../../../lib/inteligencia/acesso";
import type { FonteMeta, MetaInteligencia } from "../../../lib/inteligencia/tipos";

export const dynamic = "force-dynamic";

const TELAS_SUPORTADAS = new Set(["privacidade", "digital", "empresa", "atendimento", "financeiro", "corretores", "equipe", "gerentes", "vendas", "qualidade", "alertas", "aquisicao", "comportamento", "imoveis", "conversao", "proprietarios", "sara"]);
const CONSENT_VALIDOS = new Set(["essential", "analytics", "marketing"]);
const DEVICE_VALIDOS = new Set(["desktop", "mobile", "tablet"]);

type RpcResult = { data: unknown; error: { message: string } | null };

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

  const acesso = await resolveEffectiveAccess(supabase, authData.user.id);
  if (!acesso.role) return Response.json({ error: "Perfil não encontrado." }, { status: 403 });
  if (TELAS_FAMILIA_SITE.has(tela) && !podeVerFamiliaSite(acesso.role, acesso.permissions)) {
    return Response.json({ error: "Sem permissão para a família Site e marketing." }, { status: 403 });
  }
  if (TELAS_FAMILIA_PERFORMANCE.has(tela) && !podeVerPerformance(acesso.role)) {
    return Response.json({ error: "Sem permissão para a família Performance." }, { status: 403 });
  }

  const rotulo = url.searchParams.get("periodo") ?? "30 dias";
  const diasParam = Number(url.searchParams.get("dias"));
  const dias = Number.isFinite(diasParam) && diasParam > 0 ? Math.min(Math.trunc(diasParam), 365) : diasDoPeriodo(rotulo);
  const consentBruto = url.searchParams.get("consent");
  const deviceBruto = url.searchParams.get("device");
  const consent = consentBruto && CONSENT_VALIDOS.has(consentBruto) ? consentBruto : null;
  const device = deviceBruto && DEVICE_VALIDOS.has(deviceBruto) ? deviceBruto : null;

  const site: Record<string, string> = {
    aquisicao: "intel_aquisicao", comportamento: "intel_comportamento", imoveis: "intel_imoveis",
    conversao: "intel_conversao", proprietarios: "intel_proprietarios", sara: "intel_sara",
  };
  const performance: Record<string, string> = {
    empresa: "intel_visao_ceo", atendimento: "intel_atendimento", financeiro: "intel_financeiro",
    corretores: "intel_corretores", equipe: "intel_equipe", gerentes: "intel_gerentes",
    vendas: "intel_vendas", qualidade: "intel_qualidade", alertas: "intel_alertas",
  };

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

    if (tela === "digital") {
      const { data, error } = await chamarRpc(supabase, "intel_visao_digital", { p_days: dias });
      if (error) throw new Error(error.message);
      const cobertura = (data as { cobertura_utm?: number | null } | null)?.cobertura_utm ?? null;
      const meta = montarMeta(tela, dias, rotulo, [
        { nome: "Coleta própria (site-track)", status: "ok" },
        { nome: "GA4", status: "ausente", motivo: "GA4_PROPERTY_ID/serviço não confirmados" },
        { nome: "CRM Funil 2.0", status: "ausente", motivo: "negócio/venda ainda não ligados à Inteligência" },
      ], cobertura, true, ["KPIs de CRM (leads, negócios, visitas, pipeline, comissões, Sara) ficam como — até a fonte ser conectada."]);
      return ok(data, meta);
    }

    const siteFn = site[tela];
    if (siteFn) {
      const { data, error } = await chamarRpc(supabase, siteFn, { p_days: dias });
      if (error) throw new Error(error.message);
      const meta = montarMeta(tela, dias, rotulo, [{ nome: "coleta própria (site) + CRM", status: "ok" }], null, true,
        ["Dado real de site/CRM; custo de mídia, GA4 e atribuição seguem —."]);
      return ok(data, meta);
    }

    const fn = performance[tela];
    if (fn) {
      const { data, error } = await chamarRpc(supabase, fn, { p_days: dias });
      if (error) throw new Error(error.message);
      const meta = montarMeta(tela, dias, rotulo, [{ nome: "CRM (Funil 2.0 / vendas / avaliações)", status: "ok" }], null, true,
        ["Dado real do CRM; itens sem fonte no banco seguem — com motivo no rodapé da tela."]);
      return ok(data, meta);
    }

    return Response.json({ error: `Tela '${tela}' ainda não conectada ao dado real.` }, { status: 404 });
  } catch (e) {
    const meta = montarMeta(tela, dias, rotulo, [{ nome: "fonte", status: "ausente", motivo: e instanceof Error ? e.message : "fonte não respondeu" }], null, true, ["Fonte não respondeu — a tela mantém o layout e mostra — nos valores."]);
    return Response.json({ data: null, meta }, { status: 502 });
  }
}
