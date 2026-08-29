import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const workspace = read("../app/features/funil-2/Funil2Workspace.tsx");
const toolbar = read("../app/features/funil-2/Funil2BoardToolbar.tsx");
const mobile = read("../app/features/funil-2/Funil2Mobile.tsx");
const picker = read("../app/features/funil-2/LeadSearchPicker.tsx");
const carteira = read("../app/api/funil2/carteira/route.ts");
const pwa = read("../app/components/RegistroPwa.tsx");
const shell = read("../app/features/system/ErpShell.tsx");
const identityCss = read("../app/styles/redesign-apecerto.css");
const css = read("../app/styles/funil.css");

test("contagem do quadro corresponde somente às etapas realmente exibidas", () => {
  assert.match(workspace, /const leadsDoQuadro = leadsDoPeriodo\.filter/);
  assert.match(toolbar, />Em andamento <b>\{props\.negociosVisiveis\}<\/b>/);
  assert.match(workspace, /> Negócios <b>\{leadsDoQuadro\.length\}<\/b>/);
  assert.match(workspace, /foraDoQuadro > 0[\s\S]*fora das etapas visíveis/);
  assert.match(workspace, /Leads <b>\{leads\.length\}<\/b>/);
});

test("Kanban monta cartões incrementalmente e menus somente sob demanda", () => {
  assert.match(workspace, /limitesPorEtapa/);
  assert.match(workspace, /daEtapa\.slice\(0, limiteDaEtapa\)/);
  assert.match(workspace, /limiteDaEtapa \+ 12/);
  assert.doesNotMatch(workspace, /slice\(0, 100\)/);
  assert.match(workspace, /menuCardId === item\.id && <div role="menu">/);
  assert.match(workspace, /aria-expanded=\{menuCardId === item\.id\}/);
  assert.match(css, /\.f2-coluna-mais/);
});

test("lote sem transação não é prometido pela interface", () => {
  assert.doesNotMatch(workspace, />Selecionar<|f2-v3-bulk|modoSelecao|const \[selecionados/);
  assert.doesNotMatch(css, /f2-v3-bulk/);
  assert.match(workspace, /validarMovimentoSeguro\(ids\)/);
  assert.match(workspace, /Movimento em massa indisponível/);
  assert.doesNotMatch(workspace, /Promise\.all\([^\n]*movimentar/);
});

test("novo negócio usa pesquisa remota paginada, acessível e sem 699 options", () => {
  for (const source of [workspace, mobile]) assert.match(source, /<LeadSearchPicker/);
  assert.doesNotMatch(mobile, /leads\.map\(\(item\) => <option/);
  assert.match(picker, /modo: "buscar-funil"/);
  assert.match(picker, /AbortController/);
  assert.match(picker, /setTimeout[\s\S]*280/);
  assert.match(picker, /ArrowDown/);
  assert.match(picker, /role="listbox"/);
  assert.match(picker, /Mostrar mais resultados/);
  assert.match(picker, /Sem conexão\. A pesquisa está indisponível offline/);
});

test("pesquisa do Funil preserva autenticação, RLS e minimização de dados", () => {
  assert.match(carteira, /db\.auth\.getUser\(token\)/);
  assert.match(carteira, /from\("f2_lead"\)/);
  assert.match(carteira, /\.is\("descartado_em", null\)/);
  assert.match(carteira, /\.range\(inicio, inicio \+ TAMANHO_PAGINA_FUNIL - 1\)/);
  assert.match(carteira, /termoSeguroBusca/);
  assert.match(carteira, /telefoneMascarado/);
  assert.match(carteira, /\[\.\.\.digitos\]\.join\("\*"\)/);
  assert.doesNotMatch(carteira, /service_role|SUPABASE_SERVICE_ROLE/);
});

test("aviso PWA ocupa uma região do shell sem sobrepor o CRM", () => {
  assert.match(shell, /id="erp-update-region"/);
  assert.match(pwa, /createPortal\(aviso, alvoDoShell\)/);
  assert.match(identityCss, /\.erp-update-region:not\(:empty\)/);
  const toast = identityCss.match(/\.erp-update-toast\{[^}]+\}/)?.[0] ?? "";
  assert.doesNotMatch(toast, /position:fixed|(?:^|;)bottom:|(?:^|;)left:|(?:^|;)right:/);
});

test("mobile mantém um único CTA fixo e ações secundárias no fluxo", () => {
  assert.match(mobile, /className="ape-funil-acoes-secundarias"[\s\S]*>Pescar lead/);
  assert.match(mobile, /className="ape-funil-acoes-fixas"><button[^>]+ape-novo-negocio-fixo/);
  assert.match(css, /ape-funil-acoes-fixas\{[^}]*grid-template-columns:1fr/);
  assert.match(css, /ape-funil-acoes-secundarias\{[^}]*grid-template-columns:repeat\(2/);
});
