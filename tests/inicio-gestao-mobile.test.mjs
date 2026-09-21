import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const pagina = ler("../app/(erp)/inicio/page.tsx");
const gestao = ler("../app/features/home/InicioGestaoMobile.tsx");
const api = ler("../app/api/central-comando/route.ts");
const css = ler("../app/styles/app-mobile-gestor.css");
const harness = ler("./inicio-gestao-visual-harness/main.tsx");

test("Início móvel separa gestão da fila individual do corretor", () => {
  assert.match(pagina, /role !== "corretor" \|\| isManager/);
  assert.match(pagina, /<InicioGestaoMobile/);
  assert.match(pagina, /<InicioApp/);
  assert.match(pagina, /profile\?\.name/);
});

test("visão gerencial usa somente o recorte operacional e falha de forma recuperável", () => {
  assert.match(gestao, /section=gestao-mobile/);
  assert.match(gestao, /cache: "no-store"/);
  assert.match(gestao, /AbortController/);
  assert.match(gestao, /Tentar novamente/);
  assert.doesNotMatch(gestao, /telefone|e-mail|email|WhatsApp|nome do cliente/i);
});

test("gestor recebe obrigações por corretor, não uma lista de clientes", () => {
  for (const texto of ["Ações vencidas", "Clientes críticos", "Visitas sem feedback", "Registrar cobrança"]) {
    assert.match(gestao, new RegExp(texto));
  }
  assert.match(gestao, /equipe\.sort/);
  assert.match(gestao, /acoes_vencidas/);
  assert.match(gestao, /clientes_criticos/);
  assert.match(gestao, /corretor\.visitas_sem_feedback/);
  assert.match(gestao, /Ver pendências/);
  assert.match(gestao, /`\/agenda\?corretor=\$\{encodeURIComponent\(String\(corretor\.corretor_id\)\)\}`/);
  assert.match(gestao, /visitas_sem_responsavel/);
  assert.doesNotMatch(gestao, /"\/equipe"/);
  assert.doesNotMatch(gestao, /lead_id|negocio_id|cliente_id/);
});

test("cobrança do gerente é persistida sem resolver a pendência do corretor", () => {
  assert.match(gestao, /action: "charge"/);
  assert.match(gestao, /corretorId: corretor\.corretor_id/);
  assert.match(gestao, /cobranca_visita/);
  assert.match(gestao, /Cobrado em/);
  assert.match(api, /action === "charge"/);
  assert.match(api, /visita-feedback-corretor:/);
  assert.match(api, /f2_visitas_resultado_pendente/);
  assert.match(api, /Não há feedback pendente para cobrar deste corretor/);
  assert.match(api, /resolvido: false/);
  assert.match(api, /atualizado_por: auth\.user\.id/);
  assert.doesNotMatch(api, /action === "charge"[\s\S]{0,1800}resolvido: true/);
});

test("API móvel não aciona mídia ou analytics e não libera perfil em falha", () => {
  assert.match(api, /section === "gestao-mobile"/);
  assert.match(api, /kind: "unavailable"/);
  assert.match(api, /Não foi possível confirmar seu perfil agora/);
  const inicioRecorte = api.indexOf("async function gestaoMobile");
  const fimRecorte = api.indexOf("export async function GET", inicioRecorte);
  const recorte = api.slice(inicioRecorte, fimRecorte);
  assert.match(recorte, /central_comando_dashboard_v2/);
  assert.match(recorte, /central_comando_equipe_execucao/);
  assert.match(recorte, /f2_visitas_resultado_pendente/);
  assert.match(recorte, /pendenciasPorCorretor/);
  assert.match(recorte, /summary\.visitas_sem_feedback = pendencias\.total/);
  assert.match(recorte, /central_alerta_acoes/);
  assert.match(recorte, /visita-feedback-corretor:%/);
  assert.match(recorte, /cobranca_visita/);
  assert.match(recorte, /if \(!execution\)/);
  assert.doesNotMatch(recorte, /executionByBroker\.get\([^\n]+\) \?\? \{\}/);
  assert.doesNotMatch(recorte, /marketing-ads-read|lerGa4|central_comando_site_marketing/);
});

test("controles gerenciais móveis respeitam alvo mínimo de toque", () => {
  const inicio = css.indexOf(".ape-inicio-gestao");
  assert.ok(inicio >= 0);
  const recorte = css.slice(inicio);
  assert.match(recorte, /min-height:\s*44px/);
  assert.match(recorte, /overflow-wrap:\s*anywhere/);
});

test("harness visual usa o componente real, dados sanitizados e intercepta somente a cobrança simulada", () => {
  assert.match(harness, /InicioGestaoMobile/);
  assert.match(harness, /searchParams\.get\("section"\) !== "gestao-mobile"/);
  assert.match(harness, /method === "POST"/);
  assert.match(harness, /body\.action !== "charge"/);
  assert.match(harness, /Mutação fora do contrato sanitizado/);
  assert.match(harness, /Rede fora do harness bloqueada/);
  assert.doesNotMatch(harness, /@gmail\.|@hotmail\.|\+55 1[1-9]/);
});
