import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const workspace = read("../app/features/funil-2/Funil2Workspace.tsx");
const css = read("../app/styles/funil.css");
const card = workspace.slice(
  workspace.indexOf("{daEtapa.slice(0, limiteDaEtapa).map"),
  workspace.indexOf("{daEtapa.length > limiteDaEtapa"),
);

test("card desktop explicita cliente, momento, temperatura, próxima ação e prazo", () => {
  assert.match(card, /f2-card-avatar/);
  assert.match(card, /f2-card-contexto/);
  assert.match(card, /f2-card-sinais/);
  assert.match(card, /<span>Momento<\/span><strong>\{momento\?\.rotulo \?\? item\.momento_codigo\}<\/strong>/);
  assert.match(card, /<span>Temperatura<\/span><ChipTemperatura lead=\{item\} compacto \/>/);
  assert.match(card, /f2-card-proxima/);
  assert.match(card, /<span>Próxima ação<\/span>/);
  assert.doesNotMatch(card, /f2-card-momento/);
  assert.match(card, /f2-card-prazo/);
  assert.match(card, /f2-card-chat[\s\S]*<span>Conversa<\/span>/);
});

test("card não repete metadados operacionais disponíveis na ficha", () => {
  assert.doesNotMatch(card, /tentativaAtual|rotuloCadencia|f2-card-valor|f2-card-tags|InteresseLead/);
  assert.match(card, /menuCardId === item\.id && <div role="menu">/);
  assert.match(card, /setChatDireto\(item\)/);
  assert.match(card, /setSelecionado\(item\.id\)/);
});

test("geometria vertical mostra informações completas e conversa ocupa o rodapé", () => {
  assert.match(css, /f2-coluna[^}]*flex:0 0 276px/);
  const regraNome = css.match(/\.funil-oficial \.f2-card-identidade>strong\{[^}]+\}/)?.[0] ?? "";
  const regraAcao = css.match(/\.funil-oficial \.f2-card-proxima>strong\{[^}]+\}/)?.[0] ?? "";
  const regraRodape = css.match(/\.funil-oficial \.f2-card-rodape\{[^}]+\}/)?.[0] ?? "";
  const regraChat = css.match(/\.funil-oficial \.f2-card-chat\{[^}]+\}/)?.[0] ?? "";
  assert.doesNotMatch(regraNome, /text-overflow:ellipsis|white-space:nowrap|-webkit-line-clamp/);
  assert.doesNotMatch(regraAcao, /overflow:hidden|-webkit-line-clamp/);
  assert.match(css, /f2-card-sinais[^}]*display:grid/);
  assert.match(regraRodape, /flex-direction:column/);
  assert.match(regraRodape, /align-items:stretch/);
  assert.match(regraChat, /width:100%/);
  assert.match(css, /f2-card-menu>button[^}]*width:44px[^}]*height:44px/);
  assert.match(css, /f2-card-chat[^}]*min-height:44px/);
});

test("contexto secundário é role-aware, discreto e não usa elipse", () => {
  assert.match(card, /const papel = profile\.role\.toLowerCase\(\)/);
  assert.match(card, /papel === "corretor"/);
  assert.match(card, /item\.interesse \?\? "Interesse ainda não informado"/);
  assert.match(card, /item\.corretor_nome \? `Corretor · \$\{item\.corretor_nome\}`/);
  assert.doesNotMatch(card, /f2-card-meta/);

  const regraContexto = css.match(/\.funil-oficial \.f2-card-contexto\{[^}]+\}/)?.[0] ?? "";
  assert.match(regraContexto, /white-space:normal/);
  assert.match(regraContexto, /overflow-wrap:anywhere/);
  assert.doesNotMatch(regraContexto, /text-overflow:ellipsis|white-space:nowrap|-webkit-line-clamp/);
});

test("prazo usa estados semânticos e vermelho somente no atraso", () => {
  assert.match(css, /f2-card-prazo\.atrasado[^}]*var\(--danger-bg\)[^}]*var\(--fg-1\)/);
  assert.match(css, /f2-card-prazo\.urgente[^}]*var\(--warning-bg\)[^}]*var\(--fg-1\)/);
  assert.match(css, /f2-card-prazo\.no-prazo[^}]*var\(--bg-sunken\)[^}]*var\(--fg-3\)/);
});
