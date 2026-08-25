import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (caminho) => readFileSync(new URL(caminho, import.meta.url), "utf8");
const desktop = ler("../app/features/funil-2/Funil2Workspace.tsx");
const mobile = ler("../app/features/funil-2/Funil2Mobile.tsx");
const tags = ler("../app/features/funil-2/AssociarTagLead.tsx");
const api = ler("../app/api/funil2/route.ts");
const esteira = ler("../app/features/sales/SalesProcessWorkspace.tsx");
const crmCss = ler("../app/styles/redesign-apecerto-crm.css");
const modelo = ler("../app/features/funil-2/modelo.ts");
const temperaturaMigration = ler("../supabase/migrations/20260825150000_funil_2_temperatura_manual_auditavel.sql");

test("desktop replica a ficha aprovada em três áreas e abre a conversa sob demanda", () => {
  for (const rotulo of ["Atendimento", "Notas", "Histórico"]) assert.ok(desktop.includes(rotulo));
  assert.match(desktop, /role="tablist"/);
  assert.match(desktop, /Chat/);
  assert.match(desktop, /Agendar visita/);
  assert.match(desktop, /Mais ações/);
  assert.match(desktop, /Gerar negociação/);
  assert.match(desktop, /Adicionar tag/);
  assert.match(desktop, /Descartar lead/);
  assert.match(desktop, /Funil2ConversationDrawer/);
  assert.doesNotMatch(desktop, /\[\s*\["agora", "Agora"\], \["conversa", "Conversa"\]/);
  assert.doesNotMatch(desktop, /Ver conversa antes de agir|Ferramentas do laboratório|Simular evidência confirmada/);
});

test("aplicativo oferece as mesmas três áreas e ações essenciais do desktop", () => {
  for (const rotulo of ["Atendimento", "Notas", "Histórico"]) assert.ok(mobile.includes(rotulo));
  assert.match(mobile, /AtualizarMomentoMobile/);
  assert.match(mobile, /GerarNegociacaoMobile/);
  assert.match(mobile, /Mais/);
  assert.match(mobile, /Funil2ConversationDrawer/);
  assert.doesNotMatch(mobile, /Atendimento \{Number\(lead\.qualidade_atendimento_nota\)/, "a nota sem explicação não deve poluir o cartão");
});

test("temperatura oficial pode ser filtrada e alterada com persistência auditável", () => {
  for (const codigo of [desktop, mobile]) {
    assert.match(codigo, /rotuloTemperatura/);
    assert.match(codigo, /Aguardando leitura/);
    for (const rotulo of ["Quente", "Negociando", "Morno", "Frio", "Aguardando leitura"]) assert.ok(codigo.includes(rotulo));
    assert.match(codigo, /atualizarTemperatura/);
  }
  assert.match(desktop, /f2-temperatura-filtros/);
  assert.match(desktop, /f2-temperatura-popover/);
  assert.match(mobile, /ape-temperatura-filtros/);
  assert.match(mobile, /ape-temperatura-popover/);
  assert.match(api, /action === "atualizarTemperatura"/);
  assert.match(api, /f2_atualizar_temperatura/);
  assert.match(temperaturaMigration, /CREATE OR REPLACE FUNCTION public\.f2_atualizar_temperatura/i);
  assert.match(temperaturaMigration, /public\.f2_pode_operar_lead\(p_id\)/);
  assert.match(temperaturaMigration, /'correcao_classificacao'/);
  assert.match(temperaturaMigration, /REVOKE ALL ON FUNCTION public\.f2_atualizar_temperatura/i);
  assert.match(temperaturaMigration, /GRANT EXECUTE ON FUNCTION public\.f2_atualizar_temperatura[\s\S]*authenticated/i);
});

test("visita e negociação abertas pela ficha não pedem o cliente de novo", () => {
  assert.match(desktop, /leadFoco=\{lead\}/);
  assert.match(desktop, /CLIENTE DESTA VISITA/);
  assert.match(desktop, /CLIENTE DESTA NEGOCIAÇÃO/);
  assert.match(desktop, /function SeletorLead/);
  assert.doesNotMatch(desktop, /<label>Lead<select/);
});

test("Meu Dia mostra somente visitas ativas e com ficha existente", () => {
  assert.match(desktop, /v\.status === "agendada" \|\| v\.status === "confirmada"/);
  assert.match(desktop, /leads\.some\(\(leadAtual\) => leadAtual\.id === v\.funil_lead_id\)/);
  assert.match(crmCss, /\.f2-visita-contexto > span \{[^}]*flex-direction:column/);
});

test("tags já associadas saem do seletor e o formulário começa sem escolha implícita", () => {
  assert.match(tags, /tagsAssociadas/);
  assert.match(tags, /catalogo\.filter/);
  assert.match(tags, /const \[tagId, setTagId\] = useState\(""\)/);
  assert.match(tags, /disabled=\{salvando \|\| !selecionada\}/);
});

test("as visões principais escondem instruções e edição até existir intenção", () => {
  assert.match(desktop, /Regras do CRM/);
  assert.match(desktop, /<summary>Como este funil funciona<\/summary>/);
  assert.doesNotMatch(desktop, /MAPA DA OPERAÇÃO/);
  assert.match(desktop, /<summary>Como usar o Meu Dia<\/summary>/);
  assert.match(desktop, /const \[modo, setModo\] = useState<"agenda" \| "quadro">\("quadro"\)/);
  assert.match(desktop, /Atrasadas para atualizar/);
  assert.match(desktop, /const \[editando, setEditando\] = useState\(false\)/);
  assert.match(desktop, /Vínculo ausente/);
});

test("a ficha carrega o histórico completo do lead aberto, não o recorte global", () => {
  assert.match(api, /historicoLeadId/);
  assert.match(api, /\.eq\("funil_lead_id", historicoLeadId\)/);
  assert.match(desktop, /historicoLeadId=/);
  assert.match(mobile, /historicoLeadId=/);
});

test("listas e cartões reduzem ações concorrentes", () => {
  const cartao = desktop.slice(desktop.indexOf("f2-card-botoes"), desktop.indexOf("daEtapa.length > 100"));
  assert.doesNotMatch(cartao, /Descartar|>WhatsApp</);
  assert.doesNotMatch(cartao, /em implementação/);
  assert.match(desktop, /role="button" tabIndex=\{0\}/);
  assert.match(desktop, />Abrir ficha<\/button>/);
  assert.match(desktop, /f2-avisos-resumo-excecoes/);
});

test("desktop intermediário preserva nome, contexto e proporção operacional", () => {
  assert.match(crmCss, /\.f2-card-ident\s*\{[^}]*grid-template-columns:28px minmax\(0,1fr\)/);
  assert.match(desktop, /className="f2-card-ident-meta"/);
  assert.match(crmCss, /\.f2-board \.f2-card-trio>\.etapa\s*\{[^}]*display:none/);
  assert.match(crmCss, /body \.f2-lista\s*\{[^}]*padding:8px/);
  assert.match(crmCss, /@media\(max-width:1200px\)[\s\S]*\.f2-resumo\s*\{[^}]*repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(crmCss, /\.f2-resumo>details\s*\{[^}]*grid-column:1\/-1/);
  assert.match(crmCss, /\.f2-nav::-webkit-scrollbar\s*\{[^}]*display:none/);
});

test("linhas e cartões têm densidade de ferramenta operacional, não de blocos promocionais", () => {
  assert.match(crmCss, /\.f2-card\s*\{[^}]*border:1px solid[^}]*box-shadow:none/);
  assert.match(crmCss, /\.f2-card-ident \.f2-card-ident-meta\s*\{[^}]*flex-direction:row/);
  assert.match(crmCss, /\.f2-board \.f2-card-trio-compacto>\.acao\s*\{[^}]*border-top:1px solid/);
  assert.match(crmCss, /\.f2-dia-item\s*\{[^}]*min-height:50px[^}]*margin:0 !important[^}]*border-radius:0 !important[^}]*box-shadow:none !important/);
  assert.match(crmCss, /\.f2-dia-acao\s*\{[^}]*display:flex[^}]*align-items:center/);
  assert.match(crmCss, /\.f2-lead-linha\s*\{[^}]*min-height:50px/);
});

