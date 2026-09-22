import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/live-chat/route.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../app/features/chat/LiveChatWorkspace.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const harness = readFileSync(new URL("./live-chat-visual-harness/main.tsx", import.meta.url), "utf8");

test("Chat ao Vivo sanitiza falhas técnicas sem registrar payload ou PII", () => {
  assert.match(route, /function falhaLiveChat\(/);
  assert.match(route, /console\.error\("live_chat_operacao_falhou", \{\s*operacao,\s*codigo:/);
  assert.doesNotMatch(route, /Response\.json\(\{ error: (?:[A-Za-z]+Error|error|uploadError|approachError|dealError|brokersError|readError)\??\.message/);
  assert.doesNotMatch(route, /console\.(?:error|warn|log)\([^\n]*(?:phone|telefone|content|conteudo|payload|body)/i);
  assert.doesNotMatch(route, /success: true, (?:url: publicUrl\.publicUrl, )?[^}]*result: data/);
  assert.doesNotMatch(route, /result: data/);
});

test("leituras obrigatórias falham fechadas e a conversa não devolve raw", () => {
  assert.match(route, /data: conversation, error: conversationError/);
  assert.match(route, /if \(conversationError\) return falhaLiveChat\(conversationError, "carregar_conversa"\)/);
  assert.match(route, /data: contact, error: contactError/);
  assert.match(route, /if \(contactError\) return falhaLiveChat\(contactError, "carregar_contato"\)/);
  assert.match(route, /if \(dapi\.error\) return falhaLiveChat\(dapi\.error, "carregar_instancias_dapi"\)/);
  assert.doesNotMatch(route, /media_url,raw,criado_em/);
});

test("instabilidade ao validar instância ou carteira não vira falso 403", () => {
  assert.match(route, /return \{ allowed: !error && Boolean\(data\), error \};/);
  assert.match(route, /return \{ allowed: !error && \(data \?\? \[\]\)\.some/);
  assert.match(route, /async function validarDestinoDaMensagem/);
  assert.match(route, /if \(instanceAccess\.error\) return falhaLiveChat\(instanceAccess\.error, "validar_instancia"\)/);
  assert.match(route, /if \(phoneAccess\.error\) return falhaLiveChat\(phoneAccess\.error, "validar_carteira"\)/);
  assert.match(route, /async function validarLeadDaMensagem/);
  assert.match(route, /O telefone não corresponde ao lead informado/);
});

test("agendamento e ações só confirmam sucesso com linha retornada", () => {
  assert.match(route, /criar_mensagem_agendada/);
  assert.match(route, /cancelar_mensagem_agendada/);
  assert.match(route, /registrar_observacao/);
  assert.match(route, /registrar_tarefa/);
  assert.match(route, /criar_ficha_financiamento/);
  assert.ok((route.match(/\.select\("id"\)\.maybeSingle\(\)/g) ?? []).length >= 6);
  assert.match(route, /agendamento_nao_encontrado/);
  assert.match(route, /validarLeadVisivel\(auth, scheduled\.lead_id\)/);
});

test("proposta parcial exige reconciliação em vez de falso fracasso total", () => {
  assert.match(route, /dealUpdated/);
  assert.match(route, /if \(!dealUpdated\) return Response\.json\(\{ error: "O negócio mudou antes da proposta/);
  assert.match(route, /erro: "reconciliacao_necessaria"/);
  assert.match(route, /A proposta atualizou o negócio, mas o histórico não foi confirmado/);
});

test("interface não converte falha de agendamento em lista vazia ou cancelamento local", () => {
  assert.match(ui, /if \(!Array\.isArray\(result\.messages\)\) throw new Error\("Não foi possível confirmar as mensagens recebidas\."\)/);
  assert.match(ui, /messages\.length === 0 && scheduled\.length === 0 && !messageLoadError && !scheduledLoadError/);
  assert.match(ui, /if \(!response\.ok\) throw new Error\(result\.error \|\| "Não foi possível carregar os agendamentos\."\)/);
  assert.doesNotMatch(ui, /catch \{ setScheduled\(\[\]\); \}/);
  assert.match(ui, /if \(!response\.ok\) throw new Error\(result\.error \|\| "Não foi possível cancelar o agendamento\."\)/);
  assert.ok(ui.indexOf("if (!response.ok) throw new Error(result.error || \"Não foi possível cancelar o agendamento.\")") < ui.indexOf("setScheduled((prev) => prev.filter"));
  assert.match(ui, /A ação foi salva, mas o painel não pôde ser atualizado\. Recarregue antes de repetir\./);
  assert.match(ui, /chatStatus === "error"/);
  assert.match(ui, /Não foi possível carregar o Chat ao Vivo/);
  assert.match(ui, /Tentar novamente/);
  assert.match(css, /\.live-chat \.crm-empty-view button \{[^}]*min-height:44px/);
  assert.match(css, /\.chat-sched-error button\{[^}]*min-height:44px/);
  assert.match(css, /\.chat-sched-msg \.chat-sched-cancelbtn\{[^}]*min-height:44px/);
  assert.match(css, /@media\(max-width:820px\)\{[\s\S]*?\.live-chat > header\{[^}]*flex-direction:column/);
  assert.match(css, /\.live-chat > header label\{[^}]*width:100%/);
  assert.equal((ui.match(/activeConversation\.current = selectedId/g) ?? []).length, 1, "a troca de conversa deve disparar uma única carga");
});

test("visita criada pelo Chat exige confirmação canônica da Agenda", () => {
  assert.match(ui, /const result = await response\.json\(\)\.catch\(\(\) => \(\{\}\)\) as \{ success\?: boolean;/);
  assert.match(ui, /if \(endpoint === "\/api\/agenda" && result\.success !== true\) throw new Error\(result\.error \|\| "A Agenda não confirmou a visita\."\)/);
});

test("Chat não presume gerente livre quando a disponibilidade falha", () => {
  assert.match(ui, /if \(!response\.ok \|\| !Array\.isArray\(result\.conflitos\)\) throw new Error\("disponibilidade_invalida"\)/);
  assert.match(ui, /Não foi possível confirmar a agenda do gerente/);
  assert.match(ui, /withManager && \(!disp \|\| disp\.loading \|\| disp\.error \|\| disp\.conflitos\.length > 0\)/);
});

test("harness visual usa a tela real, dados sanitizados e bloqueia mutações", () => {
  assert.match(harness, /LiveChatWorkspace/);
  assert.match(harness, /liveChatHarness = "sanitizado"/);
  assert.match(harness, /action === "listScheduled"/);
  assert.match(harness, /Harness visual: mutação bloqueada/);
  assert.match(harness, /url\.origin !== window\.location\.origin/);
  assert.doesNotMatch(harness, /@gmail\.|@hotmail\.|\+55 1[1-9]/);
});
