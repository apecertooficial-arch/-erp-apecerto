import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const painel = readFileSync(join(ROOT, "app/features/crm-nova-era/components/PainelPiloto.tsx"), "utf8");
const workspace = readFileSync(join(ROOT, "app/features/crm-nova-era/CrmNovaEraLiveWorkspace.tsx"), "utf8");

// conta ocorrências de uma chamada de ativação do ingest (POST action: "ativar")
function contarAtivacoes(src) {
  return (src.match(/action:\s*["']ativar["']/g) || []).length;
}

test("P0-A: existe UM único caminho de ativação (ModalAtivacao no PainelPiloto)", () => {
  // O único lugar que dispara a ativação é o PainelPiloto (ModalAtivacao).
  assert.equal(contarAtivacoes(painel), 1, "esperava exatamente 1 chamada de ativação no PainelPiloto");
  // O workspace/toolbar (onde vive o IngestAdminControl) NÃO pode ativar.
  assert.equal(contarAtivacoes(workspace), 0, "IngestAdminControl/toolbar não pode conter chamada de ativação");
});

test("P0-A: a ativação exige confirmação DIGITADA exatamente 'ATIVAR'", () => {
  // O gate de confirmação compara o texto digitado com 'ATIVAR'.
  assert.match(painel, /toUpperCase\(\)\s*===\s*["']ATIVAR["']/);
  // O botão de confirmar ativação está desabilitado enquanto não confirmado.
  assert.match(painel, /disabled=\{!confirmado/);
});

test("P0-A: IngestAdminControl mantém DESATIVAR emergencial e status só-leitura", () => {
  // desativação continua disponível (kill-switch)
  assert.match(workspace, /action:\s*["']desativar["']/);
  assert.match(workspace, /Desativar ingest/);
  // e explicitamente NÃO oferece ativar
  assert.doesNotMatch(workspace, /Ativar a partir de agora/);
});
