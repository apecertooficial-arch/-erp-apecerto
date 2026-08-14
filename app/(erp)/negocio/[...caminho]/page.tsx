"use client";
/* /negocio/N — o endereço canônico que o PUSH carrega.
 *
 * O banco valida todo deep_link de notificação contra uma allowlist
 * (ncrm_private.deep_link_valido) que não aceita query string — e o
 * endereço de negócio dela é `/negocio/N` (com `/conversa` opcional).
 * Esta rota nunca existiu no aplicativo: tocar no push caía numa tela
 * de erro, que é o pior fim possível para um aviso urgente.
 *
 * Em vez de alargar o validador de segurança (que existe para impedir
 * nome de cliente e link externo dentro de pacote de push), o aplicativo
 * aprende o endereço: redireciona para /crm?lead=N, que o Funil 2.0 resolve
 * diretamente em qualquer formato.
 *
 * `replace`, não `push`: esta página é um pedágio, e o botão voltar não
 * pode devolver o corretor para ela.
 */
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function NegocioRedirect() {
  const params = useParams<{ caminho?: string[] }>();
  const router = useRouter();

  useEffect(() => {
    const bruto = Array.isArray(params?.caminho) ? params.caminho[0] : params?.caminho;
    const n = Number(bruto);
    if (Number.isFinite(n) && n > 0) router.replace(`/crm?lead=${n}`);
    else router.replace("/notificacoes");
  }, [params, router]);

  /* Nada para desenhar: o redirect dispara na montagem. Um esqueleto aqui
     seria um quadro de tela que promete conteúdo que nunca vem. */
  return null;
}
