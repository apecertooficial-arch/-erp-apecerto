/* RPCs de proprietario de produto — tipagem de contorno.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * As quatro funcoes abaixo existem em producao desde 27/08/2026 (migracao
 * produtos_proprietarios_pos_deploy) mas NAO estao em database.types.ts, que e
 * gerado e nao foi regenerado desde entao. Resultado: 5 dos 207 erros de tsc
 * que a main acumulou.
 *
 * Editar database.types.ts a mao resolveria hoje e seria perdido na proxima
 * geracao. Entao a solucao correta e temporaria e esta: concentrar o cast num
 * unico lugar, com assinatura explicita e verificada contra o catalogo do
 * Postgres, e deixar o resto do codigo tipado normalmente.
 *
 * COMO REMOVER ESTE ARQUIVO
 *   supabase gen types typescript --linked > app/lib/supabase/database.types.ts
 * Depois disso, troque as chamadas por supabase.rpc("...") direto e apague daqui.
 *
 * Assinaturas conferidas em 14/09/2026 via pg_get_function_arguments:
 *   produto_proprietario_ler(p_empreendimento_id uuid)
 *     -> TABLE(id uuid, nome text, email text, telefone text)
 *   produto_proprietarios_meus()
 *     -> TABLE(id uuid, nome text, email text, telefone text)
 *   produto_proprietario_salvar(p_empreendimento_id uuid, p_nome text, p_email text, p_telefone text)
 *     -> uuid
 *   produto_proprietario_captacao_resolver(p_proprietario_id uuid, p_nome text, p_email text, p_telefone text)
 *     -> uuid
 */

type ClienteSupabase = { rpc: (nome: never, args?: never) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }> };

export type ProprietarioProduto = { id: string; nome: string | null; email: string | null; telefone: string | null };

// O cast fica preso a esta funcao: e o unico ponto do codigo que ignora o tipo gerado.
function chamar(cliente: ClienteSupabase, nome: string, args?: Record<string, unknown>) {
  return cliente.rpc(nome as never, args as never);
}

export async function lerProprietariosDoProduto(cliente: ClienteSupabase, empreendimentoId: string) {
  const { data, error } = await chamar(cliente, "produto_proprietario_ler", { p_empreendimento_id: empreendimentoId });
  return { data: (data ?? null) as ProprietarioProduto[] | null, error };
}

export async function lerMeusProprietarios(cliente: ClienteSupabase) {
  const { data, error } = await chamar(cliente, "produto_proprietarios_meus");
  return { data: (data ?? null) as ProprietarioProduto[] | null, error };
}

export async function salvarProprietarioDoProduto(
  cliente: ClienteSupabase,
  entrada: { empreendimentoId: string; nome: string; email: string; telefone: string },
) {
  const { data, error } = await chamar(cliente, "produto_proprietario_salvar", {
    p_empreendimento_id: entrada.empreendimentoId,
    p_nome: entrada.nome,
    p_email: entrada.email,
    p_telefone: entrada.telefone,
  });
  return { data: (data ?? null) as string | null, error };
}

export async function resolverProprietarioDaCaptacao(
  cliente: ClienteSupabase,
  entrada: { proprietarioId: string | null; nome: string; email: string; telefone: string },
) {
  const { data, error } = await chamar(cliente, "produto_proprietario_captacao_resolver", {
    p_proprietario_id: entrada.proprietarioId,
    p_nome: entrada.nome,
    p_email: entrada.email,
    p_telefone: entrada.telefone,
  });
  return { data: (data ?? null) as string | null, error };
}
