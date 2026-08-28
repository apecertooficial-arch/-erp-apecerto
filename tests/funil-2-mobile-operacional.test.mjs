import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (caminho) => readFileSync(new URL(caminho, import.meta.url), "utf8");
const MOBILE = ler("../app/features/funil-2/Funil2Mobile.tsx");
const ENTRADA = `${ler("../app/(erp)/crm/page.tsx")}\n${ler("../app/features/funil-2/FunilEntry.tsx")}`;
const INICIO = ler("../app/features/home/InicioApp.tsx");
const CSS = ler("../app/styles/app-mobile.css");
const CSS_APROVADO = ler("../app/styles/app-mobile-aprovado.css");

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

test("cartão do Meu Dia expõe etapa, corretor e WhatsApp direto", () => {
  assert.match(MOBILE, /mostrarWhatsappDireto: boolean/);
  assert.match(MOBILE, /mostrarWhatsappDireto\s*\?\s*`\$\{nomeEtapa\(lead\.etapa\)\} · \$\{lead\.corretor_nome \?\? "Aguardando responsável"\}`/);
  assert.match(MOBILE, /mostrarWhatsappDireto[\s\S]*<BotaoWhatsApp[^>]*rotulo="Chamar no WhatsApp"/);
  assert.match(MOBILE, /mostrarWhatsappDireto=\{modo === "inicio"\}/);
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

test("CRM mobile troca o quadro de desktop por busca, filtros e cartões", () => {
  assert.match(MOBILE, /placeholder="Buscar"/);
  assert.match(MOBILE, /className="ape-filtros-menu"/);
  for (const etapa of ["Lead novo", "Tentando contato", "Em atendimento", "Pós-visita"]) {
    assert.ok(MOBILE.includes(etapa), `falta filtro ${etapa}`);
  }
  assert.match(MOBILE, /modo: "inicio" \| "crm"/);
  assert.ok(MOBILE.includes('className="ape-novo-negocio-fixo"'));
  assert.match(MOBILE, />Novo negócio<\/button>/);
  assert.match(MOBILE, /GerarNegociacaoMobile lead=\{leadNovoNegocio\}/);
  assert.match(MOBILE, /valorCompacto\(lead\)/);
  assert.doesNotMatch(MOBILE, />Ativos<\/button>/);
  assert.match(MOBILE, /rotuloEtapaMobile/);
  assert.match(MOBILE, /acaoCompactaMobile/);
  assert.match(MOBILE, /aria-label="Abrir a Sara"/);
});

test("WhatsApp continua nativo: a tela não chama endpoint de envio", () => {
  assert.doesNotMatch(MOBILE, /dapi-enviar|enviar-whatsapp|\/api\/crm\/chat|\/api\/live-chat/);
});
