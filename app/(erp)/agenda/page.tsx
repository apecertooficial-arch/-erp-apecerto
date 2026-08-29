"use client";

import { CalendarWorkspace } from "../../features/calendar/CalendarWorkspace";
import { TelaAgendaMobile } from "../../features/calendar/TelaAgendaMobile";
import { GuardaModulo } from "../../features/system/GuardaModulo";
import { useEhCelular } from "../../features/system/useFormato";

export default function Pagina() {
  /* null na primeira renderização: não dá para saber a largura antes de o
     navegador existir. Enquanto for null não renderizamos nenhuma das duas —
     chutar faria a tela trocar piscando na frente do corretor. */
  const ehCelular = useEhCelular();

  return (
    <GuardaModulo modulo="Calendário">
      {(t) => {
        if (ehCelular === null) return null;
        return ehCelular
          ? <TelaAgendaMobile accessToken={t} />
          : <CalendarWorkspace accessToken={t} />;
      }}
    </GuardaModulo>
  );
}
