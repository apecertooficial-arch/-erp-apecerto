import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { itensDaNavegacao } from "../app/features/system/erp-routes.ts";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const painel = ler("../app/features/team/ManagerPanelMobile.tsx");
const gestao = ler("../app/features/system/ManagementMobile.tsx");
const shell = ler("../app/features/system/ErpShell.tsx");

test("painel do gestor usa a API executiva real", () => {
  assert.match(painel, /fetch\("\/api\/performance\?periodo=mes"/);
  assert.doesNotMatch(painel, /const\s+(kpis|team)\s*=\s*\[/i);
});

test("barra separa rotina de corretor e gestor", () => {
  const corretor = itensDaNavegacao({ role: "corretor", permissoes: { dashboard: ["ver"], crm: ["ver"], calendario: ["ver"], notificacoes: ["ver"] }, carregado: true, isManager: false });
  const gestor = itensDaNavegacao({ role: "corretor", permissoes: { produtos: ["ver"] }, carregado: true, isManager: true });
  assert.deepEqual(corretor.barra, ["Início", "CRM", "Calendário", "Notificações"]);
  assert.deepEqual(gestor.barra, ["Performance", "Minha Equipe", "Produtos", "Configurações"]);
});

test("Mais é uma folha real e Gestão respeita permissões", () => {
  assert.match(shell, /app-mais-overlay/);
  assert.match(shell, /<span>Mais<\/span>/);
  assert.match(gestao, /podeVer\(item\.modulo/);
});

test("painel tem carregando, vazio, erro, offline e sessão expirada", () => {
  for (const trecho of ["ape-painel-skeleton", "Sem dados neste período", "Tentar novamente", "AppMobileOffline", "AppMobileSessaoExpirada"]) {
    assert.ok(painel.includes(trecho), `faltou ${trecho}`);
  }
});
