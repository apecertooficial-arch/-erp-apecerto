import { redirect } from "next/navigation";

/* Atalhos antigos e telas de sessao expirada ja apontam para /login. A entrada
   real vive no provider do ERP; voltar por /inicio remonta esse provider, tenta
   renovar a sessao e, se ela terminou, exibe o formulario de login. */
export default function LoginPage() {
  redirect("/inicio");
}
