"use client";

/* Encerrar a sessao — IMPLEMENTACAO UNICA.
 *
 * Existe porque o logout passou a ter dois pontos de entrada: o rodape do
 * ProfilePanel (avatar do cabecalho / sidebar do desktop) e o item "Sair" da
 * folha "Mais" no celular. Duas copias da mesma rotina e como o aparelho
 * compartilhado da imobiliaria vaza sessao: basta uma delas esquecer um passo.
 *
 * ORDEM IMPORTA. Encerra a sessao PRIMEIRO — senao o refresh automatico do
 * supabase-js pode regravar o token que acabamos de apagar — e so depois
 * limpa cache, localStorage e sessionStorage do aparelho.
 *
 * `limparDadosLocais` apaga por PREFIXO nosso (apecerto-, apecerto_, ncrm_,
 * ncrm:, sb-), nunca `localStorage.clear()`: chave de terceiro no mesmo
 * dominio nao e nossa para apagar.
 */

import { limparDadosLocais } from "../components/RegistroPwa";
import { getBrowserSupabaseClient } from "./supabase/browser";

export async function sairDaConta(): Promise<void> {
  try {
    await getBrowserSupabaseClient().auth.signOut();
  } finally {
    await limparDadosLocais();
    /* Recarrega em rota limpa: derruba qualquer estado em memoria do ERP.
       `replace` e nao `assign` para o botao voltar nao trazer a tela logada
       de volta do bfcache. */
    window.location.replace("/");
  }
}
