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
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const b = await req.json();
    const action = b.action || "run";
    const slug = b.agente_slug || null, nome = b.agente_nome || null;
    let aq = supabase.from("agentes_ia").select("*");
    if (slug) aq = aq.eq("slug", slug); else if (nome) aq = aq.eq("nome", nome); else return json({ok:false,reason:"faltando agente"},400);
    const { data: agente, error: aErr } = await aq.maybeSingle();
    if (aErr || !agente) return json({ok:false,reason:"agente_nao_encontrado"},404);

    if (action==="get") return json({ ok:true, slug:agente.slug, nome:agente.nome, modelo:agente.modelo, system_prompt:agente.system_prompt||"", config:agente.config||{}, ativo:agente.ativo });
    if (action==="save") { const { error } = await supabase.from("agentes_ia").update({ system_prompt: b.system_prompt ?? "" }).eq("id", agente.id); return error? json({ok:false,reason:"erro_salvar",detalhe:error.message},502) : json({ok:true}); }

    const hasMessages = Array.isArray(b.messages) && b.messages.length>0;
    if (!b.input && !hasMessages) return json({ok:false,reason:"faltando input"},400);

    let apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) { const { data: sec } = await supabase.from("app_secrets").select("valor").eq("chave","OPENAI_API_KEY").maybeSingle(); apiKey = sec?.valor; }
    if (!apiKey) return json({ok:false,reason:"sem_chave"});

    // A versao anterior travava em gpt-4o: qualquer modelo novo cadastrado no
    // banco era silenciosamente trocado por gpt-4o-mini, e a troca nao pegava.
    const modelo = MODELOS_OK.has(agente.modelo) ? agente.modelo : MODELO_PADRAO;
    const cfg = agente.config || {};

    let corretorId: number | null = null;
    try {
      const h = req.headers.get("authorization") || "";
      const tok = h.replace(/^Bearer\s+/i, "").trim();
      const part = tok.split(".")[1];
      if (part) {
        const payload = JSON.parse(atob(part.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(part.length/4)*4,"=")));
        if (payload && payload.role === "authenticated" && payload.sub) {
          const { data: cor } = await supabase.from("corretores").select("id").eq("usuario_id", payload.sub).maybeSingle();
          corretorId = cor?.id ?? null;
        }
      }
    } catch { /* sem identidade */ }

    const fontesUsadas: {id:number;titulo:string;versao:string}[] = [];
    let conhecimento = "";
    const { data: links } = await supabase.from("agente_fonte_links").select("fonte_id").eq("agente_id", agente.id);
    const ids = (links||[]).map((l:{fonte_id:number})=>l.fonte_id);
    if (ids.length) {
      const { data: fontes } = await supabase.from("agente_fontes").select("id,titulo,versao,conteudo,situacao").in("id", ids).eq("situacao","aprovada");
      for (const f of (fontes||[])) { conhecimento += `\n\n### FONTE: ${f.titulo} (v${f.versao||"?"})\n${f.conteudo||""}`; fontesUsadas.push({id:f.id,titulo:f.titulo,versao:f.versao}); }
    }

    const { data: perms } = await supabase.from("agente_ferramenta_permissoes").select("ferramenta_id, habilitado").eq("agente_id", agente.id).eq("habilitado", true);
    const permIds = (perms||[]).map((p:{ferramenta_id:number})=>p.ferramenta_id);
    let toolSlugs: string[] = [];
    if (permIds.length) { const { data: ferr } = await supabase.from("agente_ferramentas").select("id,slug,tipo,ativo").in("id", permIds); toolSlugs = (ferr||[]).filter((f:{ativo:boolean})=>f.ativo).map((f:{slug:string})=>f.slug); }

    const TOOLDEFS: Record<string, any> = {
      "consultar-produtos": { type:"function", function:{ name:"consultar_produtos", description:"Busca UNIDADES/imoveis reais do catalogo (ao vivo) com tipologia, area, vagas, preco e empreendimento. Use para produtos, precos, disponibilidade. Nunca invente.", parameters:{ type:"object", properties:{ bairro:{type:"string"}, dormitorios_min:{type:"integer"}, valor_max:{type:"number"}, vagas_min:{type:"integer"}, texto:{type:"string"} } } } },
      "consultar-cliente": { type:"function", function:{ name:"consultar_cliente", description:"Busca um lead pelo nome ou telefone (dados basicos).", parameters:{ type:"object", properties:{ nome:{type:"string"}, telefone:{type:"string"} } } } },
      "consultar-carteira": { type:"function", function:{ name:"consultar_carteira", description:"Carteira do corretor logado: resumo (atencao=amarelo 3-7d sem interacao, atrasados=vermelho 7d+, em_dia) e leads criticos. Use para carteira, pendencias, quem precisa de feedback/follow-up, o que fazer hoje.", parameters:{ type:"object", properties:{ filtro:{type:"string", enum:["atencao","atrasados","atencao_e_atraso","todos"] } } } } },
      "consultar-vendas": { type:"function", function:{ name:"consultar_vendas", description:"Vendas feitas: resumo (qtd, VGV total, VGV 30 dias) e ultimas vendas. Use para vendas/VGV/faturamento.", parameters:{ type:"object", properties:{} } } },
      "consultar-recebiveis": { type:"function", function:{ name:"consultar_recebiveis", description:"Valores a receber: comissoes do corretor e parcelas pendentes. Use para comissao, quanto vou receber.", parameters:{ type:"object", properties:{} } } },
      "consultar-lead": { type:"function", function:{ name:"consultar_lead", description:"Situacao completa de UM lead pelo nome/telefone: etapa, dias parado, valor, corretor, status.", parameters:{ type:"object", properties:{ texto:{type:"string"} }, required:["texto"] } } },
      "avaliar-conversa": { type:"function", function:{ name:"avaliar_conversa", description:"Puxa as ultimas mensagens de WhatsApp de um lead (nome/telefone) para avaliar o atendimento. Use quando pedirem para avaliar/analisar a conversa, dar nota, ou ajudar a responder o cliente.", parameters:{ type:"object", properties:{ texto:{type:"string"} }, required:["texto"] } } },
      "estrutura-crm": { type:"function", function:{ name:"consultar_estrutura_crm", description:"Funis e etapas do CRM. Use para explicar como o CRM/funil funciona ou tirar duvidas sobre etapas.", parameters:{ type:"object", properties:{} } } },
      "mover-lead": { type:"function", function:{ name:"mover_lead", description:"Move um lead de etapa. FLUXO: confirmar=false para preview (de/para), peca confirmacao; so confirmar=true apos o sim. So leads do proprio corretor.", parameters:{ type:"object", properties:{ lead:{type:"string"}, etapa_destino:{type:"string"}, confirmar:{type:"boolean"} }, required:["lead","etapa_destino"] } } },
      "criar-tarefa": { type:"function", function:{ name:"criar_tarefa", description:"Cria uma tarefa/agendamento de follow-up para um lead, com prazo em dias. FLUXO: confirmar=false para preview (cliente, titulo, quando), peca confirmacao; so confirmar=true apos o sim. So no proprio lead.", parameters:{ type:"object", properties:{ lead:{type:"string"}, titulo:{type:"string",description:"o que fazer"}, dias:{type:"integer",description:"prazo em dias; padrao 1"}, confirmar:{type:"boolean"} }, required:["lead","titulo"] } } },
      "registrar-feedback": { type:"function", function:{ name:"registrar_feedback", description:"Registra uma anotacao/feedback no historico de um lead. FLUXO: confirmar=false para preview, peca confirmacao; so confirmar=true apos o sim. So no proprio lead.", parameters:{ type:"object", properties:{ lead:{type:"string"}, texto:{type:"string"}, confirmar:{type:"boolean"} }, required:["lead","texto"] } } }
    };
    const tools = b.disable_tools===true ? [] : toolSlugs.filter(s=>TOOLDEFS[s]).map(s=>TOOLDEFS[s]);
    const nameToSlug: Record<string,string> = { consultar_produtos:"consultar-produtos", consultar_cliente:"consultar-cliente", consultar_carteira:"consultar-carteira", consultar_vendas:"consultar-vendas", consultar_recebiveis:"consultar-recebiveis", consultar_lead:"consultar-lead", avaliar_conversa:"avaliar-conversa", consultar_estrutura_crm:"estrutura-crm", mover_lead:"mover-lead", criar_tarefa:"criar-tarefa", registrar_feedback:"registrar-feedback" };

    async function runTool(fnName:string, args:any) {
      if (fnName==="consultar_produtos") { const { data, error } = await supabase.rpc("ia_buscar_unidades", { p_dormitorios: args.dormitorios_min ?? args.dormitorios ?? null, p_valor_max: args.valor_max ?? null, p_vagas_min: args.vagas_min ?? null, p_bairro: args.bairro ?? null, p_texto: args.texto ?? null, p_limite: 8 }); if (error) return { encontrados:0, imoveis:[], erro:error.message }; return { encontrados:(data||[]).length, imoveis:data||[] }; }
      if (fnName==="consultar_cliente") { let q = supabase.from("leads").select("id,nome,telefone,status,origem").limit(5); if (args.telefone) q=q.ilike("telefone", `%${args.telefone}%`); else if (args.nome) q=q.ilike("nome", `%${args.nome}%`); const { data, error } = await q; if (error) return { encontrados:0, clientes:[], erro:error.message }; return { encontrados:(data||[]).length, clientes:data||[] }; }
      if (fnName==="consultar_carteira") { const { data, error } = await supabase.rpc("ia_carteira", { p_corretor_id: corretorId, p_filtro: args.filtro || "atencao_e_atraso", p_limite: 12 }); if (error) return { encontrados:0, erro:error.message }; return { encontrados:(data?.leads||[]).length, ...data }; }
      if (fnName==="consultar_vendas") { const { data, error } = await supabase.rpc("ia_vendas", { p_corretor_id: corretorId, p_limite: 8 }); if (error) return { encontrados:0, erro:error.message }; return { encontrados:(data?.vendas||[]).length, ...data }; }
      if (fnName==="consultar_recebiveis") { const { data, error } = await supabase.rpc("ia_recebiveis", { p_corretor_id: corretorId }); if (error) return { encontrados:0, erro:error.message }; return { encontrados: data?.comissoes_qtd ?? 0, ...data }; }
      if (fnName==="consultar_lead") { const { data, error } = await supabase.rpc("ia_lead", { p_texto: args.texto || "" }); if (error) return { encontrados:0, erro:error.message }; return { encontrados: data?.encontrado?1:0, ...data }; }
      if (fnName==="avaliar_conversa") { const { data, error } = await supabase.rpc("ia_conversa", { p_texto: args.texto || "", p_limite: 12 }); if (error) return { encontrados:0, erro:error.message }; return { encontrados:(data?.mensagens||[]).length, ...data }; }
      if (fnName==="consultar_estrutura_crm") { const { data, error } = await supabase.rpc("ia_estrutura_crm"); if (error) return { encontrados:0, erro:error.message }; return { encontrados:(data||[]).length, funis:data }; }
      if (fnName==="mover_lead") { const { data, error } = await supabase.rpc("ia_mover_lead", { p_corretor_id: corretorId, p_texto_lead: args.lead || "", p_etapa_destino: args.etapa_destino || "", p_confirmar: args.confirmar===true }); if (error) return { ok:false, erro:error.message }; return data; }
      if (fnName==="criar_tarefa") { const { data, error } = await supabase.rpc("ia_criar_tarefa", { p_corretor_id: corretorId, p_texto_lead: args.lead || "", p_titulo: args.titulo || "", p_dias: args.dias ?? 1, p_confirmar: args.confirmar===true }); if (error) return { ok:false, erro:error.message }; return data; }
      if (fnName==="registrar_feedback") { const { data, error } = await supabase.rpc("ia_registrar_feedback", { p_corretor_id: corretorId, p_texto_lead: args.lead || "", p_texto: args.texto || "", p_confirmar: args.confirmar===true }); if (error) return { ok:false, erro:error.message }; return data; }
      return { erro:"ferramenta_desconhecida" };
    }

    const systemPrompt = (b.override_prompt || agente.system_prompt || "") +
      (conhecimento ? `\n\n=== BASE DE CONHECIMENTO (use como verdade; nunca contradiga) ===${conhecimento}` : "") +
      (tools.length ? "\n\n=== FERRAMENTAS ===\nVoce PODE e DEVE consultar dados reais do ERP com as ferramentas antes de responder sobre produtos, clientes, carteira, vendas, recebiveis, um lead, uma conversa ou a estrutura do CRM. NUNCA invente; se a ferramenta nao retornar, diga que nao encontrou. Acoes de escrita (mover, criar tarefa, registrar feedback) sempre em 2 passos: preview (confirmar=false) e execucao (confirmar=true) so apos o sim explicito do corretor." : "") +
      (corretorId ? "" : "\n\n(Observacao: nao identifiquei o corretor logado; carteira/recebiveis pessoais mostram a visao geral - deixe claro.)");

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
        body.reasoning_effort = esforcos.has(cfg.reasoning_effort) ? cfg.reasoning_effort : "low";
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
