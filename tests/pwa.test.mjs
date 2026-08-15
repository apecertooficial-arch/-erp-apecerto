// PWA — manifest e service worker do ERP inteiro (nao mais so do CRM).
// Verifica arquivos estaticos; NAO instala o app nem valida comportamento
// real de install prompt, que exige aparelho/navegador.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const iconeFonte = readFileSync(new URL("../public/icons/apecerto-app.svg", import.meta.url), "utf8");

test("manifest aponta para o ERP, nao para o CRM", () => {
  assert.equal(manifest.name, "ApêCerto — ERP");
  assert.equal(manifest.short_name, "ApêCerto");
  assert.equal(manifest.start_url, "/inicio?origem=pwa");
  assert.ok(!JSON.stringify(manifest).includes("crm=nova-era"), "start_url antigo do CRM nao pode sobrar");
});

test("start_url e atalhos apontam para rotas que existem", () => {
  const rotasValidas = new Set(["/inicio", "/crm", "/agenda", "/notificacoes", "/produtos", "/tarefas"]);
  const caminho = (u) => u.split("?")[0];
  assert.ok(rotasValidas.has(caminho(manifest.start_url)));
  for (const a of manifest.shortcuts) {
    assert.ok(rotasValidas.has(caminho(a.url)), `atalho aponta para rota inexistente: ${a.url}`);
  }
});

test("atalhos cobrem somente Inicio, CRM Funil 2 e Agenda", () => {
  const urls = manifest.shortcuts.map((a) => a.url.split("?")[0]);
  assert.deepEqual(urls, ["/inicio", "/crm", "/agenda"]);
  assert.match(manifest.shortcuts[1].url, /crm=funil-2/);
});

test("icones incluem maskable e os dois tamanhos", () => {
  const tem = (p, s) => manifest.icons.some((i) => i.purpose === p && i.sizes === s);
  assert.ok(tem("any", "192x192") && tem("any", "512x512"));
  assert.ok(tem("maskable", "192x192") && tem("maskable", "512x512"));
});

test("icones usam nome fisico v6 para vencer o cache da instalacao no iPhone", () => {
  for (const icone of manifest.icons) assert.match(icone.src, /-v6\.png$/);
  assert.match(sw, /apecerto-v6/);
  assert.match(sw, /icone-192-v6\.png/);
});

test("somente a geração v6 dos ícones publicados permanece no diretório público", () => {
  const antigos = [
    "apple-touch-icon-v5.png", "apple-touch-icon.png",
    "icone-192-v5.png", "icone-192.png", "icone-512-v5.png", "icone-512.png",
    "maskable-192-v5.png", "maskable-192.png", "maskable-512-v5.png", "maskable-512.png",
  ];
  for (const nome of antigos) {
    assert.equal(existsSync(new URL(`../public/icons/${nome}`, import.meta.url)), false, `${nome} não pode voltar`);
  }
});

test("icone instalado usa a identidade colorida da Apecerto", () => {
  assert.match(iconeFonte, /#ff7000/i);
  assert.match(iconeFonte, /#8b00cc/i);
  assert.match(iconeFonte, /aria-label="ApêCerto"/);
  assert.ok(!/fill="#000000"|fill="#000"/i.test(iconeFonte), "não pode voltar ao ícone preto e branco");
});

test("display standalone e cor da marca preservada", () => {
  assert.equal(manifest.display, "standalone");
  /* Laranja oficial: --ape-orange em apecerto-identidade.css e o themeColor
     de layout.tsx. Comparado em minusculas porque #FF7000 e #ff7000 sao a
     mesma cor -- a caixa da letra nao pode derrubar a suite. */
  assert.equal(String(manifest.theme_color).toLowerCase(), "#ff7000");
});

test("service worker nunca cacheia conteudo sensivel", () => {
  for (const alvo of ["\\/api\\/", "supabase", "\\/auth\\/", "\\/rest\\/v1\\/", "\\/functions\\/v1\\/", "\\/realtime\\/"]) {
    assert.ok(sw.includes(alvo), `padrao privado ausente do service worker: ${alvo}`);
  }
});

test("service worker tem atualizacao controlada e limpeza de logout", () => {
  assert.ok(sw.includes("ATUALIZAR_AGORA"), "troca de versao precisa ser sob comando da pagina");
  assert.ok(sw.includes("LIMPAR_TUDO"), "logout precisa poder revogar caches");
});

test("REGRESSAO: logout chama limparDadosLocais", () => {
  // limparDadosLocais existia desde o PR #39 mas nao era chamada em lugar nenhum:
  // caches e localStorage do usuario anterior sobreviviam ao logout.
  const perfil = readFileSync(new URL("../app/components/ProfilePanel.tsx", import.meta.url), "utf8");
  assert.ok(perfil.includes("limparDadosLocais"), "signOut precisa limpar os dados locais");
  assert.ok(/signOut\(\)[\s\S]{0,600}limparDadosLocais/.test(perfil), "a limpeza precisa estar dentro do fluxo de signOut");
});
