import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database";

export function createServerSupabaseClient(accessToken?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Configuração pública do Supabase não encontrada.");
  }

  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        "x-apecerto-client": "codex-production-readonly",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    },
  });
}

/**
 * Cliente privilegiado exclusivo do runtime servidor.
 *
 * Nunca exportar esta chave para componentes `use client` nem usar o helper
 * como atalho de autorização. O chamador público precisa validar entrada,
 * limitar abuso e invocar apenas RPCs service-only de escopo mínimo.
 */
export function createServerSupabaseServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Configuração privada do Supabase não encontrada.");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-apecerto-client": "erp-server-private" } },
  });
}
