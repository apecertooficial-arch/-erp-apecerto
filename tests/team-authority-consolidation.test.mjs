import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ui = readFileSync(new URL("../app/features/team/TeamWorkspace.tsx", import.meta.url), "utf8");

test("Usuarios nao cria token de autocadastro privilegiado no navegador", () => {
  assert.doesNotMatch(ui, /from\("cadastro_convites"\)/);
  assert.doesNotMatch(ui, /crypto\.randomUUID/);
  assert.doesNotMatch(ui, /gerarLinkCadastro/);
  assert.match(ui, /Criar e gerar convite/);
});

test("Usuarios nao mantem uma segunda autoridade de QR", () => {
  assert.doesNotMatch(ui, /functions\.invoke\("dapi-qr"/);
  assert.doesNotMatch(ui, /Conectada com sucesso!/);
  assert.doesNotMatch(ui, /function openQr/);
  assert.match(ui, /href="\/configuracoes\?visao=conexoes"/);
  assert.match(ui, /Gerenciar conexões/);
});

test("interface nao exibe erro tecnico arbitrario de Edge ou Storage", () => {
  assert.doesNotMatch(ui, /fnError\?\.message|uploadError\.message|signedError\?\.message/);
  assert.doesNotMatch(ui, /r\.detalhe/);
  assert.match(ui, /Não foi possível enviar o documento agora\./);
  assert.match(ui, /Não foi possível abrir o documento agora\./);
});
