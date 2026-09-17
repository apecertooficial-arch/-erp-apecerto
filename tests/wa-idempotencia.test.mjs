// WhatsApp sem mensagem duplicada — lógica pura de dapi-enviar + contratos de fonte.
// Módulo testado: supabase/functions/_shared/wa-idempotencia.ts (mesmo arquivo que a Edge Function importa).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  JANELA_DERIVADA_MS,
  chaveInformada,
  classificarResposta,
  derivarChave,
  hashConteudo,
  normalizarTelefoneBR,
  proximoPasso,
  respostaDaReserva,
  respostaDoEnvio,
  tipoCanonico,
  variantesNonoDigito,
} from "../supabase/functions/_shared/wa-idempotencia.ts";

const ler = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// Respostas reais da D-API (motor_mensagem_partes.erro, produção).
const NAO_EXISTE = { success: false, error: "Failed to send message", message: "failed to resolve phone number: phone number 5511941466369 is not on WhatsApp" };
const NAO_EXISTE_CACHE = { success: false, error: "Failed to send message", message: "failed to resolve phone number: phone number 551194371725 is not on WhatsApp (cached)" };
const SEM_LID = { success: false, error: "Failed to send message", message: "failed to send video: failed to send video: no LID found for 923164021@s.whatsapp.net from server" };
const BRIDGE_OFFLINE = { success: false, error: "Failed to send message", message: "NATS no responders for session 28abfdf7 (commandType: send_video). Bridge offline?" };

test("telefone: normaliza BR e gera variantes do 9º dígito", () => {
  assert.equal(normalizarTelefoneBR("(11) 94146-6369"), "5511941466369");
  assert.equal(normalizarTelefoneBR("1141466369"), "551141466369");
  assert.equal(normalizarTelefoneBR("5511941466369"), "5511941466369");
  assert.deepEqual(variantesNonoDigito("5511941466369"), ["5511941466369", "551141466369"]);
  assert.deepEqual(variantesNonoDigito("551141466369"), ["551141466369", "5511941466369"]);
  assert.deepEqual(variantesNonoDigito("14155550123"), ["14155550123"]);
});

test("tipo canônico aceita os aliases de dapi-enviar", () => {
  assert.equal(tipoCanonico("texto"), "text");
  assert.equal(tipoCanonico("imagem"), "image");
  assert.equal(tipoCanonico("documento"), "document");
  assert.equal(tipoCanonico(undefined), "text");
  assert.equal(tipoCanonico("sticker"), null);
});

test("chave derivada é determinística dentro da janela de 2 min e muda com qualquer campo", async () => {
  const h = await hashConteudo("text", { text: "Olá, tudo bem?" });
  const t0 = 1_790_000_040_000; // início exato de um balde
  const base = { instancia: "Kapri 01 | ApeCerto", telefone: "11941466369", tipo: "text", conteudoHash: h, agoraMs: t0 };
  const k = await derivarChave(base);
  assert.match(k, /^auto:[0-9a-f]{64}$/);
  assert.equal(await derivarChave({ ...base, agoraMs: t0 + JANELA_DERIVADA_MS - 1 }), k, "mesmo balde");
  assert.equal(await derivarChave({ ...base, telefone: "5511941466369" }), k, "telefone normalizado");
  assert.notEqual(await derivarChave({ ...base, agoraMs: t0 + JANELA_DERIVADA_MS }), k, "balde seguinte");
  assert.notEqual(await derivarChave({ ...base, instancia: "Outra" }), k);
  assert.notEqual(await derivarChave({ ...base, tipo: "image" }), k);
  assert.notEqual(await derivarChave({ ...base, conteudoHash: await hashConteudo("text", { text: "Olá, tudo bem!" }) }), k);
});

