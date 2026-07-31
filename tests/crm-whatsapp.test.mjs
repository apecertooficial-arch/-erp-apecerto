// CRM operacional — invariantes do fluxo de WhatsApp manual.
//
// O que estes testes provam: normalizacao de telefone, ausencia de qualquer
// chamada de envio no caminho novo, historico sem composer, e proposta != venda.
// O que eles NAO provam: layout renderizado em aparelho, comportamento real do
// esquema whatsapp:// no iOS/Android.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  normalizarTelefone, dddExiste, urlWhatsAppApp, urlWhatsAppWeb, prepararAberturaWhatsApp,
} from "../app/features/crm-nova-era/lib/whatsappNativo.ts";
import { grupoVisivel, GRUPO_VISIVEL_ORDEM, GRUPO_VISIVEL_ROTULO } from "../app/features/crm-nova-era/lib/linguagem.ts";

const raiz = new URL("../app/", import.meta.url).pathname;
const ler = (rel) => readFileSync(join(raiz, rel), "utf8");

/* Varredura de invariante olha CODIGO, nao comentario. Sem isto, um comentario
   explicando "nao usamos window.open" reprovaria o proprio arquivo que esta
   correto. Remove // linha, /* bloco *\/ e {/* JSX *\/}. */
const semComentarios = (src) => src
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

function arquivos(dir, acc = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, acc);
    else if (/\.(ts|tsx)$/.test(p)) acc.push(p);
  }
  return acc;
}

/* ------------------------- 1. Normalizacao de telefone ------------------------- */

test("normaliza telefone brasileiro para E.164", () => {
  for (const bruto of ["(11) 98765-4321", "11987654321", "5511987654321", "+55 11 98765-4321", " 11 9 8765 4321 "]) {
    const r = normalizarTelefone(bruto);
    assert.equal(r.ok, true, `deveria aceitar ${bruto}`);
    assert.equal(r.e164, "5511987654321");
  }
});

test("aceita fixo de 10 digitos", () => {
  const r = normalizarTelefone("(11) 3255-4321");
  assert.equal(r.ok, true);
  assert.equal(r.e164, "551132554321");
});

test("telefone invalido devolve motivo e explicacao humana", () => {
  const casos = [
    ["", "vazio"],
    ["119876", "curto_demais"],
    ["11987654321987", "pais_nao_suportado"],
    ["(20) 98765-4321", "ddd_invalido"],
    ["(11) 88765-4321", "celular_sem_nove"],
  ];
  for (const [bruto, motivo] of casos) {
    const r = normalizarTelefone(bruto);
    assert.equal(r.ok, false, `${bruto} deveria ser recusado`);
    assert.equal(r.motivo, motivo);
    assert.ok(r.explicacao.length > 10, "erro precisa explicar em linguagem humana");
    assert.ok(!/regex|E\.?164|parse|invalid input/i.test(r.explicacao), "erro nao pode ser tecnico");
  }
});

test("DDDs inexistentes sao recusados; validos aceitos", () => {
  for (const d of [20, 23, 25, 26, 29, 36, 39, 40, 50, 52, 56, 57, 58, 59, 60, 70, 72, 76, 78, 80, 90]) {
    assert.equal(dddExiste(d), false, `DDD ${d} nao existe no Brasil`);
  }
  for (const d of [11, 21, 31, 41, 51, 61, 71, 81, 91]) assert.equal(dddExiste(d), true);
});

test("telefone invalido NAO produz link de abertura", () => {
  const r = prepararAberturaWhatsApp("(20) 98765-4321");
  assert.equal(r.ok, false);
  assert.equal(r.app, undefined, "nao pode existir URL de app para telefone invalido");
  assert.equal(r.web, undefined, "nao pode existir URL web para telefone invalido");
});

/* ------------------------- 2. Esquema de abertura ------------------------- */

test("abre whatsapp://send e cai para wa.me", () => {
  assert.equal(urlWhatsAppApp("5511987654321"), "whatsapp://send?phone=5511987654321");
  assert.equal(urlWhatsAppWeb("5511987654321"), "https://wa.me/5511987654321");
});

test("nenhuma URL leva texto pre-preenchido (o corretor escreve no proprio app)", () => {
  const r = prepararAberturaWhatsApp("11987654321");
  for (const u of [r.app, r.web]) {
    assert.ok(!/[?&]text=/.test(u), `URL nao pode carregar mensagem: ${u}`);
  }
});

