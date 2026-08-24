import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (caminho) => readFileSync(new URL(caminho, import.meta.url), "utf8");
const desktop = ler("../app/features/funil-2/Funil2Workspace.tsx");
const mobile = ler("../app/features/funil-2/Funil2Mobile.tsx");
const tags = ler("../app/features/funil-2/AssociarTagLead.tsx");

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

test("temperatura oficial aparece com estados e cores sem controle manual cenográfico", () => {
  for (const codigo of [desktop, mobile]) {
    assert.match(codigo, /rotuloTemperatura/);
    assert.match(codigo, /Aguardando leitura/);
  }
  assert.doesNotMatch(desktop, /Alterar temperatura|setTemperatura/);
  assert.doesNotMatch(mobile, /Alterar temperatura|setTemperatura/);
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
});

test("tags já associadas saem do seletor e o formulário começa sem escolha implícita", () => {
  assert.match(tags, /tagsAssociadas/);
  assert.match(tags, /catalogo\.filter/);
  assert.match(tags, /const \[tagId, setTagId\] = useState\(""\)/);
  assert.match(tags, /disabled=\{salvando \|\| !selecionada\}/);
});

test("as visões principais escondem instruções e edição até existir intenção", () => {
  assert.match(desktop, /Regras do CRM/);
  assert.match(desktop, /<summary><span>Entender o funil/);
  assert.match(desktop, /<summary>Como usar o Meu Dia<\/summary>/);
  assert.match(desktop, /const \[modo, setModo\] = useState<"agenda" \| "quadro">\("agenda"\)/);
  assert.match(desktop, /Atrasadas para atualizar/);
  assert.match(desktop, /const \[editando, setEditando\] = useState\(false\)/);
  assert.match(desktop, /Vínculo ausente/);
});

test("listas e cartões reduzem ações concorrentes", () => {
  const cartao = desktop.slice(desktop.indexOf("f2-card-botoes"), desktop.indexOf("daEtapa.length > 100"));
  assert.doesNotMatch(cartao, /Descartar|>WhatsApp</);
  assert.match(desktop, /role="button" tabIndex=\{0\}/);
  assert.match(desktop, />Abrir ficha<\/button>/);
  assert.match(desktop, /f2-avisos-resumo-excecoes/);
});

test("agendamento diferencia catálogo carregando, vazio e indisponível", () => {
  for (const codigo of [desktop, mobile]) {
    assert.match(codigo, /carregandoProdutos/);
    assert.match(codigo, /Não foi possível carregar os produtos/);
    assert.match(codigo, /Nenhum produto disponível/);
    assert.match(codigo, /Produtos indisponíveis/);
  }
  assert.match(mobile, /disabled=\{salvando \|\| !quando \|\| \(!empreendimento/);
});
