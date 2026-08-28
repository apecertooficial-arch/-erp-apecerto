import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const route = read("../app/(erp)/crm/page.tsx");
const entry = read("../app/features/funil-2/FunilEntry.tsx");
const workspace = read("../app/features/funil-2/Funil2Workspace.tsx");
const mobile = read("../app/features/funil-2/Funil2Mobile.tsx");
const api = read("../app/api/funil2/route.ts");
const layout = read("../app/layout.tsx");
const erpLayout = read("../app/(erp)/layout.tsx");
const shell = read("../app/features/system/ErpShell.tsx");
const routes = read("../app/features/system/erp-routes.ts");
const render = read("../render.yaml");
const css = read("../app/styles/funil.css");
const pwa = read("../app/components/RegistroPwa.tsx");
const identityCss = read("../app/styles/redesign-apecerto.css");

test("/crm possui uma única entrada oficial chamada Funil", () => {
  assert.doesNotMatch(route, /"use client"/);
  assert.match(route, /<FunilEntry/);
  assert.doesNotMatch(`${route}\n${entry}`, /CRM_V3_EXPERIENCE|CrmEntry|experience=|legacy|CrmV3Route|fixture|localValidation/);
  assert.doesNotMatch(render, /CRM_V3_EXPERIENCE/);
  assert.match(routes, /CRM: \{[^\n]+rotuloCurto: "Funil"/);
});

test("o Funil oficial reutiliza sessão, autorização e motor canônico", () => {
  assert.match(entry, /GuardaModulo modulo="CRM"/);
  assert.match(entry, /useErpSession/);
  assert.match(entry, /<Funil2Workspace/);
  assert.match(entry, /<Funil2Mobile/);
  assert.match(workspace, /fetch\("\/api\/funil2"/);
  assert.match(mobile, /fetch\("\/api\/funil2"/);
  assert.doesNotMatch(`${workspace}\n${mobile}`, /localStorage|sessionStorage|fixture|validationAdapter|mock/i);
});

test("autenticação, RLS e mutações continuam na API canônica", () => {
  assert.match(api, /supabase\.auth\.getUser\(token\)/);
  assert.match(api, /f2_atualizar_momento/);
  assert.match(api, /f2_confirmar_acao/);
  assert.match(api, /f2_salvar_visita/);
  assert.match(api, /select\("id,lead_id,valor"\)/);
  assert.match(workspace, /Feedback pendente/);
  assert.match(workspace, /Registrar resultado/);
  assert.doesNotMatch(api, /CRM_V3|fixture|validationAdapter/);
});

test("laboratório e rota paralela não fazem parte da produção", () => {
  assert.equal(existsSync(new URL("../app/(erp)/crm-v3/page.tsx", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/features/funil-2-v3/fixtures.ts", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/features/funil-2-v3/validationAdapter.ts", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/features/system/ErpRuntime.tsx", import.meta.url)), false);
  assert.doesNotMatch(layout, /funil-2-v3|crm-v3-official/);
  assert.doesNotMatch(erpLayout, /ErpRuntime/);
  assert.doesNotMatch(shell, /crmV3Validation|\/crm-v3/);
});

test("a apresentação do Funil é uma folha única, sem camada visual antiga", () => {
  assert.match(layout, /styles\/funil\.css/);
  assert.equal(existsSync(new URL("../app/styles/funil-2.css", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/styles/crm-v3-official.css", import.meta.url)), false);
  assert.match(css, /\.funil-oficial/);
  assert.doesNotMatch(css, /\.crm-v3-official|CRM_V3_EXPERIENCE/);
  assert.doesNotMatch(css, /!important/);
  assert.match(css, /@media\s*\(max-width:\s*720px\)/);
});

test("o Funil permanece dentro do shell global do ERP sem shell interno duplicado", () => {
  assert.doesNotMatch(shell, /if \(moduloAtual === "CRM"\)[\s\S]*funil-product-shell/);
  assert.match(shell, /return \([\s\S]*<AppShell/);
  assert.match(workspace, /className="f2-root funil-oficial"/);
  assert.match(mobile, /modo-\$\{modo\} funil-oficial/);
});

test("cartão inteiro abre a ficha correta por mouse e teclado", () => {
  assert.match(workspace, /className=\{`f2-card[\s\S]*onClick=\{\(\) => \{ if \(modoSelecao\) alternarSelecao\(item\.id\); else setSelecionado\(item\.id\); \}\}/);
  assert.match(workspace, /if \(e\.key === "Enter" \|\| e\.key === " "\)[\s\S]*setSelecionado\(item\.id\)/);
  assert.match(workspace, /lead=\{lead\}[\s\S]*onFechar=\{\(\) => \{ setSelecionado\(null\)/);
  assert.match(mobile, /onAbrir=\{\(\) => \{ setAbrirNoChat\(false\); setSelecionado\(lead\.id\); \}\}/);
});

test("barra principal oferece Pescar lead com autorização canônica", () => {
  assert.match(workspace, /const \[podePescar, setPodePescar\] = useState\(false\)/);
  assert.match(workspace, /setPodePescar\(resposta\.json\.podePescar === true\)/);
  assert.match(workspace, /podePescar && <button/);
  assert.match(workspace, /className="f2-pescar-secundario"/);
  assert.match(workspace, />Pescar lead\{aquario\.length/);
  assert.doesNotMatch(workspace, /Capturar lead da Triagem/);
  assert.match(workspace, /visaoQuadro === "triagem"[\s\S]*>Pescar lead<\/button>/);
  assert.match(api, /podePescar: true/);
  assert.match(api, /db\.rpc\("f2_listar_aquario"\)/);
  assert.match(api, /rpc = "f2_pescar_negocio"/);
  assert.match(mobile, /className="ape-pescar-lead"[\s\S]*>Pescar lead/);
  assert.match(mobile, /<ModalPescar candidatos=\{aquario\}/);
  assert.match(workspace, /<ModalPescar candidatos=\{aquario\} busy=\{busy\} erro=\{erro\}/);
});

test("cartão abre chat direto e reconhecível sem abrir ficha, seleção ou arrasto", () => {
  assert.match(workspace, /const \[chatDireto, setChatDireto\] = useState<LeadFunil2 \| null>\(null\)/);
  assert.match(workspace, /aria-label=\{`Abrir chat de \$\{item\.nome\}`\}/);
  assert.match(workspace, /title=\{`Abrir chat de \$\{item\.nome\}`\}/);
  assert.match(workspace, /className="f2-card-chat"/);
  assert.match(workspace, /<IconeConversa \/>/);
  assert.match(workspace, /draggable=\{false\}/);
  assert.match(workspace, /evento\.stopPropagation\(\); chatOrigemRef\.current = evento\.currentTarget; setChatDireto\(item\);/);
  assert.match(workspace, /chatDireto && \(chatDireto\.lead_id > 0 \? <Funil2ConversationDrawer/);
  assert.match(workspace, /setChatDireto\(null\); requestAnimationFrame\(\(\) => chatOrigemRef\.current\?\.focus\(\)\)/);
  assert.doesNotMatch(workspace, /aria-label=\{`Abrir conversa com \$\{item\.nome\}`\}>○<\/button>/);
  assert.match(mobile, /onConversa=\{\(origem\) => \{ chatOrigemRef\.current = origem; setChatDireto\(lead\); \}\}/);
  assert.match(mobile, /chatDireto && \(chatDireto\.lead_id > 0 \? <Funil2ConversationDrawer/);
});

test("ficha preserva foco, prende teclado e navega sete abas", () => {
  const sete = ["Atendimento", "Histórico", "Atividades", "Negócios", "Imóveis", "Arquivos", "Dados do lead"];
  for (const source of [workspace, mobile]) {
    assert.match(source, /focoOrigemRef/);
    assert.match(source, /requestAnimationFrame/);
    assert.match(source, /evento\.key === "Tab"/);
    assert.match(source, /"ArrowLeft", "ArrowRight", "Home", "End"/);
    assert.match(source, /focoOrigemRef\.current\?\.focus\(\)/);
    for (const label of sete) assert.match(source, new RegExp(`"${label}"`));
    assert.doesNotMatch(source, /experience ===|\["notas", "Notas"\]/);
  }
});

test("ficha desktop replica a arquitetura ampla e compacta aprovada no Claude Design", () => {
  assert.match(workspace, /className="f2-ficha-identidade"/);
  assert.match(workspace, /className="f2-ficha-acoes-topo"/);
  assert.match(workspace, /className="[^"]*f2-ficha-proxima-faixa/);
  assert.match(workspace, /className="f2-ficha-grade"/);
  assert.match(workspace, /className="f2-ficha-contexto"/);
  assert.match(workspace, /className="f2-ficha-painel"/);
  assert.match(workspace, /Classificação do atendimento/);
  assert.match(workspace, /onClick=\{onAgendarVisita\}>Agendar visita/);
  assert.match(workspace, /Descartar sugestão/);
  assert.match(workspace, /Responder pelo CRM/);
  assert.match(workspace, /Abrir conversa completa/);
  assert.match(workspace, /Comentários e notas/);
  for (const acao of ["Focar", "Mover", "Ganho", "Perdido"]) assert.match(workspace, new RegExp(`>${acao}<`));
  assert.match(workspace, /onSalvarNegociacao=\{\(etapa\) => negociacaoLead \? executar\("salvarNegociacao"/);
  assert.match(mobile, /function movimentarNegocio\(etapa: NegociacaoFunil2\["etapa"\]\)/);
  assert.match(mobile, /action: "salvarNegociacao"/);
  assert.doesNotMatch(mobile, /momentoCodigo: destino\.codigo/);
  assert.match(mobile, />Ganho<.*>Perdido</s);
  assert.match(css, /\.funil-oficial \.f2-detalhe\{width:min\(86vw,1040px\);min-width:720px/);
  assert.match(css, /\.funil-oficial \.f2-ficha-grade\{[^}]*grid-template-columns:minmax\(220px,32%\) minmax\(0,1fr\)/);
  assert.match(css, /\.funil-oficial \.f2-detalhe-abas\{[^}]*border-bottom:1px solid/);
  assert.match(css, /\.funil-oficial \.f2-ficha-bloco \.f2-secundario\{width:auto;margin-top:0/);
  assert.match(workspace, /className="f2-ficha-atendimento-continuo"/);
  assert.match(css, /\.funil-oficial \.f2-ficha-atendimento-continuo\{[^}]*border:0/);
  assert.match(css, /\.funil-oficial \.f2-ficha-atendimento-continuo>section\{[^}]*border-bottom:1px solid/);
  assert.match(css, /\.funil-oficial \.f2-ficha-bloco>\.f2-ficha-dados-form\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(workspace, /<button type="button" disabled>Salvar dados<\/button>/);
  assert.match(pwa, /className="erp-update-toast"/);
  assert.doesNotMatch(pwa, /left: 16, right: 16/);
  assert.match(identityCss, /body:has\(\[aria-label\^="Atendimento de"\]\) \.erp-update-toast/);
  assert.match(identityCss, /@media\(max-width:900px\).*body:has\(\[aria-label\^="Atendimento de"\]\) \.erp-update-toast\{display:none\}/);
});

test("ficha usa dados canônicos e não coleções vazias ou identidade fixa", () => {
  assert.match(api, /select\("id,nome,telefone,email,origem,corretor_id,tags,extras"\)/);
  assert.match(api, /from\("f2_negociacao"\)\.select/);
  assert.match(api, /funilLeadIds\.length; inicio \+= 100/);
  assert.doesNotMatch(api, /negociacoes:\s*\[\]/);
  assert.match(api, /from\("negocios"\)\.select\("id,lead_id,pipeline_id,stage_id,empreendimento_id,unidade_id,valor,status/);
  assert.match(api, /from\("empreendimentos"\)\.select/);
  assert.match(api, /from\("unidades"\)\.select/);
  assert.match(api, /from\("esteira_anexos"\)\.select/);
  assert.match(workspace, /lead\.email/);
  assert.match(workspace, /lead\.cpf_cnpj/);
  assert.match(workspace, /lead\.endereco/);
  assert.doesNotMatch(workspace, /<dt>E-mail<\/dt><dd>Não informado<\/dd>/);
});

test("rodapé móvel preserva WhatsApp, Visita e Atividade mesmo com telefone inválido", () => {
  assert.match(mobile, /className="ape-ficha-alerta-contato"/);
  assert.match(mobile, /className="ape-ficha-acao-whatsapp"/);
  assert.match(mobile, /onClick=\{\(\) => setAcaoMais\("visita"\)\}>Visita/);
  assert.match(mobile, />Atividade<\/Link>/);
  assert.match(css, /\.funil-oficial \.ape-ficha-rodape-aprovado\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test("navegação aprovada existe em desktop e mobile", () => {
  for (const label of ["Meu Dia", "Negócios", "Leads", "Atividades", "Visitas", "Esteira", "Painel", "Configurações"]) {
    assert.match(workspace, new RegExp(`>${label}<|\\/> ${label}(?: |<)`));
  }
  assert.match(mobile, /aria-label="Navegação do Funil"/);
  for (const label of ["Meu Dia", "Funil", "Leads", "Agenda", "Visitas"]) assert.match(mobile, new RegExp(`>${label}<`));
  assert.match(workspace, /<Link href="\/agenda"><Icone nome="atividades" \/> Atividades/);
  assert.match(workspace, /href=\{`\/agenda\?lead=/);
  assert.match(mobile, /href=\{`\/agenda\?lead=/);
  assert.doesNotMatch(`${workspace}\n${mobile}`, /href=\{?`?\/tarefas(?:\?|["`])/);
});

test("menu, arrasto e massa convergem no mesmo motor canônico", () => {
  assert.match(workspace, /async function movimentar\(ids: string\[\], etapaCodigo: string\)/);
  assert.match(workspace, /action: "atualizarMomento"/);
  assert.match(workspace, /onDrop=.*movimentar\(\[id\], etapa\.codigo\)/s);
  assert.match(workspace, /movimentar\(selecionados, destinoMassa\)[^>]*>Mover selecionados/);
  assert.match(workspace, /movimentar\(\[item\.id\], destino\)[^>]*>[\s\S]*Escolha a etapa/);
  assert.doesNotMatch(workspace, /setLeads\([^)]*etapa/);
});

test("perfis, filtros e Design System permanecem explícitos", () => {
  assert.match(workspace, /sessionRole=\{profile\.role\}/);
  assert.match(workspace, /const podeGerir = \["admin", "gestor"\]\.includes/);
  assert.match(workspace, /type="search" value=\{buscaQuadro\}/);
  assert.match(workspace, /temperaturaQuadro === "todas"/);
  assert.match(workspace, /Nenhum sucesso foi presumido/);
  assert.match(workspace, />Ganhos <b>/);
  assert.match(workspace, />Perdidos <b>/);
  assert.match(workspace, />Triagem <b>/);
  assert.match(workspace, /Últimos 30 dias · movimentação/);
  assert.match(workspace, />Novo negócio<\/button>/);
  assert.match(css, /flex:0 0 304px/);
  assert.match(css, /background:var\(--ape-orange\)/);
  assert.match(css, /font-family:var\(--font-body\)/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /body:has\(\.funil-oficial\.modo-crm\) #sara-fab[^}]*display:none/);
  assert.match(css, /body:has\(\.funil-oficial\) #sara-fab[^}]*display:none/);
  assert.match(css, /body:has\(\.funil-oficial\) \.convite-instalar[^}]*display:none/);
  assert.match(css, /body:has\(\.funil-oficial \.f2-overlay\) #sara-fab[^}]*display:none/);
  assert.match(css, /\.funil-oficial\.modo-crm>\.ape-filtros button\.ativo[^}]*background:#FFF3EA[^}]*color:#B84300/);
  assert.match(workspace, />Abrir Sara<\/button>/);
  assert.match(mobile, />Sara<\/button>/);
});