test("hash do conteúdo cobre mídia, legenda e nome do arquivo", async () => {
  const a = await hashConteudo("image", { image: "https://x/1.jpg", caption: "Fachada" });
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, await hashConteudo("image", { caption: "Fachada", image: "https://x/1.jpg" }));
  assert.notEqual(a, await hashConteudo("image", { image: "https://x/2.jpg", caption: "Fachada" }));
  assert.notEqual(a, await hashConteudo("image", { image: "https://x/1.jpg", caption: "Lazer" }));
  assert.notEqual(await hashConteudo("document", { document: "u", fileName: "a.pdf" }), await hashConteudo("document", { document: "u", fileName: "b.pdf" }));
});

test("chave informada: validada e isolada por identidade", () => {
  assert.equal(chaveInformada(undefined, { modo: "maquina" }), null);
  assert.equal(chaveInformada("", { modo: "maquina" }), null);
  assert.equal(chaveInformada("agendada:123", { modo: "maquina" }), "svc:agendada:123");
  assert.equal(chaveInformada("sara:0b8f7c1e-1111-2222-3333-444455556666", { modo: "pessoa", userId: "u1" }), "usr:u1:sara:0b8f7c1e-1111-2222-3333-444455556666");
  assert.notEqual(chaveInformada("agendada:123", { modo: "pessoa", userId: "u1" }), chaveInformada("agendada:123", { modo: "maquina" }));
  assert.throws(() => chaveInformada("curta", { modo: "maquina" }), /idempotency_key_invalida/);
  assert.throws(() => chaveInformada("tem espaço 12345", { modo: "maquina" }), /idempotency_key_invalida/);
  assert.throws(() => chaveInformada("x".repeat(161), { modo: "maquina" }), /idempotency_key_invalida/);
});

test("classificação: sucesso", () => {
  assert.deepEqual(classificarResposta(200, { success: true, messageId: "3EB085AE3A2D05846407A0" }), { tipo: "sucesso", messageId: "3EB085AE3A2D05846407A0" });
  assert.deepEqual(classificarResposta(201, {}), { tipo: "sucesso", messageId: null });
});

test("classificação: timeout / rede / 5xx / 408 são INCERTOS (podem ter sido entregues)", () => {
  assert.equal(classificarResposta(0, "TimeoutError: Signal timed out.").tipo, "incerto");
  assert.equal(classificarResposta(0, "TypeError: error sending request: connection reset").tipo, "incerto");
  assert.equal(classificarResposta(502, "<html>bad gateway</html>").tipo, "incerto");
  assert.equal(classificarResposta(504, {}).tipo, "incerto");
  assert.equal(classificarResposta(500, { success: false, error: "internal" }).tipo, "incerto");
  assert.equal(classificarResposta(408, {}).tipo, "incerto");
});

test("classificação: número inexistente só com a recusa real da D-API", () => {
  assert.equal(classificarResposta(400, NAO_EXISTE).tipo, "numero_inexistente");
  assert.equal(classificarResposta(400, NAO_EXISTE_CACHE).tipo, "numero_inexistente");
  assert.equal(classificarResposta(400, SEM_LID).tipo, "numero_inexistente");
  assert.equal(classificarResposta(200, NAO_EXISTE).tipo, "numero_inexistente");
  // 5xx com o texto não vira definitivo: continua incerto.
  assert.equal(classificarResposta(503, NAO_EXISTE).tipo, "incerto");
});

test("classificação: recusas definitivas que não liberam variante", () => {
  assert.equal(classificarResposta(400, BRIDGE_OFFLINE).tipo, "falhou");
  assert.equal(classificarResposta(401, {}).tipo, "falhou");
  assert.match(classificarResposta(403, {}).motivo, /desconectada/);
  assert.equal(classificarResposta(400, { success: false, error: "session not found" }).tipo, "falhou");
  assert.equal(classificarResposta(429, {}).tipo, "falhou");
  assert.equal(classificarResposta(404, "404 page not found").tipo, "falhou");
  assert.equal(classificarResposta(200, { success: false, error: "x" }).tipo, "falhou");
});

test("próximo passo: timeout na 1ª forma NÃO tenta a variante do 9º dígito (bug da v14)", () => {
  const v = variantesNonoDigito("5511941466369");
  const passo = proximoPasso(v, 0, classificarResposta(0, "TimeoutError: Signal timed out."));
  assert.equal(passo.acao, "concluir");
  assert.equal(passo.status, "incerto");
});

