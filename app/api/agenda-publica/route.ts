import { createServerSupabaseClient } from "../../lib/supabase/server";
import { publicJson, publicToken } from "../../lib/public-api";

export const dynamic = "force-dynamic";

/* Agenda pública (somente leitura) — validada pelo código secreto do link. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = publicToken(request);
  if (!/^[a-f0-9]{40,80}$/i.test(token)) {
    return publicJson({ error: "Link inválido." }, 400);
  }
  const dia = (v: string | null) => {
    const partes = v?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!partes) return null;
    const ano = Number(partes[1]);
    const mes = Number(partes[2]);
    const numeroDia = Number(partes[3]);
    const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0);
    const diasPorMes = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return mes >= 1 && mes <= 12 && numeroDia >= 1 && numeroDia <= diasPorMes[mes - 1] ? v : null;
  };
  const de = dia(params.get("de"));
  const ate = dia(params.get("ate"));
  if ((params.has("de") && !de) || (params.has("ate") && !ate)) {
    return publicJson({ error: "Período inválido." }, 400);
  }
  if (de && ate) {
    const inicio = Date.parse(`${de}T12:00:00Z`);
    const fim = Date.parse(`${ate}T12:00:00Z`);
    if (fim < inicio || fim - inicio > 62 * 86_400_000) {
      return publicJson({ error: "O período da agenda deve ter no máximo 62 dias." }, 422);
    }
  }
  const supabase = createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("agenda_publica", { p_token: token, p_de: de, p_ate: ate });
  if (error) {
    console.error("agenda_publica_falhou", { codigo: error.code ?? "desconhecido" });
    return publicJson({ error: "Não foi possível abrir a agenda no momento." }, 502);
  }
  if (!data) return publicJson({ error: "Este link de agenda não existe mais. Peça o link atualizado." }, 404);
  if (typeof data !== "object" || Array.isArray(data) || !Array.isArray((data as { visitas?: unknown }).visitas)) {
    console.error("agenda_publica_falhou", { codigo: "resposta_invalida" });
    return publicJson({ error: "A agenda não pôde ser confirmada no momento." }, 502);
  }
  return publicJson(data);
}
