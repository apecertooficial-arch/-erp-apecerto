import assert from "node:assert/strict";
import test from "node:test";
import { interpretarProfileData } from "../app/components/profile-data.ts";

const valido = {
  usuario: { id: "usuario-1", role: "corretor", ativo: true },
  corretor: { id: 7, ativo: true, online: false, notif_leads: true, notif_mensagens: true, notif_som: true },
  instancias: [{ id: 3, conectada: true, ativa: true }],
  dados_bancarios: null,
};

test("perfil rejeita payload incompleto antes de confirmar leitura ou escrita", () => {
  assert.equal(interpretarProfileData(null), null);
  assert.equal(interpretarProfileData({}), null);
  assert.equal(interpretarProfileData({ ...valido, instancias: "indisponivel" }), null);
  assert.equal(interpretarProfileData({ ...valido, usuario: { id: 9 } }), null);
  assert.ok(interpretarProfileData(valido));
});
