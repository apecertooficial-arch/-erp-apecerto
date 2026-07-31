import type { ReactNode } from "react";
import { ErpSessionProvider } from "../features/system/ErpSession";
import { ErpShell } from "../features/system/ErpShell";

/* Layout do grupo (erp). Persiste entre rotas irmas -- por isso a sessao
   carrega uma vez, e nao a cada troca de modulo. O "(erp)" nao aparece na URL. */
export default function ErpLayout({ children }: { children: ReactNode }) {
  return (
    <ErpSessionProvider>
      <ErpShell>{children}</ErpShell>
    </ErpSessionProvider>
  );
}
