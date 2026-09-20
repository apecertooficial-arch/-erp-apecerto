// Transcrição privada do feedback de visita.
// Deploy futuro: verify_jwt=true; chamada somente pelo motor com segredo do Vault.
// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";

const BUCKET = "visita-feedback-audio";
const MAX_BYTES = 20 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIME_EXT: Record<string,string> = {
  "audio/ogg":"ogg", "audio/webm":"webm", "audio/mpeg":"mp3",
  "audio/mp4":"m4a", "audio/wav":"wav",
};

const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {
  status, headers:{"Content-Type":"application/json","Cache-Control":"no-store"},
});

async function timingSafeEqual(a: string, b: string) {
  const enc = new TextEncoder();
  const [ha,hb] = await Promise.all([
    crypto.subtle.digest("SHA-256",enc.encode(a)),
    crypto.subtle.digest("SHA-256",enc.encode(b)),
  ]);
  const va = new Uint8Array(ha); const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i=0;i<va.length;i++) diff |= va[i]^vb[i];
  return diff===0 && a.length===b.length;
}

const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)]
  .map((byte)=>byte.toString(16).padStart(2,"0")).join("");

Deno.serve(async (request: Request) => {
  if (request.method!=="POST") return json({ok:false,erro:"metodo_invalido"},405);
  const segredoEsperado = Deno.env.get("VISITA_FEEDBACK_TRANSCRICAO_SECRET") ?? "";
  const segredoRecebido = request.headers.get("x-internal-secret") ?? "";
  if (!segredoEsperado || !segredoRecebido || !await timingSafeEqual(segredoEsperado,segredoRecebido)) {
    return json({ok:false,erro:"nao_autorizado"},401);
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const openAiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!supabaseUrl || !serviceKey || !openAiKey) return json({ok:false,erro:"configuracao_incompleta"},503);

  const body = await request.json().catch(()=>null) as {audio_id?:unknown}|null;
  const audioId = typeof body?.audio_id==="string" && UUID.test(body.audio_id) ? body.audio_id : "";
  if (!audioId) return json({ok:false,erro:"audio_invalido"},422);
  const db = createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const claim = await db.rpc("f2_feedback_audio_reivindicar",{p_id:audioId});
  const item = claim.data as {ok?:boolean;erro?:string;path?:string;mime_type?:string;bytes?:number;sha256?:string}|null;
  if (claim.error || !item?.ok || !item.path) return json({ok:false,erro:item?.erro ?? "audio_indisponivel"},409);

  const falhar = async (codigo: string, status=502) => {
    await db.rpc("f2_feedback_audio_concluir",{p_id:audioId,p_status:"falhou",p_transcricao:null,p_erro_codigo:codigo});
    return json({ok:false,erro:codigo},status);
  };

  const arquivo = await db.storage.from(BUCKET).download(item.path);
  if (arquivo.error || !arquivo.data) return await falhar("download_falhou");
  const bytes = await arquivo.data.arrayBuffer();
  const mime = String(item.mime_type ?? "");
  if (!MIME_EXT[mime] || bytes.byteLength<1 || bytes.byteLength>MAX_BYTES || bytes.byteLength!==Number(item.bytes)) {
    return await falhar("arquivo_invalido",422);
  }
  const sha256 = hex(await crypto.subtle.digest("SHA-256",bytes));
  if (sha256!==item.sha256) return await falhar("hash_divergente",409);

  const form = new FormData();
  form.set("model",Deno.env.get("OPENAI_TRANSCRIPTION_MODEL") || "whisper-1");
  form.set("language","pt");
  form.set("file",new File([bytes],`feedback.${MIME_EXT[mime]}`,{type:mime}));
  const resposta = await fetch("https://api.openai.com/v1/audio/transcriptions",{
    method:"POST",headers:{Authorization:`Bearer ${openAiKey}`},body:form,
    signal:AbortSignal.timeout(120_000),
  }).catch(()=>null);
  if (!resposta?.ok) return await falhar("transcricao_indisponivel",resposta?.status===429 ? 429 : 502);
  const payload = await resposta.json().catch(()=>null) as {text?:unknown}|null;
  const transcricao = typeof payload?.text==="string" ? payload.text.trim().slice(0,5000) : "";
  if (!transcricao) return await falhar("transcricao_vazia",422);
  const concluido = await db.rpc("f2_feedback_audio_concluir",{
    p_id:audioId,p_status:"transcrito",p_transcricao:transcricao,p_erro_codigo:null,
  });
  if (concluido.error || concluido.data?.ok!==true) return json({ok:false,erro:"persistencia_falhou"},502);
  return json({ok:true,audio_id:audioId,status:"transcrito"});
});
