import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Camada 2 da Sara: le o QUE foi dito, nao so quem falou.
//
// Licao da primeira versao: o prompt tinha tanto contexto do negocio que
// diluiu a instrucao que importava, e o modelo pegou a data ERRADA (a de uma
// mensagem antiga em vez da mais recente). Com a regra de decisao em primeiro
// lugar e curta, nano e mini acertam igual. Ordem importa mais que tamanho.
//
// MUDANCA (v3): o prompt saiu daqui e foi para o banco, no agente
// 'leitor-momento' (tabela agentes_ia). Antes ele era fixo neste arquivo, e o
// resultado pratico era que ninguem conseguia treinar a IA: editar o prompt na
// Central de IA nao mudava nada, porque este texto vencia. Agora a Central de
// IA e a fonte da verdade, e o texto abaixo e so a rede de seguranca para o
// caso de o agente sumir ou vir vazio.

const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };

const REGRAS_PADRAO = `Voce le uma conversa de WhatsApp entre CORRETOR de imoveis e CLIENTE e decide em que momento o lead esta.

== AS TRES DECISOES POSSIVEIS ==

RETOMAR_NA_DATA -- o cliente segue interessado mas deu uma REFERENCIA DE TEMPO concreta para voltar a falar.
  Ex.: "irei por volta do dia 12", "estarei em SP dia 15", "volto de viagem semana que vem", "me chama no fim do mes".
  retorno_em e OBRIGATORIO aqui.

TENTANDO_AGENDAMENTO -- o assunto agora e marcar a visita: ele propos dia/hora, pediu endereco, ou aceitou o convite.

CONVERSANDO_QUALIFICANDO -- a conversa esta viva mas ainda descobrindo o que ele quer.
  Tambem e aqui quando ele so empurrou sem referencia ("depois eu vejo", "te chamo") ou disse "me chama amanha" (curto demais para virar retorno).

== COMO LER A DATA -- LEIA COM ATENCAO ==

1. Se o cliente deu MAIS DE UMA data ao longo da conversa, vale SEMPRE a MAIS RECENTE, ou seja, a que aparece MAIS PARA BAIXO na conversa. Ignore as anteriores.
2. "dia 12" sem mes = o proximo dia 12 a partir de hoje.
3. "semana que vem" = segunda-feira da semana seguinte.
4. "fim do mes" = dia 28 do mes corrente.

== CONTEXTO DA CASA (use so para calibrar) ==

As campanhas sao chamariz: o anuncio mostra um apartamento, mas serve para atrair quem quer comprar na regiao. Por isso perguntar preco NAO e sinal de compra -- e curiosidade comum. O sinal forte e logistica: propor dia, hora ou pedir endereco.
Nunca sugira descarte. "Esta caro" e "nao tenho tempo" nao encerram lead nesta casa; registre como sinal e siga.

Sinais possiveis: pediu_visita, propos_horario, pediu_endereco, perguntou_preco, objecao_preco, objecao_tempo, sem_interesse, vai_viajar, quer_financiar.

== RESPOSTA ==

Somente este JSON:
{"momento":"RETOMAR_NA_DATA|TENTANDO_AGENDAMENTO|CONVERSANDO_QUALIFICANDO","retorno_em":"AAAA-MM-DD ou null","sinais":["..."],"trecho":"a frase do CLIENTE que te fez decidir, copiada da conversa","confianca":0.0}

Na duvida, devolva confianca abaixo de 0.7: nao mexer e melhor que mexer errado.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s=200) => new Response(JSON.stringify(b), { status:s, headers:{...cors, "Content-Type":"application/json"} });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const b = await req.json().catch(()=>({}));
    const limite = Math.min(Number(b.limite ?? 10), 30);
    const soEste = typeof b.card === "string" ? b.card : null;

    let apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) { const { data: sec } = await supabase.from("app_secrets").select("valor").eq("chave","OPENAI_API_KEY").maybeSingle(); apiKey = sec?.valor; }
    if (!apiKey) return json({ok:false,reason:"sem_chave"});

    // O agente manda: modelo, prompt e o botao de liga/desliga vem da Central de IA.
    const { data: ag } = await supabase.from("agentes_ia")
      .select("nome,modelo,system_prompt,ativo").eq("slug","leitor-momento").maybeSingle();

    if (ag && ag.ativo === false) {
      return json({ ok:true, lidos:0, motivo:"agente_desligado", agente: ag.nome });
    }

    const modelo = ag?.modelo ?? "gpt-5.4-nano";
    const usaMaxCompletion = !modelo.startsWith("gpt-4");
    // So aceita o prompt do banco se ele tiver corpo de verdade. Prompt vazio
    // salvo por engano na tela nao pode derrubar a leitura de todo mundo.
    const doBanco = (ag?.system_prompt ?? "").trim();
    const regras = doBanco.length >= 200 ? doBanco : REGRAS_PADRAO;
    const origemPrompt = doBanco.length >= 200 ? "central_de_ia" : "padrao_do_codigo";

    const { data: cards, error } = await supabase.rpc("f2_sara_candidatos_interpretacao",
      { p_limite: limite, p_card: soEste });
    if (error) return json({ok:false,reason:"erro_candidatos",detalhe:error.message},502);
    if (!cards || !cards.length) return json({ok:true, lidos:0, motivo:"nada_para_interpretar", origemPrompt});

    const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday:"long", day:"2-digit", month:"2-digit", year:"numeric" });
    const itens:any[] = []; let aplicadas = 0;

    for (const c of cards as any[]) {
      try {
        const { data: msgs } = await supabase.rpc("f2_sara_conversa_do_card", { p_card: c.id, p_limite: 25 });
        if (!msgs || !msgs.length) { itens.push({card:c.nome, motivo:"sem_conversa"}); continue; }
        // numerar deixa explicito o que veio depois -- foi assim que o modelo
        // parou de pegar a data de uma mensagem antiga
        const conversa = (msgs as any[]).map((m, i) =>
          `${i+1}. ${m.quem}: ${m.texto}`).join("\n");

        const body:any = { model: modelo, temperature: 0.2, messages: [
          { role:"system", content: regras },
          { role:"user", content: `HOJE e ${hoje}.\nMomento atual do card: ${c.momento_codigo}\n\nCONVERSA (em ordem; a ultima linha e a mais recente):\n${conversa}` },
        ]};
        if (usaMaxCompletion) body.max_completion_tokens = 400; else body.max_tokens = 400;

        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method:"POST", headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
          body: JSON.stringify(body) });
        const d = await r.json();
        if (!r.ok) { itens.push({card:c.nome, erro: d?.error?.message}); continue; }

        const txt = d.choices?.[0]?.message?.content ?? "";
        const mm = txt.match(/\{[\s\S]*\}/);
        if (!mm) { itens.push({card:c.nome, motivo:"sem_json"}); continue; }
        let out:any; try { out = JSON.parse(mm[0]); } catch { itens.push({card:c.nome, motivo:"json_invalido"}); continue; }

        const { data: res } = await supabase.rpc("f2_sara_aplicar_leitura", {
          p_card: c.id,
          p_momento: String(out.momento ?? ""),
          p_retorno: out.retorno_em ? `${out.retorno_em}T10:00:00-03:00` : null,
          p_sinais: out.sinais ?? [],
          p_trecho: String(out.trecho ?? "").slice(0,500),
          p_confianca: Number(out.confianca ?? 0),
          p_modelo: modelo,
        });
        const ok = (res as any)?.ok === true;
        if (ok) aplicadas++;
        itens.push({ card:c.nome, corretor:c.corretor_nome, de:c.momento_codigo,
                     para:out.momento, retorno:out.retorno_em ?? null,
                     confianca:out.confianca, aplicada:ok,
                     recusa:(res as any)?.erro ?? null, trecho:String(out.trecho??"").slice(0,120) });
      } catch (e) { itens.push({card:c.nome, erro:String(e)}); }
    }

    return json({ ok:true, lidos:(cards as any[]).length, aplicadas, modelo, origemPrompt, itens });
  } catch (e) { return json({ok:false,reason:"excecao",detalhe:String(e)},500); }
});
