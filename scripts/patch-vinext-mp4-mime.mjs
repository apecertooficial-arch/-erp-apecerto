import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MP4_ENTRY = '\t".mp4": "video/mp4",';
const M4V_ENTRY = '\t".m4v": "video/mp4",';
const INSERTION_ANCHOR = '\t".map": "application/json",';

export function patchVinextMp4Mime(source) {
  const hasMp4 = source.includes(MP4_ENTRY);
  const hasM4v = source.includes(M4V_ENTRY);

  if (hasMp4 && hasM4v) {
    return { changed: false, source };
  }

  if (hasMp4 !== hasM4v) {
    throw new Error("VINEXT_MP4_MIME_PARTIAL_PATCH");
  }

  const anchorOccurrences = source.split(INSERTION_ANCHOR).length - 1;
  if (anchorOccurrences !== 1) {
    throw new Error("VINEXT_MP4_MIME_ANCHOR_NOT_FOUND");
  }

  return {
    changed: true,
    source: source.replace(
      INSERTION_ANCHOR,
      `${MP4_ENTRY}\n${M4V_ENTRY}\n${INSERTION_ANCHOR}`,
    ),
  };
}

export async function patchInstalledVinext(projectRoot = process.cwd()) {
  const target = path.join(
    projectRoot,
    "node_modules",
    "vinext",
    "dist",
    "server",
    "static-file-cache.js",
  );
  const current = await readFile(target, "utf8");
  const result = patchVinextMp4Mime(current);

  if (result.changed) {
    await writeFile(target, result.source, "utf8");
  }

  return { changed: result.changed, target };
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const result = await patchInstalledVinext();
  console.log(
    result.changed
      ? "Vinext MP4 MIME table patched."
      : "Vinext MP4 MIME table already patched.",
  );
}
