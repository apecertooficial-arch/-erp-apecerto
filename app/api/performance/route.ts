import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

type Periodo = "todo" | "7d" | "mes" | "trimestre" | "ano";

async function authClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase, user: data.user };
}

function isoData(data: Date) {
  return data.toISOString().slice(0, 10);
}

function janela(periodo: Periodo): { inicio: string; fim: string } {
  const hojeSp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [ano, mes, dia] = hojeSp.split("-").map(Number);
  const hoje = new Date(Date.UTC(ano, mes - 1, dia));
  const amanha = new Date(hoje);
  amanha.setUTCDate(amanha.getUTCDate() + 1);

  if (periodo === "todo") {
    // A RPC ajusta esta sentinela para o primeiro fato real encontrado no ERP.
    return { inicio: "2000-01-01", fim: isoData(amanha) };
  }

  if (periodo === "7d") {
    const inicio = new Date(hoje);
    inicio.setUTCDate(inicio.getUTCDate() - 6);
    return { inicio: isoData(inicio), fim: isoData(amanha) };
  }
  if (periodo === "ano") {
    return { inicio: `${ano}-01-01`, fim: `${ano + 1}-01-01` };
  }
  if (periodo === "trimestre") {
    const inicioMes = Math.floor((mes - 1) / 3) * 3;
    return {
      inicio: isoData(new Date(Date.UTC(ano, inicioMes, 1))),
      fim: isoData(new Date(Date.UTC(ano, inicioMes + 3, 1))),
    };
  }
  return {
    inicio: isoData(new Date(Date.UTC(ano, mes - 1, 1))),
    fim: isoData(new Date(Date.UTC(ano, mes, 1))),
  };
}

export async function GET(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const pedido = new URL(request.url).searchParams.get("periodo");
  const periodo: Periodo = pedido === "7d" || pedido === "mes" || pedido === "trimestre" || pedido === "ano" ? pedido : "todo";
  const { inicio, fim } = janela(periodo);
  const rpc = auth.supabase.rpc.bind(auth.supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;

  const [painel, resumo, bolsao] = await Promise.all([
    rpc("performance_painel", { p_inicio: inicio, p_fim: fim }),
    rpc("performance_resumo_empresa", { p_inicio: inicio, p_fim: fim }),
    rpc("performance_bolsao_ajustes", { p_inicio: inicio, p_fim: fim }),
  ]);
  if (painel.error) return Response.json({ error: painel.error.message }, { status: 502 });
  if (resumo.error) return Response.json({ error: resumo.error.message }, { status: 502 });
  if (bolsao.error) return Response.json({ error: bolsao.error.message }, { status: 502 });

  const base = (painel.data ?? { periodo: { inicio, fim }, corretores: [] }) as Record<string, unknown>;
  const corporativo = resumo.data as { equipe?: Record<string, unknown>; cobertura?: Array<Record<string, unknown>> } | null;
  const elegibilidade = bolsao.data as {
    equipe?: Record<string, unknown> | null;
    corretores?: Array<Record<string, unknown>>;
  } | null;
  const porCorretor = new Map((elegibilidade?.corretores ?? []).map((item) => [Number(item.corretorId), item]));
  const pesos = { carteira: 25, sla: 20, trabalho: 20, visitas: 15, qualidade: 10, atividade: 10 } as const;
  const corretores = ((base.corretores ?? []) as Array<Record<string, unknown>>).map((item) => {
    const ajuste = porCorretor.get(Number(item.corretorId));
    if (!ajuste) return item;
    const ativa = Number(ajuste.carteiraAtiva) || 0;
    const vencidas = Number(ajuste.acoesVencidas) || 0;
    const emDiaPct = ativa > 0 ? Math.round((1000 * (ativa - vencidas)) / ativa) / 10 : null;
    const notaCarteira = emDiaPct === null ? null : Math.min(100, Math.round((emDiaPct / 85) * 100));
    const pilares: Record<string, unknown> = {
      ...(item.pilares as Record<string, unknown>),
      carteira: notaCarteira,
    };
    let somaPesos = 0;
    let somaNotas = 0;
    for (const [nome, peso] of Object.entries(pesos)) {
      const valor = pilares[nome];
      if (valor !== null && valor !== undefined) {
        somaPesos += peso;
        somaNotas += (Number(valor) || 0) * peso;
      }
    }
    return {
      ...item,
      notaExecucao: somaPesos ? Math.round(somaNotas / somaPesos) : null,
      coberturaNotaPct: somaPesos,
      pilares,
      carteira: {
        ...(item.carteira as Record<string, unknown>), ativa, acoesVencidas: vencidas,
        vencem2h: ajuste.vencem2h, saraCobertos: ajuste.saraCobertos,
        descartes: ajuste.descartes, emDiaPct,
      },
      processo: {
        ...(item.processo as Record<string, unknown>),
        leadsCriados: ajuste.leadsCriados, negociosCriados: ajuste.negociosCriados,
        avaliacoesLead: ajuste.avaliacoesLead, notaMediaLead: ajuste.notaMediaLead,
        entidadesAvaliadas: ajuste.entidadesAvaliadas,
        f2AcoesConfirmadas: ajuste.f2AcoesConfirmadas,
        f2MomentosAlterados: ajuste.f2MomentosAlterados,
        f2SaraReavaliacoes: ajuste.f2SaraReavaliacoes,
        f2LeadsMovimentados: ajuste.f2LeadsMovimentados,
      },
    };
  });
  const fontes = (base.fontes ?? {}) as Record<string, unknown>;
  const equipeBolsao = elegibilidade?.equipe ?? {};
  const equipe = corporativo?.equipe ? {
    ...corporativo.equipe,
    ...equipeBolsao,
    leadsCadastrados: equipeBolsao.leadsOperacionais ?? corporativo.equipe.leadsCadastrados,
    negociosCadastrados: equipeBolsao.negociosOperacionais ?? corporativo.equipe.negociosCadastrados,
  } : null;
  const cobertura = [...(corporativo?.cobertura ?? (fontes.cobertura as Array<Record<string, unknown>> | undefined) ?? [])];
  if (equipeBolsao.leadsBolsao) cobertura.push({
    fonte: "Bolsão/Aquário · fora da performance",
    registros: equipeBolsao.leadsBolsao,
    atribuidos: 0,
    semAtribuicao: 0,
    excluidosPerformance: equipeBolsao.leadsBolsao,
    primeiroRegistro: null,
    ultimoRegistro: null,
  });
  return Response.json({
    ...base,
    corretores,
    equipe,
    fontes: { ...fontes, cobertura },
  });
}
