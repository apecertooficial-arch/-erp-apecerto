import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s=200) => new Response(JSON.stringify(b), { status:s, headers:{...cors, "Content-Type":"application/json"} });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, srk, { auth:{persistSession:false} });
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return json({ok:false,reason:"sessao_invalida"},401);
    const { data: usuario } = await supabase.from("usuarios").select("role,ativo").eq("id",authData.user.id).maybeSingle();
    if (usuario?.ativo === false || !["admin","gerente"].includes(String(usuario?.role || "").toLowerCase())) return json({ok:false,reason:"sem_permissao"},403);

    const b = await req.json();
    const slug = b.agente_slug; if (!slug) return json({ok:false,reason:"faltando agente_slug"},400);
    const offset = Number(b.offset ?? 0), limit = Math.min(Number(b.limit ?? 6), 10);
    const { data: agente } = await supabase.from("agentes_ia").select("id,slug,nome,versao_atual").eq("slug", slug).maybeSingle();
    if (!agente) return json({ok:false,reason:"agente_nao_encontrado"},404);
    const { data: cenarios } = await supabase.from("agente_cenarios").select("*").eq("agente_id", agente.id).order("id",{ascending:true}).range(offset, offset+limit-1);
    if (!cenarios || !cenarios.length) return json({ok:true, agente:slug, testados:0, fim:true});

    const resultados:any[] = [];
    for (const c of cenarios) {
      let resposta="", ferramentas:any[]=[], fontes:string[]=[], execId=null, erro=null;
      try {
        // A bateria usa a mesma identidade humana que apertou o botao. Service
        // role jamais representa uma pessoa e, por isso, nao pode chamar o router.
        const r = await fetch(`${url}/functions/v1/ia-router`, { method:"POST", headers:{Authorization:authHeader,"Content-Type":"application/json"}, body: JSON.stringify({ agente_slug:slug,input:c.pergunta,tela:"/agentes-ia/testes",disable_writes:true }) });
        const d = await r.json();
        if (!d.ok) erro = d.reason||d.detalhe||"erro";
        resposta=d.resposta||""; ferramentas=(d.ferramentas||[]).map((f:any)=>f.ferramenta); fontes=d.fontes||[]; execId=d.execucao_id??null;
      } catch (e) { erro=String(e); }
      const rl=(resposta||"").toLowerCase(); const regras:string[]=[]; let nota=100; let critico=false;
      for (const t of (c.ferramentas_esperadas||[])) if (!ferramentas.includes(t)) { regras.push("nao_consultou:"+t); critico=true; }
      for (const p of (c.respostas_proibidas||[])) if (p && rl.includes(String(p).toLowerCase())) { regras.push("proibido:"+p); critico=true; }
      for (const f of (c.fontes_esperadas||[])) if (!fontes.includes(f)) { regras.push("sem_fonte:"+f); nota-=15; }
      for (const k of ((c.contexto&&c.contexto.espera_conter)||[])) if (!rl.includes(String(k).toLowerCase())) { regras.push("faltou:"+k); nota-=15; }
      if (erro) { regras.push("erro:"+erro); critico=true; nota=Math.min(nota,10); }
      if (critico) nota=Math.min(nota,30); nota=Math.max(0,nota);
      const aprovado=nota>=70&&!critico;
      await supabase.from("agente_avaliacoes").insert({agente_id:agente.id,cenario_id:c.id,agente_versao:agente.versao_atual,execucao_id:execId,nota_auto:nota,aprovado,regras_descumpridas:regras});
      resultados.push({cenario_id:c.id,categoria:c.categoria,peso:c.peso,pergunta:c.pergunta,nota,aprovado,regras,ferramentas,fontes,preview:resposta.slice(0,240)});
    }
    const nextOffset=offset+cenarios.length;
    const { count:totalCen }=await supabase.from("agente_cenarios").select("id",{count:"exact",head:true}).eq("agente_id",agente.id);
    return json({ok:true,agente:slug,versao:agente.versao_atual,testados:resultados.length,offset,next_offset:nextOffset,fim:nextOffset>=(totalCen||0),total_cenarios:totalCen,resultados});
  } catch (e) { return json({ok:false,reason:"excecao",detalhe:String(e)},500); }
});
