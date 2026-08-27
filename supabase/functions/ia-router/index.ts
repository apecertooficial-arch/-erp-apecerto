import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Precos por 1M de tokens. Sem a entrada aqui, o custo gravado sai errado.
const PRICES: Record<string,{in:number;out:number}> = {
  "gpt-4o-mini":{in:0.15,out:0.60}, "gpt-4o":{in:2.50,out:10.00},
  "gpt-5.4-mini":{in:0.75,out:4.50}, "gpt-5.4-nano":{in:0.20,out:1.25},
  "gpt-5.4":{in:2.50,out:15.00}, "gpt-5.5":{in:5.00,out:30.00},
  "gpt-5.6-sol":{in:4.00,out:20.00},
};
// Modelos que a casa aceita usar. Fora desta lista, cai no padrao -- e o que
// impede um typo no cadastro de virar chamada cara ou modelo inexistente.
const MODELOS_OK = new Set(Object.keys(PRICES));
const MODELO_PADRAO = "gpt-5.4-mini";

// A geracao 5.x trocou max_tokens por max_completion_tokens: mandar o antigo
// devolve 400 e derruba a chamada inteira. Testado em 06/08/2026.
const usaMaxCompletion = (m: string) => !m.startsWith("gpt-4");

const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };

function segredoIgual(recebido: string | null, esperado: string) {
  if (!recebido || !esperado || recebido.length !== esperado.length) return false;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) diff |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s=200) => new Response(JSON.stringify(b), { status:s, headers:{...cors, "Content-Type":"application/json"} });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth:{persistSession:false} });
    const chamadaInterna = segredoIgual(req.headers.get("apikey"), serviceRoleKey);
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    let usuarioId: string | null = null;
    let corretorId: number | null = null;
    let perfil = "servico_interno";
    let usuarioAtivo = true;
    let userSupabase = supabase;
    if (!chamadaInterna) {
      const { data: authData, error: authError } = await supabase.auth.getUser(token);
      if (authError || !authData.user) return json({ok:false,reason:"sessao_invalida"},401);
      usuarioId = authData.user.id;
      userSupabase = createClient(supabaseUrl, anonKey, {
        auth:{persistSession:false}, global:{headers:{Authorization:`Bearer ${token}`}},
      });
      const [{ data: cor }, { data: usuario }] = await Promise.all([
        supabase.from("corretores").select("id").eq("usuario_id", usuarioId).maybeSingle(),
        supabase.from("usuarios").select("role,ativo").eq("id", usuarioId).maybeSingle(),
      ]);
      corretorId = cor?.id ?? null;
      perfil = String(usuario?.role ?? (corretorId ? "corretor" : "")).toLowerCase();
      usuarioAtivo = usuario?.ativo !== false;
    }
    const perfilFerramenta = perfil === "gerente" ? "gestor" : perfil;
    const podeVisaoGeral = chamadaInterna || perfil === "admin" || perfil === "gerente";
    const b = await req.json();
    let podeGerarNoStudio = false;
    if (!chamadaInterna && b.agente_slug === "social-media-apecerto") {
      const { data: permitido } = await userSupabase.rpc("social_has_permission", {
        p_action: "gerar",
        p_organization_id: "00000000-0000-4000-8000-000000000001",
      });
      podeGerarNoStudio = permitido === true;
    }
    if (!usuarioAtivo || (!corretorId && !podeVisaoGeral && !podeGerarNoStudio))
      return json({ok:false,reason:"perfil_operacional_nao_encontrado"},403);
    const action = b.action || "run";
    if (chamadaInterna && (action!=="run" || b.disable_tools!==true || b.agente_slug!=="sara"))
      return json({ok:false,reason:"chamada_interna_fora_do_contrato"},403);
    const slug = b.agente_slug || null, nome = b.agente_nome || null;
    let aq = supabase.from("agentes_ia").select("*");
    if (slug) aq = aq.eq("slug", slug); else if (nome) aq = aq.eq("nome", nome); else return json({ok:false,reason:"faltando agente"},400);
    const { data: agente, error: aErr } = await aq.maybeSingle();
    if (aErr || !agente) return json({ok:false,reason:"agente_nao_encontrado"},404);

    if (action==="get") return perfil === "admin"
      ? json({ ok:true, slug:agente.slug, nome:agente.nome, modelo:agente.modelo, system_prompt:agente.system_prompt||"", config:agente.config||{}, ativo:agente.ativo })
      : json({ok:false,reason:"sem_permissao"},403);
    if (action==="save") {
      if (perfil !== "admin") return json({ok:false,reason:"sem_permissao"},403);
      const { error } = await supabase.from("agentes_ia").update({ system_prompt: b.system_prompt ?? "" }).eq("id", agente.id);
      return error? json({ok:false,reason:"erro_salvar",detalhe:error.message},502) : json({ok:true});
    }
    if (action==="feedback") {
      const execucaoId = Number(b.execucao_id);
      const avaliacao = b.avaliacao === "util" ? "util" : b.avaliacao === "nao_util" ? "nao_util" : "";
      if (!Number.isSafeInteger(execucaoId) || !avaliacao) return json({ok:false,reason:"feedback_invalido"},422);
      const { data, error } = await userSupabase.rpc("ia_avaliar_execucao", { p_execucao_id:execucaoId, p_avaliacao:avaliacao });
      return error ? json({ok:false,reason:"erro_feedback",detalhe:error.message},502) : json(data);
    }

    const hasMessages = Array.isArray(b.messages) && b.messages.length>0;
    if (!b.input && !hasMessages) return json({ok:false,reason:"faltando input"},400);

    let apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) { const { data: sec } = await supabase.from("app_secrets").select("valor").eq("chave","OPENAI_API_KEY").maybeSingle(); apiKey = sec?.valor; }
    if (!apiKey) return json({ok:false,reason:"sem_chave"});

    // A versao anterior travava em gpt-4o: qualquer modelo novo cadastrado no
    // banco era silenciosamente trocado por gpt-4o-mini, e a troca nao pegava.
    const modelo = MODELOS_OK.has(agente.modelo) ? agente.modelo : MODELO_PADRAO;
    const cfg = agente.config || {};

    const fontesUsadas: {id:number;titulo:string;versao:string}[] = [];
    let conhecimento = "";
    const { data: links } = await supabase.from("agente_fonte_links").select("fonte_id").eq("agente_id", agente.id);
    const ids = (links||[]).map((l:{fonte_id:number})=>l.fonte_id);
    if (ids.length) {
      const { data: fontes } = await supabase.from("agente_fontes").select("id,titulo,versao,conteudo,situacao").in("id", ids).eq("situacao","aprovada");
      for (const f of (fontes||[])) { conhecimento += `\n\n### FONTE: ${f.titulo} (v${f.versao||"?"})\n${f.conteudo||""}`; fontesUsadas.push({id:f.id,titulo:f.titulo,versao:f.versao}); }
    }

    const { data: perms } = chamadaInterna
      ? { data: [] }
      : await supabase.from("agente_ferramenta_permissoes").select("ferramenta_id,habilitado,perfis_autorizados").eq("agente_id", agente.id).eq("habilitado", true);
    const permsDoPerfil = (perms||[]).filter((p:{perfis_autorizados?:string[]|null}) => {
      const perfis = Array.isArray(p.perfis_autorizados) ? p.perfis_autorizados : [];
      return perfis.length===0 || perfis.includes(perfil) || perfis.includes(perfilFerramenta);
    });
    const permIds = permsDoPerfil.map((p:{ferramenta_id:number})=>p.ferramenta_id);
    let toolSlugs: string[] = [];
    if (permIds.length) { const { data: ferr } = await supabase.from("agente_ferramentas").select("id,slug,tipo,ativo").in("id", permIds); toolSlugs = (ferr||[]).filter((f:{ativo:boolean})=>f.ativo).map((f:{slug:string})=>f.slug); }

    const TOOLDEFS: Record<string, any> = {
      "consultar-produtos": { type:"function", function:{ name:"consultar_produtos", description:"Busca UNIDADES/imoveis reais do catalogo (ao vivo) com tipologia, area, vagas, preco e empreendimento. Use para produtos, precos, disponibilidade. Nunca invente.", parameters:{ type:"object", properties:{ bairro:{type:"string"}, dormitorios_min:{type:"integer"}, valor_max:{type:"number"}, vagas_min:{type:"integer"}, texto:{type:"string"} } } } },
      "consultar-cliente": { type:"function", function:{ name:"consultar_cliente", description:"Localiza leads reais por nome ou telefone dentro do escopo permitido ao usuario. Pode retornar varias pessoas; se houver ambiguidade, mostre as opcoes e pergunte qual e, sem adivinhar.", parameters:{ type:"object", properties:{ texto:{type:"string"} }, required:["texto"] } } },
      "consultar-carteira": { type:"function", function:{ name:"consultar_carteira", description:"Carteira do corretor logado: resumo (atencao=amarelo 3-7d sem interacao, atrasados=vermelho 7d+, em_dia) e leads criticos. Use para carteira, pendencias, quem precisa de feedback/follow-up, o que fazer hoje.", parameters:{ type:"object", properties:{ filtro:{type:"string", enum:["atencao","atrasados","atencao_e_atraso","todos"] } } } } },
      "consultar-vendas": { type:"function", function:{ name:"consultar_vendas", description:"Vendas feitas: resumo (qtd, VGV total, VGV 30 dias) e ultimas vendas. Use para vendas/VGV/faturamento.", parameters:{ type:"object", properties:{} } } },
      "consultar-recebiveis": { type:"function", function:{ name:"consultar_recebiveis", description:"Valores a receber: comissoes do corretor e parcelas pendentes. Use para comissao, quanto vou receber.", parameters:{ type:"object", properties:{} } } },
      "consultar-lead": { type:"function", function:{ name:"consultar_lead", description:"Localiza e mostra a situacao operacional de leads reais pelo nome ou telefone. Se encontrar mais de um, nao escolha sozinho: apresente candidatos e peca a identificacao.", parameters:{ type:"object", properties:{ texto:{type:"string"} }, required:["texto"] } } },
      "avaliar-conversa": { type:"function", function:{ name:"avaliar_conversa", description:"Puxa as ultimas mensagens reais de WhatsApp de um lead ja identificado. Use quando pedirem para avaliar/analisar a conversa, dar nota ou ajudar a responder. Nunca leia conversa de outro corretor.", parameters:{ type:"object", properties:{ lead_id:{type:"string",description:"UUID retornado por consultar_lead"}, texto:{type:"string",description:"Nome ou telefone, usado apenas se ainda nao houver lead_id"} } } } },
      "estrutura-crm": { type:"function", function:{ name:"consultar_estrutura_crm", description:"Funis e etapas do CRM. Use para explicar como o CRM/funil funciona ou tirar duvidas sobre etapas.", parameters:{ type:"object", properties:{} } } },
      "mover-lead": { type:"function", function:{ name:"mover_lead", description:"Move um lead de etapa. Primeiro gere previa; confirme somente com o preview_id pendente e o sim explicito.", parameters:{ type:"object", properties:{ lead:{type:"string"}, etapa_destino:{type:"string"}, confirmar:{type:"boolean"}, preview_id:{type:"string"} }, required:["lead","etapa_destino"] } } },
      "criar-tarefa": { type:"function", function:{ name:"criar_tarefa", description:"Cria follow-up com data/hora exatas. Primeiro gere previa; confirme somente com o preview_id pendente.", parameters:{ type:"object", properties:{ lead:{type:"string"}, lead_id:{type:"string"}, titulo:{type:"string"}, vencimento_em:{type:"string"}, confirmar:{type:"boolean"}, preview_id:{type:"string"} }, required:["titulo","vencimento_em"] } } },
      "registrar-feedback": { type:"function", function:{ name:"registrar_feedback", description:"Registra anotacao no historico. Primeiro gere previa; confirme somente com o preview_id pendente.", parameters:{ type:"object", properties:{ lead:{type:"string"}, texto:{type:"string"}, confirmar:{type:"boolean"}, preview_id:{type:"string"} }, required:["lead","texto"] } } },
      "agendar-visita": { type:"function", function:{ name:"agendar_visita", description:"Agenda visita na Agenda canonica, checa conflito e atualiza o Funil 2.0. Exige lead, imovel e data/hora exatas. Primeiro gere previa; confirme somente com o preview_id pendente.", parameters:{ type:"object", properties:{ lead:{type:"string"}, lead_id:{type:"string"}, inicio_em:{type:"string"}, fim_em:{type:"string"}, imovel:{type:"string"}, observacao:{type:"string"}, confirmar:{type:"boolean"}, preview_id:{type:"string"} }, required:["inicio_em","imovel"] } } },
      "consultar-agenda": { type:"function", function:{ name:"consultar_agenda", description:"Localiza visitas reais por cliente, imovel ou ID no escopo do usuario.", parameters:{ type:"object", properties:{ busca:{type:"string"} } } } },
      "alterar-visita": { type:"function", function:{ name:"alterar_visita", description:"Reagenda ou cancela uma visita real. Localize uma unica visita, preserve dados nao alterados, cheque conflito e use previa exata.", parameters:{ type:"object", properties:{ busca:{type:"string"}, visita_id:{type:"string"}, novo_inicio_em:{type:"string"}, novo_fim_em:{type:"string"}, novo_status:{type:"string",enum:["agendada","confirmada","cancelada"]}, motivo:{type:"string"}, confirmar:{type:"boolean"}, preview_id:{type:"string"} }, required:["novo_status"] } } },
      "desfazer-acao": { type:"function", function:{ name:"desfazer_acao", description:"Desfaz a ultima acao de visita feita pela Sara dentro de 30 minutos, sempre com previa exata.", parameters:{ type:"object", properties:{ confirmar:{type:"boolean"}, preview_id:{type:"string"} } } } },
      "enviar-whatsapp": { type:"function", function:{ name:"enviar_whatsapp", description:"Envia uma mensagem de texto REAL pelo WhatsApp oficial. Exige lead inequivoco, texto final e previa exata. O retorno de envio nao equivale a entrega; use consultar_comprovante_whatsapp.", parameters:{ type:"object", properties:{ lead:{type:"string"}, lead_id:{type:"string"}, texto:{type:"string"}, confirmar:{type:"boolean"}, preview_id:{type:"string"} }, required:["texto"] } } },
      "comprovante-whatsapp": { type:"function", function:{ name:"consultar_comprovante_whatsapp", description:"Consulta o status real de uma mensagem pelo ID devolvido no envio. Apenas entregue ou lida valem como comprovante.", parameters:{ type:"object", properties:{ lead:{type:"string"}, lead_id:{type:"string"}, message_id:{type:"string"} }, required:["message_id"] } } }
    };
    const tools = b.disable_tools===true ? [] : toolSlugs.filter(s=>TOOLDEFS[s]).map(s=>TOOLDEFS[s]);
    const nameToSlug: Record<string,string> = { consultar_produtos:"consultar-produtos", consultar_cliente:"consultar-cliente", consultar_carteira:"consultar-carteira", consultar_vendas:"consultar-vendas", consultar_recebiveis:"consultar-recebiveis", consultar_lead:"consultar-lead", avaliar_conversa:"avaliar-conversa", consultar_estrutura_crm:"estrutura-crm", mover_lead:"mover-lead", criar_tarefa:"criar-tarefa", registrar_feedback:"registrar-feedback", agendar_visita:"agendar-visita", consultar_agenda:"consultar-agenda", alterar_visita:"alterar-visita", desfazer_acao:"desfazer-acao", enviar_whatsapp:"enviar-whatsapp", consultar_comprovante_whatsapp:"comprovante-whatsapp" };

    async function localizarLead(args:any) {
      const textoLead = String(args?.lead_id || args?.lead || args?.texto || args?.nome || args?.telefone || "").trim();
      if (!textoLead) return { ok:false, erro:"informe_nome_telefone_ou_id", encontrados:0, candidatos:[] };
      const { data, error } = await supabase.rpc("ia_localizar_leads_seguro", {
        p_usuario_id:usuarioId, p_texto:textoLead, p_limite:5,
      });
      if (error) return { ok:false, erro:error.message, encontrados:0, candidatos:[] };
      return data as {ok?:boolean;erro?:string;encontrados?:number;ambigua?:boolean;candidatos?:any[]};
    }

    async function leadUnico(args:any) {
      const busca = await localizarLead(args);
      const candidatos = Array.isArray(busca.candidatos) ? busca.candidatos : [];
      if (candidatos.length!==1) return { busca, lead:null };
      return { busca, lead:candidatos[0] };
    }

    async function criarPrevia(acao:string, payload:Record<string,unknown>, exibicao:Record<string,unknown>) {
      const { data, error } = await supabase.rpc("ia_criar_previa_segura", {
        p_usuario_id:usuarioId,p_agente_id:agente.id,p_acao:acao,p_payload:payload,
      });
      if (error || !(data as any)?.ok) return {ok:false,erro:error?.message || (data as any)?.erro || "falha_criar_previa"};
      return {ok:true,preview:true,preview_id:(data as any).preview_id,expira_em:(data as any).expira_em,...exibicao};
    }

    async function consumirPrevia(acao:string, payload:Record<string,unknown>, args:any) {
      const previewId = String(args?.preview_id || b.pending_preview_id || "").trim();
      if (!previewId) return {ok:false,erro:"preview_id_obrigatorio"};
      const { data, error } = await supabase.rpc("ia_consumir_previa_segura", {
        p_usuario_id:usuarioId,p_preview_id:previewId,p_acao:acao,p_payload:payload,
      });
      if (error || !(data as any)?.ok) return {ok:false,erro:error?.message || (data as any)?.erro || "previa_invalida"};
      return {ok:true,preview_id:previewId};
    }

    async function auditarAcao(acao:string, entidadeId:string|null, antes:unknown, depois:unknown) {
      await supabase.from("sara_acoes_audit").insert({
        usuario_id:usuarioId,agente_id:agente.id,acao,entidade:"visita",entidade_id:entidadeId,antes,depois,
      });
    }

    async function runTool(fnName:string, args:any) {
      if (fnName==="consultar_produtos") { const { data, error } = await supabase.rpc("ia_buscar_unidades", { p_dormitorios: args.dormitorios_min ?? args.dormitorios ?? null, p_valor_max: args.valor_max ?? null, p_vagas_min: args.vagas_min ?? null, p_bairro: args.bairro ?? null, p_texto: args.texto ?? null, p_limite: 8 }); if (error) return { encontrados:0, imoveis:[], erro:error.message }; return { encontrados:(data||[]).length, imoveis:data||[] }; }
      if (fnName==="consultar_cliente") return localizarLead(args);
      if (fnName==="consultar_carteira") { const { data, error } = await supabase.rpc("ia_carteira", { p_corretor_id: corretorId, p_filtro: args.filtro || "atencao_e_atraso", p_limite: 12 }); if (error) return { encontrados:0, erro:error.message }; return { encontrados:(data?.leads||[]).length, ...data }; }
      if (fnName==="consultar_vendas") { const { data, error } = await supabase.rpc("ia_vendas", { p_corretor_id: corretorId, p_limite: 8 }); if (error) return { encontrados:0, erro:error.message }; return { encontrados:(data?.vendas||[]).length, ...data }; }
      if (fnName==="consultar_recebiveis") { const { data, error } = await supabase.rpc("ia_recebiveis", { p_corretor_id: corretorId }); if (error) return { encontrados:0, erro:error.message }; return { encontrados: data?.comissoes_qtd ?? 0, ...data }; }
      if (fnName==="consultar_lead") return localizarLead(args);
      if (fnName==="avaliar_conversa") {
        const { busca, lead } = await leadUnico(args);
        if (!lead) return busca;
        const { data, error } = await supabase.rpc("ia_conversa_segura", { p_usuario_id:usuarioId, p_funil_lead_id:lead.id, p_limite:12 });
        if (error) return { encontrados:0, erro:error.message };
        return { encontrados:(data?.mensagens||[]).length, ...data };
      }
      if (fnName==="consultar_estrutura_crm") { const { data, error } = await supabase.rpc("ia_estrutura_funil2"); if (error) return { encontrados:0, erro:error.message }; return { encontrados:(data?.momentos||[]).length, ...data }; }
      if (fnName==="mover_lead") {
        const { data: previaBase, error: pErr } = await supabase.rpc("ia_mover_lead", { p_corretor_id:corretorId,p_texto_lead:args.lead||"",p_etapa_destino:args.etapa_destino||"",p_confirmar:false });
        if (pErr || !(previaBase as any)?.ok) return {ok:false,erro:pErr?.message || (previaBase as any)?.erro};
        const payload = {lead:(previaBase as any).lead || args.lead,etapa_origem:(previaBase as any).etapa_origem || null,etapa_destino:args.etapa_destino};
        if (args.confirmar!==true) return criarPrevia("mover_lead",payload,previaBase as any);
        const validada = await consumirPrevia("mover_lead",payload,args); if (!validada.ok) return validada;
        const { data, error } = await supabase.rpc("ia_mover_lead", { p_corretor_id:corretorId,p_texto_lead:args.lead||"",p_etapa_destino:args.etapa_destino||"",p_confirmar:true });
        if (error) return {ok:false,erro:error.message}; return data;
      }
      if (fnName==="criar_tarefa") {
        const { busca, lead } = await leadUnico(args);
        if (!lead) return busca;
        const params = {
          p_usuario_id:usuarioId, p_funil_lead_id:lead.id, p_titulo:args.titulo || "",
          p_vencimento_em:args.vencimento_em || null, p_confirmar:false,
        };
        const { data:previaBase,error:pErr } = await supabase.rpc("ia_criar_tarefa_v2",params);
        if (pErr || !(previaBase as any)?.ok) return {ok:false,erro:pErr?.message || (previaBase as any)?.erro};
        const payload={lead_id:lead.id,titulo:(previaBase as any).titulo,vencimento:(previaBase as any).vencimento};
        if(args.confirmar!==true) return criarPrevia("criar_tarefa",payload,previaBase as any);
        const validada=await consumirPrevia("criar_tarefa",payload,args); if(!validada.ok)return validada;
        const {data,error}=await supabase.rpc("ia_criar_tarefa_v2",{...params,p_confirmar:true});
        if(error)return {ok:false,erro:error.message}; return data;
      }
      if (fnName==="registrar_feedback") {
        const params={p_corretor_id:corretorId,p_texto_lead:args.lead||"",p_texto:args.texto||"",p_confirmar:false};
        const {data:previaBase,error:pErr}=await supabase.rpc("ia_registrar_feedback",params);
        if(pErr || !(previaBase as any)?.ok)return {ok:false,erro:pErr?.message || (previaBase as any)?.erro};
        const payload={lead:(previaBase as any).lead || args.lead,texto:args.texto};
        if(args.confirmar!==true)return criarPrevia("registrar_feedback",payload,previaBase as any);
        const validada=await consumirPrevia("registrar_feedback",payload,args);if(!validada.ok)return validada;
        const {data,error}=await supabase.rpc("ia_registrar_feedback",{...params,p_confirmar:true});
        if(error)return {ok:false,erro:error.message};return data;
      }
      if (fnName==="agendar_visita") {
        const { busca, lead } = await leadUnico(args);
        if (!lead) return busca;
        const inicio = typeof args.inicio_em==="string" ? new Date(args.inicio_em) : null;
        const fim = typeof args.fim_em==="string" && args.fim_em ? new Date(args.fim_em) : null;
        const imovel = String(args.imovel || "").trim();
        if (!inicio || Number.isNaN(inicio.getTime()) || inicio.getTime()<=Date.now()) return {ok:false,erro:"data_hora_exata_futura_obrigatoria"};
        if (fim && (Number.isNaN(fim.getTime()) || fim.getTime()<=inicio.getTime())) return {ok:false,erro:"horario_final_invalido"};
        if (imovel.length<2) return {ok:false,erro:"imovel_obrigatorio"};
        const payload={lead_id:lead.id,inicio_em:inicio.toISOString(),fim_em:fim?.toISOString()||null,imovel:imovel.slice(0,120),observacao:String(args.observacao||"").slice(0,500)||null};
        const {data:conflitos,error:cErr}=await supabase.rpc("ia_conflitos_visita_seguro",{p_usuario_id:usuarioId,p_funil_lead_id:lead.id,p_inicio_em:payload.inicio_em,p_fim_em:payload.fim_em,p_excluir:null});
        if(cErr)return {ok:false,erro:cErr.message}; if((conflitos as any)?.conflito)return {ok:false,erro:"conflito_de_agenda",...(conflitos as any)};
        if (args.confirmar!==true) return criarPrevia("agendar_visita",payload,{cliente:lead.cliente,...payload});
        const validada=await consumirPrevia("agendar_visita",payload,args);if(!validada.ok)return validada;
        const { data, error } = await userSupabase.rpc("f2_salvar_visita", {
          p_id:null,p_lead_id:lead.id,p_inicio_em:inicio.toISOString(),p_fim_em:fim?.toISOString()||null,
          p_imovel:imovel.slice(0,120),p_status:"agendada",p_observacao:String(args.observacao||"").slice(0,500)||null,
          p_empreendimento_id:null,p_unidade:null,p_com_gerente:false,p_gerente_id:null,
        });
        if (error) return {ok:false,erro:error.message};
        const visitaId=String((data as any)?.visita_id || (data as any)?.id || "");
        await auditarAcao("agendar_visita",visitaId||null,null,{...payload,visita_id:visitaId||null});
        return {...(data||{}),executado:(data as any)?.ok===true,cliente:lead.cliente};
      }
      if(fnName==="consultar_agenda"){
        const {data,error}=await supabase.rpc("ia_localizar_visitas_seguro",{p_usuario_id:usuarioId,p_texto:args.busca||null,p_limite:8});
        if(error)return {ok:false,erro:error.message};return data;
      }
      if(fnName==="alterar_visita"){
        const busca=String(args.visita_id || args.busca || "").trim();
        const {data:lista,error:lErr}=await supabase.rpc("ia_localizar_visitas_seguro",{p_usuario_id:usuarioId,p_texto:busca||null,p_limite:8});
        if(lErr)return {ok:false,erro:lErr.message};
        const visitas=Array.isArray((lista as any)?.visitas)?(lista as any).visitas:[];
        if(visitas.length!==1)return {...(lista as any),ok:false,erro:visitas.length?"visita_ambigua":"visita_nao_encontrada"};
        const atual=visitas[0]; const status=String(args.novo_status||atual.status);
        const inicio=args.novo_inicio_em?new Date(args.novo_inicio_em):new Date(atual.inicio_em);
        const fim=args.novo_fim_em?new Date(args.novo_fim_em):(atual.fim_em?new Date(atual.fim_em):null);
        if(Number.isNaN(inicio.getTime()) || (fim && (Number.isNaN(fim.getTime()) || fim.getTime()<=inicio.getTime())))return {ok:false,erro:"horario_invalido"};
        if(!["agendada","confirmada","cancelada"].includes(status))return {ok:false,erro:"status_invalido"};
        const payload={visita_id:atual.id,lead_id:atual.funil_lead_id,inicio_em:inicio.toISOString(),fim_em:fim?.toISOString()||null,imovel:atual.imovel,status,observacao:String(args.motivo||atual.observacao||"").slice(0,500)||null,empreendimento_id:atual.empreendimento_id||null,unidade:atual.unidade||null,com_gerente:atual.com_gerente===true,gerente_id:atual.gerente_id||null};
        if(status!=="cancelada"){const {data:conf,error:cErr}=await supabase.rpc("ia_conflitos_visita_seguro",{p_usuario_id:usuarioId,p_funil_lead_id:payload.lead_id,p_inicio_em:payload.inicio_em,p_fim_em:payload.fim_em,p_excluir:payload.visita_id});if(cErr)return {ok:false,erro:cErr.message};if((conf as any)?.conflito)return {ok:false,erro:"conflito_de_agenda",...(conf as any)};}
        if(args.confirmar!==true)return criarPrevia("alterar_visita",payload,{cliente:atual.cliente,...payload});
        const validada=await consumirPrevia("alterar_visita",payload,args);if(!validada.ok)return validada;
        const {data,error}=await userSupabase.rpc("f2_salvar_visita",{p_id:payload.visita_id,p_lead_id:payload.lead_id,p_inicio_em:payload.inicio_em,p_fim_em:payload.fim_em,p_imovel:payload.imovel,p_status:payload.status,p_observacao:payload.observacao,p_empreendimento_id:payload.empreendimento_id,p_unidade:payload.unidade,p_com_gerente:payload.com_gerente,p_gerente_id:payload.gerente_id});
        if(error)return {ok:false,erro:error.message};
        await auditarAcao("alterar_visita",payload.visita_id,atual,payload);
        return {...(data||{}),executado:(data as any)?.ok===true,cliente:atual.cliente};
      }
      if(fnName==="desfazer_acao"){
        const {data:audit,error:aErr}=await supabase.from("sara_acoes_audit").select("*").eq("usuario_id",usuarioId).eq("entidade","visita").eq("status","executada").gt("desfazivel_ate",new Date().toISOString()).order("criado_em",{ascending:false}).limit(1).maybeSingle();
        if(aErr || !audit)return {ok:false,erro:aErr?.message || "nenhuma_acao_desfazivel"};
        const payload={audit_id:audit.id,acao_original:audit.acao,entidade_id:audit.entidade_id};
        if(args.confirmar!==true)return criarPrevia("desfazer_acao",payload,{acao_original:audit.acao,criado_em:audit.criado_em});
        const validada=await consumirPrevia("desfazer_acao",payload,args);if(!validada.ok)return validada;
        const alvo=(audit.antes || audit.depois) as any;
        if(!alvo?.lead_id && !alvo?.funil_lead_id)return {ok:false,erro:"snapshot_incompleto"};
        const cancelar=!audit.antes;
        const {data,error}=await userSupabase.rpc("f2_salvar_visita",{p_id:audit.entidade_id,p_lead_id:alvo.lead_id||alvo.funil_lead_id,p_inicio_em:alvo.inicio_em,p_fim_em:alvo.fim_em||null,p_imovel:alvo.imovel,p_status:cancelar?"cancelada":alvo.status,p_observacao:cancelar?"Desfeita pela Sara":alvo.observacao||null,p_empreendimento_id:alvo.empreendimento_id||null,p_unidade:alvo.unidade||null,p_com_gerente:alvo.com_gerente===true,p_gerente_id:alvo.gerente_id||null});
        if(error)return {ok:false,erro:error.message};
        await supabase.from("sara_acoes_audit").update({status:"desfeita",desfeita_em:new Date().toISOString()}).eq("id",audit.id);
        return {...(data||{}),executado:true,acao_desfeita:audit.acao};
      }
      if(fnName==="enviar_whatsapp"){
        const {busca,lead}=await leadUnico(args);if(!lead)return busca;
        const texto=String(args.texto||"").trim();if(texto.length<1 || texto.length>1500)return {ok:false,erro:"texto_invalido"};
        const {data:dest,error:dErr}=await supabase.rpc("ia_destino_whatsapp_seguro",{p_usuario_id:usuarioId,p_funil_lead_id:lead.id});
        if(dErr || !(dest as any)?.ok)return {ok:false,erro:dErr?.message || (dest as any)?.erro};
        const payload={lead_id:lead.id,cliente:lead.cliente,telefone_mascarado:(dest as any).telefone_mascarado,texto};
        if(args.confirmar!==true)return criarPrevia("enviar_whatsapp",payload,payload);
        const validada=await consumirPrevia("enviar_whatsapp",payload,args);if(!validada.ok)return validada;
        const wr=await fetch(supabaseUrl+"/functions/v1/dapi-enviar",{method:"POST",headers:{Authorization:authHeader,apikey:anonKey,"Content-Type":"application/json"},body:JSON.stringify({to:(dest as any).telefone,tipo:"text",texto})});
        const wd=await wr.json().catch(()=>({}));
        if(!wr.ok || !wd?.ok)return {ok:false,erro:wd?.motivo || wd?.error || "falha_envio_whatsapp"};
        return {ok:true,executado:true,cliente:lead.cliente,telefone_mascarado:(dest as any).telefone_mascarado,message_id:wd.messageId,status:"enviado_aguardando_confirmacao",proximo_passo:"Use consultar_comprovante_whatsapp para confirmar entrega ou leitura."};
      }
      if(fnName==="consultar_comprovante_whatsapp"){
        const {busca,lead}=await leadUnico(args);if(!lead)return busca;
        const {data,error}=await supabase.rpc("ia_comprovante_whatsapp_seguro",{p_usuario_id:usuarioId,p_funil_lead_id:lead.id,p_message_id:String(args.message_id||"")});
        if(error)return {ok:false,erro:error.message};return data;
      }
      return { erro:"ferramenta_desconhecida" };
    }

    const agoraSaoPaulo = new Intl.DateTimeFormat("pt-BR", {
      timeZone:"America/Sao_Paulo", dateStyle:"full", timeStyle:"long",
    }).format(new Date());
    const systemPrompt = (b.override_prompt || agente.system_prompt || "") +
      (conhecimento ? `\n\n=== BASE DE CONHECIMENTO (use como verdade; nunca contradiga) ===${conhecimento}` : "") +
      `\n\n=== CONTEXTO DA SESSAO ===\nAgora em America/Sao_Paulo: ${agoraSaoPaulo}. Perfil: ${perfil}. ` +
      "Entenda datas relativas nesse fuso. Nunca escolha sozinho uma hora vaga como 'de tarde': pergunte o horario exato. " +
      (tools.length ? "\n\n=== FERRAMENTAS ===\nConsulte dados reais antes de responder. Acoes de escrita sempre usam previa exata, de uso unico: primeiro confirmar=false; depois confirmar=true somente apos sim explicito. Preserve o preview_id retornado. Uma confirmacao antiga, expirada, ja usada ou de payload diferente nunca vale. A agenda permite consultar, reagendar e cancelar; conflito bloqueia a gravacao. WhatsApp so e entregue/lido quando consultar_comprovante_whatsapp comprovar; apenas o envio nao e comprovante. Desfazer exige nova previa." : "") +
      (corretorId || chamadaInterna ? "" : "\n\nEste perfil tem visao gerencial autorizada; deixe claro quando a resposta usar o escopo geral.");

    const baseMsgs: any[] = hasMessages
      ? [{role:"system",content:systemPrompt}, ...b.messages.slice(-14).map((m:{role:string;content:string})=>({role:m.role==="user"?"user":"assistant", content:String(m.content).slice(0,4000)}))]
      : [{role:"system",content:systemPrompt},{role:"user",content: typeof b.input==="string"?b.input:JSON.stringify(b.input)}];

    const ferramentasUsadas: {ferramenta:string;args:any;encontrados:number}[] = [];
    const previewsGeradas: {preview_id:string;acao:string;expira_em?:string}[] = [];
    let tin=0, tout=0; const t0=Date.now();
    let messages = baseMsgs; let finalText="";
    const limite = cfg.max_tokens ?? 800;
    for (let round=0; round<4; round++) {
      const body:any = { model:modelo, messages };
      if (modelo.startsWith("gpt-5.6")) {
        const esforcos = new Set(["none","low","medium","high","xhigh","max"]);
        // Chat Completions rejeita ferramentas + reasoning_effort diferente de
        // "none" no gpt-5.6-sol. Sem ferramentas, preservamos a configuracao.
        body.reasoning_effort = tools.length
          ? "none"
          : (esforcos.has(cfg.reasoning_effort) ? cfg.reasoning_effort : "low");
      } else {
        body.temperature = cfg.temperatura ?? 0.5;
      }
      if (usaMaxCompletion(modelo)) body.max_completion_tokens = limite; else body.max_tokens = limite;
      if (tools.length) { body.tools = tools; body.tool_choice = "auto"; }
      const resp = await fetch("https://api.openai.com/v1/chat/completions", { method:"POST", headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"}, body:JSON.stringify(body) });
      const data = await resp.json();
      if (!resp.ok) { await supabase.from("agente_execucoes").insert({ agente_id:agente.id, agente_slug:agente.slug, entrada:{input:b.input,messages:b.messages}, saida:data, modelo, status:"erro", erro:data?.error?.message }); return json({ok:false,reason:"erro_openai",detalhe:data?.error?.message},502); }
      tin += data.usage?.prompt_tokens ?? 0; tout += data.usage?.completion_tokens ?? 0;
      const msg = data.choices?.[0]?.message;
      if (msg?.tool_calls?.length) {
        messages = [...messages, msg];
        for (const tc of msg.tool_calls) {
          let args:any={}; try { args = JSON.parse(tc.function.arguments||"{}"); } catch {}
          const result = await runTool(tc.function.name, args);
          if ((result as any)?.preview===true && (result as any)?.preview_id) previewsGeradas.push({preview_id:String((result as any).preview_id),acao:nameToSlug[tc.function.name]||tc.function.name,expira_em:(result as any).expira_em});
          ferramentasUsadas.push({ ferramenta: nameToSlug[tc.function.name]||tc.function.name, args, encontrados:(result as any).encontrados ?? 0 });
          messages.push({ role:"tool", tool_call_id: tc.id, content: JSON.stringify(result) });
        }
        continue;
      }
      finalText = msg?.content ?? ""; break;
    }

    const p = PRICES[modelo] || PRICES[MODELO_PADRAO]; const custo = (tin/1e6)*p.in + (tout/1e6)*p.out;
    let saida:unknown = finalText; try { saida = JSON.parse(finalText); } catch {}
    const { data: exec } = await supabase.from("agente_execucoes").insert({ agente_id:agente.id, agente_slug:agente.slug, agente_versao:agente.versao_atual, entrada:{input:b.input,messages:b.messages}, saida, modelo, tokens_entrada:tin, tokens_saida:tout, custo_usd:custo, status:"ok", fontes_consultadas: fontesUsadas, ferramentas_acionadas: ferramentasUsadas, latencia_ms: Date.now()-t0, usuario:usuarioId, tela:typeof b.tela==="string"?b.tela.slice(0,120):null }).select("id").maybeSingle();

    return json({ ok:true, execucao_id: exec?.id ?? null, agente:agente.slug, corretor_id:corretorId, resposta:finalText, saida, pending_preview_id:previewsGeradas.at(-1)?.preview_id ?? null, previews:previewsGeradas, tokens:{entrada:tin,saida:tout}, custo_usd:Number(custo.toFixed(6)), ms:Date.now()-t0, fontes:fontesUsadas.map(f=>f.titulo), ferramentas:ferramentasUsadas });
  } catch (e) { return json({ok:false,reason:"excecao",detalhe:String(e)},500); }
});
