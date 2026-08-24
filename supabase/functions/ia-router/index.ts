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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s=200) => new Response(JSON.stringify(b), { status:s, headers:{...cors, "Content-Type":"application/json"} });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth:{persistSession:false} });
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return json({ok:false,reason:"sessao_invalida"},401);
    const usuarioId = authData.user.id;
    const userSupabase = createClient(supabaseUrl, anonKey, {
      auth:{persistSession:false}, global:{headers:{Authorization:`Bearer ${token}`}},
    });
    const [{ data: cor }, { data: usuario }] = await Promise.all([
      supabase.from("corretores").select("id").eq("usuario_id", usuarioId).maybeSingle(),
      supabase.from("usuarios").select("role,ativo").eq("id", usuarioId).maybeSingle(),
    ]);
    const corretorId: number | null = cor?.id ?? null;
    const perfil = String(usuario?.role ?? (corretorId ? "corretor" : "")).toLowerCase();
    const perfilFerramenta = perfil === "gerente" ? "gestor" : perfil;
    const podeVisaoGeral = perfil === "admin" || perfil === "gerente";
    if (usuario?.ativo === false || (!corretorId && !podeVisaoGeral))
      return json({ok:false,reason:"perfil_operacional_nao_encontrado"},403);
    const b = await req.json();
    const action = b.action || "run";
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

    const { data: perms } = await supabase.from("agente_ferramenta_permissoes").select("ferramenta_id,habilitado,perfis_autorizados").eq("agente_id", agente.id).eq("habilitado", true);
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
      "mover-lead": { type:"function", function:{ name:"mover_lead", description:"Move um lead de etapa. FLUXO: confirmar=false para preview (de/para), peca confirmacao; so confirmar=true apos o sim. So leads do proprio corretor.", parameters:{ type:"object", properties:{ lead:{type:"string"}, etapa_destino:{type:"string"}, confirmar:{type:"boolean"} }, required:["lead","etapa_destino"] } } },
      "criar-tarefa": { type:"function", function:{ name:"criar_tarefa", description:"Cria uma tarefa de follow-up para um lead em data e hora exatas. FLUXO: localizar o lead; se ambiguo, perguntar; exigir horario exato; confirmar=false para previa; confirmar=true somente depois do sim explicito.", parameters:{ type:"object", properties:{ lead:{type:"string"}, lead_id:{type:"string"}, titulo:{type:"string",description:"o que fazer"}, vencimento_em:{type:"string",description:"ISO 8601 com fuso, por exemplo 2026-08-25T15:00:00-03:00"}, confirmar:{type:"boolean"} }, required:["titulo","vencimento_em"] } } },
      "registrar-feedback": { type:"function", function:{ name:"registrar_feedback", description:"Registra uma anotacao/feedback no historico de um lead. FLUXO: confirmar=false para preview, peca confirmacao; so confirmar=true apos o sim. So no proprio lead.", parameters:{ type:"object", properties:{ lead:{type:"string"}, texto:{type:"string"}, confirmar:{type:"boolean"} }, required:["lead","texto"] } } },
      "agendar-visita": { type:"function", function:{ name:"agendar_visita", description:"Agenda uma visita REAL na Agenda canonica e atualiza o Funil 2.0. Exige lead sem ambiguidade, imovel e data/hora exatas. Nunca escolha um horario que o corretor nao informou. FLUXO: confirmar=false para previa; confirmar=true somente apos o sim explicito.", parameters:{ type:"object", properties:{ lead:{type:"string"}, lead_id:{type:"string"}, inicio_em:{type:"string",description:"ISO 8601 com fuso America/Sao_Paulo"}, fim_em:{type:"string",description:"ISO 8601 opcional"}, imovel:{type:"string"}, observacao:{type:"string"}, confirmar:{type:"boolean"} }, required:["inicio_em","imovel"] } } }
    };
    const tools = b.disable_tools===true ? [] : toolSlugs.filter(s=>TOOLDEFS[s]).map(s=>TOOLDEFS[s]);
    const nameToSlug: Record<string,string> = { consultar_produtos:"consultar-produtos", consultar_cliente:"consultar-cliente", consultar_carteira:"consultar-carteira", consultar_vendas:"consultar-vendas", consultar_recebiveis:"consultar-recebiveis", consultar_lead:"consultar-lead", avaliar_conversa:"avaliar-conversa", consultar_estrutura_crm:"estrutura-crm", mover_lead:"mover-lead", criar_tarefa:"criar-tarefa", registrar_feedback:"registrar-feedback", agendar_visita:"agendar-visita" };

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
      if (fnName==="mover_lead") { const { data, error } = await supabase.rpc("ia_mover_lead", { p_corretor_id: corretorId, p_texto_lead: args.lead || "", p_etapa_destino: args.etapa_destino || "", p_confirmar: args.confirmar===true }); if (error) return { ok:false, erro:error.message }; return data; }
      if (fnName==="criar_tarefa") {
        const { busca, lead } = await leadUnico(args);
        if (!lead) return busca;
        const { data, error } = await supabase.rpc("ia_criar_tarefa_v2", {
          p_usuario_id:usuarioId, p_funil_lead_id:lead.id, p_titulo:args.titulo || "",
          p_vencimento_em:args.vencimento_em || null, p_confirmar:args.confirmar===true,
        });
        if (error) return { ok:false, erro:error.message };
        return data;
      }
      if (fnName==="registrar_feedback") { const { data, error } = await supabase.rpc("ia_registrar_feedback", { p_corretor_id: corretorId, p_texto_lead: args.lead || "", p_texto: args.texto || "", p_confirmar: args.confirmar===true }); if (error) return { ok:false, erro:error.message }; return data; }
      if (fnName==="agendar_visita") {
        const { busca, lead } = await leadUnico(args);
        if (!lead) return busca;
        const inicio = typeof args.inicio_em==="string" ? new Date(args.inicio_em) : null;
        const fim = typeof args.fim_em==="string" && args.fim_em ? new Date(args.fim_em) : null;
        const imovel = String(args.imovel || "").trim();
        if (!inicio || Number.isNaN(inicio.getTime()) || inicio.getTime()<=Date.now()) return {ok:false,erro:"data_hora_exata_futura_obrigatoria"};
        if (fim && (Number.isNaN(fim.getTime()) || fim.getTime()<=inicio.getTime())) return {ok:false,erro:"horario_final_invalido"};
        if (imovel.length<2) return {ok:false,erro:"imovel_obrigatorio"};
        const previa = {ok:true,preview:true,cliente:lead.cliente,inicio_em:inicio.toISOString(),fim_em:fim?.toISOString()||null,imovel};
        if (args.confirmar!==true) return previa;
        const { data, error } = await userSupabase.rpc("f2_salvar_visita", {
          p_id:null,p_lead_id:lead.id,p_inicio_em:inicio.toISOString(),p_fim_em:fim?.toISOString()||null,
          p_imovel:imovel.slice(0,120),p_status:"agendada",p_observacao:String(args.observacao||"").slice(0,500)||null,
          p_empreendimento_id:null,p_unidade:null,p_com_gerente:false,p_gerente_id:null,
        });
        if (error) return {ok:false,erro:error.message};
        return {...(data||{}),executado:(data as any)?.ok===true,cliente:lead.cliente};
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
      (tools.length ? "\n\n=== FERRAMENTAS ===\nVoce PODE e DEVE consultar dados reais do ERP antes de responder sobre produtos, clientes, carteira, vendas, recebiveis, um lead, uma conversa ou a estrutura do CRM. NUNCA invente; se a busca retornar mais de um lead, mostre opcoes seguras e pergunte qual e. Acoes de escrita (mover, criar tarefa, registrar feedback, agendar visita) sempre em 2 passos: primeiro previa com confirmar=false; depois execucao com confirmar=true somente apos um sim explicito para aquela previa. Visita exige lead inequivoco, imovel, data e hora exatas." : "") +
      (corretorId ? "" : "\n\nEste perfil tem visao gerencial autorizada; deixe claro quando a resposta usar o escopo geral.");

    const baseMsgs: any[] = hasMessages
      ? [{role:"system",content:systemPrompt}, ...b.messages.slice(-14).map((m:{role:string;content:string})=>({role:m.role==="user"?"user":"assistant", content:String(m.content).slice(0,4000)}))]
      : [{role:"system",content:systemPrompt},{role:"user",content: typeof b.input==="string"?b.input:JSON.stringify(b.input)}];

    const ferramentasUsadas: {ferramenta:string;args:any;encontrados:number}[] = [];
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
          ferramentasUsadas.push({ ferramenta: nameToSlug[tc.function.name]||tc.function.name, args, encontrados:(result as any).encontrados ?? 0 });
          messages.push({ role:"tool", tool_call_id: tc.id, content: JSON.stringify(result) });
        }
        continue;
      }
      finalText = msg?.content ?? ""; break;
    }

    const p = PRICES[modelo] || PRICES[MODELO_PADRAO]; const custo = (tin/1e6)*p.in + (tout/1e6)*p.out;
    let saida:unknown = finalText; try { saida = JSON.parse(finalText); } catch {}
    const { data: exec } = await supabase.from("agente_execucoes").insert({ agente_id:agente.id, agente_slug:agente.slug, agente_versao:agente.versao_atual, entrada:{input:b.input,messages:b.messages}, saida, modelo, tokens_entrada:tin, tokens_saida:tout, custo_usd:custo, status:"ok", fontes_consultadas: fontesUsadas, ferramentas_acionadas: ferramentasUsadas, latencia_ms: Date.now()-t0 }).select("id").maybeSingle();

    return json({ ok:true, execucao_id: exec?.id ?? null, agente:agente.slug, corretor_id:corretorId, resposta:finalText, saida, tokens:{entrada:tin,saida:tout}, custo_usd:Number(custo.toFixed(6)), ms:Date.now()-t0, fontes:fontesUsadas.map(f=>f.titulo), ferramentas:ferramentasUsadas });
  } catch (e) { return json({ok:false,reason:"excecao",detalhe:String(e)},500); }
});
