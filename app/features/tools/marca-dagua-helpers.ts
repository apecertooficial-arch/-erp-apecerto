/* Marca d'Água — funções compartilhadas entre o fluxo de uma foto
 * (WatermarkRemoverSingle) e o fluxo em lote (WatermarkRemoverBatch).
 * Nenhuma delas grava nada no banco nem no Storage — só chamam a function
 * remover-marca-dagua e devolvem o resultado pronto pro front.
 */

import { getBrowserSupabaseClient } from "../../lib/supabase/browser";

export type ResultadoRemocao =
  | { kind: "blob"; blob: Blob; mime: string }
  | { kind: "externo"; url: string; expiraEm: string };

export function extensaoDoMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

// Curto o bastante pra não poluir o nome do arquivo, único o bastante pra não
// colidir entre downloads da mesma sessão.
export function idCurto(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

// Nome base sem extensão, sem espaço e sem caractere que confunda o SO na hora
// de salvar o download.
export function nomeBase(nomeOriginal: string): string {
  const semExtensao = nomeOriginal.replace(/\.[^./\\]+$/, "");
  const limpo = semExtensao.trim().replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 40);
  return limpo || "foto";
}

export function base64ParaBlob(base64: string, mime: string): Blob {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// Chama a function remover-marca-dagua pra um arquivo e devolve o resultado
// já normalizado (blob pronto pra Blob local, ou link externo de fallback).
export async function removerMarcaDagua(
  arquivo: File,
  opcoes: { removerTexto: boolean; melhorarQualidade: boolean },
): Promise<ResultadoRemocao> {
  const form = new FormData();
  form.append("arquivo", arquivo);
  form.append("remover_logo", "true");
  form.append("remover_texto", String(opcoes.removerTexto));
  form.append("melhorar_qualidade", String(opcoes.melhorarQualidade));

  const { data, error } = await getBrowserSupabaseClient().functions.invoke("remover-marca-dagua", { body: form });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const detalhe = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
    throw new Error((detalhe as { detail?: string })?.detail || (detalhe as { error?: string })?.error || error.message);
  }

  const r = (data ?? {}) as { ok?: boolean; base64?: string; mime?: string; url?: string; expira_em?: string; error?: string; detail?: string };
  if (!r.ok) throw new Error(r.detail || r.error || "A Unwatermark não devolveu um resultado.");
  if (r.base64 && r.mime) return { kind: "blob", blob: base64ParaBlob(r.base64, r.mime), mime: r.mime };
  if (r.url) return { kind: "externo", url: r.url, expiraEm: r.expira_em ?? "24h" };
  throw new Error("A Unwatermark não devolveu um resultado.");
}
