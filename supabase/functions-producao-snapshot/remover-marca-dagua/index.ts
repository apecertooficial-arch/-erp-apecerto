// remover-marca-dagua — ferramenta avulsa: corretor sobe uma foto solta (ainda sem
// vínculo com nenhum empreendimento), a function remove a marca d'água via Unwatermark
// AI (Auto Remover V2.3, sync) e devolve os BYTES da versão limpa (base64) pro front
// mostrar o preview e baixar na hora.
//
// v6 — o output_url que a Unwatermark devolve não carrega direto num <img src> do
// navegador (bloqueiam hotlink/CORS de fora do site deles) e o atributo download de
// um link cross-origin também não força o download, só abre aba nova. Por isso a
// function agora baixa o arquivo ELA MESMA (fetch servidor-a-servidor, sem CORS) e
// devolve os bytes prontos — o front nunca mais precisa falar direto com o CDN da
// Unwatermark.
//
// Body esperado: multipart/form-data:
//   arquivo (file, obrigatório)              -> vira original_image_file na Unwatermark
//   remover_logo        ("true"/"false", default true)
//   remover_texto        ("true"/"false", default false)
//   melhorar_qualidade   ("true"/"false", default false — evite em foto de imóvel:
//     pode alterar cor/exposição e distorcer a representação do ambiente)
//   formato              (jpg|png|webp, default jpg)
//
// Resposta de sucesso: { ok: true, mime, base64 } — bytes prontos pro front montar um
// Blob local (preview + download instantâneo, sem depender de link externo).
// Se por algum motivo o download dos bytes falhar, cai pro modo antigo:
// { ok: true, url, expira_em: "24h", aviso: "..." } — link direto da Unwatermark, que
// ainda funciona abrindo em nova aba, só não tem preview inline nem download direto.
//
// Requer 1 secret (Dashboard -> Edge Functions -> Manage secrets): UNWATERMARK_API_KEY
// Sem ele a função responde 503 com erro claro, não quebra.
//
// Chamada esperada do front (usuário logado, JWT do Supabase Auth):
//   const form = new FormData(); form.append('arquivo', file);
//   supabase.functions.invoke('remover-marca-dagua', { body: form })

const UNWATERMARK_API_KEY = Deno.env.get("UNWATERMARK_API_KEY");
const UNWATERMARK_ENDPOINT = "https://api.unwatermark.ai/api/web/v1/sync/auto-unwatermark-upgrade-api/creat-job";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function paraBase64(bytes: Uint8Array): string {
  let binario = "";
  const tamanhoBloco = 0x8000; // 32KB por vez, pra nao estourar a pilha do spread em imagem grande
  for (let i = 0; i < bytes.length; i += tamanhoBloco) {
    binario += String.fromCharCode(...bytes.subarray(i, i + tamanhoBloco));
  }
  return btoa(binario);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  if (!UNWATERMARK_API_KEY) {
    return json({ error: "unwatermark_nao_configurado", detail: "Falta o secret UNWATERMARK_API_KEY no projeto Supabase." }, 503);
  }

  let incoming: FormData;
  try {
    incoming = await req.formData();
  } catch {
    return json({ error: "form_invalido", detail: "Body precisa ser multipart/form-data com o campo 'arquivo'." }, 400);
  }

  const arquivo = incoming.get("arquivo");
  if (!(arquivo instanceof File)) return json({ error: "arquivo_obrigatorio" }, 400);

  const removerLogo = incoming.get("remover_logo") !== "false";              // default true
  const removerTexto = incoming.get("remover_texto") === "true";             // default false
  const melhorarQualidade = incoming.get("melhorar_qualidade") === "true";   // default false
  const formatoRaw = String(incoming.get("formato") ?? "jpg");
  const formato = ["jpg", "png", "webp"].includes(formatoRaw) ? formatoRaw : "jpg";

  const form = new FormData();
  form.append("original_image_file", arquivo, arquivo.name || `imagem.${formato}`);
  form.append("is_remove_logo", String(removerLogo));
  form.append("is_remove_text", String(removerTexto));
  form.append("is_enhancer", String(melhorarQualidade));
  form.append("output_format", formato);

  let apiRes: any;
  try {
    const res = await fetch(UNWATERMARK_ENDPOINT, {
      method: "POST",
      headers: { "ZF-API-KEY": UNWATERMARK_API_KEY },
      body: form,
    });
    apiRes = await res.json();
  } catch (e) {
    return json({ error: "unwatermark_falhou", detail: String(e) }, 502);
  }

  if (apiRes.code !== 300007) {
    return json({ error: "unwatermark_processamento_falhou", detail: apiRes.message?.en ?? apiRes, job_id: apiRes.result?.job_id }, 502);
  }

  const outputUrl = apiRes.result?.output_url;
  if (!outputUrl) return json({ error: "unwatermark_resposta_inesperada", detail: apiRes }, 502);

  // Baixa os bytes do resultado no servidor (sem CORS) e devolve prontos pro front.
  try {
    const imgRes = await fetch(outputUrl);
    if (!imgRes.ok) throw new Error(`fetch_resultado_falhou_${imgRes.status}`);
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const mime = imgRes.headers.get("content-type") ?? `image/${formato}`;
    return json({ ok: true, mime, base64: paraBase64(bytes) });
  } catch (e) {
    // Nao trava o corretor: devolve o link direto como fallback, mesmo sem preview inline.
    return json({ ok: true, url: outputUrl, expira_em: "24h", aviso: `sem_preview_inline: ${String(e)}` });
  }
});
