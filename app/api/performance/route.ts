import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

type Periodo = "7d" | "mes" | "trimestre" | "ano";

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
  const periodo: Periodo = pedido === "7d" || pedido === "trimestre" || pedido === "ano" ? pedido : "mes";
  const { inicio, fim } = janela(periodo);
  const rpc = auth.supabase.rpc.bind(auth.supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;

  const { data, error } = await rpc("performance_painel", { p_inicio: inicio, p_fim: fim });
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json(data ?? { periodo: { inicio, fim }, corretores: [] });
}
