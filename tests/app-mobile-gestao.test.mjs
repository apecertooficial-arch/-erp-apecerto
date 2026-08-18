import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { itensDaNavegacao } from "../app/features/system/erp-routes.ts";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const painel = ler("../app/features/team/ManagerPanelMobile.tsx");
const gestao = ler("../app/features/system/ManagementMobile.tsx");
const shell = ler("../app/features/system/ErpShell.tsx");

test("painel do gestor usa a API executiva real", () => {
  // O painel tem seletor de periodo (7d/mes/trimestre/ano/todo), entao a URL e
  // montada com template literal. Exigir "periodo=mes" fixo, como fazia a versao
  // anterior deste teste, reintroduziria o bug de ler sempre o mesmo recorte.
  assert.match(painel, /fetch\(`\/api\/performance\?periodo=\$\{periodo\}`/);
  assert.doesNotMatch(painel, /const\s+(kpis|team)\s*=\s*\[/i);
});

test("barra separa rotina de corretor e gestor", () => {
  const corretor = itensDaNavegacao({ role: "corretor", permissoes: { dashboard: ["ver"], crm: ["ver"], calendario: ["ver"], notificacoes: ["ver"] }, carregado: true, isManager: false });
  const gestor = itensDaNavegacao({ role: "corretor", permissoes: { produtos: ["ver"] }, carregado: true, isManager: true });
  const gestorComAgenda = itensDaNavegacao({ role: "corretor", permissoes: { produtos: ["ver"], calendario: ["ver"] }, carregado: true, isManager: true });
  assert.deepEqual(corretor.barra, ["Início", "CRM", "Calendário", "Notificações"]);
  // "Minha Equipe" e mobile:false enquanto perf_snapshots nao existir no banco.
  // Sem o slug "calendario", Calendario cai no fail-closed do podeVer.
  assert.deepEqual(gestor.barra, ["Performance", "Produtos", "Configurações"]);
  assert.deepEqual(gestorComAgenda.barra, ["Performance", "Produtos", "Calendário", "Configurações"]);
});

test("Mais é uma folha real e Gestão respeita permissões", () => {
  // A folha "Mais" usa o prefixo ape- desde o redesenho (antes era app-).
  assert.match(shell, /ape-mais-fundo/);
  assert.match(shell, /ape-mais-folha/);
  assert.match(shell, /<span>Mais<\/span>/);
  assert.match(gestao, /podeVer\(item\.modulo/);
});

test("painel tem carregando, vazio, erro, offline e sessão expirada", () => {
  for (const trecho of ["ape-painel-skeleton", "Sem dados neste período", "Tentar novamente", "AppMobileOffline", "AppMobileSessaoExpirada"]) {
    assert.ok(painel.includes(trecho), `faltou ${trecho}`);
  }
});
