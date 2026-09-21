"use client";

import { CalendarWorkspace } from "../../features/calendar/CalendarWorkspace";
import { TelaAgendaMobile } from "../../features/calendar/TelaAgendaMobile";
import { GuardaModulo } from "../../features/system/GuardaModulo";
import { useErpSession } from "../../features/system/ErpSession";
import { useEhCelular } from "../../features/system/useFormato";
import { useSearchParams } from "next/navigation";

export default function Pagina() {
  /* null na primeira renderização: não dá para saber a largura antes de o
     navegador existir. Enquanto for null não renderizamos nenhuma das duas —
     chutar faria a tela trocar piscando na frente do corretor. */
  const ehCelular = useEhCelular();
  const { role } = useErpSession();
  const searchParams = useSearchParams();
  const corretorSolicitado = searchParams.get("corretor");
  const corretorIdInicial = corretorSolicitado && /^\d+$/.test(corretorSolicitado) ? corretorSolicitado : null;

  return (
    <GuardaModulo modulo="Calendário">
      {(t) => {
        if (ehCelular === null) return null;
        return ehCelular
          ? <TelaAgendaMobile accessToken={t} role={role} corretorIdInicial={corretorIdInicial} />
          : <CalendarWorkspace accessToken={t} corretorIdInicial={corretorIdInicial} />;
      }}
    </GuardaModulo>
  );
}
