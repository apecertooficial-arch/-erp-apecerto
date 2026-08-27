import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { renderStudioMedia } from "./render-engine.mjs";

const clean = (value, max = 500) => String(value ?? "").replace(/[\r\n\0]/g, " ").slice(0, max);

function requiredEnvironment() {
  const values = {
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    workerId: process.env.STUDIO_RENDERER_WORKER_ID,
    organizationId: process.env.STUDIO_RENDERER_ORGANIZATION_ID,
    ffmpegPath: process.env.STUDIO_FFMPEG_PATH,
    ffprobePath: process.env.STUDIO_FFPROBE_PATH,
    logoFile: process.env.STUDIO_LOGO_PATH,
    fontFile: process.env.STUDIO_FONT_PATH,
  };
  const missing = Object.entries(values).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Renderer desativado: configuração ausente (${missing.join(", ")}).`);
  for (const key of ["ffmpegPath", "ffprobePath", "logoFile", "fontFile"]) {
    if (!path.isAbsolute(values[key])) throw new Error(`${key} precisa ser um caminho absoluto.`);
  }
  return values;
}

async function downloadAsset(db, asset, destination) {
  if (!asset?.storage_bucket || !asset?.storage_path) throw new Error("Asset sem referência de storage.");
  const { data, error } = await db.storage.from(asset.storage_bucket).createSignedUrl(asset.storage_path, 300);
  if (error || !data?.signedUrl) throw new Error("Não foi possível autorizar a leitura do asset original.");
  const response = await fetch(data.signedUrl, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Download do asset falhou (${response.status}).`);
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > 100 * 1024 * 1024) throw new Error("Asset excede o limite de 100 MB.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 100 * 1024 * 1024) throw new Error("Asset vazio ou acima do limite.");
  await fs.writeFile(destination, bytes, { mode: 0o600 });
}

async function uploadCanonical(db, output, storagePath) {
  const bytes = await fs.readFile(output.outputFile);
  const { error } = await db.storage.from("social-studio").upload(storagePath, bytes, {
    contentType: output.mimeType,
    upsert: false,
    cacheControl: "31536000",
  });
  if (!error) return;
  if (!/already exists|duplicate/i.test(error.message)) throw error;
  const { data: existing, error: downloadError } = await db.storage.from("social-studio").download(storagePath);
  if (downloadError || !existing) throw new Error("O arquivo idempotente existente não pôde ser confirmado.");
  const existingBytes = new Uint8Array(await existing.arrayBuffer());
  const { createHash } = await import("node:crypto");
  const checksum = createHash("sha256").update(existingBytes).digest("hex");
  if (checksum !== output.checksum) throw new Error("Colisão de caminho: o arquivo existente possui checksum diferente.");
}

export async function processRenderJob(db, job, config) {
  const sourceVersionId = clean(job?.payload?.source_version_id, 80);
  if (!job?.id || !job.organization_id || !job.piece_id || !sourceVersionId) throw new Error("Job de render incompleto.");
  const { data: version, error: versionError } = await db.from("social_piece_versions")
    .select("id,organization_id,piece_id,snapshot_id,template_version_id,conteudo,checksum")
    .eq("id", sourceVersionId).eq("piece_id", job.piece_id).eq("organization_id", job.organization_id).single();
  if (versionError || !version) throw new Error("A versão-fonte não pertence ao job.");
  const { data: piece, error: pieceError } = await db.from("social_pieces")
    .select("id,organization_id,campaign_id,formato,current_version_id")
    .eq("id", job.piece_id).eq("organization_id", job.organization_id).single();
  if (pieceError || !piece) throw new Error("A peça do job não foi encontrada.");
  const { data: assets, error: assetError } = await db.from("social_assets")
    .select("id,organization_id,campaign_id,snapshot_id,storage_bucket,storage_path,mime_type,tipo,ordem_editorial")
    .eq("organization_id", job.organization_id).eq("campaign_id", piece.campaign_id)
    .eq("snapshot_id", version.snapshot_id).eq("tipo", "imagem").order("ordem_editorial").limit(12);
  if (assetError || !assets?.length) throw new Error("Nenhuma imagem original autorizada foi encontrada.");

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "apecerto-studio-render-"));
  try {
    const sourceFiles = [];
    for (const [index, asset] of assets.entries()) {
      const file = path.join(workDir, `source-${index}`);
      await downloadAsset(db, asset, file);
      sourceFiles.push(file);
    }
    const outputs = await renderStudioMedia({
      format: piece.formato,
      content: version.conteudo,
      sourceFiles,
      outputDir: path.join(workDir, "output"),
      ffmpegPath: config.ffmpegPath,
      ffprobePath: config.ffprobePath,
      logoFile: config.logoFile,
      fontFile: config.fontFile,
    });
    const files = [];
    for (const output of outputs) {
      const extension = output.mimeType === "video/mp4" ? "mp4" : "jpg";
      const storagePath = `${job.organization_id}/derivados/${piece.id}/${sourceVersionId}/${output.checksum}-${output.index}.${extension}`;
      await uploadCanonical(db, output, storagePath);
      files.push({
        storage_bucket: "social-studio",
        storage_path: storagePath,
        checksum: output.checksum,
        bytes: output.bytes,
        width: output.width,
        height: output.height,
        duration_seconds: output.duration ?? null,
        mime_type: output.mimeType,
        index: output.index,
        role: output.role,
        probe: output.probe,
        source_asset_id: assets[Math.min(output.index, assets.length - 1)].id,
      });
    }
    const manifest = {
      schema_version: 1,
      renderer: "ffmpeg-worker-v1",
      source_version_id: sourceVersionId,
      rendered_at: new Date().toISOString(),
      files,
    };
    const { data: completed, error: completeError } = await db.rpc("social_service_complete_render_job", {
      p_job_id: job.id,
      p_worker_id: config.workerId,
      p_manifest: manifest,
    });
    if (completeError) throw completeError;
    return completed;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

export async function runOnce() {
  const config = requiredEnvironment();
  const db = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { persistSession: false } });
  const { error: heartbeatError } = await db.from("social_integrations").update({
    status: "configurada",
    config_publica: {
      engine: "ffmpeg-worker-v1",
      image_ready: true,
      video_ready: true,
      activation: "external_worker",
      worker_id: config.workerId,
    },
    verificado_em: new Date().toISOString(),
  }).eq("provider", "renderer").eq("organization_id", config.organizationId);
  if (heartbeatError) throw heartbeatError;
  const { data: job, error } = await db.rpc("social_service_claim_render_job", {
    p_worker_id: config.workerId,
    p_organization_id: config.organizationId,
  });
  if (error) throw error;
  if (!job?.id) return { ok: true, processed: 0 };
  if (job.organization_id !== config.organizationId) throw new Error("O worker recebeu um job fora da organização configurada.");
  try {
    const result = await processRenderJob(db, job, config);
    return { ok: true, processed: 1, jobId: job.id, result };
  } catch (reason) {
    await db.rpc("social_service_fail_render_job", {
      p_job_id: job.id,
      p_worker_id: config.workerId,
      p_error_code: "render_failed",
      p_error_message: clean(reason instanceof Error ? reason.message : reason, 600),
      p_transient: false,
    }).catch(() => undefined);
    throw reason;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runOnce()
    .then((result) => process.stdout.write(JSON.stringify(result) + "\n"))
    .catch((error) => {
      process.stderr.write(JSON.stringify({ ok: false, error: clean(error instanceof Error ? error.message : error, 1_000) }) + "\n");
      process.exitCode = 1;
    });
}
