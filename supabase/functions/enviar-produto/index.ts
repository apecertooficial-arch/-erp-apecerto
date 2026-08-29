// enviar-produto — envia o PACK do produto (fotos + book) numa unica chamada.
// Reutiliza dapi-enviar (que resolve instancia, trata 9º digito e registra no chat).
//
// v6 (SEGURANCA): ate a v4 esta funcao era um endpoint PUBLICO de envio de WhatsApp.
// verify_jwt=false e nenhuma verificacao no corpo: qualquer POST disparava ate 200
// fotos pela instancia da empresa. Agora exige o token de servico interno.
//
// Como o token e verificado: a funcao NAO le o segredo. Ela manda o que recebeu
// para a RPC ncrm_envio_token_valido, que compara dentro do banco e responde
// apenas sim ou nao. O valor esperado nunca sai do Vault nem trafega pela rede.
// Para falar com dapi-enviar, repassa o mesmo header que ja foi validado.
//
// verify_jwt continua false de proposito: quem chama sao maquinas, identificadas
// pelo header x-envio-interno, nao por JWT de usuario.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE);
const DAPI_ENVIAR = `${SUPABASE_URL}/functions/v1/dapi-enviar`;

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ordem amigavel: capa -> fachada -> decorado -> lazer -> planta -> sala -> resto
const ORDEM: Record<string, number> = { fachada: 1, decorado: 2, lazer: 3, planta: 4, sala: 5 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // ---- porta de entrada: so maquina identificada passa ----
  const credencial = req.headers.get("x-envio-interno") ?? "";
  if (!credencial) return json({ error: "nao_autorizado" }, 401);
  const { data: valido, error: erroTok } = await admin.rpc("ncrm_envio_token_valido", { p_token: credencial });
  if (erroTok) return json({ error: "servico_indisponivel" }, 503);
  if (valido !== true) return json({ error: "nao_autorizado" }, 401);

  let p: any = {}; try { p = await req.json(); } catch { return json({ error: "json_invalido" }, 400); }

  const empreendimentoId = String(p.empreendimento_id ?? "");
  const telefone = String(p.telefone ?? p.to ?? "");
  if (!empreendimentoId) return json({ error: "empreendimento_id_obrigatorio" }, 400);
  const dryRun = p.dry_run === true;
  if (!dryRun && !telefone) return json({ error: "telefone_obrigatorio" }, 400);

  const categorias: string[] | null = Array.isArray(p.categorias) && p.categorias.length ? p.categorias.map((c: unknown) => String(c).toLowerCase()) : null;
  const maxFotos = Math.min(Math.max(Number(p.max_fotos) || 200, 1), 200);

  const { data: midias, error } = await admin.from("midias")
    .select("id, tipo, storage_path, categoria, nome, is_capa")
    .eq("empreendimento_id", empreendimentoId)
    .eq("tipo", "foto");
  if (error) return json({ error: "db", detail: error.message }, 500);

  let fotos = (midias ?? []).filter((m: any) => m.storage_path);
  if (categorias) fotos = fotos.filter((m: any) => categorias.includes(String(m.categoria ?? "").toLowerCase()));
  fotos.sort((a: any, b: any) => (b.is_capa ? 1 : 0) - (a.is_capa ? 1 : 0)
    || (ORDEM[String(a.categoria ?? "").toLowerCase()] ?? 9) - (ORDEM[String(b.categoria ?? "").toLowerCase()] ?? 9));
  fotos = fotos.slice(0, maxFotos);
  const { data: signedRows, error: signedError } = await admin.storage.from("empreendimentos")
    .createSignedUrls(fotos.map((m: any) => m.storage_path), 900);
  if (signedError) return json({ error: "midia_indisponivel" }, 503);
  const signedByPath = new Map((signedRows ?? []).map((item: any) => [item.path, item.signedUrl]));
  if (fotos.some((m: any) => !signedByPath.get(m.storage_path))) return json({ error: "midia_indisponivel" }, 503);

  const { data: emp } = await admin.from("empreendimentos").select("nome, bairro, cidade, preco").eq("id", empreendimentoId).maybeSingle();
  const legenda = typeof p.legenda === "string" && p.legenda.trim() ? p.legenda.trim()
    : emp ? `${emp.nome}${emp.bairro ? " · " + emp.bairro : ""}${emp.cidade ? ", " + emp.cidade : ""}` : null;
  const bookUrl = typeof p.book_url === "string" && p.book_url.trim() ? p.book_url.trim() : null;

  const plano = {
    empreendimento: emp?.nome ?? null,
    total_fotos: fotos.length,
    fotos_urls: fotos.map((m: any) => signedByPath.get(m.storage_path)),
    book_url: bookUrl,
    legenda,
  };
  if (dryRun) return json({ ok: true, dry_run: true, plano });

  const baseEnvio: Record<string, unknown> = { to: telefone };
  if (p.instancia_id) baseEnvio.instancia_id = p.instancia_id;
  if (p.corretor_id) baseEnvio.corretor_id = p.corretor_id;
  if (p.corretor_nome) baseEnvio.corretor_nome = p.corretor_nome;

  async function enviar(payload: Record<string, unknown>) {
    try {
      // Repassa a credencial ja validada: dapi-enviar tambem exige.
      const r = await fetch(DAPI_ENVIAR, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-envio-interno": credencial },
        body: JSON.stringify({ ...baseEnvio, ...payload }),
      });
      const b = await r.json().catch(() => ({}));
      return { ok: r.ok && b?.error == null, body: b };
    } catch (e) { return { ok: false, body: String(e) }; }
  }

  const resultados: any[] = [];
  let enviadas = 0, falhas = 0;

  if (legenda) { const r = await enviar({ tipo: "text", texto: legenda }); resultados.push({ etapa: "resumo", ok: r.ok }); await sleep(400); }
  if (bookUrl) { const r = await enviar({ tipo: "document", url: bookUrl, fileName: `${emp?.nome ?? "book"}.pdf` }); resultados.push({ etapa: "book", ok: r.ok }); if (r.ok) enviadas++; else falhas++; await sleep(500); }

  for (const m of fotos) {
    const r = await enviar({ tipo: "image", url: signedByPath.get(m.storage_path) });
    if (r.ok) enviadas++; else { falhas++; resultados.push({ foto: m.id, ok: false, motivo: r.body?.motivo ?? r.body }); }
    await sleep(500);
  }

  return json({ ok: true, empreendimento: emp?.nome ?? null, enviadas, falhas, total_fotos: fotos.length, com_book: Boolean(bookUrl), amostra_falhas: resultados.filter((x) => x.ok === false).slice(0, 5) });
});
