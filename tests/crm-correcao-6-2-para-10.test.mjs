import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const workspace = read("../app/features/funil-2/Funil2Workspace.tsx");
const toolbar = read("../app/features/funil-2/Funil2BoardToolbar.tsx");
const mobile = read("../app/features/funil-2/Funil2Mobile.tsx");
const picker = read("../app/features/funil-2/LeadSearchPicker.tsx");
const carteira = read("../app/api/funil2/carteira/route.ts");
const css = read("../app/styles/funil.css");

test("contagem do quadro corresponde somente às etapas realmente exibidas", () => {
  assert.match(workspace, /const leadsDoQuadro = leadsDoPeriodo\.filter/);
  assert.match(toolbar, /<span>Em andamento<\/span><b>\{props\.negociosVisiveis\}<\/b><small>etapas visíveis<\/small>/);
  assert.match(workspace, /> Negócios <b>\{leadsDoQuadro\.length\}<\/b>/);
  assert.match(workspace, /foraDoQuadro > 0[\s\S]*fora das etapas visíveis/);
  /* Com as trilhas do funil (Alphaville), o contador de Leads acompanha a
     trilha em foco — o número precisa bater com a lista que a aba mostra. */
  assert.match(workspace, /Leads <b>\{leadsDoFunil\.length\}<\/b>/);
});

test("CRM publicado resume o pipeline com dados reais no desktop e no app", () => {
  assert.match(toolbar, /aria-label="Resumo acionável do pipeline"/);
  assert.match(toolbar, /<small>aguardando análise<\/small>/);
  assert.match(mobile, /className="ape-crm-kpis" aria-label="Resumo da carteira"/);
  assert.match(mobile, /<strong>\{leads\.length\}<\/strong><small>clientes ativos<\/small>/);
  assert.match(mobile, /<strong>\{visiveis\.length\}<\/strong><small>neste recorte<\/small>/);
  assert.match(mobile, /<strong>\{contagens\.agora\}<\/strong><small>aguardando agora<\/small>/);
  assert.match(css, /\.funil-oficial \.ape-crm-kpis/);
});

test("estados vazios explicam o recorte e oferecem recuperação", () => {
  assert.match(workspace, /className="f2-coluna-vazia" role="status"/);
  assert.match(workspace, /termoQuadro \|\| temperaturaQuadro !== "todas"/);
  assert.match(workspace, /Ajuste a busca ou os filtros para ver outros negócios\./);
  assert.match(mobile, />Limpar filtros<\/button>/);
  assert.match(mobile, /setBusca\(""\); setEtapa\("ativos"\); setTemperatura\("todas"\)/);
  assert.match(css, /\.funil-oficial \.f2-coluna-vazia/);
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
  // O app mobile voltou à versão anterior ao CRM V3 (revert 90b5bd8a ("restaurar versão estável anterior ao CRM V3") e 29fc970d ("restaurar web de sexta e preservar app")); o seletor remoto ficou só no desktop.
  assert.match(workspace, /<LeadSearchPicker/);
  assert.doesNotMatch(mobile, /leads\.map\(\(item\) => <option/);
  assert.match(picker, /modo: "buscar-funil"/);
  assert.match(picker, /AbortController/);
  assert.match(picker, /setTimeout[\s\S]*280/);
  assert.match(picker, /ArrowDown/);
  assert.match(picker, /role="listbox"/);
  assert.match(picker, /Mostrar mais resultados/);
  assert.match(picker, /Sem conexão\. A pesquisa está indisponível offline/);
});

test("novo negócio não transforma resposta incompleta em nenhum cliente", () => {
  assert.match(picker, /if \(!Array\.isArray\(json\.leads\)\) throw new Error\("payload_invalido"\)/);
  assert.match(picker, /setErro\(navigator\.onLine \? "Não foi possível pesquisar os clientes\."/);
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
