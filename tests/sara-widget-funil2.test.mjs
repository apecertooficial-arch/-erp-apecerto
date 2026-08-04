import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");

test("Sara global está montada no layout persistente do ERP", () => {
  const layout = ler("../app/(erp)/layout.tsx");
  assert.match(layout, /import \{ SaraWidget \}/);
  assert.match(layout, /<SaraWidget \/>/);
});

test("widget chama a Sara canônica e apresenta o Funil 2.0", () => {
  const widget = ler("../app/components/SaraWidget.tsx");
  assert.match(widget, /agente_slug: "sara"/);
  assert.match(widget, /copiloto do Funil 2\.0/);
  assert.match(widget, /O que preciso fazer hoje\?/);
});

test("treinamento oficial preserva envio manual e confirmação pelo D-API", () => {
  const migration = ler("../supabase/migrations/20260811000000_sara_manual_funil_2.sql");
  assert.match(migration, /WhatsApp do próprio celular/);
  assert.match(migration, /Só o outbound real confirmado pelo D-API/);
  assert.match(migration, /dias 1, 2, 4, 6 e 7/);
  assert.match(migration, /nunca envia mensagem/i);
});

test("CRM mobile oferece ativação de push sem depender da tela Início", () => {
  const mobile = ler("../app/features/crm-nova-era/TelaCrmMobile.tsx");
  assert.match(mobile, /import \{ AvisoNotificacoes \}/);
  assert.match(mobile, /<AvisoNotificacoes accessToken=\{accessToken\} \/>/);
});
