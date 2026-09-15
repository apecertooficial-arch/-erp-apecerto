import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const encUrl = (u:string) => { try { return encodeURI(u).replace(/\|/g,"%7C").replace(/#/g,"%23"); } catch { return u; } };

// A versao anterior mandava TODO arquivo para a OpenAI como "audio.ogg" com
// mime audio/ogg. Todo .webm e .mp3 chegava corrompido e falhava sempre --
// e como nada marcava a falha, esses audios voltavam ao topo da fila
// indefinidamente e travavam a transcricao de todo o resto.
const FORMATOS: Record<string,string> = {
  ogg:"audio/ogg", oga:"audio/ogg", opus:"audio/ogg",
  webm:"audio/webm", mp3:"audio/mpeg", mpga:"audio/mpeg", mpeg:"audio/mpeg",
  m4a:"audio/mp4", mp4:"audio/mp4", wav:"audio/wav", flac:"audio/flac",
};

function formatoDaUrl(url: string): { ext: string; mime: string } {
  const limpa = (url.split("?")[0] || "").toLowerCase();
  const m = limpa.match(/\.([a-z0-9]{2,5})$/);
  const ext = m?.[1] ?? "";
  if (FORMATOS[ext]) return { ext, mime: FORMATOS[ext] };
  return { ext: "ogg", mime: "audio/ogg" }; // padrao do WhatsApp
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s=200) => new Response(JSON.stringify(b), { status:s, headers:{...cors, "Content-Type":"application/json"} });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const b = await req.json().catch(()=>({}));
    const limite = Math.min(Number(b.limite ?? 6), 25);
    const modelo = b.modelo || "gpt-4o-mini-transcribe";
    const todos = b.todos === true;

    let apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) { const { data: sec } = await supabase.from("app_secrets").select("valor").eq("chave","OPENAI_API_KEY").maybeSingle(); apiKey = sec?.valor; }
    if (!apiKey) return json({ok:false,reason:"sem_chave"});

    let audios: {id:string; media_url:string}[] = [];
    if (b.lead) {
      const { data: l } = await supabase.from("leads").select("id").or(`nome.ilike.%${b.lead}%,telefone.ilike.%${b.lead}%`).order("atualizado_em",{ascending:false,nullsFirst:false}).limit(1).maybeSingle();
      const leadId = l?.id ?? null;
      if (!leadId) return json({ok:true, transcritos:0, motivo:"lead_nao_encontrado"});
      const { data: contatos } = await supabase.from("wa_contatos").select("id").eq("lead_id", leadId);
      const contatoIds = (contatos||[]).map((c:{id:number})=>c.id);
      if (!contatoIds.length) return json({ok:true, transcritos:0, motivo:"sem_conversa"});
      const { data: convs } = await supabase.from("wa_conversas").select("id").in("contato_id", contatoIds);
      const convIds = (convs||[]).map((c:{id:number})=>c.id);
      if (!convIds.length) return json({ok:true, transcritos:0, motivo:"sem_conversa"});
      const { data } = await supabase.from("wa_mensagens").select("id, media_url").eq("tipo","audio").is("transcricao", null).not("media_url","is",null).in("conversa_id", convIds).order("enviado_em",{ascending:false,nullsFirst:false}).limit(limite);
      audios = (data||[]) as any;
    } else if (todos) {
      const { data } = await supabase.from("wa_mensagens").select("id, media_url").eq("tipo","audio").is("transcricao", null).not("media_url","is",null).lt("transcricao_tentativas", 3).order("enviado_em",{ascending:false,nullsFirst:false}).limit(limite);
      audios = (data||[]) as any;
    } else {
      const { data } = await supabase.rpc("ia_audios_pendentes", { p_limite: limite });
      audios = (data||[]) as any;
    }
    if (!audios || !audios.length) return json({ok:true, transcritos:0, motivo:"nada_pendente"});

    // Registra a falha para o audio nao voltar ao topo da fila para sempre.
    const marcarFalha = async (id: string, erro: string) => {
      const { data: atual } = await supabase.from("wa_mensagens").select("transcricao_tentativas").eq("id", id).maybeSingle();
      const n = (atual?.transcricao_tentativas ?? 0) + 1;
      await supabase.from("wa_mensagens").update({
        transcricao_tentativas: n,
        transcricao_erro: erro.slice(0, 300),
        transcricao_tentada_em: new Date().toISOString(),
        // na 3a falha marca como nao transcritivel para sair da fila de vez
        ...(n >= 3 ? { transcricao: "(audio nao transcrito)" } : {}),
      }).eq("id", id);
    };

    const itens:any[] = []; let ok=0, falhas=0;
    for (const a of audios) {
      try {
        const resp = await fetch(encUrl(a.media_url));
        if (!resp.ok) { falhas++; await marcarFalha(a.id, `download ${resp.status}`); itens.push({id:a.id, erro:`download ${resp.status}`}); continue; }
        const buf = await resp.arrayBuffer();
        const { ext, mime } = formatoDaUrl(a.media_url);
        const form = new FormData();
        form.append("file", new Blob([buf], { type: mime }), `audio.${ext}`);
        form.append("model", modelo);
        const tr = await fetch("https://api.openai.com/v1/audio/transcriptions", { method:"POST", headers:{ Authorization:`Bearer ${apiKey}` }, body: form });
        const td = await tr.json();
        if (!tr.ok) { falhas++; const msg = td?.error?.message || "transcricao_falhou"; await marcarFalha(a.id, msg); itens.push({id:a.id, erro: msg}); continue; }
        const texto = (td.text || "").trim();
        await supabase.from("wa_mensagens").update({ transcricao: texto || "(audio sem fala)", transcrito_em: new Date().toISOString(), transcricao_erro: null }).eq("id", a.id);
        ok++; itens.push({id:a.id, formato: ext, texto: texto.slice(0,140)});
      } catch (e) { falhas++; await marcarFalha(a.id, String(e)); itens.push({id:a.id, erro:String(e)}); }
    }
    return json({ ok:true, transcritos:ok, falhas, itens });
  } catch (e) { return json({ok:false,reason:"excecao",detalhe:String(e)},500); }
});
