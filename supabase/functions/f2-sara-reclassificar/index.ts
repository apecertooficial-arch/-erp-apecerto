// Funil 2.0 — Sara analisa etapa, momento, ação, prazo e qualidade.
// Contrato do módulo: somente lê e devolve JSON estruturado. Não altera lead,
// negócio, card, momento, etapa ou ação. A aplicação pertence a um bloco de
// Ação explícito no mapa publicado da Central de Automações.
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";
import {
  direcaoCliente,
  direcaoCorretor,
  deveAplicarCadenciaSemResposta,
  fatosDaConversa,
  filtrarCatalogoParaIa,
  validarSugestaoAutomatica,
} from "../_shared/sara-policy.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const MAX_MENSAGENS = 60;
const TEMPERATURAS = ["frio", "morno", "quente", "negociando"] as const;

type Catalogo = {
  codigo: string; etapa: string; rotulo: string; descricao: string;
  acao_codigo: string; acao_rotulo: string; prazo_minutos: number | null;
};
type Candidato = {
  funil_lead_id: string; origem_negocio_id: number; lead_id: number; versao: number;
  etapa: string; momento_codigo: string; acao_codigo: string; cadencia_passo: number;
  corte_conversa_em: string; historico_completo: boolean;
};

function segredoIgual(recebido: string | null, esperado: string) {
  if (!recebido || !esperado || recebido.length !== esperado.length) return false;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) diff |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return diff === 0;
}

async function sha256(texto: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function objetoJson(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== "string") return null;
  const achou = raw.match(/\{[\s\S]*\}/);
  if (!achou) return null;
  try { const value = JSON.parse(achou[0]); return value && typeof value === "object" ? value : null; }
  catch { return null; }
}

