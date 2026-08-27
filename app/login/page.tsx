"use client";

import { useEffect } from "react";

/* Atalhos antigos e telas de sessao expirada ja apontam para /login. A entrada
   real vive no provider do ERP; voltar por /inicio remonta esse provider, tenta
   renovar a sessao e, se ela terminou, exibe o formulario de login.

   O redirecionamento e relativo e feito no navegador porque o proxy do Render
   entrega a requisicao ao runtime via HTTP interno. Um redirect do servidor
   acabava expondo esse protocolo interno no Location antes de voltar ao HTTPS. */
export default function LoginPage() {
  useEffect(() => {
    window.location.replace("/inicio");
  }, []);

  return <div className="workspace-loading" aria-busy="true"><span /><strong>Abrindo a tela de entrada…</strong></div>;
}
