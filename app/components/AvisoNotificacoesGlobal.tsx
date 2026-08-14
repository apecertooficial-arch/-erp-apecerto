"use client";

import { AvisoNotificacoes } from "../features/home/AvisoNotificacoes";
import { useErpSession } from "../features/system/ErpSession";

/* A inscricao de push (pushManager.subscribe) vive dentro de AvisoNotificacoes.
   Enquanto ele era montado tela a tela, bastava o usuario estar numa tela que
   nao o incluia para NUNCA conseguir se inscrever -- foi o que aconteceu: nem o
   CRM Nova Era 3.0, nem o Funil 2.0, nem o Inicio do desktop o montavam, entao o
   navegador jamais pedia permissao e o iPhone nem aparecia nos Ajustes do iOS.

   Aqui ele entra no layout do ERP: presente em toda rota, independente de qual
   funil esta ativo. O proprio componente decide o que mostrar (convite, estado
   ligado, ou nada quando o aparelho nao suporta). */
export function AvisoNotificacoesGlobal() {
  const { accessToken } = useErpSession();
  if (!accessToken) return null;
  return <AvisoNotificacoes accessToken={accessToken} />;
}
