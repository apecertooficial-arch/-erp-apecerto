// VARREDURA: ESTE NUMERO TEM WHATSAPP?
//
// POR QUE EXISTE. Ate hoje a unica forma de descobrir que um numero nao tem
// WhatsApp era um corretor abrir a conversa e o aplicativo avisar. Isso custa o
// tempo dele, custa a confianca na fila e ainda produz descarte que apaga do
// funil quem talvez fosse recuperavel. Em 11/08 isso aconteceu dez vezes.
//
// A D-API responde direto: POST /api/v1/contacts/check. Nenhuma mensagem e
// enviada -- e consulta pura.
//
// v3 -- POR QUE EM PEDACOS PEQUENOS. A v2 mandava a fila inteira num POST so e
// batia no timeout: 130 numeros estourou, 40 tambem. O check parece ser serial
// do lado de la, entao o custo cresce com o tamanho da lista e um lote grande
// nunca volta. Agora vai em blocos de 4, alguns blocos ao mesmo tempo, e -- o
// ponto principal -- CADA BLOCO GRAVA ASSIM QUE VOLTA. Se o processo morrer no
// meio, o que ja foi verificado esta salvo; a proxima chamada continua de onde
// parou em vez de comecar do zero.
//
// O FORMATO DA RESPOSTA NAO E DOCUMENTADO. Por isso a funcao devolve o corpo
// CRU quando nao consegue interpretar: adivinhar formato de API em producao foi
// exatamente o erro que trouxe o problema ate aqui.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHECK = "https://api.d-api.cloud/api/v1/contacts/check";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

function lerVeredito(item: unknown): { numero: string | null; tem: boolean | null } {
  if (!item || typeof item !== "object") return { numero: null, tem: null };
  const o = item as Record<string, unknown>;
  const numero = String(o.number ?? o.phone ?? o.jid ?? o.id ?? o.numero ?? o.user ?? "").replace(/\D/g, "") || null;
  for (const chave of ["exists", "isRegistered", "registered", "isWhatsapp", "isWhatsApp", "hasWhatsapp", "valid", "onWhatsApp", "isInWhatsapp", "isUser"]) {
    const v = o[chave];
    if (typeof v === "boolean") return { numero, tem: v };
    if (v === "true" || v === "false") return { numero, tem: v === "true" };
  }
  if (o.status === "valid" || o.status === "registered") return { numero, tem: true };
  if (o.status === "invalid" || o.status === "not_registered") return { numero, tem: false };
  return { numero, tem: null };
}

