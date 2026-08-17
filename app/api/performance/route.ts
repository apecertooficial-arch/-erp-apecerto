import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

type Periodo = "todo" | "7d" | "mes" | "trimestre" | "ano";

async function authClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return supabase;
}

const isoData = (data: Date) => data.toISOString().slice(0, 10);

function janela(periodo: Periodo) {
  const hojeSp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [ano, mes, dia] = hojeSp.split("-").map(Number);
  const hoje = new Date(Date.UTC(ano, mes - 1, dia));
  const fim = new Date(hoje);
  fim.setUTCDate(fim.getUTCDate() + 1);
  if (periodo === "todo") return { inicio: "2000-01-01", fim: isoData(fim) };
  if (periodo === "7d") {
    const inicio = new Date(hoje); inicio.setUTCDate(inicio.getUTCDate() - 6);
    return { inicio: isoData(inicio), fim: isoData(fim) };
  }
  if (periodo === "trimestre") {
    const inicio = new Date(Date.UTC(ano, Math.floor((mes - 1) / 3) * 3, 1));
    return { inicio: isoData(inicio), fim: isoData(fim) };
  }
  if (periodo === "ano") {
    const inicio = new Date(Date.UTC(ano, 0, 1));
    return { inicio: isoData(inicio), fim: isoData(fim) };
  }
  return { inicio: isoData(new Date(Date.UTC(ano, mes - 1, 1))), fim: isoData(fim) };
}

export async function GET(request: Request) {
  const supabase = await authClient(request);
  if (!supabase) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const pedido = new URL(request.url).searchParams.get("periodo");
  const periodo: Periodo = pedido === "todo" || pedido === "7d" || pedido === "trimestre" || pedido === "ano" ? pedido : "mes";
  const { inicio, fim } = janela(periodo);
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc("performance_sala_comando", { p_inicio: inicio, p_fim: fim });
  if (error) {
    /* A mensagem do Postgres NÃO vai para a tela: o painel do gestor no celular
       mostra o texto do campo `error` direto, e nome de relação que falhou não é
       assunto de quem está vendendo apartamento. O técnico fica no log. */
    console.error("performance_sala_comando falhou:", error.message);
    return Response.json({ error: "Não foi possível carregar os números agora." }, { status: 502 });
  }
  return Response.json(data ?? { periodo: { inicio, fim }, empresa: null, corretores: [], origens: [] });
}
