// A AGENDA E AS CONVERSAS DO APARELHO DE CADA CORRETOR
//
// POR QUE EXISTE. A regra da voz nova precisa saber se o corretor ja conhece o
// cliente ANTES de o lead sair. O ERP so sabe o que sincronizou -- mensagens a
// partir de jan/2026, e so de quem trocou mensagem. O aparelho sabe mais:
// conversas mais antigas e, principalmente, a AGENDA. Cliente salvo no telefone
// do corretor e prova de relacionamento mesmo sem nenhuma mensagem no ERP.
//
// E o Romulo foi explicito: o corretor nao participa disso. Ninguem declara
// nada, ninguem clica em nada -- a verificacao acontece antes da entrega.
//
// SO LEITURA. Dois GET por instancia conectada, nenhuma mensagem enviada:
//   GET /api/v1/chats?sessionId=X     -> conversas
//   GET /api/v1/contacts?sessionId=X  -> agenda
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const BASE = "https://api.d-api.cloud/api/v1";
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

/* A D-API mistura formatos: "5511999999999@s.whatsapp.net", "5511999999999",
   as vezes com sufixo de dispositivo (":12"). Tirar tudo que nao e digito
   resolve os tres. Grupo, lista de transmissao e status saem antes: conversa de
   grupo nao e relacionamento com o cliente. */
function sodigito(v: unknown): string | null {
  const s = String(v ?? "");
  if (!s || s.includes("@g.us") || s.includes("broadcast") || s.includes("status@")) return null;
  const d = s.split("@")[0].split(":")[0].replace(/\D/g, "");
  return d.length >= 10 ? d : null;
}

function lista(resp: unknown, ...chaves: string[]): unknown[] {
  if (Array.isArray(resp)) return resp;
  if (resp && typeof resp === "object") {
    const o = resp as Record<string, unknown>;
    for (const c of [...chaves, "data", "result", "results", "items"]) {
      const v = o[c];
      if (Array.isArray(v)) return v;
      if (v && typeof v === "object") { const d = lista(v, ...chaves); if (d.length) return d; }
    }
  }
  return [];
}

Deno.serve(async (req) => {
  const interno = req.headers.get("x-envio-interno");
  if (!interno) return json({ error: "nao_autorizado" }, 401);
  const { data: ok } = await admin.rpc("ncrm_envio_token_valido", { p_token: interno });
  if (ok !== true) return json({ error: "nao_autorizado" }, 401);

  const p = await req.json().catch(() => ({})) as Record<string, unknown>;
  const soCorretor = p.corretor_id ? Number(p.corretor_id) : null;
  const paginas = Math.max(1, Math.min(Number(p.paginas ?? 10), 50));
  const porPagina = Math.max(50, Math.min(Number(p.por_pagina ?? 500), 1000));

  const { data: inst } = await admin
    .from("instancias")
    .select("id, instancia_dapi, corretor_id, conectada, status_dapi, instancias_credenciais(apikey)")
    .eq("ativa", true);

  const vivas = (inst ?? []).filter((i: Record<string, unknown>) => {
    const c = i.instancias_credenciais as { apikey?: string } | null;
    if (!c?.apikey || !i.corretor_id) return false;
    if (soCorretor && Number(i.corretor_id) !== soCorretor) return false;
    return i.conectada === true || i.status_dapi === "connected";
  });
  if (!vivas.length) return json({ ok: false, erro: "nenhuma_instancia_conectada" });

  const relatorio: Record<string, unknown>[] = [];

  for (const i of vivas) {
    const sessionId = String(i.instancia_dapi);
    const apikey = String((i.instancias_credenciais as { apikey: string }).apikey);
    const corretor = Number(i.corretor_id);
    const h = { Authorization: apikey, "Content-Type": "application/json" };
    const itens = new Map<string, { telefone: string; fonte: string; nome?: string; ultima_troca?: string }>();
    const notas: string[] = [];

    // CONVERSAS, pagina a pagina. Para quando a pagina volta vazia ou nao traz
    // nada novo -- a paginacao nao e documentada, e uma API que ignore o
    // parametro devolveria a mesma pagina para sempre.
    for (let pg = 1; pg <= paginas; pg++) {
      try {
        const r = await fetch(`${BASE}/chats?sessionId=${encodeURIComponent(sessionId)}&page=${pg}&limit=${porPagina}`,
                              { headers: h, signal: AbortSignal.timeout(30000) });
        if (!r.ok) { notas.push(`chats http_${r.status}`); break; }
        const linhas = lista(JSON.parse(await r.text()), "chats");
        if (!linhas.length) break;
        let novos = 0;
        for (const l of linhas) {
          const o = l as Record<string, unknown>;
          const ct = (o.contact ?? {}) as Record<string, unknown>;
          if (o.isGroup === true || o.is_group === true) continue;
          const tel = sodigito(ct.phone ?? o.chat_id ?? o.chatName ?? ct.jid);
          if (!tel) continue;
          const cru = String(ct.pushName ?? o.chat_name ?? o.chatName ?? "");
          const nome = cru.includes("@") ? undefined : cru || undefined;
          if (!itens.has(tel)) novos++;
          itens.set(tel, { telefone: tel, fonte: "conversa", nome,
            ultima_troca: (o.last_message_timestamp ?? o.updated_at ?? null) as string | undefined });
        }
        if (novos === 0) break;
      } catch (e) { notas.push(`chats ${String(e).slice(0, 60)}`); break; }
    }

    // AGENDA. Contato salvo e o sinal que o ERP nunca teria: o corretor guardou
    // o numero, entao houve relacionamento -- mesmo sem mensagem sincronizada.
    try {
      const r = await fetch(`${BASE}/contacts?sessionId=${encodeURIComponent(sessionId)}`,
                            { headers: h, signal: AbortSignal.timeout(45000) });
      if (r.ok) {
        for (const l of lista(JSON.parse(await r.text()), "contacts")) {
          const o = l as Record<string, unknown>;
          const tel = sodigito(o.phone ?? o.jid);
          if (!tel || itens.has(tel)) continue;   // conversa ja e sinal mais forte
          const nome = String(o.name ?? "");
          itens.set(tel, { telefone: tel, fonte: "agenda", nome: nome.includes("@") ? undefined : nome || undefined });
        }
      } else notas.push(`contacts http_${r.status}`);
    } catch (e) { notas.push(`contacts ${String(e).slice(0, 60)}`); }

    // Grava em blocos: um upsert de 20 mil linhas de uma vez estoura o payload.
    const todos = [...itens.values()];
    let gravados = 0;
    for (let k = 0; k < todos.length; k += 500) {
      const { error } = await admin.rpc("wa_conhecido_gravar",
        { p_corretor_id: corretor, p_itens: todos.slice(k, k + 500) });
      if (error) { notas.push(`gravar ${error.message.slice(0, 80)}`); break; }
      gravados += Math.min(500, todos.length - k);
    }

    relatorio.push({ instancia: sessionId, corretor_id: corretor,
      conversas: todos.filter((t) => t.fonte === "conversa").length,
      agenda: todos.filter((t) => t.fonte === "agenda").length,
      gravados, notas: notas.length ? notas : undefined });
  }

  return json({ ok: true, instancias: relatorio.length, relatorio });
});
