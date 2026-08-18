import { createServerSupabaseClient } from "../../lib/supabase/server";
import { ga4Configurado, lerGa4, type Ga4Leitura } from "../../lib/ga4";

/* INTELIGÊNCIA — endpoint agregador da área.
 *
 * Um endpoint só, autenticado, para as leituras da área. Ele NÃO cria relação nem
 * função no banco: consome o que já existe. Cada bloco é lido de forma
 * independente e, quando a fonte não responde, volta null com pendência declarada
 * — nunca zero, nunca número estimado.
 *
 * Escopo e permissão: a RPC performance_sala_comando resolve o escopo por perfil.
 * Este endpoint só confirma a sessão e repassa o token — nenhuma chave de serviço
 * chega ao navegador.
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

function janela(periodo: Periodo) {
  const hojeSp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
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

/* Contagem por chave, mantendo "não informado" visível: volume sem classificação é
   informação, não sujeira. */
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
    fn: string, args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;

  /* BLOCO 1 — empresa, corretores e qualidade do dado. */
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
      if (!corretores.length) pendencias.push({ chave: "equipe", texto: "Nenhum corretor com atividade confirmada neste período." });
    }
  }

  /* BLOCO 2 — leads confirmados vindos do site. */
  let digital: { leadsDoSite: number; primeiroEm: string | null; ultimoEm: string | null } | null = null;
  {
    const consulta = supabase
      .from("site_leads")
      .select("criado_em", { count: "exact" })
      .gte("criado_em", inicio).lt("criado_em", fim)
      .order("criado_em", { ascending: true }) as unknown as Promise<{
        data: Array<{ criado_em: string }> | null; count: number | null; error: { message: string } | null;
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

  /* BLOCO 3 — captação de proprietários, agregada no servidor: a tela recebe
     contagem, não pessoa. */
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
      .gte("criado_em", inicio).lt("criado_em", fim)
      .order("criado_em", { ascending: false }).limit(2000) as unknown as Promise<{
        data: Array<Record<string, unknown>> | null; count: number | null; error: { message: string } | null;
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

  /* BLOCO 4 — estóque anunciado. `anuncios_site` é o que está publicado hoje:
     serve para responder "o que temos para oferecer" e cruzar com a procura do
     proprietário. Visão por imóvel (quantas pessoas viram cada anuncio) depende de
     telemetria por item, que ainda não chega ao ERP. */
  let estoque: {
    publicados: number; comPreco: number; destaque: number;
    porBairro: Array<{ chave: string; total: number }>;
    porFinalidade: Array<{ chave: string; total: number }>;
    porStatus: Array<{ chave: string; total: number }>;
    precoMediano: number | null;
  } | null = null;
  {
    const consulta = supabase
      .from("anuncios_site")
      .select("bairro,status,estagio,preco,destaque,dormitorios", { count: "exact" })
      .limit(2000) as unknown as Promise<{
        data: Array<Record<string, unknown>> | null; count: number | null; error: { message: string } | null;
      }>;
    const { data, count, error } = await consulta;
    if (error) {
      console.error("[inteligencia] anuncios_site indisponível:", error.message);
      pendencias.push({ chave: "estóque", texto: "Anúncios do site ainda não disponíveis para esta leitura." });
    } else {
      const linhas = data ?? [];
      const precos = linhas
        .map((l) => Number(l.preco))
        .filter((v) => Number.isFinite(v) && v > 0)
        .sort((a, b) => a - b);
      estoque = {
        publicados: count ?? linhas.length,
        comPreco: precos.length,
        destaque: linhas.filter((l) => l.destaque === true).length,
        porBairro: contarPor(linhas, "bairro").slice(0, 10),
        porFinalidade: contarPor(linhas, "estagio"),
        porStatus: contarPor(linhas, "status"),
        precoMediano: precos.length ? precos[Math.floor(precos.length / 2)] : null,
      };
    }
  }

  /* BLOCO 5 — GA4. Sem as variáveis, ou com falha na Data API, volta null e a
     pendência aparece — as telas nunca escrevem 0 sessões. */
  let analytics: Ga4Leitura | null = null;
  if (ga4Configurado()) {
    try {
      analytics = await lerGa4(inicio, fim);
    } catch (erro) {
      console.error("[inteligencia] GA4 falhou:", erro instanceof Error ? erro.message : erro);
      analytics = null;
    }
    if (!analytics) pendencias.push({ chave: "analytics", texto: "GA4 configurado, mas a leitura não respondeu agora. Nenhum número de tráfego foi estimado." });
  } else {
    pendencias.push({ chave: "analytics", texto: "GA4 ainda não conectado: sessões, páginas e origem de tráfego aparecem depois da liberação." });
  }

  pendencias.push({ chave: "midia", texto: "Custos de mídia ainda não conectados. Conecte Google Ads e Meta Ads para ver CPL, custo por negócio e ROAS." });
  pendencias.push({ chave: "clarity", texto: "Microsoft Clarity não conectado: mapas de calor e gravações não existem nesta leitura." });

  return Response.json({
    periodo: { chave: periodo, inicio, fim, rotulo, fuso: "America/Sao_Paulo" },
    atualizadoEm: new Date().toISOString(),
    origem: "dado real",
    empresa, corretores, qualidadeDado, digital, proprietarios, estoque, analytics, pendencias,
  });
}
