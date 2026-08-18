"use client";

/* Registro das telas publicadas da Inteligência — as 17 no ar.
 *
 * A casca lê daqui. Tela ausente do registro não vira página em branco: a casca
 * mostra o cabeçalho real dela e o BlocoSemDado com a referência do artboard.
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
import { ImoveisProcura } from "./telas/ImoveisProcura";
import { CaptacaoProprietarios } from "./telas/CaptacaoProprietarios";
import { Sara } from "./telas/Sara";
import { CentralAlertas } from "./telas/CentralAlertas";
import { PrivacidadeTracking } from "./telas/PrivacidadeTracking";

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
  imoveis: (p) => <ImoveisProcura {...p} />,
  proprietarios: (p) => <CaptacaoProprietarios {...p} />,
  sara: (p) => <Sara {...p} />,
  alertas: (p) => <CentralAlertas {...p} />,
  privacidade: (p) => <PrivacidadeTracking {...p} />,
};
