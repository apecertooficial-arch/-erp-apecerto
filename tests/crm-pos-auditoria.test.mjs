import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  combinarAtividades,
  decisaoConflitoHumano,
  statusHttpFunil,
  validarMovimentoSeguro,
} from "../app/features/funil-2/contratos.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const api = read("../app/api/funil2/route.ts");
const workspace = read("../app/features/funil-2/Funil2Workspace.tsx");
const mobile = read("../app/features/funil-2/Funil2Mobile.tsx");
const css = read("../app/styles/funil.css");

test("401, 403, 409 e 422 preservam o significado do contrato", () => {
  assert.equal(statusHttpFunil("sessao_necessaria"), 401);
  assert.equal(statusHttpFunil("sem_permissao"), 403);
  assert.equal(statusHttpFunil("versao_conflito"), 409);
  assert.equal(statusHttpFunil("dados_invalidos"), 422);
  assert.equal(statusHttpFunil("erro_desconhecido"), 409);
});

test("conflito humano nunca repete silenciosamente uma intencao antiga", () => {
  assert.deepEqual(decisaoConflitoHumano("versao_conflito"), {
    repetirAutomaticamente: false,
    recarregarAntesDeRepetir: true,
  });
});

test("lote sem RPC atomica e bloqueado antes de qualquer chamada", () => {
  assert.deepEqual(validarMovimentoSeguro([]), { ok: false, motivo: "selecao_vazia" });
  assert.deepEqual(validarMovimentoSeguro(["lead-1"]), { ok: true, id: "lead-1" });
  assert.deepEqual(validarMovimentoSeguro(["lead-1", "lead-2"]), { ok: false, motivo: "lote_sem_contrato_atomico" });
});

test("atividades combinam crm_tarefas e visitas sem confundir os objetos", () => {
  const resultado = combinarAtividades(
    [{ id: "t-1", funil_lead_id: "f-1", titulo: "Ligar", prazo_em: "2026-08-28T12:00:00Z", status: "pendente", prioridade: "alta", responsavel: "Ana" }],
    [{ id: "v-1", funil_lead_id: "f-1", imovel: "Residencial Sol", inicio_em: "2026-08-29T15:00:00Z", status: "agendada" }],
  );
  assert.equal(resultado.length, 2);
  assert.deepEqual(resultado.map((item) => item.tipo), ["tarefa", "visita"]);
  assert.equal(resultado[0].titulo, "Ligar");
  assert.equal(resultado[1].titulo, "Visita · Residencial Sol");
});

test("estado vazio de atividades e exato", () => {
  assert.deepEqual(combinarAtividades([], []), []);
});

test("API liga crm_tarefas ao lead original e não mascara falha como vazio", () => {
  assert.match(api, /from\("crm_tarefas"\)[\s\S]*select\("id,lead_id,negocio_id,corretor_id,titulo,vencimento,concluida,prioridade"\)/);
  assert.match(api, /Não foi possível carregar as atividades deste atendimento/);
  assert.match(api, /visitas: visitas \?\? \[\], atividades/);
  assert.match(workspace, /atividadesCompletas = combinarAtividades\(atividades, visitas\)/);
  assert.match(mobile, /atividadesCompletas = combinarAtividades\(atividades, visitas\)/);
});

test("Ganho e Perdido não conseguem mais fechar somente a cópia operacional", () => {
  assert.match(api, /Ganho e perda precisam atualizar o negócio canônico pela Esteira/);
  assert.doesNotMatch(workspace, /onSalvarNegociacao\("venda"\)|onSalvarNegociacao\("perdida"\)/);
  assert.doesNotMatch(mobile, />Ganho<|>Perdido</);
  assert.match(workspace, /Nenhuma dessas ações é simulada aqui/);
});

test("PATCH devolve 409 com estado atual e nunca faz retry automático", () => {
  assert.match(api, /select\("versao,momento_codigo,etapa,atualizado_em"\)/);
  assert.match(api, /Este atendimento mudou em outra sessão/);
  assert.doesNotMatch(api, /args = \{ \.\.\.args, p_versao: versaoAtual \}/);
  assert.doesNotMatch(api, /reexecutamos a ação/);
});

test("falha de trilha após mutação exige reconciliação explícita", () => {
  assert.match(api, /alteracaoAplicada: true/);
  assert.match(api, /reconciliacaoNecessaria: true/);
  assert.match(workspace, /resposta\.json\.reconciliacaoNecessaria[\s\S]*await carregar\(\)/);
});

test("falhas auxiliares ficam visíveis sem inventar um fallback", () => {
  assert.match(api, /instancia_origem: daConversa \? "conversa" : instancia \? "padrao" : "indisponivel"/);
  assert.match(workspace, /Sara temporariamente indisponível/);
  assert.match(workspace, /Configuração operacional indisponível/);
  assert.match(mobile, /Sara indisponível/);
});

test("Kanban desktop usa a densidade aprovada sem duplicar contagem no cabeçalho", () => {
  assert.match(css, /f2-coluna[^}]*flex:0 0 240px/);
  assert.match(css, /grid-template-columns:8px minmax\(0,1fr\) auto auto 28px 28px/);
  assert.doesNotMatch(workspace, /\{daEtapa\.length\} negócios ·/);
});

test("menu Mais mobile replica as quatro áreas aprovadas sem duplicar a navegação inferior", () => {
  assert.match(mobile, /aria-label="Mais áreas do Funil"/);
  for (const item of ["Esteira de vendas", "Painel gerencial", "Configurações", "Matriz de validação"]) {
    assert.match(mobile, new RegExp(`>${item}<`));
  }
  const menuMais = mobile.match(/aria-label="Mais áreas do Funil"[\s\S]*?<\/nav>/)?.[0] ?? "";
  assert.doesNotMatch(menuMais, />Meu Dia<|>Agenda<|>Produtos<|>Sara</);
});
