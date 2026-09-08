import assert from "node:assert/strict";
import test from "node:test";

import { patchVinextMp4Mime } from "../scripts/patch-vinext-mp4-mime.mjs";

const VINEXT_MIME_TABLE = `const CONTENT_TYPES = {
\t".webp": "image/webp",
\t".avif": "image/avif",
\t".map": "application/json",
\t".rsc": "text/x-component"
};`;

test("adiciona MP4 e M4V à tabela MIME usada pelo servidor Vinext", () => {
  const result = patchVinextMp4Mime(VINEXT_MIME_TABLE);

  assert.equal(result.changed, true);
  assert.match(result.source, /"\.mp4": "video\/mp4"/);
  assert.match(result.source, /"\.m4v": "video\/mp4"/);
  assert.match(result.source, /"\.map": "application\/json"/);
});

test("é idempotente e não altera novamente uma instalação corrigida", () => {
  const first = patchVinextMp4Mime(VINEXT_MIME_TABLE);
  const second = patchVinextMp4Mime(first.source);

  assert.equal(second.changed, false);
  assert.equal(second.source, first.source);
});

test("falha fechada se a estrutura interna do Vinext mudar", () => {
  assert.throws(
    () => patchVinextMp4Mime("const CONTENT_TYPES = {};"),
    /VINEXT_MP4_MIME_ANCHOR_NOT_FOUND/,
  );
});
