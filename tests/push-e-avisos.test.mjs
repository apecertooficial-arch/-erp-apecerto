/* Push com barulho e a tela de Avisos — as três pontas do aviso.
 *
 * A corrente do push atravessa quatro lugares que não se enxergam:
 * o gerador no banco (notificacoes_sincronizar), a entrega (edge function
 * ncrm-web-push), o sw.js no aparelho e a tela de Avisos. Estes testes
 * conferem as pontas que vivem NESTE repositório e amarram as listas que
 * precisam ser iguais dos dois lados.
 *
 * Tudo aqui é leitura de texto: sw.js roda em service worker e a rota roda
 * no servidor — nenhum dos dois importa num teste de node puro.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const SW = ler("../public/sw.js");
const ROTA = ler("../app/api/ncrm/notificacoes/route.ts");
const GATE = ler("../app/features/crm-nova-era/CrmNovaEraGate.tsx");
const LISTA = ler("../app/features/crm-nova-era/TelaCrmMobile.tsx");
const MIGRACAO = ler("../supabase/migrations/20260803010000_push_vencendo_e_deep_links_reais.sql");

/* ---------------- o barulho ---------------- */

test("lead novo, resposta e combinado vencendo/vencido são urgentes no aparelho", () => {
  const inicio = SW.indexOf("TAGS_URGENTES");
  assert.ok(inicio > -1, "a lista de urgentes precisa existir e ter nome");
  const bloco = SW.slice(inicio, SW.indexOf("]", inicio));
  for (const tag of ["primeira_abordagem_pendente", "cliente_respondeu", "acao_vencendo", "acao_vencida"]) {
    assert.ok(bloco.includes(`"${tag}"`), `"${tag}" precisa estar na lista de urgentes do sw.js`);
  }
});

test("urgente vibra e NUNCA é silencioso", () => {
  assert.match(SW, /vibrate: urgente \? \[180, 80, 180\] : undefined/);
  assert.match(SW, /silent: urgente \? false : undefined/, "silent: false é o que garante o som padrão do aparelho");
});

test("a lista do sw.js casa com a da migração que enfileira", () => {
  /* As duas listas vivem em mundos diferentes (navegador × banco). Este
     assert é o único fio que as mantém iguais: se alguém adicionar um tipo
     urgente num lado só, quebra aqui e não no bolso do corretor. */
  for (const tipo of ["acao_vencendo", "acao_vencida"]) {
    assert.ok(MIGRACAO.includes(`'${tipo}'`), `a migração precisa conhecer "${tipo}"`);
  }
  assert.match(MIGRACAO, /interval '30 minutes'/, "o vencendo dispara 30 minutos antes do prazo");
});

test("deep link do push aponta para rota que existe", () => {
  assert.ok(MIGRACAO.includes("'/crm?lead='||e.negocio_id"), "corretor vai para /crm?lead=N");
  assert.ok(!/'\/negocio\/'/.test(MIGRACAO), "/negocio/N não existe no aplicativo — era 404 no toque");
});

/* ---------------- a rota que faltava ---------------- */

test("a tela de Avisos tem servidor: a rota chama a RPC do banco", () => {
  assert.match(ROTA, /rpc\("ncrm_notificacoes"\)/);
  assert.match(ROTA, /rpc\("ncrm_notificacao_vista"/, "marcar como vista também existe");
});

test("a rota traduz o shape da RPC para o contrato da tela", () => {
  /* A RPC fala `desde`/`vista`; o tipo Aviso fala `criada_em`/`vista_em`.
     Sem esta tradução a tela mostra tudo como não lido e sem tempo. */
  assert.match(ROTA, /criada_em: i\.desde/);
  assert.match(ROTA, /vista_em: i\.vista \? i\.desde : null/);
});

test("falha na RPC vira 502, nunca lista vazia", () => {
  assert.match(ROTA, /status: 502/, "Avisos zerados por erro fariam o corretor achar que está tudo em dia");
});

/* ---------------- o toque no push ---------------- */

test("no celular, ?lead= abre a ficha do celular — não o CRM de desktop", () => {
  const semComentarios = GATE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(semComentarios, /deepLink\.chat/, "a conversa continua indo para o CrmWorkspace");
  assert.match(semComentarios, /deepLink\.lead/, "a ficha tem tratamento próprio");
  assert.match(semComentarios, /ehCelular === null\) return null/, "largura desconhecida não pode chutar desktop e baixar 1,8 MB à toa");
});

test("a TelaCrmMobile consome o ?lead= e apaga a query", () => {
  const semComentarios = LISTA.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(semComentarios, /lerLeadDaUrl/);
  assert.match(semComentarios, /limparLeadDaUrl/, "voltar não pode reabrir a mesma ficha");
  assert.match(semComentarios, /não está mais na sua fila/, "lead fora da fila é aviso visível, nunca silêncio");
});

test("o sw.js continua levando o toque para dentro do app", () => {
  assert.match(SW, /notificationclick/);
  assert.match(SW, /url\.startsWith\("\/"\)/, "URL absoluta vinda do pacote abriria site de fora");
});