test("SEM POPUP ATRASADO: o botao navega pelo href, na interacao do usuario", () => {
  const bruto = ler("features/crm-nova-era/components/BotaoWhatsApp.tsx");
  const src = semComentarios(bruto);
  assert.ok(/href=\{preparo\.app\}/.test(src), "a acao principal precisa ser <a href={preparo.app}>");
  assert.ok(!/window\.open/.test(src), "window.open e bloqueado fora da ativacao do usuario");
  assert.ok(!/setTimeout\([^)]*window\.location/.test(src), "nao pode navegar por temporizador");
  // O unico setTimeout tolerado e o do aviso "copiado".
  const timers = src.match(/setTimeout\(/g) ?? [];
  assert.ok(timers.length <= 1, `esperado no maximo 1 setTimeout (aviso de copia), achei ${timers.length}`);
  assert.ok(/href=\{preparo\.web\}/.test(src), "fallback wa.me precisa ser link visivel");
});

/* ------------------------- 3. O clique nao faz mais nada ------------------------- */

test("clicar NAO confirma contato, NAO muda etapa, NAO inicia SLA, NAO envia", () => {
  const src = semComentarios(ler("features/crm-nova-era/components/BotaoWhatsApp.tsx"));
  const proibidos = [
    /fetch\s*\(/,                       // nenhuma chamada de rede
    /\/api\//,                          // nenhum endpoint
    /supabase/i,                        // nenhum acesso direto ao banco
    /\bsetEtapa\b|\bmudarEtapa\b|\bcoluna\s*=/,   // nenhuma mudanca de etapa
    /confirmarContato|registrarContato|marcarContato/,
    /iniciarSla|startSla|sla_inicio|primeiraAbordagem/i,
    /enviarMensagem|sendMessage|outbound/i,
  ];
  for (const re of proibidos) {
    assert.ok(!re.test(src), `BotaoWhatsApp nao pode conter ${re}`);
  }
});

test("o unico efeito do clique e avisar a tela (intencao)", () => {
  const src = ler("features/crm-nova-era/components/BotaoWhatsApp.tsx");
  assert.ok(/onAbriu\?\.\(negocioId\)/.test(src), "clique so propaga intencao");
});

/* ------------------------- 4. Nenhum envio no frontend ------------------------- */

test("VARREDURA: nenhum componente do CRM Nova Era chama endpoint de envio", () => {
  const suspeitos = [
    /fetch\([^)]*\/api\/[^)]*(enviar|send|disparo|outbound|mensagem)/i,
    /\/api\/ncrm\/(enviar|send|outbound)/i,
    /\/api\/live-chat[^)]*method:\s*["']POST/i,
  ];
  const achados = [];
  for (const f of arquivos(join(raiz, "features/crm-nova-era"))) {
    const src = semComentarios(readFileSync(f, "utf8"));
    for (const re of suspeitos) if (re.test(src)) achados.push(`${f} :: ${re}`);
  }
  assert.deepEqual(achados, [], `chamada de envio encontrada no CRM:\n${achados.join("\n")}`);
});

test("VARREDURA: nao existe rota de API de envio de WhatsApp no repositorio", () => {
  const api = join(raiz, "api");
  const rotasEnvio = arquivos(api).filter((f) => /\/(enviar|send|outbound|disparar)\//.test(f));
  assert.deepEqual(rotasEnvio, [], "o app nao deve expor rota de envio");
});

/* ------------------------- 5. Historico somente leitura ------------------------- */

test("ficha do lead nao tem campo de digitacao nem botao de envio", () => {
  const src = semComentarios(ler("features/crm-nova-era/components/LeadPanel.tsx"));
  assert.ok(!/<textarea/i.test(src), "historico nao pode ter textarea");
  assert.ok(!/<input(?![^>]*type=["'](checkbox|radio)["'])/i.test(src), "historico nao pode ter campo de texto");
  assert.ok(!/>\s*Enviar\s*</i.test(src), "historico nao pode ter botao Enviar");
  assert.ok(!/composer|Composer/.test(src), "historico nao pode ter composer");
});

/* ------------------------- 6. Meu Dia: tres grupos ------------------------- */

test("Meu Dia apresenta exatamente tres grupos, na ordem de urgencia", () => {
  assert.deepEqual(GRUPO_VISIVEL_ORDEM, ["atenda_agora", "faca_combinado", "acompanhe"]);
  assert.deepEqual(
    GRUPO_VISIVEL_ORDEM.map((g) => GRUPO_VISIVEL_ROTULO[g]),
    ["Atenda agora", "Faça o combinado", "Acompanhe"],
  );
});

test("os quatro grupos internos colapsam corretamente nos tres visiveis", () => {
  assert.equal(grupoVisivel("atenda_agora"), "atenda_agora");
  assert.equal(grupoVisivel("faca_hoje"), "faca_combinado");
  assert.equal(grupoVisivel("agendados"), "faca_combinado");
  assert.equal(grupoVisivel("aguardando_cliente"), "acompanhe");
});

test("card do Meu Dia tem UMA acao principal (sem botoes concorrentes)", () => {
  const src = ler("features/crm-nova-era/components/MeuDia.tsx");
  const bloco = src.slice(src.indexOf('className="ncrm-dia-acao"'), src.indexOf('className="ncrm-dia-acao"') + 400);
  const botoes = bloco.match(/<button/g) ?? [];
  assert.equal(botoes.length, 1, `esperado 1 botao de acao no card, achei ${botoes.length}`);
});

test("Meu Dia trata carregando, vazio e erro", () => {
  const src = ler("features/crm-nova-era/components/MeuDia.tsx");
  assert.ok(/carregando &&/.test(src), "precisa de estado de carregamento");
  assert.ok(/erro &&/.test(src), "precisa de estado de erro");
  assert.ok(/itens\.length === 0/.test(src), "precisa de estado vazio");
});

test("Meu Dia nao reordena a fila no cliente (prioridade vem do banco)", () => {
  const src = ler("features/crm-nova-era/components/MeuDia.tsx");
  assert.ok(!/\.sort\(/.test(src), "ordenacao no cliente divergiria da regra do banco");
});
