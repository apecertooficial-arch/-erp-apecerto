import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const FORMAT_SIZE = {
  feed: { width: 1080, height: 1350, role: "single" },
  carousel: { width: 1080, height: 1350, role: "slide" },
  story: { width: 1080, height: 1920, role: "story" },
  reel: { width: 1080, height: 1920, role: "reel" },
};

function assertFilePath(value, label) {
  if (typeof value !== "string" || !path.isAbsolute(value)) throw new Error(`${label} precisa ser um caminho absoluto.`);
  return value;
}

function filterPath(value) {
  return value.replaceAll("\\", "/").replaceAll(":", "\\:").replaceAll("'", "\\'");
}

function wrapText(value, maxLine = 28, maxChars = 180) {
  const words = String(value ?? "").trim().slice(0, maxChars).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxLine && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4).join("\n");
}

function rowsFor(format, content) {
  if (format === "carousel" && Array.isArray(content.slides) && content.slides.length) {
    return content.slides.slice(0, 10).map((row, index) => ({
      text: row?.titulo || row?.texto || content.headline,
      cta: index === content.slides.length - 1 ? content.cta : row?.texto || "",
      mediaIndex: Number.isInteger(Number(row?.media_index)) ? Number(row.media_index) : index,
      duration: 0,
    }));
  }
  if (format === "story" && Array.isArray(content.stories) && content.stories.length) {
    return content.stories.slice(0, 10).map((row, index) => ({
      text: row?.titulo || row?.texto || content.headline,
      cta: row?.texto || content.cta,
      mediaIndex: Number.isInteger(Number(row?.media_index)) ? Number(row.media_index) : index,
      duration: 0,
    }));
  }
  if (format === "reel" && Array.isArray(content.cenas) && content.cenas.length) {
    return content.cenas.slice(0, 12).map((row, index) => ({
      text: row?.texto_tela || content.headline,
      cta: index === content.cenas.length - 1 ? content.cta : "",
      mediaIndex: Number.isInteger(Number(row?.media_index)) ? Number(row.media_index) : index,
      duration: Math.max(1, Math.min(15, Number(row?.duracao_segundos) || 3)),
    }));
  }
  return [{ text: content.headline, cta: content.cta, mediaIndex: 0, duration: format === "reel" ? 5 : 0 }];
}

async function run(binary, args, timeoutMs = 120_000) {
  assertFilePath(binary, "Binário");
  return await new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Processo de mídia excedeu ${timeoutMs} ms.`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout = (stdout + chunk).slice(-200_000); });
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-200_000); });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Processo de mídia falhou (código ${code}): ${stderr.slice(-2_000)}`));
    });
  });
}

function visualFilter({ width, height, headlineFile, ctaFile, fontFile }) {
  const headlineY = height - 500;
  const ctaY = height - 195;
  return [
    `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`,
    `drawbox=x=0:y=${height - 650}:w=${width}:h=650:color=black@0.52:t=fill`,
    `drawbox=x=76:y=${height - 682}:w=150:h=12:color=0xFF7000@1:t=fill`,
    `drawtext=fontfile='${filterPath(fontFile)}':textfile='${filterPath(headlineFile)}':fontcolor=white:fontsize=72:line_spacing=14:x=76:y=${headlineY}`,
    `drawtext=fontfile='${filterPath(fontFile)}':textfile='${filterPath(ctaFile)}':fontcolor=0xFFDFC7:fontsize=38:x=76:y=${ctaY}[base]`,
    `[1:v]scale=300:-1[logo]`,
    `[base][logo]overlay=76:72:format=auto[out]`,
  ].join(",");
}

async function prepareTextFiles(workDir, index, row) {
  const headlineFile = path.join(workDir, `headline-${index}.txt`);
  const ctaFile = path.join(workDir, `cta-${index}.txt`);
  await fs.writeFile(headlineFile, wrapText(row.text, 27, 180), { encoding: "utf8", mode: 0o600 });
  await fs.writeFile(ctaFile, wrapText(row.cta, 42, 100), { encoding: "utf8", mode: 0o600 });
  return { headlineFile, ctaFile };
}

async function renderJpeg({ ffmpegPath, sourceFile, logoFile, fontFile, outputFile, width, height, textFiles }) {
  const filter = visualFilter({ width, height, ...textFiles, fontFile });
  await run(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", sourceFile, "-i", logoFile,
    "-filter_complex", filter, "-map", "[out]",
    "-frames:v", "1", "-q:v", "2", "-pix_fmt", "yuvj420p", outputFile,
  ]);
}

async function renderVideoScene({ ffmpegPath, sourceFile, logoFile, fontFile, outputFile, width, height, duration, textFiles }) {
  const filter = visualFilter({ width, height, ...textFiles, fontFile });
  await run(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-loop", "1", "-framerate", "30", "-i", sourceFile, "-i", logoFile,
    "-filter_complex", filter, "-map", "[out]",
    "-t", String(duration), "-r", "30", "-c:v", "libx264", "-preset", "medium",
    "-crf", "20", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", outputFile,
  ]);
}

