import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ler = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const rota = ler("../app/api/funil2/route.ts");
const desktop = ler("../app/features/funil-2/Funil2Workspace.tsx");
const mobile = ler("../app/features/funil-2/Funil2Mobile.tsx");
const componente = ler("../app/features/funil-2/ConfirmarAcaoOperacional.tsx");
const modelo = ler("../app/features/funil-2/modelo.ts");
const draft = ler("../docs/erp-reestruturacao/P0_F2_CONFIRMAR_ACAO_DRAFT.sql");
const sara = ler("../supabase/functions/f2-sara-reclassificar/index.ts");

test("navegador nunca pode forjar a origem D-API", () => {
  assert.match(rota, /body\.fonte !== "registro_operacional"/);
  assert.doesNotMatch(rota, /body\.fonte === "dapi" \? "dapi"/);
  assert.match(desktop, /ConfirmarAcaoOperacional/);
  assert.match(mobile, /ConfirmarAcaoOperacional/);
});

test("API confirma somente para o corretor dono e para momento manual", () => {
  assert.match(rota, /rpc\("current_broker_id"\)/);
  assert.match(rota, /select\("corretor_id,versao,momento_codigo"\)/);
  assert.match(rota, /Number\(lead\.corretor_id\) !== corretorId/);
  assert.match(rota, /select\("exige_dapi"\)/);
  assert.match(rota, /confirmacao_dapi_obrigatoria/);
});

test("capacidade vem do servidor e as duas fichas usam o mesmo comando", () => {
  assert.match(modelo, /pode_confirmar_acao: boolean/);
  assert.match(rota, /pode_confirmar_acao:/);
  assert.match(desktop, /<ConfirmarAcaoOperacional/);
  assert.match(mobile, /<ConfirmarAcaoOperacional/);
  assert.doesNotMatch(desktop, />Confirmar ação<\/a>/);
});

test("confirmação exige gesto explícito, trata erro e atualiza a ficha", () => {
  assert.match(componente, /Registrar ação realizada/);
  assert.match(componente, /Confirmar execução/);
  assert.match(componente, /action: "confirmarAcao"/);
  assert.match(componente, /if \(!resposta\.ok\) throw new Error/);
  assert.match(componente, /Somente o corretor responsável/);
  assert.match(componente, /confirmada automaticamente pelo D-API/);
  assert.match(componente, /A Sara está analisando a próxima orientação/);
});

test("ação manual gera evento e fila idempotentes sem fingir reavaliação", () => {
  assert.match(sara, /"lead\.action_confirmed"/);
  assert.match(sara, /const EVENTOS_DE_PRAZO = new Set/);
  assert.match(sara, /EVENTOS_DE_PRAZO\.has\(eventType/);
  assert.doesNotMatch(sara, /const eventoDue = evento\.eventType\?\.startsWith\("lead\."\)/);
  assert.match(draft, /f2_evento_acao_confirmada_versao_uniq/);
  assert.match(draft, /motor_fila_sara_acao_confirmada_uniq/);
  assert.match(draft, /'lead\.action_confirmed'/);
  assert.match(draft, /public\.motor_enfileirar\(49/);
  assert.match(draft, /'versao_base', p_versao/);
  assert.match(draft, /'sara_em_fila', true/);
  assert.doesNotMatch(draft, /ultima_reavaliacao_sara_em\s*=\s*now\(\)/);
  assert.doesNotMatch(draft, /VALUES\s*\([^;]*'sara_reavaliou'/i);
});

test("draft é fail-closed, fixa o baseline e sempre desfaz o ensaio", () => {
  assert.match(draft, /DRAFT NÃO APLICADO/);
  assert.match(draft, /7d1fd56bd3bd79045f11c3e6c4aadd9e2e810ea8851bf0ee181d03660e9127f0/);
  assert.match(draft, /576ea391acdeae18293083bb90ee2cce468fb54fd0dbd942634abf03570fa991/);
  assert.match(draft, /public\.current_broker_id\(\)/);
  assert.match(draft, /p_fonte <> 'registro_operacional'/);
  assert.match(draft, /confirmacao_dapi_pelo_webhook/);
  assert.match(draft, /for update/i);
  assert.match(draft, /v_atual\.versao <> p_versao/);
  assert.match(draft, /revoke all on function public\.f2_confirmar_acao/i);
  assert.match(draft, /grant execute on function public\.f2_confirmar_acao[\s\S]*authenticated, service_role/i);
  assert.match(draft, /ROLLBACK;\s*$/i);
  assert.doesNotMatch(draft, /\bCOMMIT\b/i);
  assert.doesNotMatch(draft.replace(/^\s*--.*$/gm, ""), /delete from|truncate|drop table/i);
});
