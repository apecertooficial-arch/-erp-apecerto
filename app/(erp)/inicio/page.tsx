"use client";

/* IN\u00cdCIO.
 *
 * No CELULAR a entrada do app \u00e9 o MEU DIA: a fila real do Funil 2.0 em ordem de
 * prazo, com a dire\u00e7\u00e3o da Sara e o bot\u00e3o de chamar no WhatsApp no pr\u00f3prio card.
 * \u00c9 o mesmo princ\u00edpio do ERP no computador, onde o corretor entra e j\u00e1 est\u00e1 em
 * cima do trabalho.
 *
 * O `InicioApp` (Funil2Mobile modo="inicio") existia e estava \u00f3rf\u00e3o: esta p\u00e1gina
 * montava o `HomeWorkspace` nas duas larguras, ent\u00e3o o corretor abria o app e
 * ca\u00eda num painel de indicadores, tendo que ir at\u00e9 o CRM para come\u00e7ar a
 * trabalhar. No computador o painel continua sendo a entrada.
 */

import { useRouter } from "next/navigation";
import { HomeWorkspace } from "../../features/home/HomeWorkspace";
import { InicioApp } from "../../features/home/InicioApp";
import { GuardaModulo } from "../../features/system/GuardaModulo";
import { useErpSession } from "../../features/system/ErpSession";
import { pathDoModulo } from "../../features/system/erp-routes";
import { isModuleName } from "../../features/system/module-map";
import { useEhCelular } from "../../features/system/useFormato";

export default function Pagina() {
  const { profile } = useErpSession();
  const ehCelular = useEhCelular();
  const router = useRouter();
  return (
    <GuardaModulo modulo="Início">
      {(t) => {
        /* null = ainda n\u00e3o sabemos a largura. Renderizar o painel e trocar pelo
           Meu Dia no frame seguinte faria a tela piscar duas interfaces. */
        if (ehCelular === null) return null;
        if (ehCelular) {
          return (
            <InicioApp
              accessToken={t}
              nome={profile?.name ?? "Corretor"}
              onIr={(destino) => router.push(destino)}
            />
          );
        }
        return (
          <HomeWorkspace
            accessToken={t}
            sessionName={profile?.name ?? ""}
            onNavigate={(nome) => { if (isModuleName(nome)) router.push(pathDoModulo(nome)); }}
            onIr={(destino) => router.push(destino)}
          />
        );
      }}
    </GuardaModulo>
  );
}
