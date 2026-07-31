/* Revisão da Sara — Fase 1 do item 1.
 *
 * Cobre a validação do lote no servidor: o teto de 100 e a recusa de lista suja
 * não podem depender do navegador. O contrato de autorização no banco (RLS,
 * grant por coluna, "nada foi aplicado") é verificado por script SQL — ver a
 * seção 2 no fim deste arquivo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { LOTE_MAX, lerDecisao, normalizarLote } from "../../app/api/ncrm/sara/decidir/logica.ts";

/* ------------------------------ 1. lote puro ------------------------------ */

test("lerDecisao aceita só aprovada e rejeitada", () => {
  assert.equal(lerDecisao("aprovada"), "aprovada");
  assert.equal(lerDecisao("rejeitada"), "rejeitada");
  for (const ruim of ["aceita", "APROVADA", "", null, undefined, 1, {}, ["aprovada"]]) {
    assert.equal(lerDecisao(ruim), null, `deveria recusar ${JSON.stringify(ruim)}`);
  }
});

test("normalizarLote deduplica antes de conferir o teto", () => {
  assert.deepEqual(normalizarLote([3, 1, 3, 1]), [3, 1]);
  const repetido = Array.from({ length: 500 }, () => 7);
  assert.deepEqual(normalizarLote(repetido), [7], "500 repetições do mesmo id são 1 item");
});

test("normalizarLote recusa lista suja, vazia e acima do teto", () => {
  for (const ruim of [null, undefined, "1,2", {}, [], [0], [-1], [1.5], ["a"], [NaN], [1, null]]) {
    assert.equal(normalizarLote(ruim), null, `deveria recusar ${JSON.stringify(ruim)}`);
  }
  const noTeto = Array.from({ length: LOTE_MAX }, (_, i) => i + 1);
  assert.equal(normalizarLote(noTeto)?.length, LOTE_MAX);
  assert.equal(normalizarLote([...noTeto, LOTE_MAX + 1]), null, "acima do teto tem de ser recusado no servidor");
});

/* --------------------- 2. contrato do banco publicado ---------------------
 *
 * As garantias de RLS, grant por coluna e "nada foi aplicado" NÃO cabem num
 * teste de node: exigem catálogo do Postgres (pg_policies, column_privileges),
 * que o PostgREST não expõe. Ficam em:
 *
 *     supabase/verificacao/20260808_sara_fase1_verificacao.sql
 *
 * Rode esse script no SQL Editor logo depois de aplicar a migration. Ele falha
 * alto (RAISE EXCEPTION) em cada desvio, inclusive na versão insegura da
 * autorização. Inventar uma RPC de exec_sql só para o teste seria abrir no
 * banco um buraco maior do que qualquer coisa que ele fosse proteger.
 */
