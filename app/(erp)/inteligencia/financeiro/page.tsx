"use client";

import { Financeiro } from "../../../features/inteligencia/Financeiro";
import { GuardaModulo } from "../../../features/system/GuardaModulo";

/* Financeiro da area usa a permissao do modulo Financeiro, nao a de Performance:
   e a unica tela da Inteligencia com dado de dinheiro da empresa. */
export default function Pagina() {
  return <GuardaModulo modulo="Financeiro">{(t) => <Financeiro accessToken={t} />}</GuardaModulo>;
}
