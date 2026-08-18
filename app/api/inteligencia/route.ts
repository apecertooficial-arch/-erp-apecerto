import { createServerSupabaseClient } from "../../lib/supabase/server";

/* INTELIGÊNCIA — endpoint agregador da área.
 *
 * Um endpoint só, autenticado, para as leituras da área Inteligência. Ele NÃO
 * cria relação nem função no banco: consome o que já existe hoje. Cada bloco é
 * lido de forma independente e, quando a fonte não responde, o bloco volta como
 * null com uma pendência declarada — nunca zero, nunca número estimado. As telas
 * já estão desenhadas para esse estado ("aguardando dado").
 *
 * Escopo e permissão: a RPC performance_sala_comando já resolve o escopo por
 * perfil (can_manage_all para gestor, próprio corretor_id para corretor). Este
 * endpoint só confirma a sessão e repassa o token — nenhuma chave de serviço
 * chega ao navegador, e nada é consultado sem usuário autenticado.
 *
 * Fora deste endpoint, de propósito: GA4, Google e Meta Ads (custos), Clarity.
 * Enquanto não existirem, os campos correspondentes não são inventados — entram
 * em `pendencias`.
 */

export const dynamic = "force-dynamic";

type Periodo = "hoje" | "7d" | "30d" | "90d" | "mes" | "todo";

type Pendencia = { chave: string; texto: string };

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

/* Janela em America/Sao_Paulo — a mesma regra de /api/performance, para os dois
   endpoints nunca discordarem sobre onde o dia começa. */
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
  const diasAtras = (dias: number) => {
    const inicio = new Date(hoje);
    inicio.setUTCDate(inicio.getUTCDate() - dias);
    return isoData(inicio);
  };
  if (periodo === "todo") return { inicio: "2000-01-01", fim: isoData(fim), rotulo: "Todo histórico" };
  if (periodo === "hoje") return { inicio: isoData(hoje), fim: isoData(fim), rotulo: "Hoje" };
  if (periodo === "7d") return { inicio: diasAtras(6), fim: isoData(fim), rotulo: "7 dias" };
  if (periodo === "90d") return { inicio: diasAtras(89), fim: isoData(fim), rotulo: "90 dias" };
  if (periodo === "mes") return { inicio: isoData(new Date(Date.UTC(ano, mes - 1, 1))), fim: isoData(fim), rotulo: "Mês atual" };
  return { inicio: diasAtras(29), fim: isoData(fim), rotulo: "30 dias" };
}

function lerPeriodo(valor: string | null): Periodo {
  const aceitos: Periodo[] = ["hoje", "7d", "30d", "90d", "mes", "todo"];
  return aceitos.includes(valor as Periodo) ? (valor as Periodo) : "30d";
}

/* Contagem por chave, mantendo "não informado" visível em vez de descartar a linha:
   volume sem classificação é informação, não sujeira. */
function contarPor(linhas: Array<Record<string, unknown>>, campo: string) {
  const mapa = new Map<string, number>();
  linhas.forEach((linha) => {
    const bruto = linha[campo];
    const chave = bruto === null || bruto === undefined || bruto === "" ? "não informado" : String(bruto);
    mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
  });
  return [...mapa.entries()].map(([chave, total]) => ({ chave, total })).sort((a, b) => b.total - a.total);
}

