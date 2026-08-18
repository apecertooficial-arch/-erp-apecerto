/* Fechamento das pendencias de frontend da homologacao.
 * Nada aqui toca banco, consulta ou backend.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { podeVer, itensDaNavegacao, rotasModulo } from "../app/features/system/erp-routes.ts";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const convite = ler("../app/components/ConviteInstalar.tsx");
const layoutErp = ler("../app/(erp)/layout.tsx");
const sw = ler("../public/sw.js");
const offline = ler("../public/offline.html");

test("a RPC de performance não volta ao anti-join correlacionado por lead", () => {
  const migration = ler("../supabase/migrations/20260814234000_otimizar_performance_corretores.sql");
  assert.match(migration, /left join fones f on f\.corretor_id=l\.corretor_id and f\.f8=l\.f8/);
  assert.match(migration, /left join dupf d on d\.f8=l\.f8/);
  assert.match(migration, /raise exception 'bloco ld esperado não encontrado'/);
});

/* ---------------- 2. OFFLINE ---------------- */

test("service worker nunca cacheia dado de cliente", () => {
  const privado = sw.match(/const PRIVADO = \[[^\]]+\]/)[0];
  // As barras vem escapadas no fonte (/\/rest\/v1\//i), entao comparamos sem elas.
  const semEscape = privado.replace(/\\/g, "");
  for (const alvo of ["/api/", "supabase", "/auth/", "/rest/v1/", "/functions/v1/", "/realtime/"]) {
    assert.ok(semEscape.includes(alvo), `${alvo} precisa estar fora do cache`);
  }
  assert.ok(/if \(ehPrivado\(url\)\) return;/.test(sw), "rota privada tem que sair antes de qualquer cache");
  assert.ok(/req\.method !== "GET"/.test(sw), "mutacao nunca pode ser servida do cache");
});

test("offline.html existe, e sobrio e tem tentar de novo", () => {
  assert.ok(/Tentar de novo/.test(offline));
  assert.ok(/location\.reload\(\)/.test(offline));
  const texto = offline.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
  assert.ok(!/lead|corretor|telefone|R\$/i.test(texto), "a tela offline nao pode conter dado de cliente");
});

test("sem rede, mutacao nao pode aparecer como concluida", () => {
  // O SW so intercepta GET e so faz fallback em navegacao. POST/PATCH nao tem
  // caminho de sucesso sintetico: falham de verdade, e a tela mostra o erro.
  assert.ok(!/respondWith\(new Response\(/.test(sw), "resposta sintetica poderia fingir que a escrita deu certo");
  assert.ok(!/BackgroundSync|sync\.register|queue/i.test(sw), "fila silenciosa faria a pessoa achar que enviou");
});

/* ---------------- 3. INSTALACAO ---------------- */

test("convite de instalação pertence ao layout autenticado e não fica órfão", () => {
  assert.match(layoutErp, /import \{ ConviteInstalar \} from "\.\.\/components\/ConviteInstalar"/);
  assert.match(layoutErp, /<ConviteInstalar \/>/);
});

test("Android: botao so aparece com beforeinstallprompt real", () => {
  assert.ok(/addEventListener\("beforeinstallprompt"/.test(convite));
  assert.ok(/if \(!evento && !ios\) return null/.test(convite), "sem evento e fora do iOS nao pode oferecer nada");
  assert.ok(/\{evento && <button[^>]*convite-instalar-ok/.test(convite), "o botao Instalar depende do evento existir");
  assert.ok(/evento\.prompt\(\)/.test(convite), "o clique precisa chamar o prompt do proprio navegador");
});

test("iPhone: orientacao textual, nunca botao que nao funciona", () => {
  assert.ok(/Adicionar à Tela de Início/.test(convite));
  assert.ok(/Compartilhar/.test(convite));
  const ramoIos = convite.slice(convite.indexOf("{ios ? ("), convite.indexOf(") : ("));
  assert.ok(!/<button/.test(ramoIos), "iOS nao instala por script; botao ali seria mentira");
});

test("nao promete instalacao automatica nem reaparece depois de instalado", () => {
  assert.ok(/jaInstalado/.test(convite) && /display-mode: standalone/.test(convite));
  assert.ok(/appinstalled/.test(convite));
  assert.ok(!/instalando|instalaremos|instala automaticamente/i.test(convite));
});

test("a chave do convite e limpa no logout", () => {
  const registro = ler("../app/components/RegistroPwa.tsx");
  const prefixos = [...registro.match(/const PREFIXOS_APECERTO[^;]+;/)[0].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const chave = convite.match(/CHAVE_DISPENSADO = "([^"]+)"/)[1];
  assert.ok(prefixos.some((p) => chave.startsWith(p)), `"${chave}" ficaria para o proximo usuario`);
});

/* ---------------- 4. PERMISSOES ---------------- */

const CORRETOR = {
  crm: ["ver"], chat: ["ver"], leads: ["ver"], vendas: ["ver"], disparos: ["ver"],
  pipeline: ["ver"], produtos: ["ver"], comissoes: ["ver"], dashboard: ["ver"],
  abordagens: ["ver"], calendario: ["ver"], performance: ["ver"],
  notificacoes: ["ver"], configuracoes: ["ver"],
};
const comoCorretor = { role: "corretor", permissoes: CORRETOR, carregado: true, isManager: false };
const comoAdmin = { role: "admin", permissoes: null, carregado: true, isManager: true };

test("corretor nao ve Financeiro so por ter comissoes:ver", () => {
  assert.equal(CORRETOR.comissoes.includes("ver"), true, "o cenario perde o sentido sem comissoes:ver");
  assert.equal(podeVer("Financeiro", comoCorretor), false);
});

test("Projetos e Tarefas aparece, e o slug usado e real", () => {
  assert.equal(podeVer("Projetos e Tarefas", comoCorretor), true);
  const doBanco = new Set(["abordagens","agentes_ia","auditoria","automacoes","calendario","chat",
    "comissoes","configuracoes","crm","dashboard","disparos","financeiro","fluxo_caixa","leads",
    "metas","notificacoes","performance","pipeline","produtos","usuarios","vendas"]);
  for (const [modulo, rota] of Object.entries(rotasModulo)) {
    for (const slug of rota.slugs) {
      assert.ok(doBanco.has(slug), `${modulo} usa slug "${slug}", que nao existe no banco`);
    }
  }
});

test("admin continua vendo todos os modulos autorizados", () => {
  const { barra, mais } = itensDaNavegacao(comoAdmin);
  // O app oferece apenas os modulos com tela de celular (mobile:true); os
  // demais seguem alcancaveis no computador. Antes desta flag a folha "Mais"
  // espelhava a sidebar inteira e abria telas de escritorio em 390px.
  const doApp = Object.entries(rotasModulo).filter(([, rota]) => rota.mobile).map(([nome]) => nome);
  assert.equal(barra.length + mais.length, doApp.length, "admin precisa alcancar todo modulo com tela de celular");
  for (const m of ["Financeiro", "Usuários", "Perfis e Permissões", "Auditoria", "Projetos e Tarefas"]) {
    assert.equal(podeVer(m, comoAdmin), true, `${m} sumiu para o admin`);
  }
  assert.ok([...barra, ...mais].includes("Projetos e Tarefas"), "Tarefas tem tela de celular e precisa aparecer");
});
