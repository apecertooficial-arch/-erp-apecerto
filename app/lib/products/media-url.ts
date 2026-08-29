import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Builds an authenticated URL from an opaque media id. */
export function productMediaUrl(mediaId: string | null | undefined) {
  return mediaId && UUID.test(mediaId)
    ? `/api/product-media?id=${encodeURIComponent(mediaId)}`
    : null;
}

export async function signedProductMediaUrls(
  supabase: SupabaseClient<Database>,
  rows: Array<{ storage_path?: string | null }>,
) {
  const paths = [...new Set(rows.map((row) => row.storage_path).filter((path): path is string => Boolean(path)))];
  const result = new Map<string, string>();
  if (!paths.length) return result;
  const { data, error } = await supabase.storage.from("empreendimentos").createSignedUrls(paths, 300);
  if (error) return result;
  for (const item of data ?? []) if (item.path && item.signedUrl) result.set(item.path, item.signedUrl);
  return result;
}
