"use client";

/* Descobre se estamos no formato de celular.
 *
 * Por que NAO e CSS: o Inicio do desktop busca indicadores gerenciais que o
 * celular não usa. Esconder isso com media query faria o aparelho baixar dados
 * e depois jogá-los fora. Aqui a decisão acontece antes do fetch.
 *
 * Por que useSyncExternalStore e nao useState+useEffect: matchMedia e um
 * sistema externo com assinatura. Ler o valor inicial dentro de um efeito
 * dispara render em cascata (react-hooks/set-state-in-effect); esta API existe
 * exatamente para este caso.
 *
 * No servidor nao existe largura, entao o retorno e null. Quem consome trata
 * null como "ainda nao sei" e mostra esqueleto -- chutar um formato faria a
 * tela piscar do layout errado para o certo na frente da pessoa.
 *
 * O prefixo "use" nao e estilo: a regra react-hooks/rules-of-hooks e mecanica.
 */

import { useSyncExternalStore } from "react";

export const LARGURA_CELULAR = 900;

const consulta = () => window.matchMedia(`(max-width: ${LARGURA_CELULAR}px)`);

function inscrever(aoMudar: () => void) {
  const mq = consulta();
  mq.addEventListener("change", aoMudar);
  return () => mq.removeEventListener("change", aoMudar);
}

/* Booleano puro de proposito: useSyncExternalStore compara por Object.is, e
   devolver objeto novo a cada leitura entraria em laco infinito. */
const lerNoNavegador = (): boolean => consulta().matches;
const lerNoServidor = (): boolean | null => null;

export function useEhCelular(): boolean | null {
  return useSyncExternalStore(inscrever, lerNoNavegador, lerNoServidor);
}
