// remover-marca-dagua — remove marca d'água/logo de fotos usando a Unwatermark AI
// (Auto Remover V2.3, modo síncrono). Substitui a engine PixelBin/watermarkremover.io.
//
// DOIS MODOS DE ENTRADA, pelo Content-Type da requisição:
//
// 1) multipart/form-data com `original_image_file` — modo da ferramenta avulsa
//    (app/features/tools/WatermarkRemover.tsx): o corretor sobe o arquivo direto
//    da tela, sem ele já estar no Storage. Sem midia_id, não há onde persistir —
//    a resposta sempre traz o link direto da Unwatermark (expira em 24h).
//    Campos opcionais no form: remover_logo, remover_texto, melhorar_qualidade,
//    formato (jpg|png|webp), midia_id (se quiser persistir mesmo nesse modo).
//
// 2) application/json com { url } ou { midia_id } — modo integrado a um registro
//    já existente (ex.: futura integração em CaptureWizard/UnitWizard/ProductDetail).
//    A imagem já está no Storage; a function baixa os bytes a partir da URL.
//
// Em ambos os casos: envia os bytes pra Unwatermark (Auto Remover V2.3, sync) e,
// se houver midia_id resolvido, por padrão REGRAVA o resultado no Storage (bucket
// empreendimentos) e atualiza midias.storage_path — porque o output_url da
// Unwatermark expira em 24h (diferente do link da PixelBin, que não expirava).
// Passe salvar_em_midia:false para só receber o link efêmero.
//
// Flags (default entre parênteses): remover_logo (true), remover_texto (false),
// melhorar_qualidade (false — evite em foto de imóvel: o enhancer pode alterar
// cor/exposição e distorcer a representação do ambiente), formato (jpg).
//
// Requer 1 secret no projeto (Dashboard -> Edge Functions -> Manage secrets):
//   UNWATERMARK_API_KEY
// Sem ele a função responde 503 com erro claro, não quebra.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE);

const UNWATERMARK_API_KEY = Deno.env.get("UNWATERMARK_API_KEY");
const UNWATERMARK_ENDPOINT = "https://api.unwatermark.ai/api/web/v1/sync/auto-unwatermark-upgrade-api/creat-job";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function publicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/empreendimentos/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function boolField(value: FormDataEntryValue | null, fallback: boolean) {
  if (value === null) return fallback;
  return String(value) === "true";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  if (!UNWATERMARK_API_KEY) {
    return json({ error: "unwatermark_nao_configurado", detail: "Falta o secret UNWATERMARK_API_KEY no projeto Supabase." }, 503);
  }

  const contentType = req.headers.get("content-type") ?? "";
  let sourceBlob: Blob;
  let midia: { id: string; storage_path: string } | null = null;
  let removerLogo = true;
  let removerTexto = false;
  let melhorarQualidade = false;
  let formato = "jpg";
  let salvarEmMidia = true;

  if (contentType.includes("multipart/form-data")) {
    // Modo 1: ferramenta avulsa.
    let incomingForm: FormData;
    try { incomingForm = await req.formData(); } catch { return json({ error: "form_invalido" }, 400); }

    const file = incomingForm.get("original_image_file");
    if (!(file instanceof File)) return json({ error: "arquivo_ausente", detail: "Envie original_image_file no form-data." }, 400);
    sourceBlob = file;

    removerLogo = boolField(incomingForm.get("remover_logo"), true);
    removerTexto = boolField(incomingForm.get("remover_texto"), false);
    melhorarQualidade = boolField(incomingForm.get("melhorar_qualidade"), false);
    salvarEmMidia = boolField(incomingForm.get("salvar_em_midia"), true);
    const formatoBruto = String(incomingForm.get("formato") ?? "jpg");
    formato = ["jpg", "png", "webp"].includes(formatoBruto) ? formatoBruto : "jpg";

    const midiaId = incomingForm.get("midia_id");
    if (midiaId) {
      const { data, error } = await admin.from("midias").select("id, storage_path").eq("id", String(midiaId)).maybeSingle();
      if (error) return json({ error: "db", detail: error.message }, 500);
      if (data?.storage_path) midia = data;
    }
  } else {
    // Modo 2: já integrado a um registro do ERP — imagem já está no Storage.
    let p: any = {};
    try { p = await req.json(); } catch { return json({ error: "json_invalido" }, 400); }

    let sourceUrl = typeof p.url === "string" ? p.url.trim() : "";
    if (!sourceUrl && p.midia_id) {
      const { data, error } = await admin.from("midias").select("id, storage_path").eq("id", String(p.midia_id)).maybeSingle();
      if (error) return json({ error: "db", detail: error.message }, 500);
      if (!data?.storage_path) return json({ error: "midia_nao_encontrada" }, 404);
      midia = data;
      sourceUrl = publicUrl(data.storage_path);
    }
    if (!sourceUrl) return json({ error: "informe_url_ou_midia_id" }, 400);

    try {
      const imgRes = await fetch(sourceUrl);
      if (!imgRes.ok) throw new Error(`fetch_origem_falhou_${imgRes.status}`);
      sourceBlob = await imgRes.blob();
    } catch (e) {
      return json({ error: "download_origem_falhou", detail: String(e) }, 502);
    }

    removerLogo = p.remover_logo !== false;
    removerTexto = p.remover_texto === true;
    melhorarQualidade = p.melhorar_qualidade === true;
    salvarEmMidia = p.salvar_em_midia !== false;
    formato = ["jpg", "png", "webp"].includes(p.formato) ? p.formato : "jpg";
  }

  const uploadForm = new FormData();
  uploadForm.append("original_image_file", sourceBlob, "imagem." + formato);
  uploadForm.append("is_remove_logo", String(removerLogo));
  uploadForm.append("is_remove_text", String(removerTexto));
  uploadForm.append("is_enhancer", String(melhorarQualidade));
  uploadForm.append("output_format", formato);

  let apiRes: any;
  try {
    const res = await fetch(UNWATERMARK_ENDPOINT, {
      method: "POST",
      headers: { "ZF-API-KEY": UNWATERMARK_API_KEY },
      body: uploadForm,
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

  if (salvarEmMidia && midia) {
    try {
      const img = await fetch(outputUrl);
      if (!img.ok) throw new Error(`fetch_falhou_${img.status}`);
      const bytes = new Uint8Array(await img.arrayBuffer());
      const novoPath = midia.storage_path.replace(/(\.[a-zA-Z0-9]+)?$/, "-limpo$1");
      const { error: upErr } = await admin.storage.from("empreendimentos").upload(novoPath, bytes, {
        contentType: img.headers.get("content-type") ?? `image/${formato}`,
        upsert: true,
      });
      if (upErr) throw upErr;
      await admin.from("midias").update({ storage_path: novoPath }).eq("id", midia.id);
      return json({ ok: true, url: publicUrl(novoPath), salvo_em_midia: true });
    } catch (e) {
      return json({ ok: true, url: outputUrl, salvo_em_midia: false, aviso: `nao_conseguiu_persistir: ${String(e)}`, expira_em: "24h" });
    }
  }

  return json({ ok: true, url: outputUrl, salvo_em_midia: false, expira_em: "24h" });
});
