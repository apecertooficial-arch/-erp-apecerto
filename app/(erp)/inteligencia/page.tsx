"use client";

import { VisaoEmpresa } from "../../features/inteligencia/VisaoEmpresa";
import { GuardaModulo } from "../../features/system/GuardaModulo";

/* /inteligencia — primeira tela real da área.
 *
 * Reaproveita a permissão do módulo Performance de propósito: quem já pode ler
 * performance da empresa é exatamente quem deve ler esta tela, e a área vai
 * SUBSTITUIR o item Performance no menu (a proposta de transição aprovada, 23a e
 * 23b). Criar um slug novo agora abriria uma permissão que ninguém configurou.
 *
 * Ainda não há item de menu apontando para cá: a rota é alcançável por URL, e a
 * troca do menu + o redirect de /performance vêm no commit da Fase 1B. Assim esta
 * tela pode ser conferida com dado real sem mexer na navegação de ninguém.
 */
export default function Pagina() {
  return <GuardaModulo modulo="Performance">{(t) => <VisaoEmpresa accessToken={t} />}</GuardaModulo>;
}
