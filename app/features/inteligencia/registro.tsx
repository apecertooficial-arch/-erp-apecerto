"use client";

/* Registro das telas publicadas da Inteligência.
 *
 * A casca lê daqui. Cada lote de publicação acrescenta uma linha neste arquivo
 * e mais nada — a casca não muda de novo. Tela ausente do registro não vira
 * página em branco: a casca mostra o cabeçalho real dela e o BlocoSemDado com a
 * referência do artboard.
 */

import type { ReactNode } from "react";
import type { PropsTela } from "./CascaInteligencia";
import { VisaoEmpresa } from "./telas/VisaoEmpresa";

export const telasPublicadas: Record<string, (props: PropsTela) => ReactNode> = {
  empresa: (p) => <VisaoEmpresa {...p} />,
};