test("funil e listas não repetem frases longas entre ação e prazo", () => {
  assert.match(modelo, /export function prazoDaAcao[\s\S]*return situacao;/);
  assert.doesNotMatch(modelo, /rotulo:\s*`\$\{situacao\.rotulo\} para \$\{acaoVisivel/);
  assert.match(desktop, /function resumoEtapa/);
  assert.match(desktop, /<ChipTemperatura lead=\{item\} compacto \/>/);
  assert.match(desktop, /<small className="f2-card-cadencia">\{cadencia\}<\/small>/);
  assert.match(desktop, /<strong className="f2-lead-acao">\{lead\.acao_rotulo\}<\/strong>/);
  assert.match(crmCss, /\.f2-tabela-compacta \.f2-lead-linha>em\s*\{[^}]*white-space:nowrap/);
  assert.match(crmCss, /\.f2-dia-item>em\s*\{[^}]*white-space:nowrap/);
});

test("Meu Dia e Todos os Leads usam temperatura e próxima ação como informação decisória", () => {
  assert.match(desktop, /f2-dia-colunas[\s\S]*Temperatura[\s\S]*Próxima ação[\s\S]*Tempo/);
  assert.match(desktop, /f2-tabela-cab[\s\S]*Temperatura[\s\S]*Próxima ação/);
  assert.match(desktop, /f2-lead-chip temperatura/);
});

test("cartão móvel aprovado é compacto e não despeja metadados técnicos na fila", () => {
  const cartao = mobile.slice(mobile.indexOf("function CartaoLead"), mobile.indexOf("function AgendarVisitaMobile"));
  assert.match(cartao, /PRÓXIMA AÇÃO/);
  assert.match(cartao, /temperatura-/);
  assert.doesNotMatch(cartao, /<ContextoDoLead/);
  assert.doesNotMatch(cartao, /O momento deste cliente/);
});

test("Esteira expõe aprovações e indicadores antes do kanban", () => {
  assert.match(esteira, /sales-approvals/);
  assert.match(esteira, /sales-metrics/);
  assert.ok(esteira.indexOf("sales-approvals") < esteira.indexOf("sales-kanban"));
});

test("agendamento diferencia catálogo carregando, vazio e indisponível", () => {
  for (const codigo of [desktop, mobile]) {
    assert.match(codigo, /carregandoProdutos/);
    assert.match(codigo, /Não foi possível carregar os produtos/);
    assert.match(codigo, /Nenhum produto disponível/);
    assert.match(codigo, /Produtos indisponíveis/);
  }
});
