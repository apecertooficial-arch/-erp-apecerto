"use client";

/* MEU DIA — mantido como casca fina sobre a TelaCorretor.
 *
 * A tela foi reconstruída no desenho do protótipo e vive em TelaCorretor.tsx.
 * Este arquivo continua existindo porque HomeWorkspace e os testes importam
 * `MeuDiaCorretor` — trocar a montagem lá dentro mexeria na tela mais crítica
 * do app para não ganhar nada. A casca custa oito linhas e zero risco.
 *
 * As props são idênticas; quem monta não precisa saber de nada disso.
 */

import { TelaCorretor } from "./TelaCorretor";

export function MeuDiaCorretor(props: {
  accessToken: string;
  nome: string;
  onAbrirLead: (negocioId: number) => void;
  onIr: (destino: string) => void;
}) {
  return <TelaCorretor {...props} />;
}