export async function GET(request: Request) {
  const supabase = await authClient(request);
  if (!supabase) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const periodo = lerPeriodo(new URL(request.url).searchParams.get("periodo"));
  const { inicio, fim, rotulo } = janela(periodo);
  const pendencias: Pendencia[] = [];

  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;

  /* BLOCO 1 — empresa, corretores e qualidade do dado. Fonte canónica já em
     produção, com escopo por perfil resolvido dentro da própria função. */
  let empresa: unknown = null;
  let corretores: unknown[] = [];
  let qualidadeDado: unknown = null;
  {
    const { data, error } = await rpc("performance_sala_comando", { p_inicio: inicio, p_fim: fim });
    if (error) {
      console.error("[inteligencia] performance_sala_comando falhou:", error.message);
      pendencias.push({ chave: "empresa", texto: "Os números da operação não puderam ser confirmados agora." });
    } else {
      empresa = data ?? null;
      const envelope = (data ?? {}) as { corretores?: unknown[]; qualidadeDado?: unknown };
      corretores = Array.isArray(envelope.corretores) ? envelope.corretores : [];
      qualidadeDado = envelope.qualidadeDado ?? null;
      if (!corretores.length) {
        pendencias.push({ chave: "equipe", texto: "Nenhum corretor com atividade confirmada neste período." });
      }
    }
  }

  /* BLOCO 2 — digital: leads confirmados vindos do site. `site_leads` é a fonte
     de "Lead do site" na definição das métricas. */
  let digital: { leadsDoSite: number; primeiroEm: string | null; ultimoEm: string | null } | null = null;
  {
    const consulta = supabase
      .from("site_leads")
      .select("criado_em", { count: "exact" })
      .gte("criado_em", inicio)
      .lt("criado_em", fim)
      .order("criado_em", { ascending: true }) as unknown as Promise<{
        data: Array<{ criado_em: string }> | null;
        count: number | null;
        error: { message: string } | null;
      }>;
    const { data, count, error } = await consulta;
    if (error) {
      console.error("[inteligencia] site_leads indisponível:", error.message);
      pendencias.push({ chave: "digital", texto: "Leads do site ainda não disponíveis para esta leitura." });
    } else {
      const linhas = data ?? [];
      digital = {
        leadsDoSite: count ?? linhas.length,
        primeiroEm: linhas.length ? linhas[0].criado_em : null,
        ultimoEm: linhas.length ? linhas[linhas.length - 1].criado_em : null,
      };
    }
  }

  /* BLOCO 3 — captação de proprietários. `captacoes_portal` guarda o que o
     proprietário enviou pelo site; é o único funil digital com dado próprio hoje.
     Agregamos aqui (status, bairro, finalidade) para nenhum dado de contato do
     proprietário sair do servidor: a tela recebe contagem, não pessoa. */
  let proprietarios: {
    recebidas: number; comPreco: number; ultimaEm: string | null;
    porStatus: Array<{ chave: string; total: number }>;
    porBairro: Array<{ chave: string; total: number }>;
    porFinalidade: Array<{ chave: string; total: number }>;
  } | null = null;
  {
    const consulta = supabase
      .from("captacoes_portal")
      .select("criado_em,status,bairro,finalidade,preco", { count: "exact" })
      .gte("criado_em", inicio)
      .lt("criado_em", fim)
      .order("criado_em", { ascending: false })
      .limit(2000) as unknown as Promise<{
        data: Array<Record<string, unknown>> | null;
        count: number | null;
        error: { message: string } | null;
      }>;
    const { data, count, error } = await consulta;
    if (error) {
      console.error("[inteligencia] captacoes_portal indisponível:", error.message);
      pendencias.push({ chave: "proprietários", texto: "Captações do site ainda não disponíveis para esta leitura." });
    } else {
      const linhas = data ?? [];
      proprietarios = {
        recebidas: count ?? linhas.length,
        comPreco: linhas.filter((l) => l.preco !== null && l.preco !== undefined).length,
        ultimaEm: linhas.length ? String(linhas[0].criado_em) : null,
        porStatus: contarPor(linhas, "status"),
        porBairro: contarPor(linhas, "bairro").slice(0, 8),
        porFinalidade: contarPor(linhas, "finalidade"),
      };
    }
  }

  /* Integrações que ainda não existem entram como pendência declarada, para a
     tela nunca preencher CPL, ROAS ou mapa de calor com número fictício. */
  pendencias.push({ chave: "midia", texto: "Custos de mídia ainda não conectados. Conecte Google Ads e Meta Ads para ver CPL, custo por negócio e ROAS." });
  pendencias.push({ chave: "analytics", texto: "GA4 ainda não conectado: sessões, páginas e origem de tráfego aparecem depois da liberação." });
  pendencias.push({ chave: "clarity", texto: "Microsoft Clarity não conectado: mapas de calor e gravações não existem nesta leitura." });

  return Response.json({
    periodo: { chave: periodo, inicio, fim, rotulo, fuso: "America/Sao_Paulo" },
    atualizadoEm: new Date().toISOString(),
    origem: "dado real",
    empresa,
    corretores,
    qualidadeDado,
    digital,
    proprietarios,
    pendencias,
  });
}
