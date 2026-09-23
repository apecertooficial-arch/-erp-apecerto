import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const projectRoot = process.cwd();
const output = path.join(
  projectRoot,
  "public/media/abordagens/autoral-moema/autoral-moema-original-02.mp4",
);
const parts = ["aa", "ab"].map((suffix) => path.join(
  projectRoot,
  `media-sources/abordagens/autoral-moema/autoral-moema-original-02.mp4.part-${suffix}`,
));
const expectedBytes = 105_202_824;
const expectedSha256 = "d3f59f3b360e9e9c34901607459d65c15c86e023b98e7505a5bfb0c309d7c846";

async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function isComplete(file) {
  try {
    const info = await stat(file);
    return info.size === expectedBytes && await sha256(file) === expectedSha256;
  } catch {
    return false;
  }
}

if (await isComplete(output)) {
  console.log("Autoral Moema video 02 already assembled and verified.");
  process.exit(0);
}

for (const part of parts) await access(part);
await mkdir(path.dirname(output), { recursive: true });

const temporary = `${output}.tmp`;
await unlink(temporary).catch(() => {});

for (const [index, part] of parts.entries()) {
  await pipeline(
    createReadStream(part),
    createWriteStream(temporary, { flags: index === 0 ? "w" : "a" }),
  );
}

if (!await isComplete(temporary)) {
  await unlink(temporary).catch(() => {});
  throw new Error("AUTORAL_MOEMA_VIDEO_02_INTEGRITY_CHECK_FAILED");
}

await rename(temporary, output);
console.log("Autoral Moema video 02 assembled and verified.");
