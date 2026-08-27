import type { ReactNode } from "react";
import { ErpRuntime } from "../features/system/ErpRuntime";
import { ErpSessionProvider } from "../features/system/ErpSession";
import { ErpShell } from "../features/system/ErpShell";
import { SaraWidget } from "../components/SaraWidget";
import { AvisoNotificacoesGlobal } from "../components/AvisoNotificacoesGlobal";
import { AvisoNaTela } from "../components/AvisoNaTela";
import { PresencaGlobal } from "../components/PresencaGlobal";
import { ConviteInstalar } from "../components/ConviteInstalar";
import { CentralActivityHeartbeat } from "../features/inteligencia/CentralActivityHeartbeat";

/* Layout do grupo (erp). Persiste entre rotas irmas -- por isso a sessao
   carrega uma vez, e nao a cada troca de modulo. O "(erp)" nao aparece na URL. */
export default function ErpLayout({ children }: { children: ReactNode }) {
  return (
    <ErpRuntime localContent={children}>
      <ErpSessionProvider>
        <ErpShell>{children}</ErpShell>
        <AvisoNotificacoesGlobal />
        <AvisoNaTela />
        <PresencaGlobal />
        <CentralActivityHeartbeat />
        <SaraWidget />
        <ConviteInstalar />
      </ErpSessionProvider>
    </ErpRuntime>
  );
}
