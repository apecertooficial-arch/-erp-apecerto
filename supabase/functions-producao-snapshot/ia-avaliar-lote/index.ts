import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s=200) => new Response(JSON.stringify(b), { status:s, headers:{...cors, "Content-Type":"application/json"} });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, srk);
    const b = await req.json().catch(()=>({}));
    const limite = Math.min(Number(b.limite ?? 8), 15);

    // O modelo vem do cadastro do agente, nao escrito no codigo: assim trocar
    // o modelo em Agentes de IA muda de verdade o que fica gravado no historico.
    const { data: ag } = await supabase.from("agentes_ia").select("modelo").eq("slug","avaliador-atendimento").maybeSingle();
    const modeloEmUso = ag?.modelo ?? "gpt-5.4-mini";

    let alvos: {lead_id:number; nome:string}[] = [];
    if (b.lead) {
      const { data: l } = await supabase.from("leads").select("id,nome").or(`nome.ilike.%${b.lead}%,telefone.ilike.%${b.lead}%`).order("atualizado_em",{ascending:false,nullsFirst:false}).limit(1).maybeSingle();
      if (!l) return json({ok:true, avaliados:0, motivo:"lead_nao_encontrado"});
      alvos = [{lead_id:l.id, nome:l.nome}];
    } else {
      const { data } = await supabase.rpc("ia_leads_para_avaliar", { p_limite: limite });
      alvos = (data||[]) as any;
    }
    if (!alvos.length) return json({ok:true, avaliados:0, motivo:"nada_pendente"});

    let ok=0; const itens:any[]=[];
    for (const alvo of alvos) {
      try {
        const { data: d } = await supabase.rpc("ia_avaliacao_dados", { p_lead_id: alvo.lead_id });
        const dd = d as any;
        const msgs = (dd?.mensagens||[]) as any[];
        if (!msgs.length) { itens.push({lead:alvo.nome, motivo:"sem_conversa"}); continue; }
        const conversa = msgs.map((m)=>`${m.direcao==="enviada"?"CORRETOR":"CLIENTE"}: ${m.texto}`).join("\n");
        const override = `Voce e o Avaliador de Atendimento da Apecerto. Avalie o atendimento do CORRETOR com o CLIENTE usando como UNICA REGUA o Playbook de Atendimento Comercial v3.0 (esta na sua base de conhecimento). Os corretores sao todos avaliados por essa mesma regua.\nCRITERIOS DO PLAYBOOK: (1) energia/tom alegre, humano e curto; (2) velocidade - regra dos 5 min; (3) escuta/qualificacao - perguntar antes de oferecer (morar/investir, regiao, tipo, faixa de valor, financiar/entrada, prazo, preferencias), uma pergunta por vez; (4) envio consultivo - explicar o porque de cada opcao, ligar ao que o cliente disse, vender o sonho, nunca despejar lista; (5) conducao para a visita - oferecer e dar opcoes de horario (SO quando a conversa ja evoluiu); (6) personalizacao - nada de copiar e colar; (7) presenca - nao abandonar, proximo passo claro.\nCONTEXTO: etapa \"${dd.etapa||"?"}\"; ${dd.n_mensagens||0} mensagens (${dd.n_cliente||0} do cliente, ${dd.n_corretor||0} do corretor); atendimento iniciado ha ${dd.dias_atendimento||0} dias.\nJUSTICA POR ESTAGIO: avalie SOMENTE o que ja era esperado neste ponto do atendimento. Conversa inicial, curta ou com cliente pouco responsivo NAO deve ser penalizada por falta de visita agendada ou fechamento - isso vem em fases posteriores. Nunca cobre passos de fases futuras. Audios vem transcritos com [audio].\nCONVERSA:\n${conversa}\n\nResponda SOMENTE um JSON valido:\n{\"nota\":<0 a 10>,\"feedbacks\":[{\"criterio\":\"<um dos criterios do playbook>\",\"positivo\":<true|false>,\"texto\":\"<por que, 1 frase baseada na conversa>\"}],\"subnotas\":{\"clareza\":<0-100|null>,\"cordialidade\":<0-100|null>,\"personalizacao\":<0-100|null>,\"qualificacao\":<0-100|null>,\"conducao\":<0-100|null>,\"objecoes\":<0-100|null>,\"escrita\":<0-100|null>},\"nota_geral\":<0-100>,\"destaque\":\"<1 frase com o principal ponto forte ou correcao>\"}\nNas subnotas, use null quando o criterio NAO apareceu na conversa (ex.: nenhuma objecao surgiu) - nao de nota baixa por criterio ausente. PELO MENOS 3 feedbacks adequados ao estagio. Nada alem do JSON.`;
        const r = await fetch(`${url}/functions/v1/ia-router`, { method:"POST", headers:{Authorization:`Bearer ${srk}`,"Content-Type":"application/json"}, body: JSON.stringify({ agente_slug:"avaliador-atendimento", input: alvo.nome, override_prompt: override }) });
        const j = await r.json();
        let out:any = (j && typeof j.saida==="object") ? j.saida : null;
        if (!out && typeof j?.resposta==="string") { const mm=j.resposta.match(/\{[\s\S]*\}/); if(mm){ try{ out=JSON.parse(mm[0]); }catch{} } }
        if (!out || out.nota==null) { itens.push({lead:alvo.nome, motivo:"sem_json", detalhe: j?.detalhe ?? null}); continue; }
        const contexto = { etapa:dd.etapa, n_mensagens:dd.n_mensagens, n_cliente:dd.n_cliente, n_corretor:dd.n_corretor, dias_atendimento:dd.dias_atendimento };
        await supabase.rpc("ia_salvar_avaliacao", { p_lead_id: alvo.lead_id, p_negocio_id: dd.negocio_id ?? null, p_nota: out.nota, p_feedbacks: out.feedbacks ?? [], p_contexto: contexto });

        // ---- mesma passada alimenta a Central de Performance (subnotas por corretor) ----
        try {
          const num = (v:any) => (v==null || isNaN(Number(v))) ? null : Math.max(0, Math.min(100, Math.round(Number(v))));
          const sn = (out.subnotas && typeof out.subnotas==="object") ? out.subnotas : {};
          const notaGeral = num(out.nota_geral) ?? Math.round(Number(out.nota)*10);
          const { data: ldd } = await supabase.from("leads").select("corretor_id,telefone").eq("id", alvo.lead_id).maybeSingle();
          if (ldd?.corretor_id && ldd?.telefone && notaGeral!=null) {
            await supabase.rpc("ia_salvar_nota_atendimento", {
              p_corretor_id: ldd.corretor_id, p_telefone: ldd.telefone, p_msgs: dd.n_mensagens ?? 0,
              p_clareza: num(sn.clareza), p_cordialidade: num(sn.cordialidade), p_personalizacao: num(sn.personalizacao),
              p_qualificacao: num(sn.qualificacao), p_conducao: num(sn.conducao), p_objecoes: num(sn.objecoes),
              p_escrita: num(sn.escrita), p_nota_geral: notaGeral,
              p_destaque: typeof out.destaque==="string" ? out.destaque : null, p_modelo: modeloEmUso
            });
          }
        } catch { /* nota do lead ja salva; performance fica para a proxima passada */ }

        ok++; itens.push({lead:alvo.nome, nota:out.nota, feedbacks:(out.feedbacks||[]).length});
      } catch (e) { itens.push({lead:alvo.nome, erro:String(e)}); }
    }
    return json({ ok:true, avaliados:ok, modelo: modeloEmUso, itens });
  } catch (e) { return json({ok:false,reason:"excecao",detalhe:String(e)},500); }
});
