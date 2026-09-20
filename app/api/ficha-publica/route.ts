import { createServerSupabaseClient } from "../../lib/supabase/server";
import { publicJson, publicToken } from "../../lib/public-api";

export const dynamic = "force-dynamic";

/* Ficha de financiamento pública — validada pelo token do link (sem login).
   Mesmo padrão da agenda pública: RPCs SECURITY DEFINER no banco. */

const validToken = (token: string) => /^[a-f0-9]{30,80}$/i.test(token);

export async function GET(request: Request) {
  const token = publicToken(request);
  if (!validToken(token)) return publicJson({ error: "Link inválido." }, 400);
  const supabase = createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("ficha_publica_obter", { p_token: token });
  if (error) {
    console.error("ficha_publica_falhou", { operacao: "abrir", codigo: error.code ?? "desconhecido" });
    return publicJson({ error: "Não foi possível abrir a ficha no momento." }, 502);
  }
  if (!data) return publicJson({ error: "Esta ficha não existe mais. Peça um novo link ao seu corretor." }, 404);
  if (typeof data !== "object" || Array.isArray(data)) {
    console.error("ficha_publica_falhou", { operacao: "abrir", codigo: "resposta_invalida" });
    return publicJson({ error: "A ficha não pôde ser confirmada no momento." }, 502);
  }
  const ficha = data as Record<string, unknown>;
  return publicJson({
    comprador_nome: null,
    telefone: null,
    email: null,
    status: typeof ficha.status === "string" ? ficha.status : null,
    corretor_nome: typeof ficha.corretor_nome === "string" ? ficha.corretor_nome : null,
    produto: typeof ficha.produto === "string" ? ficha.produto : null,
    valor_imovel: typeof ficha.valor_imovel === "number" ? ficha.valor_imovel : null,
  });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 32_768) {
    return publicJson({ error: "Dados excedem o tamanho permitido." }, 413);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return publicJson({ error: "Formato inválido." }, 415);
  }
  const rawBody = await request.text().catch(() => "");
  if (!rawBody || new TextEncoder().encode(rawBody).byteLength > 32_768) {
    return publicJson({ error: rawBody ? "Dados excedem o tamanho permitido." : "JSON inválido." }, rawBody ? 413 : 400);
  }
  let body: { token?: string; dados?: Record<string, unknown> };
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return publicJson({ error: "JSON inválido." }, 400);
    }
    body = parsed as { token?: string; dados?: Record<string, unknown> };
  } catch {
    return publicJson({ error: "JSON inválido." }, 400);
  }
  const token = publicToken(request, body.token);
  if (!validToken(token)) return publicJson({ error: "Link inválido." }, 400);
  if (!body.dados || typeof body.dados !== "object" || Array.isArray(body.dados)) return publicJson({ error: "Dados inválidos." }, 422);
  const supabase = createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("ficha_publica_enviar", { p_token: token, p_dados: body.dados });
  if (error) {
    console.error("ficha_publica_falhou", { operacao: "enviar", codigo: error.code ?? "desconhecido" });
    return publicJson({ error: "Não foi possível enviar a ficha no momento." }, 502);
  }
  const result = (data ?? {}) as { ok?: boolean };
  if (result.ok !== true) return publicJson({ error: "A ficha não foi confirmada. Verifique os dados e tente novamente." }, 422);
  return publicJson({ success: true });
}