test("próximo passo: 5xx na 1ª forma também não tenta a variante", () => {
  const v = variantesNonoDigito("5511941466369");
  assert.deepEqual(proximoPasso(v, 0, classificarResposta(502, {})).status, "incerto");
});

test("próximo passo: número inexistente tenta a variante, e só uma vez", () => {
  const v = variantesNonoDigito("5511941466369");
  const p1 = proximoPasso(v, 0, classificarResposta(400, NAO_EXISTE));
  assert.deepEqual(p1, { acao: "tentar_variante", destino: "551141466369" });
  const p2 = proximoPasso(v, 1, classificarResposta(400, NAO_EXISTE));
  assert.equal(p2.acao, "concluir");
  assert.equal(p2.status, "falhou");
});

test("próximo passo: variante com sucesso conclui enviado no destino efetivo", () => {
  const v = variantesNonoDigito("551141466369");
  assert.deepEqual(proximoPasso(v, 1, classificarResposta(200, { messageId: "3EBX" })), { acao: "concluir", status: "enviado", destino: "5511941466369", messageId: "3EBX" });
});

test("próximo passo: timeout na variante é incerto (não 'falhou')", () => {
  const v = variantesNonoDigito("5511941466369");
  assert.equal(proximoPasso(v, 1, classificarResposta(0, "aborted")).status, "incerto");
});

test("próximo passo: recusa definitiva sem ser de número não tenta variante", () => {
  const v = variantesNonoDigito("5511941466369");
  assert.equal(proximoPasso(v, 0, classificarResposta(401, {})).status, "falhou");
});

test("simulação: o laço da função nunca faz mais de uma chamada quando a 1ª dá timeout", () => {
  const v = variantesNonoDigito("5511941466369");
  const respostas = [[0, "TimeoutError"], [200, { messageId: "NAO-DEVERIA" }]];
  let chamadas = 0, i = 0, fim;
  while (i < v.length) {
    const [st, corpo] = respostas[chamadas++];
    const passo = proximoPasso(v, i, classificarResposta(st, corpo));
    if (passo.acao === "tentar_variante") { i++; continue; }
    fim = passo; break;
  }
  assert.equal(chamadas, 1);
  assert.equal(fim.status, "incerto");
});

test("reserva: 'enviar' libera; demais devolvem resposta sem chamar o provedor", () => {
  const ctx = { tipoPedido: "text", sessionId: "Kapri 01 | ApeCerto" };
  assert.equal(respostaDaReserva({ acao: "enviar", registro: {} }, ctx), null);

  const dev = respostaDaReserva({ acao: "devolver", registro: { idempotency_key: "svc:agendada:9", status: "enviado", provider_message_id: "3EB0", destino: "551141466369", instancia: "Kapri 01 | ApeCerto" } }, ctx);
  assert.equal(dev.status, 200);
  assert.deepEqual(dev.body, { ok: true, sessionId: "Kapri 01 | ApeCerto", tipo: "text", to: "551141466369", messageId: "3EB0", idempotente: true, idempotency_key: "svc:agendada:9" });

  assert.equal(respostaDaReserva({ acao: "em_andamento", registro: {} }, ctx).status, 409);
  const inc = respostaDaReserva({ acao: "incerto", registro: {} }, ctx);
  assert.equal(inc.status, 409);
  assert.equal(inc.body.error, "envio_incerto");
  assert.equal(respostaDaReserva({ acao: "conflito", registro: {} }, ctx).status, 422);
});

