import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { itensDaNavegacao } from "../app/features/system/erp-routes.ts";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const gestao = ler("../app/features/system/ManagementMobile.tsx");
const shell = ler("../app/features/system/ErpShell.tsx");

test("barra separa rotina de corretor e gestor", () => {
  const corretor = itensDaNavegacao({ role: "corretor", permissoes: { dashboard: ["ver"], crm: ["ver"], calendario: ["ver"], notificacoes: ["ver"] }, carregado: true, isManager: false });
  const gestor = itensDaNavegacao({ role: "corretor", permissoes: { produtos: ["ver"] }, carregado: true, isManager: true });
  const gestorComAgenda = itensDaNavegacao({ role: "corretor", permissoes: { produtos: ["ver"], calendario: ["ver"] }, carregado: true, isManager: true });
  assert.deepEqual(corretor.barra, ["Início", "CRM", "Calendário", "Notificações"]);
  // "Minha Equipe" e mobile:false enquanto perf_snapshots nao existir no banco.
  // Sem o slug "calendario", Calendario cai no fail-closed do podeVer.
  assert.deepEqual(gestor.barra, ["Produtos", "Configurações"]);
  assert.deepEqual(gestorComAgenda.barra, ["Produtos", "Calendário", "Configurações"]);
});

test("Mais é uma folha real e Gestão respeita permissões", () => {
  // A folha "Mais" usa o prefixo ape- desde o redesenho (antes era app-).
  assert.match(shell, /ape-mais-fundo/);
  assert.match(shell, /ape-mais-folha/);
  assert.match(shell, /<span>Mais<\/span>/);
  assert.match(gestao, /podeVer\(item\.modulo/);
});