export async function inspectMedia({ ffprobePath, ffmpegPath, file }) {
  const { stdout } = await run(ffprobePath, [
    "-v", "error", "-show_streams", "-show_format", "-of", "json", file,
  ], 30_000);
  const probe = JSON.parse(stdout);
  const video = Array.isArray(probe.streams) ? probe.streams.find((stream) => stream.codec_type === "video") : null;
  if (!video) throw new Error("O arquivo final não contém faixa visual.");
  await run(ffmpegPath, ["-v", "error", "-i", file, "-f", "null", "-"], 120_000);
  return {
    formatName: String(probe.format?.format_name ?? ""),
    duration: Number(probe.format?.duration ?? video.duration ?? 0),
    codec: String(video.codec_name ?? ""),
    pixelFormat: String(video.pix_fmt ?? ""),
    width: Number(video.width ?? 0),
    height: Number(video.height ?? 0),
    audioStreams: Array.isArray(probe.streams) ? probe.streams.filter((stream) => stream.codec_type === "audio").length : 0,
  };
}

async function digestFile(file) {
  const bytes = await fs.readFile(file);
  return { checksum: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, header: bytes.subarray(0, 16) };
}

export async function renderStudioMedia({
  format,
  content,
  sourceFiles,
  outputDir,
  ffmpegPath,
  ffprobePath,
  logoFile,
  fontFile,
}) {
  const size = FORMAT_SIZE[format];
  if (!size) throw new Error("Formato de Studio inválido.");
  if (!Array.isArray(sourceFiles) || !sourceFiles.length) throw new Error("Nenhuma imagem original foi fornecida ao renderer.");
  for (const [value, label] of [[ffmpegPath, "FFmpeg"], [ffprobePath, "FFprobe"], [logoFile, "Logo"], [fontFile, "Fonte"], [outputDir, "Diretório de saída"]]) assertFilePath(value, label);
  await fs.mkdir(outputDir, { recursive: true });
  const workDir = await fs.mkdtemp(path.join(outputDir, ".render-"));
  try {
    const rows = rowsFor(format, content ?? {});
    if (format === "reel") {
      const segments = [];
      for (const [index, row] of rows.entries()) {
        const sourceFile = sourceFiles[Math.abs(row.mediaIndex) % sourceFiles.length];
        const textFiles = await prepareTextFiles(workDir, index, row);
        const segment = path.join(workDir, `scene-${String(index).padStart(2, "0")}.mp4`);
        await renderVideoScene({ ffmpegPath, sourceFile, logoFile, fontFile, outputFile: segment, width: size.width, height: size.height, duration: row.duration, textFiles });
        segments.push(segment);
      }
      const concatFile = path.join(workDir, "segments.txt");
      await fs.writeFile(concatFile, segments.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"), { encoding: "utf8", mode: 0o600 });
      const outputFile = path.join(outputDir, "reel.mp4");
      await run(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", concatFile, "-c", "copy", "-movflags", "+faststart", outputFile]);
      const probe = await inspectMedia({ ffprobePath, ffmpegPath, file: outputFile });
      if (!probe.formatName.includes("mp4") || probe.codec !== "h264" || probe.pixelFormat !== "yuv420p" || probe.width !== 1080 || probe.height !== 1920 || probe.duration <= 0) {
        throw new Error(`MP4 fora do contrato: ${JSON.stringify(probe)}`);
      }
      const file = await digestFile(outputFile);
      if (file.header.subarray(4, 8).toString("ascii") !== "ftyp") throw new Error("Assinatura MP4 inválida.");
      return [{ outputFile, ...file, width: size.width, height: size.height, duration: probe.duration, index: 0, role: size.role, mimeType: "video/mp4", probe }];
    }

    const outputs = [];
    for (const [index, row] of rows.entries()) {
      const sourceFile = sourceFiles[Math.abs(row.mediaIndex) % sourceFiles.length];
      const textFiles = await prepareTextFiles(workDir, index, row);
      const outputFile = path.join(outputDir, `${format}-${String(index).padStart(2, "0")}.jpg`);
      await renderJpeg({ ffmpegPath, sourceFile, logoFile, fontFile, outputFile, width: size.width, height: size.height, textFiles });
      const probe = await inspectMedia({ ffprobePath, ffmpegPath, file: outputFile });
      if (probe.codec !== "mjpeg" || probe.width !== size.width || probe.height !== size.height) throw new Error(`JPEG fora do contrato: ${JSON.stringify(probe)}`);
      const file = await digestFile(outputFile);
      if (!(file.header[0] === 0xff && file.header[1] === 0xd8 && file.header[2] === 0xff)) throw new Error("Assinatura JPEG inválida.");
      outputs.push({ outputFile, ...file, width: size.width, height: size.height, index, role: size.role, mimeType: "image/jpeg", probe });
    }
    return outputs;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

