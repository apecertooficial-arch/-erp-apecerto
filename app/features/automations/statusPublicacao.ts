/** Status de publicação de uma automação. Nulo/vazio = rascunho.
    Antes a tela tratava nulo como "publicado" e exibia como publicada uma
    automação que ninguém publicou (a coluna automacoes.status tem default
    'rascunho'). Em 16/09/2026 nenhuma linha tem status nulo. */
export function statusPublicacao(a: { status?: string | null }): string {
  return a.status || "rascunho";
}
