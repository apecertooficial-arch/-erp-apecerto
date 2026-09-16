import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =====================================================================
// Sara organizadora de documentos da esteira.
// Recebe um lote de arquivos ja enviados ao bucket esteira-docs e
// descobre, para cada um: de QUEM e (comprador / conjuge / vendedor) e
// QUAL documento e (RG, comprovante de residencia, matricula...).
// Alta confianca vai direto para o slot. Baixa confianca vai para triagem.
// =====================================================================

const BUCKET = "esteira-docs";
const MODELO = "gpt-4o-mini";
const PRECO = { in: 0.15, out: 0.60 }; // USD por 1M tokens
const LIMIAR_AUTO = 0.85;   // >= entra direto no slot
const MAX_ARQUIVOS = 15;
const MAX_BYTES = 8 * 1024 * 1024;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Modelo = { grupo: string; nome: string; obrigatorio: boolean; condicao: string | null };
type Parte = { papel: string; nome: string | null; cpf: string | null };

const GRUPO_LABEL: Record<string, string> = {
  comprador: "comprador (titular)",
  conjuge_comprador: "conjuge do comprador",
  vendedor: "vendedor (titular)",
  conjuge_vendedor: "conjuge do vendedor",
  imovel: "imovel",
};

// Fase 0 (15/09/2026): exige usuario logado de verdade. A chave anon passava no gateway.
async function usuarioLogado(req: Request): Promise<string | null> {
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!tok) return null;
  try {
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${tok}`, apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const u = await r.json();
    return typeof u?.id === "string" ? u.id : null;
  } catch { return null; }
}

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const usuarioId = await usuarioLogado(req);
    if (!usuarioId) return json({ ok: false, reason: "nao_autorizado" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const processoRef: string = String(body.processo_ref || "").trim();
    const loteId: string | null = body.lote_id ? String(body.lote_id) : null;
    const anexoIds: string[] = Array.isArray(body.anexo_ids) ? body.anexo_ids.map(String) : [];
    if (!processoRef) return json({ ok: false, reason: "faltando processo_ref" }, 400);
    if (!loteId && anexoIds.length === 0) return json({ ok: false, reason: "faltando lote_id ou anexo_ids" }, 400);

    // ---- chave da OpenAI (env primeiro, app_secrets como fallback) ----
    let apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      const { data: sec } = await supabase.from("app_secrets").select("valor").eq("chave", "OPENAI_API_KEY").maybeSingle();
      apiKey = sec?.valor;
    }
    if (!apiKey) return json({ ok: false, reason: "sem_chave" }, 500);

    // ---- quem disparou (para a trilha de auditoria) ----
    let atorId: string | null = usuarioId;
    let atorNome: string | null = null;
    try {
      const { data: u } = await supabase.from("usuarios").select("nome").eq("id", usuarioId).maybeSingle();
      atorNome = u?.nome ?? null;
    } catch { /* segue sem nome */ }

    // ---- contexto do processo: quais grupos existem nesta venda ----
    const [{ data: processo }, { data: condicoes }, { data: partes }, { data: modeloRaw }] = await Promise.all([
      supabase.from("venda_processos").select("id, tipo_venda").eq("id", processoRef).maybeSingle(),
      supabase.from("venda_condicoes")
        .select("comprador_tem_conjuge, vendedor_tem_conjuge, forma_pagamento")
        .eq("processo_ref", processoRef).maybeSingle(),
      supabase.from("venda_partes").select("papel, nome, cpf").eq("processo_ref", processoRef),
      supabase.from("esteira_doc_modelo").select("grupo, nome, obrigatorio, ordem, condicao").eq("ativo", true).order("ordem"),
    ]);

    if (!processo) return json({ ok: false, reason: "processo_nao_encontrado" }, 404);

    const forma = condicoes?.forma_pagamento ?? null;
    const grupos = ["comprador", "vendedor", "imovel"];
    if (condicoes?.comprador_tem_conjuge) grupos.push("conjuge_comprador");
    if (condicoes?.vendedor_tem_conjuge) grupos.push("conjuge_vendedor");

    const condicaoVale = (c: string | null) => {
      if (!c) return true;
      if (!forma) return true; // forma nao definida: mantem visivel
      if (c === "financiamento") return forma === "financiamento" || forma === "misto";
      if (c === "consorcio") return forma === "consorcio" || forma === "misto";
      if (c === "nao_a_vista") return forma !== "a_vista";
      return true;
    };

    const modelo: Modelo[] = (modeloRaw || [])
      .filter((m: Modelo) => grupos.includes(m.grupo) && condicaoVale(m.condicao));

    // catalogo apresentado ao modelo
    const catalogo = grupos
      .map((g) => {
        const docs = modelo.filter((m) => m.grupo === g).map((m) => `"${m.nome}"`);
        return docs.length ? `- ${g} (${GRUPO_LABEL[g] || g}): ${docs.join(", ")}` : null;
      })
      .filter(Boolean)
      .join("\n");

    const partesConhecidas = (partes || [])
      .filter((p: Parte) => p.nome)
      .map((p: Parte) => `- ${p.papel}: ${p.nome}${p.cpf ? ` (CPF ${p.cpf})` : ""}`)
      .join("\n");

    // ---- arquivos do lote ----
    let q = supabase.from("esteira_anexos")
      .select("id, nome, path, mime, grupo, doc_nome, ia_status")
      .eq("processo_ref", processoRef);
    q = anexoIds.length ? q.in("id", anexoIds) : q.eq("lote_id", loteId);
    const { data: anexos, error: anexErr } = await q.limit(MAX_ARQUIVOS);
    if (anexErr) return json({ ok: false, reason: "erro_consulta" }, 502);
    if (!anexos?.length) return json({ ok: true, processados: 0, resultados: [] });

    const systemPrompt = [
      "Voce e a Sara, assistente documental de uma imobiliaria. Sua tarefa e triagem de documentos de uma venda de imovel.",
      "Voce recebe UM arquivo por vez (imagem ou PDF) e deve dizer a QUAL PARTE ele pertence e QUAL documento do checklist ele e.",
      "",
      "CHECKLIST VALIDO desta venda (use EXATAMENTE estes valores de grupo e nome):",
      catalogo,
      "",
      partesConhecidas
        ? `PARTES JA CADASTRADAS (use o nome/CPF do documento para decidir de quem ele e):\n${partesConhecidas}`
        : "PARTES: ainda nao cadastradas. Decida o grupo pelo conteudo e contexto do documento.",
      "",
      "REGRAS:",
      "1. 'grupo' deve ser um dos listados no checklist. 'doc_nome' deve ser exatamente um dos nomes daquele grupo.",
      "2. Documentos do imovel (matricula, IPTU, onus reais, habite-se, planta, escritura, quitacao condominial) sempre vao para o grupo 'imovel'.",
      "3. Se o nome do titular do documento bater com uma parte cadastrada, use o grupo daquela parte. Se bater com o conjuge, use o grupo do conjuge.",
      "4. Se nao houver checklist compativel, ou se o arquivo estiver ilegivel, use grupo e doc_nome null e explique em 'motivo'.",
      "5. 'confianca' e um numero de 0 a 1. Seja honesta: abaixo de 0.85 o documento vai para conferencia humana.",
      "6. Extraia o que conseguir ler em 'extraido': nome_completo, cpf, rg, data_nascimento, telefone, email, endereco, numero_matricula, inscricao_iptu, validade. Use null no que nao aparecer.",
      "7. NUNCA invente dados que nao estao no documento.",
      "",
      'Responda SOMENTE um JSON valido: {"grupo":<string|null>,"doc_nome":<string|null>,"confianca":<number>,"tipo_detectado":<string>,"motivo":<string>,"extraido":{...}}',
    ].join("\n");

    let tin = 0, tout = 0;
    const t0 = Date.now();
    const resultados: unknown[] = [];

    for (const anexo of anexos) {
      const marcarFalha = async (motivo: string) => {
        await supabase.from("esteira_anexos").update({
          ia_status: "falhou", ia_motivo: motivo, ia_processado_em: new Date().toISOString(),
          status: "triagem",
        }).eq("id", anexo.id);
        resultados.push({ id: anexo.id, nome: anexo.nome, ok: false, motivo });
      };

      try {
        await supabase.from("esteira_anexos").update({ ia_status: "processando" }).eq("id", anexo.id);

        const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(anexo.path);
        if (dlErr || !blob) { await marcarFalha(`Nao consegui baixar o arquivo: ${dlErr?.message || "vazio"}`); continue; }
        const buf = await blob.arrayBuffer();
        if (buf.byteLength > MAX_BYTES) { await marcarFalha("Arquivo acima de 8 MB — envie uma versao menor."); continue; }

        const mime = anexo.mime || blob.type || "application/octet-stream";
        const dados = b64(buf);
        let conteudo: unknown[];

        if (mime.startsWith("image/")) {
          conteudo = [
            { type: "text", text: `Arquivo enviado pelo corretor: "${anexo.nome}". Classifique.` },
            { type: "image_url", image_url: { url: `data:${mime};base64,${dados}`, detail: "high" } },
          ];
        } else if (mime === "application/pdf" || /\.pdf$/i.test(anexo.nome || "")) {
          conteudo = [
            { type: "text", text: `Arquivo enviado pelo corretor: "${anexo.nome}". Classifique.` },
            { type: "file", file: { filename: anexo.nome || "documento.pdf", file_data: `data:application/pdf;base64,${dados}` } },
          ];
        } else {
          await marcarFalha(`Formato nao suportado para leitura automatica (${mime}). Classifique manualmente.`);
          continue;
        }

        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: MODELO,
            temperature: 0,
            max_tokens: 700,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: conteudo },
            ],
          }),
          signal: AbortSignal.timeout(60000),
        });
        const data = await resp.json();
        if (!resp.ok) { await marcarFalha(`Erro da IA: ${data?.error?.message || resp.status}`); continue; }

        tin += data.usage?.prompt_tokens ?? 0;
        tout += data.usage?.completion_tokens ?? 0;

        let saida: Record<string, unknown> = {};
        try { saida = JSON.parse(data.choices?.[0]?.message?.content ?? "{}"); } catch { /* abaixo */ }

        let grupo = typeof saida.grupo === "string" ? saida.grupo : null;
        let docNome = typeof saida.doc_nome === "string" ? saida.doc_nome : null;
        const confianca = Math.max(0, Math.min(1, Number(saida.confianca) || 0));
        const motivo = typeof saida.motivo === "string" ? saida.motivo.slice(0, 400) : null;

        // valida contra o checklist real — a IA nao pode inventar slot
        const casa = grupo && docNome
          ? modelo.find((m) => m.grupo === grupo && m.nome.toLowerCase() === String(docNome).toLowerCase())
          : null;
        if (!casa) { grupo = grupo && grupos.includes(grupo) ? grupo : null; docNome = null; }
        else { docNome = casa.nome; }

        const autoAplica = Boolean(casa) && confianca >= LIMIAR_AUTO;
        const agora = new Date().toISOString();

        const patch: Record<string, unknown> = {
          ia_status: autoAplica ? "classificado" : "incerto",
          ia_grupo: grupo,
          ia_doc_nome: docNome,
          ia_confianca: confianca,
          ia_extraido: saida.extraido ?? null,
          ia_motivo: motivo,
          ia_processado_em: agora,
        };
        if (autoAplica) {
          patch.grupo = grupo;
          patch.doc_nome = docNome;
          patch.status = "anexado";
          patch.origem = "lote_ia";
        } else {
          patch.status = "triagem";
          patch.origem = "lote_ia";
        }

        await supabase.from("esteira_anexos").update(patch).eq("id", anexo.id);
        await supabase.from("esteira_anexo_eventos").insert({
          anexo_id: anexo.id,
          processo_ref: processoRef,
          lote_id: loteId,
          evento: autoAplica ? "classificado_ia" : "triagem_ia",
          detalhe: {
            arquivo: anexo.nome, grupo, doc_nome: docNome, confianca,
            tipo_detectado: saida.tipo_detectado ?? null, motivo, modelo: MODELO,
          },
          ator: atorId,
          ator_nome: atorNome,
        });

        resultados.push({
          id: anexo.id, nome: anexo.nome, ok: true,
          grupo, doc_nome: docNome, confianca, auto: autoAplica,
          tipo_detectado: saida.tipo_detectado ?? null, motivo, extraido: saida.extraido ?? null,
        });
      } catch (e) {
        await marcarFalha(`Falha inesperada: ${String(e).slice(0, 200)}`);
      }
    }

    const custo = (tin / 1e6) * PRECO.in + (tout / 1e6) * PRECO.out;
    const auto = resultados.filter((r: { auto?: boolean }) => r.auto).length;

    return json({
      ok: true,
      processados: resultados.length,
      classificados: auto,
      triagem: resultados.length - auto,
      resultados,
      tokens: { entrada: tin, saida: tout },
      custo_usd: Number(custo.toFixed(6)),
      ms: Date.now() - t0,
    });
  } catch (e) {
    console.error("ia-docs-classificar", e);
    return new Response(JSON.stringify({ ok: false, reason: "excecao" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
