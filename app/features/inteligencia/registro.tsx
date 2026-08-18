"use client";

/* Registro das telas publicadas da Inteligência.
 *
 * A casca lê daqui. Cada lote de publicação acrescenta uma linha neste arquivo e
 * mais nada. Tela ausente do registro não vira página em branco: a casca mostra
 * o cabeçalho real dela e o BlocoSemDado com a referência do artboard.
 */

import type { ReactNode } from "react";
import type { PropsTela } from "./CascaInteligencia";
import { VisaoEmpresa } from "./telas/VisaoEmpresa";
import { VendasPrevisao } from "./telas/VendasPrevisao";
import { FinanceiroComissoes } from "./telas/FinanceiroComissoes";
import { AtendimentoSla } from "./telas/AtendimentoSla";
import { PerformanceEquipe } from "./telas/PerformanceEquipe";
import { Gerentes } from "./telas/Gerentes";
import { Corretores } from "./telas/Corretores";
import { QualidadeDesenvolvimento } from "./telas/QualidadeDesenvolvimento";
import { ConversaoCrm } from "./telas/ConversaoCrm";
import { VisaoDigital } from "./telas/VisaoDigital";
import { AquisicaoCampanhas } from "./telas/AquisicaoCampanhas";
import { ComportamentoConteudo } from "./telas/ComportamentoConteudo";

export const telasPublicadas: Record<string, (props: PropsTela) => ReactNode> = {
  empresa: (p) => <VisaoEmpresa {...p} />,
  vendas: (p) => <VendasPrevisao {...p} />,
  financeiro: (p) => <FinanceiroComissoes {...p} />,
  atendimento: (p) => <AtendimentoSla {...p} />,
  equipe: (p) => <PerformanceEquipe {...p} />,
  gerentes: (p) => <Gerentes {...p} />,
  corretores: (p) => <Corretores {...p} />,
  qualidade: (p) => <QualidadeDesenvolvimento {...p} />,
  conversao: (p) => <ConversaoCrm {...p} />,
  digital: (p) => <VisaoDigital {...p} />,
  aquisicao: (p) => <AquisicaoCampanhas {...p} />,
  comportamento: (p) => <ComportamentoConteudo {...p} />,
};
