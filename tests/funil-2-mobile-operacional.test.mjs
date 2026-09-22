import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (caminho) => readFileSync(new URL(caminho, import.meta.url), "utf8");
const MOBILE = ler("../app/features/funil-2/Funil2Mobile.tsx");
const ENTRADA = `${ler("../app/(erp)/crm/page.tsx")}\n${ler("../app/features/funil-2/FunilEntry.tsx")}`;
const INICIO = ler("../app/features/home/InicioApp.tsx");
const CSS = ler("../app/styles/app-mobile.css");
const CSS_APROVADO = ler("../app/styles/app-mobile-aprovado.css");
const NAVEGACAO = ler("../app/features/funil-2/MobileCrmNavigation.tsx");
const CSS_ESTEIRA = ler("../app/styles/redesign-apecerto-esteira.css");
const LAYOUT = ler("../app/layout.tsx");
const ESTEIRA = ler("../app/features/sales/SalesProcessWorkspace.tsx");
const HARNESS_ESTEIRA = ler("./sales-mobile-visual-harness/main.tsx");

test("Inicio e CRM do celular usam o Funil 2.0, nunca as filas antigas", () => {
  assert.match(MOBILE, /fetch\("\/api\/funil2"/);
  assert.doesNotMatch(MOBILE, /\/api\/ncrm\/fila/);
  assert.match(INICIO, /modo="inicio"/);
  assert.match(ENTRADA, /if \(ehCelular\)[\s\S]*<Funil2Mobile/);
});

test("todo perfil autorizado entra no F2 sem gate de piloto", () => {
  assert.match(ENTRADA, /GuardaModulo modulo="CRM"/);
  assert.match(ENTRADA, /<Funil2Mobile/);
  assert.match(ENTRADA, /<Funil2Workspace/);
  assert.doesNotMatch(ENTRADA, /CrmNovaEraGate|podeFunil2|liberado|piloto/i);
});

test("Meu Dia entrega o lead e a chamada; a orientação completa fica na ficha", () => {
  assert.match(MOBILE, /className="ape-ordem ape-proxima-aprovada">[\s\S]*<h3>\{acaoVisivel\(lead\)\}<\/h3>/);
  assert.match(MOBILE, /BotaoWhatsApp/);
  // O layout aprovado trocou os chips "Agora · N" por um resumo de tres
  // contadores com rotulo em palavra. O contrato que importa continua o mesmo:
  // os tres numeros do dia saem de `contagens` e cada um chega rotulado.
  for (const [expressao, rotulo] of [["contagens.agora", "aguardando"], ["contagens.novos", "leads novos"], ["contagens.hoje", "para hoje"]]) {
    assert.ok(MOBILE.includes(`{${expressao}}`), `faltou o numero ${expressao}`);
    assert.ok(MOBILE.includes(`<span>${rotulo}</span>`), `faltou o rotulo ${rotulo}`);
  }
  assert.match(MOBILE, /ape-manchete/);
  assert.ok(MOBILE.includes("esperam você agora"), "a manchete precisa contar quem espera agora");
});

test("contadores móveis usam a mesma fila operacional exibida", () => {
  assert.match(MOBILE, /leadOperacionalNoMeuDia/);
  assert.match(MOBILE, /const leadsOperacionais = useMemo\(\(\) => leads\.filter\(leadOperacionalNoMeuDia\), \[leads\]\)/);
  assert.match(MOBILE, /agora: leadsOperacionais\.filter/);
  assert.match(MOBILE, /hoje: leadsOperacionais\.filter/);
  assert.match(MOBILE, /novos: leadsOperacionais\.filter/);
  assert.match(MOBILE, /etapa === "ativos" \? leadOperacionalNoMeuDia\(lead\)/);
  assert.doesNotMatch(MOBILE, /setHours\(23, 59, 59, 999\)/);
});

test("Meu Dia mantém o relógio vivo enquanto a tela permanece aberta", () => {
  assert.doesNotMatch(MOBILE, /const \[agora\] = useState\(\(\) => Date\.now\(\)\)/);
  assert.match(MOBILE, /setInterval\(\(\) => setAgora\(Date\.now\(\)\), 30_000\)/);
  assert.match(MOBILE, /clearInterval\(temporizador\)/);
});

test("a ação principal do aplicativo é verde e tem alvo de toque", () => {
  const inicio = CSS_APROVADO.indexOf(".ape-acoes .ncrm-wa-principal");
  const bloco = CSS_APROVADO.slice(inicio, CSS_APROVADO.indexOf("}", inicio));
  assert.match(bloco, /min-height:44px/);
  assert.match(bloco, /background: #1E9E5A/);
});

test("a folha mobile antiga não mantém estruturas mortas do aplicativo", () => {
  for (const seletor of [".f2m-root", ".f2m-topo", ".f2m-card", ".f2m-filtros", ".f2m-whatsapp"]) {
    assert.ok(!CSS.includes(seletor), `seletor legado ainda presente: ${seletor}`);
  }
});

test("CRM mobile oferece as etapas do Funil como filtro nos dois modos", () => {
  // Busca, menu de filtros, CTA fixo "Novo negócio", valor compacto e atalho da Sara eram do app
  // mobile do CRM V3, desfeito nos reverts 90b5bd8a / 29fc970d. Fica o contrato que o app atual cumpre.
  for (const etapa of ["Lead novo", "Tentando contato", "Em atendimento", "Pós-visita"]) {
    assert.ok(MOBILE.includes(etapa), `falta filtro ${etapa}`);
  }
  assert.match(MOBILE, /modo: "inicio" \| "crm"/);
});

test("erro e estados vazios móveis são anunciados por tecnologia assistiva", () => {
  assert.match(MOBILE, /erro && <div className="ape-estado ruim" role="alert" aria-live="assertive">/);
  assert.match(MOBILE, /pedidoUrl !== null && !leadPedido && <div className="ape-estado ruim" role="alert" aria-live="assertive">/);
  assert.ok((MOBILE.match(/className="ape-estado" role="status" aria-live="polite"/g) ?? []).length >= 2);
});

test("CRM e Meu Dia recuperam sessão expirada pelo estado compartilhado do app", () => {
  assert.match(MOBILE, /import \{ AppMobileSessaoExpirada \}/);
  assert.match(MOBILE, /if \(resposta\.status === 401\) throw new Error\("sessao_expirada"\)/);
  assert.match(MOBILE, /if \(sessaoExpirada\) return <AppMobileSessaoExpirada \/>/);
});

test("CRM móvel rejeita resposta 200 incompleta em vez de fingir carteira vazia", () => {
  assert.match(MOBILE, /function payloadMobileValido\(payload: PayloadMobile\)/);
  assert.match(MOBILE, /\[payload\.leads, payload\.momentos, payload\.eventos, payload\.notas, payload\.tagCatalogo, payload\.etapas\]\.every\(Array\.isArray\)/);
  assert.match(MOBILE, /if \(!payloadMobileValido\(json\)\) throw new Error\("Não foi possível abrir o CRM\."\)/);
});

test("ficha móvel não transforma histórico incompleto em atualização vazia", () => {
  assert.match(MOBILE, /if \(!Array\.isArray\(resposta\.json\.eventos\) \|\| !Array\.isArray\(resposta\.json\.notas\)\)/);
  assert.match(MOBILE, /historicoErro \? <div className="ape-estado ruim" role="alert">/);
  assert.match(MOBILE, /onRecarregarHistorico=\{\(\) => setHistoricoTentativa\(\(atual\) => atual \+ 1\)\}/);
});

test("busca móvel não transforma carteira antiga incompleta em zero resultados", () => {
  assert.match(MOBILE, /if \(!Array\.isArray\(json\.leads\)\) throw new Error\("Não foi possível pesquisar a carteira antiga\."\)/);
  assert.match(MOBILE, /dados && !erro && !erroCarteira && modo === "crm"/);
  assert.match(MOBILE, /erroCarteira \? "Indisponível" : `\$\{carteiraAntiga\.length\} encontrado\(s\)`/);
});

test("WhatsApp continua nativo: a tela não chama endpoint de envio", () => {
  assert.doesNotMatch(MOBILE, /dapi-enviar|enviar-whatsapp|\/api\/crm\/chat|\/api\/live-chat/);
});

test("CRM móvel liga Carteira, Esteira, Visitas e Avisos às rotas canônicas", () => {
  assert.match(MOBILE, /MobileCrmNavigation areaAtual="carteira"/);
  for (const [rotulo, rota] of [["Carteira", "/crm"], ["Esteira", "/crm?vista=vendas"], ["Visitas", "/agenda"], ["Avisos", "/notificacoes"]]) {
    assert.ok(NAVEGACAO.includes(`label: "${rotulo}", href: "${rota}"`), `falta atalho ${rotulo}`);
  }
  assert.match(NAVEGACAO, /aria-current=\{areaAtual === area\.id \? "page" : undefined\}/);
  assert.match(CSS_APROVADO, /ape-mobile-mais-areas button\.ativo/);
  assert.match(LAYOUT, /import "\.\/styles\/app-mobile-aprovado\.css"/);
});

test("vista vendas monta a Esteira canônica no celular", () => {
  assert.match(ENTRADA, /useSearchParams/);
  assert.match(ENTRADA, /searchParams\.get\("vista"\)/);
  assert.match(ENTRADA, /vistaMobile === "vendas"/);
  assert.match(ENTRADA, /ape-mobile-esteira[\s\S]*SalesProcessView/);
  assert.match(ENTRADA, /SalesProcessView accessToken=\{accessToken\} sessionRole=\{role\}/);
});

test("falha inicial da Esteira não deixa o aplicativo preso no carregamento", () => {
  assert.match(ESTEIRA, /const \[initialLoadSettled, setInitialLoadSettled\] = useState\(false\)/);
  assert.match(ESTEIRA, /\.finally\(\(\) => setInitialLoadSettled\(true\)\)/);
  assert.match(ESTEIRA, /if \(!data && !initialLoadSettled\) return <div className="crm-loading"/);
  assert.match(ESTEIRA, /if \(!data\) return <section className="sales-load-error" role="alert">/);
  assert.match(ESTEIRA, /onClick=\{carregarInicial\}>Tentar novamente/);
});

test("harness móvel usa a Esteira produtiva, dados sanitizados e bloqueia mutações", () => {
  assert.match(HARNESS_ESTEIRA, /import \{ SalesProcessView \}/);
  assert.match(HARNESS_ESTEIRA, /<SalesProcessView accessToken="harness-test-only" sessionRole="admin"/);
  assert.match(HARNESS_ESTEIRA, /method !== "GET" \|\| url\.origin !== window\.location\.origin/);
  assert.match(HARNESS_ESTEIRA, /Cliente sanitizado/);
  assert.doesNotMatch(HARNESS_ESTEIRA, /@gmail\.|@hotmail\.|\+55 1[1-9]/);
});

test("folhas carregadas garantem alvos de toque da Esteira no celular", () => {
  assert.match(LAYOUT, /import "\.\/styles\/redesign-apecerto-esteira\.css"/);
  assert.match(CSS_ESTEIRA, /ape-mobile-esteira \.sales-head-actions button,[\s\S]*min-height:44px/);
  assert.match(CSS_ESTEIRA, /ape-mobile-esteira \.sales-approval-actions button/);
  assert.match(CSS_ESTEIRA, /ape-mobile-esteira \.sales-filter button/);
  assert.match(CSS_ESTEIRA, /ape-mobile-esteira \.crm-stage-cog \{ width:44px; height:44px; \}/);
});