function listaDaResposta(resp: unknown): unknown[] {
  if (Array.isArray(resp)) return resp;
  if (resp && typeof resp === "object") {
    const o = resp as Record<string, unknown>;
    for (const chave of ["data", "result", "results", "contacts", "numbers", "items", "users", "response", "checks"]) {
      const v = o[chave];
      if (Array.isArray(v)) return v;
      if (v && typeof v === "object") {
        const dentro = listaDaResposta(v);
        if (dentro.length) return dentro;
      }
    }
  }
  return [];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const interno = req.headers.get("x-envio-interno");
  if (!interno) return json({ error: "nao_autorizado" }, 401);
  const { data: ok } = await admin.rpc("ncrm_envio_token_valido", { p_token: interno });
  if (ok !== true) return json({ error: "nao_autorizado" }, 401);

  let p: Record<string, unknown> = {};
  try { p = await req.json(); } catch { /* corpo vazio e permitido */ }
  const lote = String(p.lote ?? "carinas-ago26");
  const teto = Math.max(1, Math.min(Number(p.limite ?? 40), 200));
  const bloco = Math.max(1, Math.min(Number(p.bloco ?? 4), 20));
  const frentes = Math.max(1, Math.min(Number(p.frentes ?? 4), 8));
  const esperaMs = Math.max(5000, Math.min(Number(p.espera_ms ?? 30000), 60000));
  const numerosDados = Array.isArray(p.numeros) ? (p.numeros as string[]) : null;
  const gravar = p.gravar !== false;

  const { data: inst } = await admin
    .from("instancias")
    .select("id, instancia_dapi, conectada, status_dapi, instancias_credenciais(apikey)")
    .eq("ativa", true);
  const viva = (inst ?? []).find((i: Record<string, unknown>) => {
    const cred = i.instancias_credenciais as { apikey?: string } | null;
    return (i.conectada === true || i.status_dapi === "connected") && cred?.apikey;
  });
  if (!viva) return json({ error: "sem_instancia_conectada" }, 422);
  const sessionId = String(viva.instancia_dapi);
  const apikey = String((viva.instancias_credenciais as { apikey: string }).apikey);

  let numeros: string[];
  if (numerosDados) {
    numeros = numerosDados.map((n) => String(n).replace(/\D/g, "")).filter((n) => n.length >= 12);
  } else {
    const { data: fila } = await admin.rpc("f2_carga_numeros_para_checar", { p_lote: lote, p_limite: teto });
    numeros = ((fila ?? []) as { telefone: string }[]).map((r) => r.telefone);
  }
  if (!numeros.length) return json({ ok: true, checados: 0, acao: "nada a verificar" });

  const pedacos: string[][] = [];
  for (let i = 0; i < numeros.length; i += bloco) pedacos.push(numeros.slice(i, i + bloco));

  const vereditos: { numero: string; tem: boolean }[] = [];
  const falhas: { numeros: number; motivo: string }[] = [];
  let indefinidos = 0;
  let cru = "";

  // Um bloco que falha nao derruba os outros: e registrado e a fila o devolve
  // na proxima chamada, porque so sai da fila quem ganhou veredito gravado.
  async function rodar(lista: string[]) {
    try {
      const r = await fetch(CHECK, {
        method: "POST",
        headers: { Authorization: apikey, "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, numbers: lista, async: false }),
        signal: AbortSignal.timeout(esperaMs),
      });
      const texto = await r.text();
      if (!r.ok) { falhas.push({ numeros: lista.length, motivo: `http_${r.status}` }); if (!cru) cru = texto.slice(0, 800); return; }
      let resp: unknown = null;
      try { resp = JSON.parse(texto); } catch { /* segue com resp null */ }
      const linhas = listaDaResposta(resp);
      if (!linhas.length) { falhas.push({ numeros: lista.length, motivo: "formato_desconhecido" }); if (!cru) cru = texto.slice(0, 800); return; }
      const doBloco: { numero: string; tem: boolean }[] = [];
      for (let i = 0; i < linhas.length; i++) {
        const { numero, tem } = lerVeredito(linhas[i]);
        const alvo = numero ?? lista[i] ?? null;
        if (!alvo || tem === null) { indefinidos++; continue; }
        doBloco.push({ numero: alvo, tem });
      }
      if (!doBloco.length) return;
      // GRAVA JA. O valor da varredura esta no que sobreviveu, nao no total.
      if (gravar) await admin.rpc("f2_carga_gravar_veredito", { p_lote: lote, p_vereditos: doBloco });
      vereditos.push(...doBloco);
    } catch (e) {
      falhas.push({ numeros: lista.length, motivo: String(e).slice(0, 120) });
    }
  }

  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(frentes, pedacos.length) }, async () => {
      while (cursor < pedacos.length) await rodar(pedacos[cursor++]);
    }),
  );

  return json({
    ok: vereditos.length > 0,
    instancia: sessionId,
    pedidos: numeros.length,
    com_veredito: vereditos.length,
    sem_veredito: indefinidos,
    com_whatsapp: vereditos.filter((v) => v.tem).length,
    sem_whatsapp: vereditos.filter((v) => !v.tem).length,
    blocos_falhos: falhas.length,
    falhas: falhas.slice(0, 5),
    cru: cru || undefined,
  });
});