function texto(v: unknown, max: number) {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

function proximaAcaoContrato(momento: Catalogo, executarEm: string | null) {
  return {
    codigo: momento.acao_codigo,
    tipo: momento.codigo === "CADENCIA_SEM_RESPOSTA" ? "cadencia" : "proxima_acao",
    responsavel: "corretor_atual",
    executar_em: executarEm,
    criterio_conclusao: `Evidencia posterior confirma a conclusao de ${momento.acao_codigo}.`,
    evidencia_esperada: "mensagem, evento operacional ou atualizacao auditavel posterior a analise",
  };
}

class IaIndisponivelError extends Error {
  constructor(public readonly motivo: string) {
    super("ia_indisponivel");
    this.name = "IaIndisponivelError";
  }
}

function normalizarEvidencia(v: unknown) {
  return String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function prompt(c: Candidato, catalogo: Catalogo[], mensagens: any[], fatos: ReturnType<typeof fatosDaConversa>) {
  const regras = catalogo.map((m) =>
    `${m.codigo} | etapa=${m.etapa} | ação=${m.acao_codigo} (${m.acao_rotulo}) | prazo=${m.prazo_minutos ?? "data combinada"}min | ${m.descricao}`,
  ).join("\n");
  const conversa = mensagens.map((m) => {
    const papel = direcaoCliente(m.direcao) ? "CLIENTE" : "CORRETOR";
    const data = String(m.enviado_em ?? m.criado_em ?? "").slice(0, 16).replace("T", " ");
    const conteudo = texto(m.transcricao, 500) ?? texto(m.conteudo, 500) ?? `(${m.tipo ?? "mensagem"} sem texto)`;
    return `[${papel} id=${String(m.id)} ${data}] ${conteudo}`;
  }).join("\n");
  return `Você é a Sara, supervisora de atendimento imobiliário. Classifique a conversa no catálogo FECHADO do Funil 2.0.
OBJETIVO: nenhum lead fica parado; etapa organiza, momento explica, ação e prazo movem o trabalho.
REGRAS OBRIGATÓRIAS:
- FATOS DO BANCO: cliente_respondeu=${fatos.clienteRespondeu}; corretor_enviou=${fatos.corretorEnviou}; ultima_direcao=${fatos.ultimaDirecao}; recebidas=${fatos.recebidas}; enviadas=${fatos.enviadas}.
- Envio, resposta, direção da última mensagem e estados registrados de visita são fatos do banco. Não reinterpretar esses fatos.
- O catálogo abaixo já foi reduzido às transições automáticas permitidas. Não sugira código ausente dele.
- Cliente nunca respondeu: CADENCIA_SEM_RESPOSTA.
- Cliente respondeu: nunca use PRIMEIRA_ABORDAGEM nem CADENCIA_SEM_RESPOSTA.
- Se pediu outro perfil/produto e falta localizar opções: PROCURANDO_PRODUTO.
- Se as opções já foram enviadas e aguardam reação: PRODUTO_ENVIADO.
- Se há intenção de visita sem data fechada: TENTANDO_AGENDAMENTO.
- Pós-visita, cancelamento e remarcação usam somente momentos de pós-visita do catálogo.
- RETORNO_PROGRAMADO só quando há data/prazo combinado; sem data explícita, o CRM usará 5 dias.
- Evidências são mensagens do CLIENTE. Em evidencia_ids, devolva somente IDs exibidos em linhas CLIENTE e que sustentem a classificação. Nunca use ID de CORRETOR.
- Temperatura descreve a intenção REAL do cliente, nunca o esforço do corretor:
  frio = não respondeu, recusou ou não demonstrou intenção concreta;
  morno = respondeu e existe interesse, mas ainda sem urgência ou próximo passo forte;
  quente = declarou intenção concreta de visitar, escolher, financiar, enviar documentos ou decidir em curto prazo;
  negociando = existe proposta, reserva, contrato ou negociação explícita de valores/condições.
- QUENTE e NEGOCIANDO exigem fala literal do CLIENTE e confiança mínima de 0.85. Mensagem automática, insistência do corretor, quantidade de mensagens e momento atual nunca tornam um lead quente.
- Em temperatura_evidencia_ids, devolva apenas IDs de mensagens do CLIENTE que provam a temperatura escolhida.
- Não invente informação e não crie momento/ação livre. Você não envia mensagem.
CATÁLOGO OFICIAL:
${regras}
ESTADO ATUAL: etapa=${c.etapa}; momento=${c.momento_codigo}; cadência_passo=${c.cadencia_passo}; agora=${new Date().toISOString()}.
CONVERSA D-API EM ORDEM CRONOLÓGICA (recorte mais recente, até ${MAX_MENSAGENS} mensagens):
${conversa}
Também avalie a qualidade do atendimento do CORRETOR de 0 a 10. A nota mede clareza, agilidade, condução para o próximo passo e aderência ao que o cliente pediu. Sem mensagens do corretor, use nota null. Não desconte pontos por fatos que não aparecem na conversa.
Responda SOMENTE JSON válido: {"momento_codigo":"CÓDIGO_DO_CATÁLOGO","resumo":"diagnóstico objetivo em até 2 frases","proxima_acao_especifica":"orientação concreta para o corretor","confianca":0.0,"evidencia_ids":["ID_DA_MENSAGEM_DO_CLIENTE"],"evidencias":["trecho literal do cliente"],"temperatura":"frio|morno|quente|negociando","temperatura_confianca":0.0,"temperatura_evidencia_ids":["ID_DA_MENSAGEM_DO_CLIENTE"],"prazo_sugerido":null,"qualidade_nota":0.0,"qualidade_resumo":"justificativa objetiva da nota"}.`;
}

async function carregarMensagens(db: any, c: Candidato) {
  const [{ data: contatos, error: e1 }, { data: vinculados, error: eVinculo }] = await Promise.all([
    db.from("wa_contatos").select("id").eq("lead_id", c.lead_id),
    db.from("f2_historico_vinculo").select("contato_id").eq("funil_lead_id", c.funil_lead_id),
  ]);
  if (e1) throw new Error("contatos_indisponiveis");
  if (eVinculo) throw new Error("vinculos_indisponiveis");
  const contatoIds = [...new Set([
    ...(contatos ?? []).map((x: any) => x.id),
    ...(vinculados ?? []).map((x: any) => x.contato_id),
  ])];
  if (!contatoIds.length) return [];
  const { data: conversas, error: e2 } = await db.from("wa_conversas").select("id").in("contato_id", contatoIds);
  if (e2) throw new Error("conversas_indisponiveis");
  const conversaIds = (conversas ?? []).map((x: any) => x.id);
  if (!conversaIds.length) return [];
  // O maior histórico observado na auditoria tinha 212 mensagens. Buscamos 250,
  // aplicamos o corte no servidor e entregamos à IA as 60 mais recentes.
  const { data, error } = await db.from("wa_mensagens")
    .select("id,direcao,tipo,conteudo,transcricao,enviado_em,criado_em")
    .in("conversa_id", conversaIds).order("criado_em", { ascending: false }).limit(250);
  if (error) throw new Error("mensagens_indisponiveis");
  const corte = Date.parse(c.corte_conversa_em);
  return (data ?? [])
    .filter((m: any) => c.historico_completo || Date.parse(m.enviado_em ?? m.criado_em) >= corte)
    .sort((a: any, b: any) => Date.parse(a.enviado_em ?? a.criado_em) - Date.parse(b.enviado_em ?? b.criado_em))
    .slice(-MAX_MENSAGENS);
}

async function processar(db: any, c: Candidato, catalogo: Catalogo[], agenteSlug: string) {
  const mensagens = await carregarMensagens(db, c);
  const fatos = fatosDaConversa(mensagens);
  const catalogoIa = filtrarCatalogoParaIa(c, catalogo, fatos) as Catalogo[];
  const hash = await sha256(JSON.stringify({ lead: c.funil_lead_id, versao: c.versao,
    contrato:"evidencia-id-v7-inteligencia-hibrida",
    agente: agenteSlug,
    mensagens: mensagens.map((m: any) => [m.id,m.enviado_em ?? m.criado_em]),
    fatos,
    catalogo: catalogoIa.map((m) => [m.codigo,m.etapa,m.acao_codigo,m.prazo_minutos]) }));
  if (!mensagens.length) {
    return { id:c.funil_lead_id,versao_base:c.versao,context_hash:hash,
      origem:"deterministica",status:"sem_historico",momento_codigo:null,
      etapa:null,acao_codigo:null,acao_rotulo:null,prazo_sugerido:null,
      resumo:c.historico_completo
        ? "Nenhum histórico D-API foi localizado para este lead; classificação anterior preservada."
        : "Sem histórico D-API posterior à entrada no Funil 2.0; classificação anterior preservada.",
      evidencias:[],confianca:null,mensagens:0,qualidade_nota:null,
      temperatura:null,temperatura_confianca:null,temperatura_evidencias:[],
      proxima_acao:null,
      qualidade_resumo:"Sem mensagens suficientes para avaliar o atendimento." };
  }
  const entradas = mensagens.filter((m: any) => direcaoCliente(m.direcao));
  const saidas = mensagens.filter((m: any) => direcaoCorretor(m.direcao));
  if (!entradas.length && saidas.length) {
    if (!deveAplicarCadenciaSemResposta(c, fatos)) {
      return { id:c.funil_lead_id,versao_base:c.versao,context_hash:hash,
        origem:"deterministica",status:"sem_historico",momento_codigo:null,
        etapa:null,acao_codigo:null,acao_rotulo:null,prazo_sugerido:null,
        resumo:"Sem resposta do cliente no recorte atual, mas o card ja esta em uma etapa posterior; estado preservado para evitar regressao automatica.",
        evidencias:[],confianca:null,mensagens:mensagens.length,qualidade_nota:null,
        temperatura:null,temperatura_confianca:null,temperatura_evidencias:[],
        qualidade_resumo:"A qualidade foi preservada porque nao ha resposta do cliente no recorte atual." };
    }
    const momento = catalogo.find((m) => m.codigo === "CADENCIA_SEM_RESPOSTA");
    if (!momento) throw new Error("catalogo_sem_cadencia");
    return { id:c.funil_lead_id,versao_base:c.versao,context_hash:hash,
      origem:"deterministica",status:"sugestao",momento_codigo:"CADENCIA_SEM_RESPOSTA",
      etapa:momento.etapa,acao_codigo:momento.acao_codigo,acao_rotulo:momento.acao_rotulo,
      prazo_sugerido:null,
      resumo:"O corretor já tentou contato, mas o cliente ainda não respondeu; seguir a cadência oficial.",
      evidencias:[],confianca:1,mensagens:mensagens.length,qualidade_nota:null,
      temperatura:"frio",temperatura_confianca:1,temperatura_evidencias:[],
      proxima_acao:proximaAcaoContrato(
        momento,
        momento.prazo_minutos === null ? null : new Date(Date.now()+momento.prazo_minutos*60000).toISOString(),
      ),
      qualidade_resumo:"Sem resposta do cliente; a qualidade não foi pontuada automaticamente." };
  }

  const revisaoSegura = (motivo: string) => {
    const momento = catalogo.find((m) => m.codigo === c.momento_codigo)
      ?? catalogoIa.find((m) => m.codigo === "CONVERSANDO_QUALIFICANDO")
      ?? catalogo[0];
    const ultimaEntrada = entradas.at(-1);
    const evidencia = ultimaEntrada
      ? texto(ultimaEntrada.transcricao, 300)
        ?? texto(ultimaEntrada.conteudo, 300)
        ?? `Mensagem recebida do cliente (id ${String(ultimaEntrada.id)}), sem texto disponivel.`
      : null;
    return { id:c.funil_lead_id,versao_base:c.versao,context_hash:hash,
      origem:"ia",status:"sugestao",momento_codigo:momento.codigo,
      etapa:momento.etapa,acao_codigo:momento.acao_codigo,acao_rotulo:momento.acao_rotulo,
      prazo_sugerido:null,
      resumo:"A resposta do modelo nao atingiu o contrato seguro; o cadastro foi preservado para revisao humana.",
      evidencias:evidencia ? [evidencia] : [],confianca:0,mensagens:mensagens.length,
      qualidade_nota:null,temperatura:"morno",temperatura_confianca:0,
      temperatura_evidencias:evidencia ? [evidencia] : [],
      qualidade_resumo:"A avaliacao automatica nao foi aplicada porque faltou uma saida estruturada confiavel.",
      revisao_motivo:motivo.slice(0,80) };
  };

  try {
  const input = prompt(c,catalogoIa,mensagens,fatos);
  const response = await fetch(`${SUPABASE_URL}/functions/v1/ia-router`, {
    method:"POST",headers:{apikey:SERVICE_ROLE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({agente_slug:agenteSlug,input,disable_tools:true,
      override_prompt:"Classifique estritamente pelo catálogo fechado do input. Retorne somente JSON."}),
    signal:AbortSignal.timeout(25000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const motivo = texto(payload?.reason, 80) ?? `ia_router_http_${response.status}`;
    throw new IaIndisponivelError(motivo);
  }
  const raw = payload && typeof payload.saida === "object" ? payload.saida : payload?.resposta ?? payload;
  const parsed = objetoJson(raw);
  if (!parsed) throw new Error("ia_json_invalido");
  const codigo = texto(parsed.momento_codigo,50);
  const momento = catalogoIa.find((m) => m.codigo===codigo);
  const confianca = Number(parsed.confianca);
  const resumoBase = texto(parsed.resumo,550);
  const proxima = texto(parsed.proxima_acao_especifica,220);
  if (!momento || !resumoBase || !Number.isFinite(confianca) || confianca<0 || confianca>1) throw new Error("ia_contrato_invalido");
  const entradasPorId = new Map(entradas.map((m: any) => [String(m.id), m]));
  const evidenciasPorId = (Array.isArray(parsed.evidencia_ids) ? parsed.evidencia_ids : [])
    .map((id: unknown) => entradasPorId.get(String(id)))
    .filter(Boolean)
    .map((m: any) => texto(m.transcricao, 300) ?? texto(m.conteudo, 300))
    .filter((e: string | null): e is string => Boolean(e));
  const falasCliente = entradas.map((m: any) => normalizarEvidencia(m.transcricao ?? m.conteudo ?? ""));
  const evidenciasTexto = (Array.isArray(parsed.evidencias) ? parsed.evidencias : [])
    .filter((e: unknown) => typeof e==="string" && e.trim().length>=4)
    .map((e: string) => e.trim().slice(0,300))
    .filter((e: string) => {
      const normalizada = normalizarEvidencia(e);
      return normalizada.length >= 4 && falasCliente.some((fala: string) => fala.includes(normalizada));
    });
  const evidencias = [...new Set([...evidenciasPorId, ...evidenciasTexto])].slice(0,5);
  const temperatura = texto(parsed.temperatura, 20);
  const temperaturaConfianca = Number(parsed.temperatura_confianca);
  if (!TEMPERATURAS.includes(temperatura as (typeof TEMPERATURAS)[number]) ||
      !Number.isFinite(temperaturaConfianca) || temperaturaConfianca < 0 || temperaturaConfianca > 1)
    throw new Error("ia_temperatura_invalida");
  const temperaturaEvidencias = [...new Set(
    (Array.isArray(parsed.temperatura_evidencia_ids) ? parsed.temperatura_evidencia_ids : [])
      .map((id: unknown) => entradasPorId.get(String(id)))
      .filter(Boolean)
      .map((m: any) => texto(m.transcricao, 300) ?? texto(m.conteudo, 300))
      .filter((e: string | null): e is string => Boolean(e)),
  )].slice(0,5);
  if (!temperaturaEvidencias.length) throw new Error("ia_temperatura_sem_evidencia_cliente");
  if (["quente", "negociando"].includes(temperatura!) && temperaturaConfianca < 0.85)
    throw new Error("ia_temperatura_alta_sem_confianca");
  const prazo = typeof parsed.prazo_sugerido==="string" && !Number.isNaN(Date.parse(parsed.prazo_sugerido))
    ? new Date(parsed.prazo_sugerido).toISOString() : null;
  const politica = validarSugestaoAutomatica({
    candidato:c,momento,fatos,confianca,evidencias,prazoSugerido:prazo,
  });
  if (!politica.ok) throw new Error(`ia_${politica.motivo}`);
  const notaRaw = parsed.qualidade_nota;
  const nota = notaRaw === null || notaRaw === undefined ? null : Number(notaRaw);
  if (nota !== null && (!Number.isFinite(nota) || nota < 0 || nota > 10))
    throw new Error("ia_nota_invalida");
  const qualidadeResumo = texto(parsed.qualidade_resumo,500)
    ?? (nota === null ? "Sem mensagens suficientes para avaliar o atendimento." : null);
  if (nota !== null && !qualidadeResumo) throw new Error("ia_qualidade_sem_justificativa");
  return { id:c.funil_lead_id,versao_base:c.versao,context_hash:hash,
    origem:"ia",status:"sugestao",momento_codigo:momento.codigo,
    etapa:momento.etapa,acao_codigo:momento.acao_codigo,acao_rotulo:momento.acao_rotulo,
    prazo_sugerido:prazo,
    resumo:`${resumoBase}${proxima ? ` Próxima direção: ${proxima}` : ""}`.slice(0,800),
    evidencias,confianca,mensagens:mensagens.length,qualidade_nota:nota,
    temperatura,temperatura_confianca:temperaturaConfianca,
    temperatura_evidencias:temperaturaEvidencias,
    proxima_acao:proximaAcaoContrato(
      momento,
      prazo ?? (momento.prazo_minutos === null
        ? null : new Date(Date.now()+momento.prazo_minutos*60000).toISOString()),
    ),
    qualidade_resumo:qualidadeResumo };
  } catch (e) {
    if (e instanceof IaIndisponivelError) throw e;
    const motivo = e instanceof Error ? e.message : "ia_falhou";
    console.warn("f2-sara-reclassificar:revisao-segura", motivo.slice(0,80));
    return revisaoSegura(motivo);
  }
}

Deno.serve(async (req: Request) => {
  if (!segredoIgual(req.headers.get("x-cron-secret"),CRON_SECRET))
    return Response.json({ok:false,erro:"nao_autorizado"},{status:401});
  const db = createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false}});
  try {
    const body = await req.json().catch(()=>({})) as Record<string, unknown>;
    const funilLeadId = texto(body.funil_lead_id, 36);
    if (funilLeadId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(funilLeadId))
      return Response.json({ok:false,erro:"funil_lead_id_invalido"},{status:400});
    const agenteSlug = texto(body.agente_slug, 80) ?? "sara";
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(agenteSlug))
      return Response.json({ok:false,erro:"agente_slug_invalido"},{status:400});

    const { data: config, error: ec } = await db.from("f2_sara_config").select("enabled,lote").eq("id",true).maybeSingle();
    if (ec || !config) throw new Error("config_indisponivel");
    if (!config.enabled) return Response.json({ok:false,executou:false,motivo:"desligado"},{status:503});
    if (!funilLeadId)
      return Response.json({ok:false,erro:"funil_lead_id_obrigatorio",motivo:"o modulo de IA nao executa varredura em lote"},{status:400});
    const candidatoQuery = db.rpc("f2_sara_candidato",{p_funil_lead_id:funilLeadId});
    const [{data:candidatos,error:e1},{data:catalogo,error:e2}] = await Promise.all([
      candidatoQuery,
      db.from("f2_momento_config").select("codigo,etapa,rotulo,descricao,acao_codigo,acao_rotulo,prazo_minutos").eq("ativo",true).order("ordem"),
    ]);
    if (e1 || e2 || !catalogo?.length) throw new Error("fila_indisponivel");
    if (funilLeadId && !(candidatos ?? []).length)
      return Response.json({ok:false,erro:"card_nao_encontrado",funil_lead_id:funilLeadId},{status:404});
    const resultados = await Promise.allSettled(
      (candidatos ?? []).map((c:Candidato)=>processar(db,c,catalogo,agenteSlug)),
    );
    const ok = resultados.filter((r)=>r.status==="fulfilled").map((r:any)=>r.value);
    const rejeitados = resultados.filter((r)=>r.status==="rejected") as PromiseRejectedResult[];
    const erros = rejeitados.map((r:any)=>r.reason instanceof IaIndisponivelError
      ? r.reason.motivo : String(r.reason?.message ?? "falha").slice(0,80));
    const iaIndisponivel = rejeitados.some((r:any)=>r.reason instanceof IaIndisponivelError);
    const resposta = {ok:erros.length===0,executou:true,modo:"direto",somente_analise:true,
      agente_slug:agenteSlug,selecionados:(candidatos??[]).length,processados:ok.length,
      erros:erros.length,resultados:ok,detalhes_erros:erros};
    return Response.json({...resposta,ia_indisponivel:iaIndisponivel},{status:iaIndisponivel?503:(funilLeadId&&erros.length?502:200)});
  } catch (e) {
    console.error("f2-sara-reclassificar",e instanceof Error?e.message:"falha");
    return Response.json({ok:false,erro:"falha_interna"},{status:500});
  }
});
