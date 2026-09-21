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
  normalizarPrazoSugerido,
  saidaNovaSemRespostaDesdeAnalise,
  validarSugestaoAutomatica,
} from "../_shared/sara-policy.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const MAX_MENSAGENS_CARREGADAS = 250;
const MAX_MENSAGENS_NOVAS = 24;
const MENSAGENS_ANCORA = 8;
const TEMPERATURAS = ["frio", "morno", "quente", "negociando"] as const;
const EVENTOS_DE_PRAZO = new Set([
  "lead.next_action_due",
  "lead.cadence_due",
]);
const EVENTOS_SARA = new Set([
  "conversation.message_received",
  "conversation.message_sent",
  "lead.next_action_due",
  "lead.cadence_due",
  "lead.action_confirmed",
]);

type Catalogo = {
  codigo: string; etapa: string; rotulo: string; descricao: string;
  acao_codigo: string; acao_rotulo: string; prazo_minutos: number | null;
};
type Candidato = {
  funil_lead_id: string; origem_negocio_id: number; lead_id: number; versao: number;
  etapa: string; momento_codigo: string; acao_codigo: string; cadencia_passo: number;
  corte_conversa_em: string; historico_completo: boolean;
};
type ContextoEvento = {
  eventType: string | null;
  sourceId: string | null;
  executionId: number | null;
  expectedAction: Record<string, unknown> | null;
  analisadoEm: string | null;
  resumoAnterior: string | null;
  messageIds: string[];
  evidenciasOperacionais: Array<{ id: string; tipo: string; resumo: string; criado_em: string }>;
};

const SARA_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "sara_classificacao",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        momento_codigo: { type: "string" },
        resumo: { type: "string" },
        proxima_acao_especifica: { type: "string" },
        confianca: { type: "number", minimum: 0, maximum: 1 },
        evidencia_ids: { type: "array", items: { type: "string" } },
        evidencias: { type: "array", items: { type: "string" } },
        temperatura: { type: "string", enum: [...TEMPERATURAS] },
        temperatura_confianca: { type: "number", minimum: 0, maximum: 1 },
        temperatura_evidencia_ids: { type: "array", items: { type: "string" } },
        prazo_sugerido: { description: "Data/hora ISO 8601 completa com timezone, nunca uma duracao textual.", anyOf: [{ type: "string" }, { type: "null" }] },
        qualidade_nota: { anyOf: [{ type: "number", minimum: 0, maximum: 10 }, { type: "null" }] },
        qualidade_resumo: { type: "string" },
        acao_anterior_executada: { anyOf: [{ type: "boolean" }, { type: "null" }] },
        acao_anterior_evidencia_ids: { type: "array", items: { type: "string" } },
      },
      required: [
        "momento_codigo", "resumo", "proxima_acao_especifica", "confianca",
        "evidencia_ids", "evidencias", "temperatura", "temperatura_confianca",
        "temperatura_evidencia_ids", "prazo_sugerido", "qualidade_nota",
        "qualidade_resumo", "acao_anterior_executada", "acao_anterior_evidencia_ids",
      ],
    },
  },
} as const;

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

