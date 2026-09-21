import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { eventoSaraVisivel, leituraSaraVisivel } from "../app/features/funil-2/modelo.ts";

const ler = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const rota = ler("../app/api/funil2/route.ts");
const modelo = ler("../app/features/funil-2/modelo.ts");
const desktop = ler("../app/features/funil-2/Funil2Workspace.tsx");
const mobile = ler("../app/features/funil-2/Funil2Mobile.tsx");
const harness = ler("./crm-visual-harness/main.tsx");

test("o navegador só registra ação manual pelo contrato auditável e nunca forja D-API", () => {
  assert.match(rota, /action === "confirmarAcao"[\s\S]*?body\.fonte !== "registro_operacional"/);
  assert.doesNotMatch(rota, /body\.fonte === "dapi" \? "dapi"/);
  assert.match(desktop, /Abrir WhatsApp|Enviar tentativa/);
  assert.doesNotMatch(desktop, />Confirmar ação<\/a>/);
});

test("resumos legados produzidos pela confirmação não são apresentados como nova análise", () => {
  assert.match(modelo, /RESUMOS_LEGADOS_SEM_ANALISE/);
  assert.match(modelo, /Nova leitura da Sara ainda não comprovada/);
  assert.match(modelo, /leituraSaraVisivel/);
  assert.match(desktop, /leituraSaraVisivel\(lead\)/);
  assert.match(mobile, /leituraSaraVisivel\(lead\)/);
  assert.doesNotMatch(mobile, /<b>Sara reavaliou<\/b><strong>\{lead\.ultima_reavaliacao_sara_em/);
  assert.deepEqual(leituraSaraVisivel({
    ultima_reavaliacao_sara_em: "2026-09-20T12:00:00Z",
    ultima_reavaliacao_resumo: "A ação foi confirmada; a Sara revisou o laboratório e manteve a conduta atual.",
  }), {
    comprovada: false,
    data: null,
    resumo: "Nova leitura da Sara ainda não comprovada. A ação foi registrada, mas a análise precisa aparecer na trilha auditável.",
  });
  assert.equal(leituraSaraVisivel({
    ultima_reavaliacao_sara_em: "2026-09-20T12:01:00Z",
    ultima_reavaliacao_resumo: "Cliente respondeu e pediu uma visita para sábado.",
  }).comprovada, true);
});

test("eventos legados da confirmação são rotulados como pendentes de comprovação", () => {
  assert.match(modelo, /eventoSaraVisivel/);
  assert.match(modelo, /Reavaliação pendente de comprovação/);
  assert.match(desktop, /eventoSaraVisivel\(eventoOriginal\)/);
  assert.match(mobile, /eventoSaraVisivel\(eventoOriginal\)/);
  const visivel = eventoSaraVisivel({
    id: 1,
    funil_lead_id: "00000000-0000-4000-8000-000000000000",
    tipo: "sara_reavaliou",
    titulo: "Sara reavaliou a cópia",
    detalhe: "A conduta foi mantida após a ação de demonstração.",
    payload: {},
    criado_em: "2026-09-20T12:00:00Z",
  });
  assert.equal(visivel.titulo, "Reavaliação pendente de comprovação");
  assert.match(visivel.detalhe, /não comprova uma nova análise/);
  assert.match(harness, /parametros\.get\("sara"\) === "pendente"/);
  assert.match(harness, /Sara reavaliou a cópia/);
});
