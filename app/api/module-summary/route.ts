import type { Database } from "../../lib/supabase/database.types";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { isModuleName, moduleMap } from "../../features/system/module-map";

export const dynamic = "force-dynamic";

type TableName = keyof Database["public"]["Tables"];

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!accessToken) return Response.json({ error: "Sessão necessária." }, { status: 401 });

  const requestedModule = new URL(request.url).searchParams.get("module") ?? "";
  if (!isModuleName(requestedModule)) {
    return Response.json({ error: "Módulo desconhecido." }, { status: 400 });
  }

  const definition = moduleMap[requestedModule];
  const supabase = createServerSupabaseClient(accessToken);
  const { error: authError } = await supabase.auth.getUser(accessToken);
  if (authError) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const connections = await Promise.all(definition.tables.map(async (table) => {
    const [{ count, error }, sample] = await Promise.all([
      supabase.from(table as TableName).select("*", { count: "exact", head: true }),
      supabase.from(table as TableName).select("*").limit(12),
    ]);

    return {
      table,
      count: count ?? 0,
      connected: !error && !sample.error,
      error: error?.message ?? sample.error?.message ?? null,
      records: sample.data ?? [],
    };
  }));

  return Response.json({
    module: requestedModule,
    mode: "production-readonly",
    description: definition.description,
    gap: "gap" in definition ? definition.gap : null,
    connections,
  });
}