function prompt(
  c: Candidato,
  catalogo: Catalogo[],
  mensagens: any[],
  fatos: ReturnType<typeof fatosDaConversa>,
  evento: ContextoEvento,
  evidenciasPosteriores: string[],
) {
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
- Em prazo_sugerido, converta prazo relativo usando o horario de agora e devolva ISO 8601 completo com timezone. Nunca devolva "5 dias", "1440min" ou outro texto de duracao.
- Evidências são mensagens do CLIENTE. Em evidencia_ids, devolva somente IDs exibidos em linhas CLIENTE e que sustentem a classificação. Nunca use ID de CORRETOR.
- Temperatura descreve a intenção REAL do cliente, nunca o esforço do corretor:
  frio = não respondeu, recusou ou não demonstrou intenção concreta;
  morno = respondeu e existe interesse, mas ainda sem urgência ou próximo passo forte;
  quente = declarou intenção concreta de visitar, escolher, financiar, enviar documentos ou decidir em curto prazo;
  negociando = existe proposta, reserva, contrato ou negociação explícita de valores/condições.
- QUENTE e NEGOCIANDO exigem fala literal do CLIENTE e confiança mínima de 0.85. Mensagem automática, insistência do corretor, quantidade de mensagens e momento atual nunca tornam um lead quente.
- Em temperatura_evidencia_ids, devolva apenas IDs de mensagens do CLIENTE que provam a temperatura escolhida.
- Não invente informação e não crie momento/ação livre. Você não envia mensagem.
- Quando EVENTO for lead.next_action_due ou lead.cadence_due, avalie se a AÇÃO ESPERADA
  foi realmente executada usando apenas EVIDÊNCIAS POSTERIORES. Ausência de evidência
  significa false; não use o estado anterior como prova. Em acao_anterior_evidencia_ids,
  use somente identificadores canônicos mensagem:<id>, evento:<id> ou visita:<id> listados abaixo.
CATÁLOGO OFICIAL:
${regras}
ESTADO ATUAL: etapa=${c.etapa}; momento=${c.momento_codigo}; cadência_passo=${c.cadencia_passo}; agora=${new Date().toISOString()}.
EVENTO: ${evento.eventType ?? "conversation.unspecified"}; source_id=${evento.sourceId ?? "-"}; execution_id=${evento.executionId ?? "-"}.
AÇÃO ESPERADA: ${JSON.stringify(evento.expectedAction)}.
EVIDÊNCIAS POSTERIORES À ANÁLISE ANTERIOR: ${JSON.stringify(evidenciasPosteriores)}.
RESUMO DA ANÁLISE ANTERIOR: ${evento.resumoAnterior ?? "primeira análise; sem resumo anterior"}.
LOTE ATUAL: ${JSON.stringify(evento.messageIds)}.
CONVERSA D-API EM ORDEM CRONOLÓGICA (âncora anterior + mensagens novas):
${conversa}
Também avalie a qualidade do atendimento do CORRETOR de 0 a 10. A nota mede clareza, agilidade, condução para o próximo passo e aderência ao que o cliente pediu. Sem mensagens do corretor, use nota null. Não desconte pontos por fatos que não aparecem na conversa.
Responda SOMENTE JSON válido: {"momento_codigo":"CÓDIGO_DO_CATÁLOGO","resumo":"diagnóstico objetivo em até 2 frases","proxima_acao_especifica":"orientação concreta para o corretor","confianca":0.0,"evidencia_ids":["ID_DA_MENSAGEM_DO_CLIENTE"],"evidencias":["trecho literal do cliente"],"temperatura":"frio|morno|quente|negociando","temperatura_confianca":0.0,"temperatura_evidencia_ids":["ID_DA_MENSAGEM_DO_CLIENTE"],"prazo_sugerido":null,"qualidade_nota":0.0,"qualidade_resumo":"justificativa objetiva da nota","acao_anterior_executada":null,"acao_anterior_evidencia_ids":[]}.`;
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
  // O histórico completo continua no banco. Esta leitura produz fatos objetivos
  // e o hash; somente delta + uma pequena ancora seguem para a IA.
  const { data, error } = await db.from("wa_mensagens")
    .select("id,direcao,tipo,conteudo,transcricao,enviado_em,criado_em")
    .in("conversa_id", conversaIds).order("criado_em", { ascending: false })
    .limit(MAX_MENSAGENS_CARREGADAS);
  if (error) throw new Error("mensagens_indisponiveis");
  const corte = Date.parse(c.corte_conversa_em);
  return (data ?? [])
    .filter((m: any) => c.historico_completo || Date.parse(m.enviado_em ?? m.criado_em) >= corte)
    .sort((a: any, b: any) => Date.parse(a.enviado_em ?? a.criado_em) - Date.parse(b.enviado_em ?? b.criado_em));
}

function mensagensParaAnalise(mensagens: any[], evento: ContextoEvento) {
  if (!evento.analisadoEm) return mensagens.slice(-MAX_MENSAGENS_NOVAS);
  const corte = Date.parse(evento.analisadoEm);
  const idsDoLote = new Set(evento.messageIds);
  const novas = mensagens.filter((m: any) =>
    idsDoLote.has(String(m.id)) || Date.parse(m.enviado_em ?? m.criado_em) > corte
  );
  const primeiraNova = novas.length ? mensagens.indexOf(novas[0]) : mensagens.length;
  const ancora = mensagens.slice(Math.max(0, primeiraNova-MENSAGENS_ANCORA), primeiraNova);
  return [...ancora, ...novas.slice(-MAX_MENSAGENS_NOVAS)];
}

async function processar(
  db: any,
  c: Candidato,
  catalogo: Catalogo[],
  agenteSlug: string,
  evento: ContextoEvento,
) {
  const mensagens = await carregarMensagens(db, c);
  const mensagensPrompt = mensagensParaAnalise(mensagens, evento);
  const corteAnterior = evento.analisadoEm ? Date.parse(evento.analisadoEm) : Number.NaN;
  const idsDoLote = new Set(evento.messageIds);
  const mensagensPosteriores = mensagens.filter((m: any) =>
    idsDoLote.has(String(m.id)) || Number.isNaN(corteAnterior)
      || Date.parse(m.enviado_em ?? m.criado_em) > corteAnterior
  );
  const evidenciasPosteriores = [
    ...mensagensPosteriores.map((m: any) =>
      `mensagem:${String(m.id)}:${direcaoCliente(m.direcao) ? "cliente" : "corretor"}`
    ),
    ...evento.evidenciasOperacionais.map((e) => `${e.id}:${e.tipo}:${e.resumo}`),
  ];
  const fatos = fatosDaConversa(mensagens);
  const catalogoIa = filtrarCatalogoParaIa(c, catalogo, fatos) as Catalogo[];
  const hash = await sha256(JSON.stringify({ lead: c.funil_lead_id, versao: c.versao,
    contrato:"evidencia-id-v13-preservacao-protegida",
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
      checkpoint_anterior:null,
      qualidade_resumo:"Sem mensagens suficientes para avaliar o atendimento." };
  }
  const entradas = mensagens.filter((m: any) => direcaoCliente(m.direcao));
  const saidas = mensagens.filter((m: any) => direcaoCorretor(m.direcao));
  if (saidaNovaSemRespostaDesdeAnalise(mensagensPosteriores, evento.eventType)) {
    const fatosNovos = fatosDaConversa(mensagensPosteriores);
    const codigo = !entradas.length && deveAplicarCadenciaSemResposta(c, fatosNovos)
      ? "CADENCIA_SEM_RESPOSTA"
      : c.momento_codigo;
    const momento = catalogo.find((m) => m.codigo === codigo);
    if (!momento) throw new Error("catalogo_sem_momento_atual");
    const [{ data: estadoAtual, error: erroEstadoAtual },
      { data: ultimaClassificacao, error: erroUltimaClassificacao }] = await Promise.all([
      db.from("f2_lead").select("temperatura").eq("id", c.funil_lead_id).maybeSingle(),
      db.from("f2_sara_analise")
        .select("temperatura_sugerida,temperatura_confianca,temperatura_evidencias")
        .eq("funil_lead_id", c.funil_lead_id)
        .in("status", ["aplicada", "mantida"])
        .not("temperatura_sugerida", "is", null)
        .order("analisado_em", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (erroEstadoAtual || erroUltimaClassificacao)
      throw new Error("estado_atual_indisponivel");
    const ultimaEntrada = entradas.at(-1);
    const evidenciaDaMensagem = ultimaEntrada
      ? texto(ultimaEntrada.transcricao, 300) ?? texto(ultimaEntrada.conteudo, 300)
      : null;
    const evidenciaPersistida = Array.isArray(ultimaClassificacao?.temperatura_evidencias)
      ? ultimaClassificacao.temperatura_evidencias
        .map((item: unknown) => texto(item, 300)).find(Boolean) ?? null
      : null;
    const evidenciaTemperatura = evidenciaDaMensagem ?? evidenciaPersistida;
    const temperaturaPreservada = estadoAtual?.temperatura
      ?? ultimaClassificacao?.temperatura_sugerida ?? "morno";
    // O registro da analise exige prova literal para preservar uma temperatura
    // quando ja existe resposta no historico. Sem essa prova, deixa a IA seguir
    // pelo caminho seguro em vez de fabricar evidencia ou travar o card.
    if (entradas.length && !evidenciaTemperatura) {
      // segue para a interpretacao normal abaixo
    } else {
      const moveuParaCadencia = codigo === "CADENCIA_SEM_RESPOSTA"
        && codigo !== c.momento_codigo;
      return { id:c.funil_lead_id,versao_base:c.versao,context_hash:hash,
        origem:"deterministica",status:"sugestao",momento_codigo:momento.codigo,
        etapa:momento.etapa,acao_codigo:momento.acao_codigo,acao_rotulo:momento.acao_rotulo,
        prazo_sugerido:null,
        resumo:moveuParaCadencia
          ? "O corretor cumpriu a tentativa de contato e nao houve resposta nova do cliente; seguir a cadencia oficial."
          : "O corretor cumpriu a acao prevista e nao houve resposta nova do cliente; o estado foi preservado e o proximo checkpoint foi renovado.",
        evidencias:[],confianca:1,mensagens:mensagens.length,qualidade_nota:null,
        temperatura:moveuParaCadencia ? "frio" : temperaturaPreservada,
        temperatura_confianca:moveuParaCadencia
          ? 1
          : ultimaClassificacao?.temperatura_confianca ?? 0.5,
        temperatura_evidencias:evidenciaTemperatura ? [evidenciaTemperatura] : [],
        proxima_acao:proximaAcaoContrato(
          momento,
          momento.prazo_minutos === null ? null
            : new Date(Date.now()+momento.prazo_minutos*60000).toISOString(),
        ),
        checkpoint_anterior:null,
        qualidade_resumo:"A qualidade foi preservada porque nao houve nova resposta do cliente.",
        mensagens_novas:mensagensPosteriores.length,
        ultima_mensagem_id:mensagens.at(-1)?.id ?? null };
    }
  }
  if (!entradas.length && saidas.length && !EVENTOS_DE_PRAZO.has(evento.eventType ?? "")) {
    if (!deveAplicarCadenciaSemResposta(c, fatos)) {
      return { id:c.funil_lead_id,versao_base:c.versao,context_hash:hash,
        origem:"deterministica",status:"sem_historico",momento_codigo:null,
        etapa:null,acao_codigo:null,acao_rotulo:null,prazo_sugerido:null,
        resumo:"Sem resposta do cliente no recorte atual, mas o card ja esta em uma etapa posterior; estado preservado para evitar regressao automatica.",
        evidencias:[],confianca:null,mensagens:mensagens.length,qualidade_nota:null,
        temperatura:null,temperatura_confianca:null,temperatura_evidencias:[],
        checkpoint_anterior:null,
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
      checkpoint_anterior:EVENTOS_DE_PRAZO.has(evento.eventType ?? "") ? {
        event_type:evento.eventType,source_id:evento.sourceId,
        expected_action:evento.expectedAction,
        executada:mensagensPosteriores.some((m:any)=>direcaoCorretor(m.direcao)) ||
          evento.evidenciasOperacionais.length>0,
        evidencias:evidenciasPosteriores,
      } : null,
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
      checkpoint_anterior:EVENTOS_DE_PRAZO.has(evento.eventType ?? "") ? {
        event_type:evento.eventType,source_id:evento.sourceId,
        expected_action:evento.expectedAction,executada:null,evidencias:[],
      } : null,
      qualidade_resumo:"A avaliacao automatica nao foi aplicada porque faltou uma saida estruturada confiavel.",
      mensagens_novas:mensagensPosteriores.length,
      ultima_mensagem_id:mensagens.at(-1)?.id ?? null,
      revisao_motivo:motivo.slice(0,80) };
  };

  try {
  const { data:orcamento, error:erroOrcamento } = await db.rpc("f2_sara_orcamento_status", {
    p_projected_usd: 0.005,
  });
  const rpcAindaNaoInstalada = erroOrcamento && (
    erroOrcamento.code === "PGRST202" ||
    /f2_sara_orcamento_status.*(schema cache|not find|nao encontr)/i.test(
      String(erroOrcamento.message ?? ""),
    )
  );
  if (erroOrcamento && !rpcAindaNaoInstalada) throw new Error("orcamento_indisponivel");
  if (!erroOrcamento && orcamento?.permitido !== true)
    return revisaoSegura("orcamento_mensal_esgotado");
  const input = prompt(c,catalogoIa,mensagensPrompt,fatos,evento,evidenciasPosteriores);
  const response = await fetch(`${SUPABASE_URL}/functions/v1/ia-router`, {
    method:"POST",headers:{apikey:SERVICE_ROLE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({agente_slug:agenteSlug,input,disable_tools:true,
      model_override:"gpt-5.6-luna",response_format:SARA_RESPONSE_FORMAT,
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
  const prazo = normalizarPrazoSugerido(parsed.prazo_sugerido);
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
  const eventoDue = EVENTOS_DE_PRAZO.has(evento.eventType ?? "");
  const acaoAnteriorExecutada = eventoDue ? parsed.acao_anterior_executada : null;
  if (eventoDue && typeof acaoAnteriorExecutada !== "boolean")
    throw new Error("ia_acao_anterior_sem_resultado");
  const evidenciaIdsPermitidos = new Set(evidenciasPosteriores.map((e) => e.split(":").slice(0,2).join(":")));
  const evidenciasAcaoAnterior = (Array.isArray(parsed.acao_anterior_evidencia_ids)
    ? parsed.acao_anterior_evidencia_ids : [])
    .map((id:unknown)=>String(id).split(":").slice(0,2).join(":"))
    .filter((id:string)=>evidenciaIdsPermitidos.has(id))
    .slice(0,10);
  if (acaoAnteriorExecutada === true && !evidenciasAcaoAnterior.length)
    throw new Error("ia_acao_anterior_sem_evidencia");
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
    checkpoint_anterior:eventoDue ? {
      event_type:evento.eventType,source_id:evento.sourceId,
      expected_action:evento.expectedAction,executada:acaoAnteriorExecutada,
      evidencias:evidenciasAcaoAnterior,
    } : null,
    qualidade_resumo:qualidadeResumo,
    ia_execucao_id:payload?.execucao_id ?? null,modelo:payload?.modelo ?? "gpt-5.6-luna",
    tokens_entrada:payload?.tokens?.entrada ?? null,
    tokens_cache_entrada:payload?.tokens?.cache_entrada ?? null,
    tokens_saida:payload?.tokens?.saida ?? null,custo_usd:payload?.custo_usd ?? null,
    mensagens_novas:mensagensPosteriores.length,
    ultima_mensagem_id:mensagens.at(-1)?.id ?? null };
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
    const eventType = texto(body.event_type, 80);
    if (eventType && !EVENTOS_SARA.has(eventType))
      return Response.json({ok:false,erro:"event_type_invalido"},{status:400});
    const sourceId = texto(body.source_id, 100);
    const messageIds = Array.isArray(body.message_ids)
      ? [...new Set(body.message_ids
        .filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)))]
        .slice(0, 100)
      : [];
    const executionRaw = Number(body.execution_id);
    const executionId = Number.isSafeInteger(executionRaw) && executionRaw > 0 ? executionRaw : null;
    const expectedAction = body.expected_action && typeof body.expected_action === "object" &&
      !Array.isArray(body.expected_action) ? body.expected_action as Record<string,unknown> : null;
    const eventoDePrazo = EVENTOS_DE_PRAZO.has(eventType ?? "");
    if (eventoDePrazo && (!sourceId || !executionId || !expectedAction))
      return Response.json({ok:false,erro:"contexto_due_incompleto"},{status:400});
    if (eventType === "lead.action_confirmed" && (!sourceId || !executionId || !/^\d+$/.test(sourceId)))
      return Response.json({ok:false,erro:"contexto_acao_confirmada_incompleto"},{status:400});

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
    let analisadoEm: string | null = null;
    let resumoAnterior: string | null = null;
    const evidenciasOperacionais: ContextoEvento["evidenciasOperacionais"] = [];
    if (eventoDePrazo && sourceId && /^\d+$/.test(sourceId)) {
      const { data: analise, error: ea } = await db.from("f2_sara_analise")
        .select("id,funil_lead_id,analisado_em,resumo").eq("id",Number(sourceId))
        .eq("funil_lead_id",funilLeadId).maybeSingle();
      if (ea || !analise) return Response.json({ok:false,erro:"checkpoint_origem_invalido"},{status:409});
      analisadoEm = analise.analisado_em;
      resumoAnterior = analise.resumo;
      const [{data:eventos,error:ee},{data:visitas,error:ev}] = await Promise.all([
        db.from("f2_evento").select("id,tipo,titulo,criado_em")
          .eq("funil_lead_id",funilLeadId).gt("criado_em",analisadoEm).order("criado_em").limit(100),
        db.from("f2_visita").select("id,status,inicio_em,atualizado_em")
          .eq("funil_lead_id",funilLeadId).gt("atualizado_em",analisadoEm).order("atualizado_em").limit(100),
      ]);
      if (ee || ev) throw new Error("evidencias_operacionais_indisponiveis");
      for (const e of eventos ?? []) evidenciasOperacionais.push({
        id:`evento:${String(e.id)}`,tipo:String(e.tipo),resumo:texto(e.titulo,120) ?? "evento operacional",
        criado_em:String(e.criado_em),
      });
      for (const v of visitas ?? []) evidenciasOperacionais.push({
        id:`visita:${String(v.id)}`,tipo:`visita.${String(v.status)}`,resumo:"estado de visita registrado",
        criado_em:String(v.atualizado_em ?? v.inicio_em),
      });
    } else {
      const { data: analiseAnterior, error: ea } = await db.from("f2_sara_analise")
        .select("analisado_em,resumo").eq("funil_lead_id",funilLeadId)
        .order("analisado_em", { ascending:false }).limit(1).maybeSingle();
      if (ea) throw new Error("analise_anterior_indisponivel");
      analisadoEm = analiseAnterior?.analisado_em ?? null;
      resumoAnterior = analiseAnterior?.resumo ?? null;
      if (eventType === "lead.action_confirmed" && sourceId) {
        const { data: eventoConfirmacao, error: erroConfirmacao } = await db.from("f2_evento")
          .select("id,tipo,titulo,criado_em").eq("id",Number(sourceId))
          .eq("funil_lead_id",funilLeadId).eq("tipo","acao_confirmada").maybeSingle();
        if (erroConfirmacao || !eventoConfirmacao)
          return Response.json({ok:false,erro:"acao_confirmada_origem_invalida"},{status:409});
        evidenciasOperacionais.push({
          id:`evento:${String(eventoConfirmacao.id)}`,
          tipo:String(eventoConfirmacao.tipo),
          resumo:texto(eventoConfirmacao.titulo,120) ?? "ação operacional confirmada",
          criado_em:String(eventoConfirmacao.criado_em),
        });
      }
    }
    const evento: ContextoEvento = {
      eventType,sourceId,executionId,expectedAction,analisadoEm,resumoAnterior,
      messageIds,evidenciasOperacionais,
    };
    const resultados = await Promise.allSettled(
      (candidatos ?? []).map((c:Candidato)=>processar(db,c,catalogo,agenteSlug,evento)),
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
