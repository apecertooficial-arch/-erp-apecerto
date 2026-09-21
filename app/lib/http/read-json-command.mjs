export const FUNIL2_COMMAND_MAX_BYTES = 64 * 1024;

const falha = (status, code, message) => ({ ok: false, status, code, message });

function ehJson(contentType) {
  const mediaType = String(contentType ?? "").split(";", 1)[0].trim().toLowerCase();
  return mediaType === "application/json"
    || /^application\/[a-z0-9!#$&^_.+-]+\+json$/.test(mediaType);
}

/**
 * Lê um comando JSON pequeno sem confiar em Content-Length. O limite também é
 * aplicado durante o streaming, antes de juntar ou interpretar o corpo.
 *
 * @param {Request} request
 * @param {number} [maxBytes]
 * @returns {Promise<
 *   | { ok: true, value: Record<string, unknown> }
 *   | { ok: false, status: number, code: string, message: string }
 * >}
 */
export async function lerComandoJson(request, maxBytes = FUNIL2_COMMAND_MAX_BYTES) {
  if (!ehJson(request.headers.get("content-type"))) {
    return falha(415, "conteudo_nao_suportado", "Envie o comando como JSON.");
  }

  const declarado = request.headers.get("content-length");
  if (declarado && /^\d+$/.test(declarado) && Number(declarado) > maxBytes) {
    return falha(413, "comando_muito_grande", "O comando enviado ultrapassa o limite permitido.");
  }
  if (!request.body) return falha(400, "json_invalido", "JSON inválido.");

  const leitor = request.body.getReader();
  const partes = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await leitor.cancel("comando_muito_grande").catch(() => undefined);
        return falha(413, "comando_muito_grande", "O comando enviado ultrapassa o limite permitido.");
      }
      partes.push(value);
    }
  } catch {
    return falha(400, "json_invalido", "JSON inválido.");
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const parte of partes) {
    bytes.set(parte, offset);
    offset += parte.byteLength;
  }

  try {
    const texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const value = JSON.parse(texto, (chave, item) => {
      if (["__proto__", "prototype", "constructor"].includes(chave)) {
        throw new SyntaxError("chave_reservada");
      }
      return item;
    });
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return falha(400, "json_invalido", "JSON inválido.");
    }
    return { ok: true, value };
  } catch {
    return falha(400, "json_invalido", "JSON inválido.");
  }
}
