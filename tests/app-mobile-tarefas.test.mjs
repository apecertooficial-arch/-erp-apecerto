import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const tela = ler("../app/features/tasks/SaraTasksMobile.tsx");
const pagina = ler("../app/(erp)/tarefas/page.tsx");
const api = ler("../app/api/funil2/route.ts");
const central = ler("../app/features/automations/CentralOperationsPanel.tsx");
const estilos = ler("../app/styles/automation-workspace.css");
const harness = ler("./crm-visual-harness/main.tsx");

test("celular usa Tarefas da Sara e desktop preserva Projetos", () => {
  assert.match(pagina, /ehCelular \? <SaraTasksMobile/);
  assert.match(pagina, /: <ProjectsWorkspace/);
});

test("tarefas usam somente dados reais do Funil 2", () => {
  assert.match(tela, /fetch\("\/api\/funil2"/);
  assert.match(tela, /dados\?\.leads/);
  assert.doesNotMatch(tela, /const\s+(tasks|tarefas)\s*=\s*\[/i);
  assert.match(tela, /if \(!Array\.isArray\(json\.leads\)\) throw new Error/);
  assert.match(harness, /"invalido"/);
});

test("tarefas não recolocam histórico, atualização manual ou pescado na fila operacional", () => {
  assert.match(tela, /leadOperacionalNoMeuDia/);
  assert.match(tela, /if \(!leadOperacionalNoMeuDia\(lead\) \|\| lead\.etapa === "pescado" \|\| semPrazo\(lead\.proxima_acao_em\)\) continue/);
});

test("fila móvel abre nas tarefas atrasadas antes das próximas", () => {
  assert.match(tela, /useState<Faixa>\("atrasadas"\)/);
  assert.match(harness, /tela === "tarefas-mobile"[\s\S]*?<SaraTasksMobile/);
});

test("fila extensa não monta todos os cards de uma vez no celular", () => {
  assert.match(tela, /useState\(25\)/);
  assert.match(tela, /visiveis\.slice\(0, limite\)\.map/);
  assert.match(tela, /Mostrar mais/);
});

test("corretor executa a próxima ação e não decide revisão humana da Sara", () => {
  assert.match(tela, /acaoVisivel\(lead\)/);
  assert.match(tela, /BotaoWhatsApp/);
  assert.doesNotMatch(tela, /decidirSugestao|Aceitar sugestão|Recusar|analisesSara|decisoesSara|Concluídas/);
});

test("revisão humana fica acionável somente na Central de gestão", () => {
  const bloco = api.match(/if \(action === "decidirSugestao"\) \{[\s\S]*?return Response\.json\(\{ ok: true, decisao \}\);\n  \}/)?.[0] ?? "";
  assert.match(bloco, /rpc\("f2_admin"\)/);
  assert.match(bloco, /podeGerenciar !== true/);
  assert.ok(bloco.indexOf('rpc("f2_admin")') < bloco.indexOf('rpc("f2_decidir_sugestao"'));
  assert.match(bloco, /decisao === "recusada" && motivo\.length < 3/);
  assert.match(central, /action: "decidirSugestao"/);
  assert.match(central, /decidirSara\(item\.analise_id, "aceita"\)/);
  assert.match(central, /decidirSara\(item\.analise_id, "recusada"\)/);
  assert.match(estilos, /\.central-revisao-acoes button\s*\{[^}]*min-height:\s*44px;/s);
  assert.doesNotMatch(api, /send-text-message|enviarMensagem/);
});

test("tarefas têm os cinco estados de sistema", () => {
  for (const trecho of ["ape-esqueleto", "Fila zerada", "Tentar novamente", "AppMobileOffline", "AppMobileSessaoExpirada"]) {
    assert.ok(tela.includes(trecho), `faltou ${trecho}`);
  }
  assert.match(tela, /role="status">Carregando tarefas…/);
});
