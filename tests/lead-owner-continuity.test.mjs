import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ownerMigration = await readFile(
  "supabase/migrations/20260901015921_blindagem_dono_visita_legado.sql",
  "utf8",
);
const auditMigration = await readFile(
  "supabase/migrations/20260918174605_fix_f2_config_audit_tipo_carteira_antiga.sql",
  "utf8",
);

const md5 = (value) => createHash("md5").update(value).digest("hex");

test("repositório preserva exatamente a blindagem de dono já aplicada na produção", () => {
  assert.equal(md5(ownerMigration), "db23a94c6477a2db717eb090a619c1e9");
  assert.equal(md5(auditMigration.trimEnd()), "21eba3ebd9a09e5b1e40e7a243b73263");
});

test("identidade cruza IDs, telefone e e-mail, mas nunca nome", () => {
  const identity = ownerMigration.match(/identidade as materialized \([\s\S]*?\), negocios_identidade/)?.[0] ?? "";
  assert.match(identity, /datacrazy_lead_id/);
  assert.match(identity, /wa_contato_id/);
  assert.match(identity, /email_chave/);
  assert.match(identity, /telefone_chave/);
  assert.doesNotMatch(identity, /l\.nome\s*=/);
});

test("visita e negociação preservam o dono e conflito falha fechado", () => {
  for (const source of ["public.visitas", "public.f2_visita", "public.f2_lead", "public.pipeline_stages", "public.f2_negociacao"]) {
    assert.match(ownerMigration, new RegExp(source.replace(".", "\\.")));
  }
  assert.match(ownerMigration, /'VISITA_AGENDADA','REMARCAR_VISITA'/);
  assert.match(ownerMigration, /'VISITA_REALIZADA','COLETAR_FEEDBACK','ACOMPANHAMENTO_POS_VISITA'/);
  assert.match(ownerMigration, /'\(negocia\|proposta\|contrato\)'/);
  assert.match(ownerMigration, /'f2_negociacao','negociação ativa no Funil 2\.0'/);
  assert.match(ownerMigration, /'protegido',false,'conflito',true/);
  assert.match(ownerMigration, /Distribuir BLOQUEADO: evidencias protegidas apontam donos diferentes/);
});

test("roleta alinha lead, negócio e card e registra a troca auditável", () => {
  assert.match(ownerMigration, /update public\.leads set corretor_id=v_dono_id/);
  assert.match(ownerMigration, /update public\.negocios set corretor_id=v_dono_id/);
  assert.match(ownerMigration, /motor_sincronizar_dono_f2/);
  assert.match(ownerMigration, /insert into public\.lead_dono_auditoria/);
  assert.match(ownerMigration, /grant execute on function public\.motor_resolver_dono_protegido[\s\S]*to service_role/);
  assert.doesNotMatch(ownerMigration, /to authenticated/);
});

test("auditoria aceita a origem carteira antiga observada em produção", () => {
  assert.match(auditMigration, /'carteira_antiga'/);
});