test("resposta do envio: sucesso mantém o contrato antigo; incerto não é 2xx nem 502", () => {
  const ok = respostaDoEnvio({ status: "enviado", sessionId: "s", tipoPedido: "texto", destino: "5511", messageId: "3EB", chave: "k", tentativas: [] });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.ok, true);
  assert.equal(ok.body.messageId, "3EB");
  assert.equal(ok.body.error, undefined);

  const inc = respostaDoEnvio({ status: "incerto", sessionId: "s", tipoPedido: "texto", motivo: "m", chave: "k", tentativas: [], ultimoHttp: 0 });
  assert.equal(inc.status, 504);
  assert.equal(inc.body.error, "resultado_incerto");

  const falha = respostaDoEnvio({ status: "falhou", sessionId: "s", tipoPedido: "texto", motivo: "m", chave: "k", tentativas: [], ultimoHttp: 400 });
  assert.equal(falha.status, 502);
  assert.equal(falha.body.error, "dapi_erro");
  assert.equal(falha.body.status, 400);
});

// ---------------------------------------------------------------------------
// Contratos de fonte: a função e os chamadores usam a lógica acima.
// ---------------------------------------------------------------------------

test("dapi-enviar: reserva antes do fetch, sem retry cego, autorização preservada", () => {
  const src = ler("supabase/functions/dapi-enviar/index.ts");
  assert.match(src, /from "\.\.\/_shared\/wa-idempotencia\.ts"/);
  const reserva = src.indexOf('admin.rpc("wa_envio_reservar"');
  const fetchProvedor = src.indexOf("await fetch(DAPI + ep");
  assert.ok(reserva > 0 && fetchProvedor > reserva, "wa_envio_reservar precisa vir antes da chamada à D-API");
  assert.ok(src.indexOf("respostaDaReserva(") > reserva && src.indexOf("respostaDaReserva(") < fetchProvedor);
  assert.match(src, /proximoPasso\(variantes, indice, classificarResposta\(/);
  assert.doesNotMatch(src, /catch \(e\) \{[^}]*continue;/, "timeout não pode seguir para a próxima variante");
  assert.doesNotMatch(src, /for \(const dest of brVariants/);
  assert.match(src, /wa_envio_concluir/);
  // Autorização atual intacta (v12/v13/v14 de produção).
  assert.match(src, /ncrm_envio_token_valido/);
  assert.match(src, /admin\.auth\.getUser\(jwt\)/);
  assert.match(src, /ncrm_resolver_envio_autorizado/);
  assert.match(src, /ncrm_pode_enviar_pelo_erp/);
  assert.match(src, /p_modo: quem\.modo/);
  assert.match(src, /idempotencia_indisponivel/);
});

test("chamadores mandam idempotency_key estável", () => {
  assert.match(ler("supabase/functions/ia-router/index.ts"), /idempotency_key:`sara:\$\{\(validada as any\)\.preview_id\}`/);
  const produto = ler("supabase/functions/enviar-produto/index.ts");
  assert.match(produto, /chaveItem\("resumo"\)/);
  assert.match(produto, /chaveItem\("book"\)/);
  assert.match(produto, /chaveItem\(`foto:\$\{m\.id\}`\)/);
  const rota = ler("app/api/live-chat/route.ts");
  assert.equal((rota.match(/idempotency_key: /g) ?? []).length, 3);
  const front = ler("app/features/chat/LiveChatWorkspace.tsx");
  assert.match(front, /clientMessageId = crypto\.randomUUID\(\)/);
  assert.match(front, /form\.set\("clientMessageId", crypto\.randomUUID\(\)\)/);
  const mig = ler("supabase/migrations/20260917120000_fase3_wa_envios_idempotencia.sql");
  assert.match(mig, /'idempotency_key','agendada:'\|\|r\.id/);
});

test("migration: wa_envios com RLS fechada e status canônicos", () => {
  const mig = ler("supabase/migrations/20260917120000_fase3_wa_envios_idempotencia.sql");
  assert.match(mig, /create table if not exists public\.wa_envios/);
  assert.match(mig, /unique \(idempotency_key\)/);
  assert.match(mig, /check \(status in \('reservado','enviado','falhou','incerto'\)\)/);
  assert.match(mig, /alter table public\.wa_envios enable row level security;/);
  assert.match(mig, /revoke all on table public\.wa_envios from public, anon, authenticated;/);
  assert.doesNotMatch(mig, /create policy/i);
  assert.match(mig, /revoke all on function public\.wa_envio_reservar\([^)]*\) from public, anon, authenticated;/);
});
