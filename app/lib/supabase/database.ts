/* Tipo Database usado pelos clientes Supabase (server.ts, browser.ts).
 *
 * database.types.ts e gerado e nao deve ser editado a mao. Ele esta atrasado em
 * relacao ao banco: as quatro RPCs de proprietario abaixo existem em producao
 * (supabase/migrations/20260826193000_produtos_editorial_midias_rascunhos.sql e
 * produtos_proprietarios_pos_deploy) mas nao aparecem no arquivo gerado.
 *
 * Em vez de cast (`as never`) em cada chamada, as assinaturas entram aqui, tipadas,
 * copiadas de generate_typescript_types rodado em 16/09/2026 contra o projeto
 * diaegvfveqezispcthwk, com um unico ajuste: p_proprietario_id aceita null, porque
 * a funcao trata `p_proprietario_id is null` criando um proprietario novo (o
 * gerador nao expressa nulidade de argumento sem default).
 *
 * COMO REMOVER: ao regenerar database.types.ts (supabase gen types typescript),
 * apague as entradas abaixo que passarem a existir no arquivo gerado e rode
 * `pnpm exec tsc --noEmit --incremental false`. Mantenha o ajuste de
 * p_proprietario_id enquanto o gerador tipar o argumento como `string`.
 */
import type { Database as DatabaseGerado, Json } from "./database.types";

type Publico = DatabaseGerado["public"];

type ProprietarioLido = {
  email: string
  id: string
  nome: string
  telefone: string
};

type FuncoesDeProprietario = {
  produto_proprietario_ler: {
    Args: { p_empreendimento_id: string }
    Returns: ProprietarioLido[]
  }
  produto_proprietarios_meus: {
    Args: never
    Returns: ProprietarioLido[]
  }
  produto_proprietario_salvar: {
    Args: {
      p_email: string
      p_empreendimento_id: string
      p_nome: string
      p_telefone: string
    }
    Returns: string
  }
  produto_proprietario_captacao_resolver: {
    Args: {
      p_email: string
      p_nome: string
      p_proprietario_id: string | null
      p_telefone: string
    }
    Returns: string
  }
};

type FuncoesDeCaptacao = {
  produto_captacao_criar_atomica: {
    Args: { p_payload: Json }
    Returns: Json
  }
  produto_captacao_finalizar_atomica: {
    Args: { p_empreendimento_id: string }
    Returns: Json
  }
  produto_decidir_captacao: {
    Args: {
      p_empreendimento_id: string
      p_unidade_id: string
      p_aprovar: boolean
      p_motivo?: string | null
    }
    Returns: Json
  }
};

export type Database = Omit<DatabaseGerado, "public"> & {
  public: Omit<Publico, "Functions"> & {
    Functions: Publico["Functions"] & FuncoesDeProprietario & FuncoesDeCaptacao
  }
};
