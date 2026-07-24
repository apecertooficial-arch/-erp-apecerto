export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      _perf_baseline: {
        Row: {
          calls: number | null
          consulta: string | null
          ms_media: number | null
          ms_total: number | null
          rotulo: string | null
          snap_em: string | null
        }
        Insert: {
          calls?: number | null
          consulta?: string | null
          ms_media?: number | null
          ms_total?: number | null
          rotulo?: string | null
          snap_em?: string | null
        }
        Update: {
          calls?: number | null
          consulta?: string | null
          ms_media?: number | null
          ms_total?: number | null
          rotulo?: string | null
          snap_em?: string | null
        }
        Relationships: []
      }
      _view_backup: {
        Row: {
          def: string | null
          nome: string | null
          salvo_em: string | null
        }
        Insert: {
          def?: string | null
          nome?: string | null
          salvo_em?: string | null
        }
        Update: {
          def?: string | null
          nome?: string | null
          salvo_em?: string | null
        }
        Relationships: []
      }
      abordagens: {
        Row: {
          ativo: boolean
          criado_em: string
          empreendimento_id: string | null
          grupo: string | null
          id: number
          mensagens: Json
          nome: string
          ordem: number
          produto_id: number | null
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          empreendimento_id?: string | null
          grupo?: string | null
          id?: never
          mensagens?: Json
          nome: string
          ordem?: number
          produto_id?: number | null
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          empreendimento_id?: string | null
          grupo?: string | null
          id?: never
          mensagens?: Json
          nome?: string
          ordem?: number
          produto_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "abordagens_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abordagens_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abordagens_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_empreendimento_resumo"
            referencedColumns: ["empreendimento_id"]
          },
          {
            foreignKeyName: "abordagens_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_produtos_publicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abordagens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      acesso_convites: {
        Row: {
          corretor_id: number | null
          criado_em: string
          expira_em: string
          id: string
          token: string
          usado_em: string | null
          usuario_id: string
        }
        Insert: {
          corretor_id?: number | null
          criado_em?: string
          expira_em: string
          id?: string
          token: string
          usado_em?: string | null
          usuario_id: string
        }
        Update: {
          corretor_id?: number | null
          criado_em?: string
          expira_em?: string
          id?: string
          token?: string
          usado_em?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acesso_convites_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acesso_convites_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "acesso_convites_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
        ]
      }
      administradores: {
        Row: {
          id: number
          nome: string
        }
        Insert: {
          id?: number
          nome: string
        }
        Update: {
          id?: number
          nome?: string
        }
        Relationships: []
      }
      agenda_share: {
        Row: {
          atualizado_em: string
          id: number
          token: string
        }
        Insert: {
          atualizado_em?: string
          id?: number
          token: string
        }
        Update: {
          atualizado_em?: string
          id?: number
          token?: string
        }
        Relationships: []
      }
      agente_auditoria: {
        Row: {
          acao: string
          agente_id: number | null
          ator: string | null
          criado_em: string
          detalhe: Json | null
          id: number
        }
        Insert: {
          acao: string
          agente_id?: number | null
          ator?: string | null
          criado_em?: string
          detalhe?: Json | null
          id?: never
        }
        Update: {
          acao?: string
          agente_id?: number | null
          ator?: string | null
          criado_em?: string
          detalhe?: Json | null
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "agente_auditoria_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_ia"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_avaliacoes: {
        Row: {
          agente_id: number | null
          agente_versao: number | null
          aprovado: boolean | null
          avaliador_humano: string | null
          cenario_id: number | null
          comentario: string | null
          criado_em: string
          execucao_id: number | null
          id: number
          nota_auto: number | null
          nota_humana: number | null
          regras_descumpridas: string[] | null
        }
        Insert: {
          agente_id?: number | null
          agente_versao?: number | null
          aprovado?: boolean | null
          avaliador_humano?: string | null
          cenario_id?: number | null
          comentario?: string | null
          criado_em?: string
          execucao_id?: number | null
          id?: never
          nota_auto?: number | null
          nota_humana?: number | null
          regras_descumpridas?: string[] | null
        }
        Update: {
          agente_id?: number | null
          agente_versao?: number | null
          aprovado?: boolean | null
          avaliador_humano?: string | null
          cenario_id?: number | null
          comentario?: string | null
          criado_em?: string
          execucao_id?: number | null
          id?: never
          nota_auto?: number | null
          nota_humana?: number | null
          regras_descumpridas?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "agente_avaliacoes_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_ia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agente_avaliacoes_cenario_id_fkey"
            columns: ["cenario_id"]
            isOneToOne: false
            referencedRelation: "agente_cenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_cenarios: {
        Row: {
          agente_id: number | null
          categoria: string
          contexto: Json | null
          criado_em: string
          criterio_aprovacao: string | null
          ferramentas_esperadas: string[] | null
          fontes_esperadas: string[] | null
          id: number
          pergunta: string
          peso: number
          resposta_esperada: string | null
          respostas_proibidas: string[] | null
        }
        Insert: {
          agente_id?: number | null
          categoria?: string
          contexto?: Json | null
          criado_em?: string
          criterio_aprovacao?: string | null
          ferramentas_esperadas?: string[] | null
          fontes_esperadas?: string[] | null
          id?: never
          pergunta: string
          peso?: number
          resposta_esperada?: string | null
          respostas_proibidas?: string[] | null
        }
        Update: {
          agente_id?: number | null
          categoria?: string
          contexto?: Json | null
          criado_em?: string
          criterio_aprovacao?: string | null
          ferramentas_esperadas?: string[] | null
          fontes_esperadas?: string[] | null
          id?: never
          pergunta?: string
          peso?: number
          resposta_esperada?: string | null
          respostas_proibidas?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "agente_cenarios_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_ia"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_execucoes: {
        Row: {
          agente_id: number | null
          agente_slug: string | null
          agente_versao: number | null
          avaliacao_humana: string | null
          conversa_id: string | null
          criado_em: string
          custo_usd: number | null
          entrada: Json | null
          erro: string | null
          ferramentas_acionadas: Json | null
          fontes_consultadas: Json | null
          id: number
          latencia_ms: number | null
          lead_id: number | null
          modelo: string | null
          nota_auto: number | null
          regras_descumpridas: string[] | null
          saida: Json | null
          status: string
          tela: string | null
          tokens_entrada: number | null
          tokens_saida: number | null
          usuario: string | null
        }
        Insert: {
          agente_id?: number | null
          agente_slug?: string | null
          agente_versao?: number | null
          avaliacao_humana?: string | null
          conversa_id?: string | null
          criado_em?: string
          custo_usd?: number | null
          entrada?: Json | null
          erro?: string | null
          ferramentas_acionadas?: Json | null
          fontes_consultadas?: Json | null
          id?: never
          latencia_ms?: number | null
          lead_id?: number | null
          modelo?: string | null
          nota_auto?: number | null
          regras_descumpridas?: string[] | null
          saida?: Json | null
          status?: string
          tela?: string | null
          tokens_entrada?: number | null
          tokens_saida?: number | null
          usuario?: string | null
        }
        Update: {
          agente_id?: number | null
          agente_slug?: string | null
          agente_versao?: number | null
          avaliacao_humana?: string | null
          conversa_id?: string | null
          criado_em?: string
          custo_usd?: number | null
          entrada?: Json | null
          erro?: string | null
          ferramentas_acionadas?: Json | null
          fontes_consultadas?: Json | null
          id?: never
          latencia_ms?: number | null
          lead_id?: number | null
          modelo?: string | null
          nota_auto?: number | null
          regras_descumpridas?: string[] | null
          saida?: Json | null
          status?: string
          tela?: string | null
          tokens_entrada?: number | null
          tokens_saida?: number | null
          usuario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agente_execucoes_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_ia"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_ferramenta_permissoes: {
        Row: {
          agente_id: number
          ferramenta_id: number
          habilitado: boolean
          perfis_autorizados: string[]
        }
        Insert: {
          agente_id: number
          ferramenta_id: number
          habilitado?: boolean
          perfis_autorizados?: string[]
        }
        Update: {
          agente_id?: number
          ferramenta_id?: number
          habilitado?: boolean
          perfis_autorizados?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "agente_ferramenta_permissoes_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_ia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agente_ferramenta_permissoes_ferramenta_id_fkey"
            columns: ["ferramenta_id"]
            isOneToOne: false
            referencedRelation: "agente_ferramentas"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_ferramentas: {
        Row: {
          ativo: boolean
          descricao: string | null
          funcao_backend: string | null
          id: number
          nome: string
          requer_confirmacao: boolean
          slug: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          descricao?: string | null
          funcao_backend?: string | null
          id?: never
          nome: string
          requer_confirmacao?: boolean
          slug: string
          tipo?: string
        }
        Update: {
          ativo?: boolean
          descricao?: string | null
          funcao_backend?: string | null
          id?: never
          nome?: string
          requer_confirmacao?: boolean
          slug?: string
          tipo?: string
        }
        Relationships: []
      }
      agente_fonte_links: {
        Row: {
          agente_id: number
          fonte_id: number
        }
        Insert: {
          agente_id: number
          fonte_id: number
        }
        Update: {
          agente_id?: number
          fonte_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "agente_fonte_links_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_ia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agente_fonte_links_fonte_id_fkey"
            columns: ["fonte_id"]
            isOneToOne: false
            referencedRelation: "agente_fontes"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_fontes: {
        Row: {
          atualizado_em: string
          conteudo: string | null
          criado_em: string
          id: number
          responsavel: string | null
          situacao: string
          storage_path: string | null
          tipo: string
          titulo: string
          validade: string | null
          versao: string | null
        }
        Insert: {
          atualizado_em?: string
          conteudo?: string | null
          criado_em?: string
          id?: never
          responsavel?: string | null
          situacao?: string
          storage_path?: string | null
          tipo?: string
          titulo: string
          validade?: string | null
          versao?: string | null
        }
        Update: {
          atualizado_em?: string
          conteudo?: string | null
          criado_em?: string
          id?: never
          responsavel?: string | null
          situacao?: string
          storage_path?: string | null
          tipo?: string
          titulo?: string
          validade?: string | null
          versao?: string | null
        }
        Relationships: []
      }
      agente_versoes: {
        Row: {
          agente_id: number | null
          aprovador: string | null
          autor: string | null
          criado_em: string
          id: number
          notas: string | null
          publicado_em: string | null
          snapshot: Json
          status: string
          versao: number
        }
        Insert: {
          agente_id?: number | null
          aprovador?: string | null
          autor?: string | null
          criado_em?: string
          id?: never
          notas?: string | null
          publicado_em?: string | null
          snapshot: Json
          status?: string
          versao: number
        }
        Update: {
          agente_id?: number | null
          aprovador?: string | null
          autor?: string | null
          criado_em?: string
          id?: never
          notas?: string | null
          publicado_em?: string | null
          snapshot?: Json
          status?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "agente_versoes_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_ia"
            referencedColumns: ["id"]
          },
        ]
      }
      agentes_ia: {
        Row: {
          ativo: boolean
          atualizado_em: string
          canais: string | null
          categoria: string | null
          config: Json
          criado_em: string
          gatilhos: string | null
          id: number
          indicadores: string | null
          instrucao: Json
          missao: string | null
          modelo: string
          nome: string
          publico: string | null
          slug: string
          status: string
          system_prompt: string | null
          tipo: string
          versao_atual: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          canais?: string | null
          categoria?: string | null
          config?: Json
          criado_em?: string
          gatilhos?: string | null
          id?: never
          indicadores?: string | null
          instrucao?: Json
          missao?: string | null
          modelo?: string
          nome: string
          publico?: string | null
          slug: string
          status?: string
          system_prompt?: string | null
          tipo?: string
          versao_atual?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          canais?: string | null
          categoria?: string | null
          config?: Json
          criado_em?: string
          gatilhos?: string | null
          id?: never
          indicadores?: string | null
          instrucao?: Json
          missao?: string | null
          modelo?: string
          nome?: string
          publico?: string | null
          slug?: string
          status?: string
          system_prompt?: string | null
          tipo?: string
          versao_atual?: number
        }
        Relationships: []
      }
      app_secrets: {
        Row: {
          atualizado_em: string
          chave: string
          valor: string
        }
        Insert: {
          atualizado_em?: string
          chave: string
          valor: string
        }
        Update: {
          atualizado_em?: string
          chave?: string
          valor?: string
        }
        Relationships: []
      }
      atendimento_acoes: {
        Row: {
          canal: string | null
          corretor_id: number | null
          criado_em: string | null
          criado_por: string | null
          id: number
          lead_id: number | null
          negocio_id: number | null
          resultado: string | null
          texto: string | null
          tipo: string
        }
        Insert: {
          canal?: string | null
          corretor_id?: number | null
          criado_em?: string | null
          criado_por?: string | null
          id?: never
          lead_id?: number | null
          negocio_id?: number | null
          resultado?: string | null
          texto?: string | null
          tipo: string
        }
        Update: {
          canal?: string | null
          corretor_id?: number | null
          criado_em?: string | null
          criado_por?: string | null
          id?: never
          lead_id?: number | null
          negocio_id?: number | null
          resultado?: string | null
          texto?: string | null
          tipo?: string
        }
        Relationships: []
      }
      automacao_execucoes: {
        Row: {
          corretor_id: number | null
          criado_em: string
          detalhe: string | null
          id: number
          lead_id: number | null
          status: string | null
        }
        Insert: {
          corretor_id?: number | null
          criado_em?: string
          detalhe?: string | null
          id?: never
          lead_id?: number | null
          status?: string | null
        }
        Update: {
          corretor_id?: number | null
          criado_em?: string
          detalhe?: string | null
          id?: never
          lead_id?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automacao_execucoes_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automacao_execucoes_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "automacao_execucoes_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "automacao_execucoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automacao_execucoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_erros_envio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "automacao_execucoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      automacao_versoes: {
        Row: {
          automacao_id: number
          criado_em: string | null
          criado_por: string | null
          id: number
          mapa: Json
          nome: string | null
          observacao: string | null
          versao: number
        }
        Insert: {
          automacao_id: number
          criado_em?: string | null
          criado_por?: string | null
          id?: never
          mapa: Json
          nome?: string | null
          observacao?: string | null
          versao: number
        }
        Update: {
          automacao_id?: number
          criado_em?: string | null
          criado_por?: string | null
          id?: never
          mapa?: Json
          nome?: string | null
          observacao?: string | null
          versao?: number
        }
        Relationships: []
      }
      automacoes: {
        Row: {
          arquivada: boolean | null
          ativa: boolean
          atualizada_em: string
          criada_em: string
          grupo: string | null
          id: number
          mapa: Json
          nome: string
          publicado_em: string | null
          status: string | null
          ultima_entrada: Json | null
          ultima_entrada_em: string | null
          webhook_token: string | null
          webhook_token_enforced: boolean
          webhook_token_updated_at: string | null
        }
        Insert: {
          arquivada?: boolean | null
          ativa?: boolean
          atualizada_em?: string
          criada_em?: string
          grupo?: string | null
          id?: never
          mapa?: Json
          nome?: string
          publicado_em?: string | null
          status?: string | null
          ultima_entrada?: Json | null
          ultima_entrada_em?: string | null
          webhook_token?: string | null
          webhook_token_enforced?: boolean
          webhook_token_updated_at?: string | null
        }
        Update: {
          arquivada?: boolean | null
          ativa?: boolean
          atualizada_em?: string
          criada_em?: string
          grupo?: string | null
          id?: never
          mapa?: Json
          nome?: string
          publicado_em?: string | null
          status?: string | null
          ultima_entrada?: Json | null
          ultima_entrada_em?: string | null
          webhook_token?: string | null
          webhook_token_enforced?: boolean
          webhook_token_updated_at?: string | null
        }
        Relationships: []
      }
      caixa_keywords: {
        Row: {
          categoria: string
          id: number
          keyword: string
          prioridade: number
        }
        Insert: {
          categoria: string
          id?: number
          keyword: string
          prioridade?: number
        }
        Update: {
          categoria?: string
          id?: number
          keyword?: string
          prioridade?: number
        }
        Relationships: []
      }
      categorias_caixa: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          id: string
          natureza: string
          nome: string
          ordem: number
          tipo: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          id?: string
          natureza?: string
          nome: string
          ordem?: number
          tipo: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          id?: string
          natureza?: string
          nome?: string
          ordem?: number
          tipo?: string
        }
        Relationships: []
      }
      comissoes: {
        Row: {
          beneficiario_id: string | null
          config_versao: string | null
          created_at: string
          id: string
          override_motivo: string | null
          override_por: string | null
          papel: Database["public"]["Enums"]["papel_comissao"]
          valor_calculado: number | null
          valor_final: number
          venda_id: string
        }
        Insert: {
          beneficiario_id?: string | null
          config_versao?: string | null
          created_at?: string
          id?: string
          override_motivo?: string | null
          override_por?: string | null
          papel: Database["public"]["Enums"]["papel_comissao"]
          valor_calculado?: number | null
          valor_final: number
          venda_id: string
        }
        Update: {
          beneficiario_id?: string | null
          config_versao?: string | null
          created_at?: string
          id?: string
          override_motivo?: string | null
          override_por?: string | null
          papel?: Database["public"]["Enums"]["papel_comissao"]
          valor_calculado?: number | null
          valor_final?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_beneficiario_id_fkey"
            columns: ["beneficiario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_beneficiario_id_fkey"
            columns: ["beneficiario_id"]
            isOneToOne: false
            referencedRelation: "v_painel_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "comissoes_beneficiario_id_fkey"
            columns: ["beneficiario_id"]
            isOneToOne: false
            referencedRelation: "v_painel_socio"
            referencedColumns: ["socio_id"]
          },
          {
            foreignKeyName: "comissoes_beneficiario_id_fkey"
            columns: ["beneficiario_id"]
            isOneToOne: false
            referencedRelation: "vw_ranking_vgv"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "comissoes_config_versao_fkey"
            columns: ["config_versao"]
            isOneToOne: false
            referencedRelation: "config_comissao"
            referencedColumns: ["versao"]
          },
          {
            foreignKeyName: "comissoes_override_por_fkey"
            columns: ["override_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_override_por_fkey"
            columns: ["override_por"]
            isOneToOne: false
            referencedRelation: "v_painel_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "comissoes_override_por_fkey"
            columns: ["override_por"]
            isOneToOne: false
            referencedRelation: "v_painel_socio"
            referencedColumns: ["socio_id"]
          },
          {
            foreignKeyName: "comissoes_override_por_fkey"
            columns: ["override_por"]
            isOneToOne: false
            referencedRelation: "vw_ranking_vgv"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "comissoes_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "v_vendas_detalhe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      condominios: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string
          complemento: string | null
          created_at: string
          created_by: string
          endereco: string
          id: string
          nome: string
          numero: string | null
          uf: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string
          complemento?: string | null
          created_at?: string
          created_by?: string
          endereco: string
          id?: string
          nome: string
          numero?: string | null
          uf?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string
          complemento?: string | null
          created_at?: string
          created_by?: string
          endereco?: string
          id?: string
          nome?: string
          numero?: string | null
          uf?: string
        }
        Relationships: []
      }
      config: {
        Row: {
          distribuicao_pausada: boolean
          id: number
        }
        Insert: {
          distribuicao_pausada?: boolean
          id?: never
        }
        Update: {
          distribuicao_pausada?: boolean
          id?: never
        }
        Relationships: []
      }
      config_comissao: {
        Row: {
          descricao: string | null
          parametros: Json
          versao: string
          vigente_ate: string | null
          vigente_de: string
        }
        Insert: {
          descricao?: string | null
          parametros: Json
          versao: string
          vigente_ate?: string | null
          vigente_de: string
        }
        Update: {
          descricao?: string | null
          parametros?: Json
          versao?: string
          vigente_ate?: string | null
          vigente_de?: string
        }
        Relationships: []
      }
      config_financeiro: {
        Row: {
          chave: string
          descricao: string | null
          valor: number
        }
        Insert: {
          chave: string
          descricao?: string | null
          valor: number
        }
        Update: {
          chave?: string
          descricao?: string | null
          valor?: number
        }
        Relationships: []
      }
      corretor_instancias: {
        Row: {
          corretor_id: number
          instancia_id: number
        }
        Insert: {
          corretor_id: number
          instancia_id: number
        }
        Update: {
          corretor_id?: number
          instancia_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "corretor_instancias_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corretor_instancias_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "corretor_instancias_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "corretor_instancias_instancia_id_fkey"
            columns: ["instancia_id"]
            isOneToOne: false
            referencedRelation: "instancias"
            referencedColumns: ["id"]
          },
        ]
      }
      corretor_presencas: {
        Row: {
          corretor_id: number
          dia: string
        }
        Insert: {
          corretor_id: number
          dia: string
        }
        Update: {
          corretor_id?: number
          dia?: string
        }
        Relationships: [
          {
            foreignKeyName: "corretor_presencas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corretor_presencas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "corretor_presencas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
        ]
      }
      corretores: {
        Row: {
          apelido: string | null
          ativo: boolean
          creci: string | null
          doc_contrato_em: string | null
          doc_contrato_nome: string | null
          doc_contrato_path: string | null
          doc_rg_em: string | null
          doc_rg_nome: string | null
          doc_rg_path: string | null
          email: string | null
          foto_path: string | null
          gerente_id: number | null
          id: number
          limite_carteira: number
          no_escritorio: boolean
          nome: string
          notif_leads: boolean
          notif_mensagens: boolean
          notif_som: boolean
          online: boolean
          ordem: number
          peso: number
          presente_data: string | null
          telefone: string | null
          ultima_presenca: string | null
          usuario_id: string | null
        }
        Insert: {
          apelido?: string | null
          ativo?: boolean
          creci?: string | null
          doc_contrato_em?: string | null
          doc_contrato_nome?: string | null
          doc_contrato_path?: string | null
          doc_rg_em?: string | null
          doc_rg_nome?: string | null
          doc_rg_path?: string | null
          email?: string | null
          foto_path?: string | null
          gerente_id?: number | null
          id?: never
          limite_carteira?: number
          no_escritorio?: boolean
          nome: string
          notif_leads?: boolean
          notif_mensagens?: boolean
          notif_som?: boolean
          online?: boolean
          ordem: number
          peso?: number
          presente_data?: string | null
          telefone?: string | null
          ultima_presenca?: string | null
          usuario_id?: string | null
        }
        Update: {
          apelido?: string | null
          ativo?: boolean
          creci?: string | null
          doc_contrato_em?: string | null
          doc_contrato_nome?: string | null
          doc_contrato_path?: string | null
          doc_rg_em?: string | null
          doc_rg_nome?: string | null
          doc_rg_path?: string | null
          email?: string | null
          foto_path?: string | null
          gerente_id?: number | null
          id?: never
          limite_carteira?: number
          no_escritorio?: boolean
          nome?: string
          notif_leads?: boolean
          notif_mensagens?: boolean
          notif_som?: boolean
          online?: boolean
          ordem?: number
          peso?: number
          presente_data?: string | null
          telefone?: string | null
          ultima_presenca?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corretores_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "gerentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corretores_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corretores_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "v_painel_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "corretores_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "v_painel_socio"
            referencedColumns: ["socio_id"]
          },
          {
            foreignKeyName: "corretores_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "vw_ranking_vgv"
            referencedColumns: ["corretor_id"]
          },
        ]
      }
      crm_atividades: {
        Row: {
          corretor_id: number | null
          criado_em: string
          criado_por: string | null
          id: number
          lead_id: number | null
          negocio_id: number | null
          texto: string | null
          tipo: string
        }
        Insert: {
          corretor_id?: number | null
          criado_em?: string
          criado_por?: string | null
          id?: never
          lead_id?: number | null
          negocio_id?: number | null
          texto?: string | null
          tipo?: string
        }
        Update: {
          corretor_id?: number | null
          criado_em?: string
          criado_por?: string | null
          id?: never
          lead_id?: number | null
          negocio_id?: number | null
          texto?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_atividades_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_atividades_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "crm_atividades_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "crm_atividades_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_atividades_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_erros_envio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "crm_atividades_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "crm_atividades_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_atividades_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_erp_cards"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "crm_atividades_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_erros_envio"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "crm_atividades_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_escalonamento"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "crm_atividades_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "crm_atividades_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_sla_leads"
            referencedColumns: ["negocio_id"]
          },
        ]
      }
      crm_lead_alertas: {
        Row: {
          corretor_id: number | null
          criado_em: string
          id: number
          negocio_id: number
          reconhecido_em: string | null
          reconhecido_por: string | null
        }
        Insert: {
          corretor_id?: number | null
          criado_em?: string
          id?: number
          negocio_id: number
          reconhecido_em?: string | null
          reconhecido_por?: string | null
        }
        Update: {
          corretor_id?: number | null
          criado_em?: string
          id?: number
          negocio_id?: number
          reconhecido_em?: string | null
          reconhecido_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_alertas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_alertas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "crm_lead_alertas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "crm_lead_alertas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_alertas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "vw_erp_cards"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "crm_lead_alertas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "vw_erros_envio"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "crm_lead_alertas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "vw_escalonamento"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "crm_lead_alertas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "crm_lead_alertas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "vw_sla_leads"
            referencedColumns: ["negocio_id"]
          },
        ]
      }
      crm_lead_leituras: {
        Row: {
          lido_em: string
          negocio_id: number
          usuario_id: string
        }
        Insert: {
          lido_em?: string
          negocio_id: number
          usuario_id: string
        }
        Update: {
          lido_em?: string
          negocio_id?: number
          usuario_id?: string
        }
        Relationships: []
      }
      crm_tarefas: {
        Row: {
          cliente_nome: string | null
          concluida: boolean
          corretor_id: number | null
          criado_em: string
          criado_por: string | null
          dc_lead_id: string | null
          dc_negocio_id: string | null
          descricao: string | null
          id: number
          lead_id: number | null
          negocio_id: number | null
          prioridade: string
          titulo: string
          vencimento: string | null
        }
        Insert: {
          cliente_nome?: string | null
          concluida?: boolean
          corretor_id?: number | null
          criado_em?: string
          criado_por?: string | null
          dc_lead_id?: string | null
          dc_negocio_id?: string | null
          descricao?: string | null
          id?: never
          lead_id?: number | null
          negocio_id?: number | null
          prioridade?: string
          titulo: string
          vencimento?: string | null
        }
        Update: {
          cliente_nome?: string | null
          concluida?: boolean
          corretor_id?: number | null
          criado_em?: string
          criado_por?: string | null
          dc_lead_id?: string | null
          dc_negocio_id?: string | null
          descricao?: string | null
          id?: never
          lead_id?: number | null
          negocio_id?: number | null
          prioridade?: string
          titulo?: string
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_tarefas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tarefas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "crm_tarefas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "crm_tarefas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tarefas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_erros_envio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "crm_tarefas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "crm_tarefas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tarefas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_erp_cards"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "crm_tarefas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_erros_envio"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "crm_tarefas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_escalonamento"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "crm_tarefas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "crm_tarefas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_sla_leads"
            referencedColumns: ["negocio_id"]
          },
        ]
      }
      dapi_chat_cache: {
        Row: {
          atualizado_em: string
          chat_id: string
          contato_nome: string | null
          instancia_id: number
          session_id: string | null
          telefone: string
        }
        Insert: {
          atualizado_em?: string
          chat_id: string
          contato_nome?: string | null
          instancia_id: number
          session_id?: string | null
          telefone: string
        }
        Update: {
          atualizado_em?: string
          chat_id?: string
          contato_nome?: string | null
          instancia_id?: number
          session_id?: string | null
          telefone?: string
        }
        Relationships: [
          {
            foreignKeyName: "dapi_chat_cache_instancia_id_fkey"
            columns: ["instancia_id"]
            isOneToOne: false
            referencedRelation: "instancias"
            referencedColumns: ["id"]
          },
        ]
      }
      dapi_conta: {
        Row: {
          apikey: string
          id: number
        }
        Insert: {
          apikey: string
          id?: number
        }
        Update: {
          apikey?: string
          id?: number
        }
        Relationships: []
      }
      distribuicao_config: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          failover_envio: boolean
          failover_transfere_lead: boolean
          fds_exige_presencas: number
          id: number
          janela_fim: string
          janela_inicio: string
          modo_fora_janela: string
          modo_rodizio: string
          receber_ate: string
          resgate_orfaos: boolean
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          failover_envio?: boolean
          failover_transfere_lead?: boolean
          fds_exige_presencas?: number
          id?: number
          janela_fim?: string
          janela_inicio?: string
          modo_fora_janela?: string
          modo_rodizio?: string
          receber_ate?: string
          resgate_orfaos?: boolean
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          failover_envio?: boolean
          failover_transfere_lead?: boolean
          fds_exige_presencas?: number
          id?: number
          janela_fim?: string
          janela_inicio?: string
          modo_fora_janela?: string
          modo_rodizio?: string
          receber_ate?: string
          resgate_orfaos?: boolean
        }
        Relationships: []
      }
      distribuicao_estado: {
        Row: {
          id: number
          ultimo_corretor_ordem: number
        }
        Insert: {
          id?: never
          ultimo_corretor_ordem?: number
        }
        Update: {
          id?: never
          ultimo_corretor_ordem?: number
        }
        Relationships: []
      }
      empreendimentos: {
        Row: {
          acesso_codigo: string | null
          acesso_instrucoes: string | null
          acesso_tipo: string | null
          andar: string | null
          aprovacao: string
          aprovado_em: string | null
          aprovado_por: string | null
          area_util: number | null
          bairro: string | null
          banheiros: number | null
          captacao_habilitada: boolean
          captado_em: string | null
          captado_por_usuario: string | null
          captador_corretor_id: number | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          condominio_id: string | null
          condominio_valor: number | null
          created_at: string
          descricao: string | null
          destaque: boolean
          diferenciais: string[] | null
          dormitorios: number | null
          endereco: string | null
          entrega: string | null
          finalidade: string | null
          id: string
          incorporadora: string | null
          iptu: number | null
          latitude: number | null
          lazer: string[] | null
          link_maps: string | null
          longitude: number | null
          nome: string
          numero: string | null
          ordem: number | null
          origem: string
          outros_custos: number | null
          preco: number | null
          proprietario_email: string | null
          proprietario_id: string | null
          proprietario_nome: string | null
          proprietario_tel: string | null
          publicado: boolean
          published_at: string | null
          rascunho: boolean
          reprovacao_motivo: string | null
          situacao: string | null
          slogan: string | null
          slug: string | null
          status: Database["public"]["Enums"]["status_empreend"]
          suites: number | null
          titulo: string | null
          uf: string | null
          vagas: number | null
        }
        Insert: {
          acesso_codigo?: string | null
          acesso_instrucoes?: string | null
          acesso_tipo?: string | null
          andar?: string | null
          aprovacao?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          area_util?: number | null
          bairro?: string | null
          banheiros?: number | null
          captacao_habilitada?: boolean
          captado_em?: string | null
          captado_por_usuario?: string | null
          captador_corretor_id?: number | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          condominio_id?: string | null
          condominio_valor?: number | null
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          diferenciais?: string[] | null
          dormitorios?: number | null
          endereco?: string | null
          entrega?: string | null
          finalidade?: string | null
          id?: string
          incorporadora?: string | null
          iptu?: number | null
          latitude?: number | null
          lazer?: string[] | null
          link_maps?: string | null
          longitude?: number | null
          nome: string
          numero?: string | null
          ordem?: number | null
          origem?: string
          outros_custos?: number | null
          preco?: number | null
          proprietario_email?: string | null
          proprietario_id?: string | null
          proprietario_nome?: string | null
          proprietario_tel?: string | null
          publicado?: boolean
          published_at?: string | null
          rascunho?: boolean
          reprovacao_motivo?: string | null
          situacao?: string | null
          slogan?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["status_empreend"]
          suites?: number | null
          titulo?: string | null
          uf?: string | null
          vagas?: number | null
        }
        Update: {
          acesso_codigo?: string | null
          acesso_instrucoes?: string | null
          acesso_tipo?: string | null
          andar?: string | null
          aprovacao?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          area_util?: number | null
          bairro?: string | null
          banheiros?: number | null
          captacao_habilitada?: boolean
          captado_em?: string | null
          captado_por_usuario?: string | null
          captador_corretor_id?: number | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          condominio_id?: string | null
          condominio_valor?: number | null
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          diferenciais?: string[] | null
          dormitorios?: number | null
          endereco?: string | null
          entrega?: string | null
          finalidade?: string | null
          id?: string
          incorporadora?: string | null
          iptu?: number | null
          latitude?: number | null
          lazer?: string[] | null
          link_maps?: string | null
          longitude?: number | null
          nome?: string
          numero?: string | null
          ordem?: number | null
          origem?: string
          outros_custos?: number | null
          preco?: number | null
          proprietario_email?: string | null
          proprietario_id?: string | null
          proprietario_nome?: string | null
          proprietario_tel?: string | null
          publicado?: boolean
          published_at?: string | null
          rascunho?: boolean
          reprovacao_motivo?: string | null
          situacao?: string | null
          slogan?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["status_empreend"]
          suites?: number | null
          titulo?: string | null
          uf?: string | null
          vagas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "empreendimentos_captador_corretor_id_fkey"
            columns: ["captador_corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empreendimentos_captador_corretor_id_fkey"
            columns: ["captador_corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "empreendimentos_captador_corretor_id_fkey"
            columns: ["captador_corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "empreendimentos_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empreendimentos_proprietario_id_fkey"
            columns: ["proprietario_id"]
            isOneToOne: false
            referencedRelation: "proprietarios"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_auditoria: {
        Row: {
          acao: string
          antes: Json | null
          criado_em: string
          depois: Json | null
          detalhe: string | null
          entidade: string | null
          entidade_id: string | null
          id: number
          ip: string | null
          modulo: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          antes?: Json | null
          criado_em?: string
          depois?: Json | null
          detalhe?: string | null
          entidade?: string | null
          entidade_id?: string | null
          id?: never
          ip?: string | null
          modulo: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          antes?: Json | null
          criado_em?: string
          depois?: Json | null
          detalhe?: string | null
          entidade?: string | null
          entidade_id?: string | null
          id?: never
          ip?: string | null
          modulo?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: []
      }
      erp_pipeline_config: {
        Row: {
          config: Json | null
          cor: string | null
          id: string
          nome: string | null
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          cor?: string | null
          id: string
          nome?: string | null
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          cor?: string | null
          id?: string
          nome?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      erp_settings: {
        Row: {
          atualizado_em: string
          chave: string
          valor: Json
        }
        Insert: {
          atualizado_em?: string
          chave: string
          valor?: Json
        }
        Update: {
          atualizado_em?: string
          chave?: string
          valor?: Json
        }
        Relationships: []
      }
      erp_user_config: {
        Row: {
          acessos: Json | null
          ativo: boolean | null
          email: string
          instancias: Json | null
          nome: string | null
          perfil: string | null
          updated_at: string | null
        }
        Insert: {
          acessos?: Json | null
          ativo?: boolean | null
          email: string
          instancias?: Json | null
          nome?: string | null
          perfil?: string | null
          updated_at?: string | null
        }
        Update: {
          acessos?: Json | null
          ativo?: boolean | null
          email?: string
          instancias?: Json | null
          nome?: string | null
          perfil?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      escritorio_config: {
        Row: {
          atualizado_em: string
          id: number
          ips: string[]
        }
        Insert: {
          atualizado_em?: string
          id?: number
          ips?: string[]
        }
        Update: {
          atualizado_em?: string
          id?: number
          ips?: string[]
        }
        Relationships: []
      }
      esteira_anexos: {
        Row: {
          criado_em: string
          doc_nome: string | null
          enviado_por: string | null
          etapa_slug: string | null
          grupo: string | null
          id: string
          mime: string | null
          negocio_id: number | null
          nome: string
          obrigatorio: boolean
          observacao: string | null
          path: string
          processo_ref: string
          revisado_em: string | null
          revisado_por: string | null
          status: string
          status_motivo: string | null
          tamanho: number | null
        }
        Insert: {
          criado_em?: string
          doc_nome?: string | null
          enviado_por?: string | null
          etapa_slug?: string | null
          grupo?: string | null
          id?: string
          mime?: string | null
          negocio_id?: number | null
          nome: string
          obrigatorio?: boolean
          observacao?: string | null
          path: string
          processo_ref: string
          revisado_em?: string | null
          revisado_por?: string | null
          status?: string
          status_motivo?: string | null
          tamanho?: number | null
        }
        Update: {
          criado_em?: string
          doc_nome?: string | null
          enviado_por?: string | null
          etapa_slug?: string | null
          grupo?: string | null
          id?: string
          mime?: string | null
          negocio_id?: number | null
          nome?: string
          obrigatorio?: boolean
          observacao?: string | null
          path?: string
          processo_ref?: string
          revisado_em?: string | null
          revisado_por?: string | null
          status?: string
          status_motivo?: string | null
          tamanho?: number | null
        }
        Relationships: []
      }
      esteira_doc_modelo: {
        Row: {
          ativo: boolean
          criado_em: string
          grupo: string
          id: string
          nome: string
          obrigatorio: boolean
          ordem: number
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          grupo: string
          id?: string
          nome: string
          obrigatorio?: boolean
          ordem?: number
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          grupo?: string
          id?: string
          nome?: string
          obrigatorio?: boolean
          ordem?: number
        }
        Relationships: []
      }
      esteira_etapa_docs: {
        Row: {
          ativo: boolean
          created_at: string
          etapa_slug: string
          id: string
          nome: string
          obrigatorio: boolean
          ordem: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          etapa_slug: string
          id?: string
          nome: string
          obrigatorio?: boolean
          ordem?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          etapa_slug?: string
          id?: string
          nome?: string
          obrigatorio?: boolean
          ordem?: number
        }
        Relationships: []
      }
      esteira_etapa_verificacoes: {
        Row: {
          etapa_slug: string
          id: string
          processo_ref: string
          verificado_em: string
          verificado_por: string | null
        }
        Insert: {
          etapa_slug: string
          id?: string
          processo_ref: string
          verificado_em?: string
          verificado_por?: string | null
        }
        Update: {
          etapa_slug?: string
          id?: string
          processo_ref?: string
          verificado_em?: string
          verificado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esteira_etapa_verificacoes_processo_ref_fkey"
            columns: ["processo_ref"]
            isOneToOne: false
            referencedRelation: "venda_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      esteira_etapas: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          exige_docs: boolean
          id: string
          nome: string
          ordem: number
          papel: string
          resale: boolean
          sla_dias: number
          slug: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          exige_docs?: boolean
          id?: string
          nome: string
          ordem?: number
          papel?: string
          resale?: boolean
          sla_dias?: number
          slug: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          exige_docs?: boolean
          id?: string
          nome?: string
          ordem?: number
          papel?: string
          resale?: boolean
          sla_dias?: number
          slug?: string
        }
        Relationships: []
      }
      financiamento_fichas: {
        Row: {
          aberta_em: string | null
          atualizado_em: string
          cep: string | null
          comprador_nome: string | null
          concluida_em: string | null
          conjuge_cpf: string | null
          conjuge_data_nascimento: string | null
          conjuge_nome: string | null
          conjuge_renda: number | null
          conjuge_rg: string | null
          consentimento_lgpd: boolean
          corretor_id: number | null
          cpf: string | null
          created_by: string | null
          criado_em: string
          data_nascimento: string | null
          dc_negocio_id: string | null
          email: string | null
          endereco: string | null
          enviada_em: string | null
          estado_civil: string | null
          id: string
          link_token: string | null
          preenchida_em: string | null
          produto: string | null
          renda: number | null
          rg: string | null
          status: string
          telefone: string | null
          unidade: string | null
          valor_entrada: number | null
          valor_financiar: number | null
          valor_imovel: number | null
        }
        Insert: {
          aberta_em?: string | null
          atualizado_em?: string
          cep?: string | null
          comprador_nome?: string | null
          concluida_em?: string | null
          conjuge_cpf?: string | null
          conjuge_data_nascimento?: string | null
          conjuge_nome?: string | null
          conjuge_renda?: number | null
          conjuge_rg?: string | null
          consentimento_lgpd?: boolean
          corretor_id?: number | null
          cpf?: string | null
          created_by?: string | null
          criado_em?: string
          data_nascimento?: string | null
          dc_negocio_id?: string | null
          email?: string | null
          endereco?: string | null
          enviada_em?: string | null
          estado_civil?: string | null
          id?: string
          link_token?: string | null
          preenchida_em?: string | null
          produto?: string | null
          renda?: number | null
          rg?: string | null
          status?: string
          telefone?: string | null
          unidade?: string | null
          valor_entrada?: number | null
          valor_financiar?: number | null
          valor_imovel?: number | null
        }
        Update: {
          aberta_em?: string | null
          atualizado_em?: string
          cep?: string | null
          comprador_nome?: string | null
          concluida_em?: string | null
          conjuge_cpf?: string | null
          conjuge_data_nascimento?: string | null
          conjuge_nome?: string | null
          conjuge_renda?: number | null
          conjuge_rg?: string | null
          consentimento_lgpd?: boolean
          corretor_id?: number | null
          cpf?: string | null
          created_by?: string | null
          criado_em?: string
          data_nascimento?: string | null
          dc_negocio_id?: string | null
          email?: string | null
          endereco?: string | null
          enviada_em?: string | null
          estado_civil?: string | null
          id?: string
          link_token?: string | null
          preenchida_em?: string | null
          produto?: string | null
          renda?: number | null
          rg?: string | null
          status?: string
          telefone?: string | null
          unidade?: string | null
          valor_entrada?: number | null
          valor_financiar?: number | null
          valor_imovel?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financiamento_fichas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financiamento_fichas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "financiamento_fichas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
        ]
      }
      gerentes: {
        Row: {
          ativo: boolean
          corretor_id: number | null
          criado_em: string | null
          geral: boolean
          id: number
          nome: string
        }
        Insert: {
          ativo?: boolean
          corretor_id?: number | null
          criado_em?: string | null
          geral?: boolean
          id?: number
          nome: string
        }
        Update: {
          ativo?: boolean
          corretor_id?: number | null
          criado_em?: string | null
          geral?: boolean
          id?: number
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "gerentes_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gerentes_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "gerentes_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
        ]
      }
      ia_notas_atendimento: {
        Row: {
          avaliado_em: string
          clareza: number | null
          classificacao: string
          conducao: number | null
          cordialidade: number | null
          corretor_id: number
          destaque: string | null
          dia: string
          escrita: number | null
          id: number
          lead_id: number | null
          modelo: string | null
          msgs_avaliadas: number
          nota_geral: number
          objecoes: number | null
          personalizacao: number | null
          qualificacao: number | null
          telefone: string
        }
        Insert: {
          avaliado_em?: string
          clareza?: number | null
          classificacao?: string
          conducao?: number | null
          cordialidade?: number | null
          corretor_id: number
          destaque?: string | null
          dia?: string
          escrita?: number | null
          id?: never
          lead_id?: number | null
          modelo?: string | null
          msgs_avaliadas?: number
          nota_geral: number
          objecoes?: number | null
          personalizacao?: number | null
          qualificacao?: number | null
          telefone: string
        }
        Update: {
          avaliado_em?: string
          clareza?: number | null
          classificacao?: string
          conducao?: number | null
          cordialidade?: number | null
          corretor_id?: number
          destaque?: string | null
          dia?: string
          escrita?: number | null
          id?: never
          lead_id?: number | null
          modelo?: string | null
          msgs_avaliadas?: number
          nota_geral?: number
          objecoes?: number | null
          personalizacao?: number | null
          qualificacao?: number | null
          telefone?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_notas_atendimento_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_notas_atendimento_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "ia_notas_atendimento_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
        ]
      }
      instancias: {
        Row: {
          ativa: boolean
          conectada: boolean
          conectada_em: string | null
          corretor_id: number | null
          falhas_seguidas: number
          id: number
          instancia_dapi: string
          nome: string
          numero_conectado: string | null
          status_dapi: string | null
          telefone: string | null
          ultima_falha_em: string | null
        }
        Insert: {
          ativa?: boolean
          conectada?: boolean
          conectada_em?: string | null
          corretor_id?: number | null
          falhas_seguidas?: number
          id?: never
          instancia_dapi: string
          nome: string
          numero_conectado?: string | null
          status_dapi?: string | null
          telefone?: string | null
          ultima_falha_em?: string | null
        }
        Update: {
          ativa?: boolean
          conectada?: boolean
          conectada_em?: string | null
          corretor_id?: number | null
          falhas_seguidas?: number
          id?: never
          instancia_dapi?: string
          nome?: string
          numero_conectado?: string | null
          status_dapi?: string | null
          telefone?: string | null
          ultima_falha_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instancias_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instancias_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "instancias_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
        ]
      }
      instancias_credenciais: {
        Row: {
          apikey: string
          instancia_id: number
        }
        Insert: {
          apikey: string
          instancia_id: number
        }
        Update: {
          apikey?: string
          instancia_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "instancias_credenciais_instancia_id_fkey"
            columns: ["instancia_id"]
            isOneToOne: true
            referencedRelation: "instancias"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_caixa: {
        Row: {
          beneficiario_id: string | null
          categoria: string
          comissao_id: string | null
          created_at: string
          data: string
          descricao: string | null
          id: string
          natureza: string
          origem: string | null
          papel: Database["public"]["Enums"]["papel_comissao"] | null
          recebimento_id: string | null
          tipo: Database["public"]["Enums"]["tipo_caixa"]
          valor: number
          venda_id: string | null
        }
        Insert: {
          beneficiario_id?: string | null
          categoria: string
          comissao_id?: string | null
          created_at?: string
          data: string
          descricao?: string | null
          id?: string
          natureza?: string
          origem?: string | null
          papel?: Database["public"]["Enums"]["papel_comissao"] | null
          recebimento_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_caixa"]
          valor: number
          venda_id?: string | null
        }
        Update: {
          beneficiario_id?: string | null
          categoria?: string
          comissao_id?: string | null
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          natureza?: string
          origem?: string | null
          papel?: Database["public"]["Enums"]["papel_comissao"] | null
          recebimento_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_caixa"]
          valor?: number
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_receb"
            columns: ["recebimento_id"]
            isOneToOne: false
            referencedRelation: "recebimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_caixa_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "v_vendas_detalhe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_caixa_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_avaliacoes: {
        Row: {
          agente_versao: number | null
          contexto: Json | null
          criado_em: string | null
          feedbacks: Json | null
          id: number
          lead_id: number | null
          negocio_id: number | null
          nota: number | null
        }
        Insert: {
          agente_versao?: number | null
          contexto?: Json | null
          criado_em?: string | null
          feedbacks?: Json | null
          id?: number
          lead_id?: number | null
          negocio_id?: number | null
          nota?: number | null
        }
        Update: {
          agente_versao?: number | null
          contexto?: Json | null
          criado_em?: string | null
          feedbacks?: Json | null
          id?: number
          lead_id?: number | null
          negocio_id?: number | null
          nota?: number | null
        }
        Relationships: []
      }
      lead_momentos: {
        Row: {
          atualizado_por: string
          corretor_id: number
          criado_em: string
          etapa_anterior_id: number | null
          etapa_nova_id: number | null
          id: string
          lead_id: number
          momento: string
          negocio_id: number | null
          observacao: string | null
          proxima_acao: string | null
          proxima_acao_em: string | null
          resultado: string | null
          temperatura: string | null
        }
        Insert: {
          atualizado_por: string
          corretor_id: number
          criado_em?: string
          etapa_anterior_id?: number | null
          etapa_nova_id?: number | null
          id?: string
          lead_id: number
          momento: string
          negocio_id?: number | null
          observacao?: string | null
          proxima_acao?: string | null
          proxima_acao_em?: string | null
          resultado?: string | null
          temperatura?: string | null
        }
        Update: {
          atualizado_por?: string
          corretor_id?: number
          criado_em?: string
          etapa_anterior_id?: number | null
          etapa_nova_id?: number | null
          id?: string
          lead_id?: number
          momento?: string
          negocio_id?: number | null
          observacao?: string | null
          proxima_acao?: string | null
          proxima_acao_em?: string | null
          resultado?: string | null
          temperatura?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_momentos_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_momentos_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "lead_momentos_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "lead_momentos_etapa_anterior_id_fkey"
            columns: ["etapa_anterior_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_momentos_etapa_anterior_id_fkey"
            columns: ["etapa_anterior_id"]
            isOneToOne: false
            referencedRelation: "vw_erp_kanban_resumo"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "lead_momentos_etapa_nova_id_fkey"
            columns: ["etapa_nova_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_momentos_etapa_nova_id_fkey"
            columns: ["etapa_nova_id"]
            isOneToOne: false
            referencedRelation: "vw_erp_kanban_resumo"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "lead_momentos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_momentos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_erros_envio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_momentos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_momentos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_momentos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_erp_cards"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "lead_momentos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_erros_envio"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "lead_momentos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_escalonamento"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "lead_momentos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "lead_momentos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_sla_leads"
            referencedColumns: ["negocio_id"]
          },
        ]
      }
      lead_produtos: {
        Row: {
          created_at: string
          empreendimento_id: string
          lead_id: number
          vinculado_por: string
        }
        Insert: {
          created_at?: string
          empreendimento_id: string
          lead_id: number
          vinculado_por?: string
        }
        Update: {
          created_at?: string
          empreendimento_id?: string
          lead_id?: number
          vinculado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_produtos_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_produtos_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_produtos_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_empreendimento_resumo"
            referencedColumns: ["empreendimento_id"]
          },
          {
            foreignKeyName: "lead_produtos_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_produtos_publicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_produtos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_produtos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_erros_envio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_produtos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      leads: {
        Row: {
          atendido_em: string | null
          atualizado_em: string | null
          corretor_id: number | null
          criado_em: string
          datacrazy_lead_id: string | null
          disparo_optout: boolean
          email: string | null
          extras: Json | null
          id: number
          instagram: string | null
          momento_atual: string | null
          momento_atualizado_em: string | null
          momento_atualizado_por: string | null
          nome: string | null
          origem: string | null
          pipeline_id: number | null
          proxima_acao: string | null
          proxima_acao_em: string | null
          status: string
          tags: Json | null
          telefone: string | null
          wa_contato_id: string | null
        }
        Insert: {
          atendido_em?: string | null
          atualizado_em?: string | null
          corretor_id?: number | null
          criado_em?: string
          datacrazy_lead_id?: string | null
          disparo_optout?: boolean
          email?: string | null
          extras?: Json | null
          id?: never
          instagram?: string | null
          momento_atual?: string | null
          momento_atualizado_em?: string | null
          momento_atualizado_por?: string | null
          nome?: string | null
          origem?: string | null
          pipeline_id?: number | null
          proxima_acao?: string | null
          proxima_acao_em?: string | null
          status?: string
          tags?: Json | null
          telefone?: string | null
          wa_contato_id?: string | null
        }
        Update: {
          atendido_em?: string | null
          atualizado_em?: string | null
          corretor_id?: number | null
          criado_em?: string
          datacrazy_lead_id?: string | null
          disparo_optout?: boolean
          email?: string | null
          extras?: Json | null
          id?: never
          instagram?: string | null
          momento_atual?: string | null
          momento_atualizado_em?: string | null
          momento_atualizado_por?: string | null
          nome?: string | null
          origem?: string | null
          pipeline_id?: number | null
          proxima_acao?: string | null
          proxima_acao_em?: string | null
          status?: string
          tags?: Json | null
          telefone?: string | null
          wa_contato_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "leads_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "leads_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_agendadas: {
        Row: {
          campanha_id: string | null
          corretor_nome: string | null
          criado_em: string | null
          criado_por: string | null
          etapa_destino_id: number | null
          etapa_origem_id: number | null
          file_name: string | null
          id: number
          instancia_id: number | null
          lead_id: number | null
          mimetype: string | null
          movido_em: string | null
          quando: string
          resultado: string | null
          status: string | null
          telefone: string
          texto: string | null
          tipo: string
          url: string | null
        }
        Insert: {
          campanha_id?: string | null
          corretor_nome?: string | null
          criado_em?: string | null
          criado_por?: string | null
          etapa_destino_id?: number | null
          etapa_origem_id?: number | null
          file_name?: string | null
          id?: never
          instancia_id?: number | null
          lead_id?: number | null
          mimetype?: string | null
          movido_em?: string | null
          quando: string
          resultado?: string | null
          status?: string | null
          telefone: string
          texto?: string | null
          tipo?: string
          url?: string | null
        }
        Update: {
          campanha_id?: string | null
          corretor_nome?: string | null
          criado_em?: string | null
          criado_por?: string | null
          etapa_destino_id?: number | null
          etapa_origem_id?: number | null
          file_name?: string | null
          id?: never
          instancia_id?: number | null
          lead_id?: number | null
          mimetype?: string | null
          movido_em?: string | null
          quando?: string
          resultado?: string | null
          status?: string | null
          telefone?: string
          texto?: string | null
          tipo?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_agendadas_etapa_destino_id_fkey"
            columns: ["etapa_destino_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_agendadas_etapa_destino_id_fkey"
            columns: ["etapa_destino_id"]
            isOneToOne: false
            referencedRelation: "vw_erp_kanban_resumo"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "mensagens_agendadas_etapa_origem_id_fkey"
            columns: ["etapa_origem_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_agendadas_etapa_origem_id_fkey"
            columns: ["etapa_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_erp_kanban_resumo"
            referencedColumns: ["stage_id"]
          },
        ]
      }
      metas: {
        Row: {
          ano: number
          corretor_id: number | null
          created_at: string
          criado_por: string | null
          id: string
          meta_vendas: number
          meta_vgv: number
          periodo: number
          periodo_tipo: string
          updated_at: string
        }
        Insert: {
          ano: number
          corretor_id?: number | null
          created_at?: string
          criado_por?: string | null
          id?: string
          meta_vendas?: number
          meta_vgv?: number
          periodo?: number
          periodo_tipo: string
          updated_at?: string
        }
        Update: {
          ano?: number
          corretor_id?: number | null
          created_at?: string
          criado_por?: string | null
          id?: string
          meta_vendas?: number
          meta_vgv?: number
          periodo?: number
          periodo_tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "metas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
        ]
      }
      metas_corretor: {
        Row: {
          atualizado_em: string
          corretor_id: number | null
          meta_vgv: number
          nome: string
        }
        Insert: {
          atualizado_em?: string
          corretor_id?: number | null
          meta_vgv?: number
          nome: string
        }
        Update: {
          atualizado_em?: string
          corretor_id?: number | null
          meta_vgv?: number
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_corretor_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_corretor_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "metas_corretor_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
        ]
      }
      midias: {
        Row: {
          categoria: string | null
          created_at: string
          empreendimento_id: string
          id: string
          is_capa: boolean
          nome: string | null
          storage_path: string
          tipo: Database["public"]["Enums"]["tipo_midia"]
          unidade_id: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          empreendimento_id: string
          id?: string
          is_capa?: boolean
          nome?: string | null
          storage_path: string
          tipo: Database["public"]["Enums"]["tipo_midia"]
          unidade_id?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          empreendimento_id?: string
          id?: string
          is_capa?: boolean
          nome?: string | null
          storage_path?: string
          tipo?: Database["public"]["Enums"]["tipo_midia"]
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "midias_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midias_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midias_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_empreendimento_resumo"
            referencedColumns: ["empreendimento_id"]
          },
          {
            foreignKeyName: "midias_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_produtos_publicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midias_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      mig_corretor_map: {
        Row: {
          corretor_id: number | null
          dc_attendant_id: string
          dc_name: string | null
        }
        Insert: {
          corretor_id?: number | null
          dc_attendant_id: string
          dc_name?: string | null
        }
        Update: {
          corretor_id?: number | null
          dc_attendant_id?: string
          dc_name?: string | null
        }
        Relationships: []
      }
      mig_pipe_map: {
        Row: {
          dc_pipeline_id: string
          erp_pipeline_id: number | null
        }
        Insert: {
          dc_pipeline_id: string
          erp_pipeline_id?: number | null
        }
        Update: {
          dc_pipeline_id?: string
          erp_pipeline_id?: number | null
        }
        Relationships: []
      }
      motivos_descarte: {
        Row: {
          motivo: string
          ordem: number | null
        }
        Insert: {
          motivo: string
          ordem?: number | null
        }
        Update: {
          motivo?: string
          ordem?: number | null
        }
        Relationships: []
      }
      motor_execucoes: {
        Row: {
          automacao_id: number | null
          automacao_nome: string | null
          bloco_id: string | null
          criado_em: string | null
          detalhe: string | null
          evento: string | null
          id: number
          lead_nome: string | null
          lead_telefone: string | null
          status: string | null
        }
        Insert: {
          automacao_id?: number | null
          automacao_nome?: string | null
          bloco_id?: string | null
          criado_em?: string | null
          detalhe?: string | null
          evento?: string | null
          id?: never
          lead_nome?: string | null
          lead_telefone?: string | null
          status?: string | null
        }
        Update: {
          automacao_id?: number | null
          automacao_nome?: string | null
          bloco_id?: string | null
          criado_em?: string | null
          detalhe?: string | null
          evento?: string | null
          id?: never
          lead_nome?: string | null
          lead_telefone?: string | null
          status?: string | null
        }
        Relationships: []
      }
      motor_fila: {
        Row: {
          automacao_id: number
          bloco_id: string
          criado_em: string
          due_at: string
          id: number
          lead: Json
          processado_em: string | null
          status: string
        }
        Insert: {
          automacao_id: number
          bloco_id: string
          criado_em?: string
          due_at: string
          id?: never
          lead: Json
          processado_em?: string | null
          status?: string
        }
        Update: {
          automacao_id?: number
          bloco_id?: string
          criado_em?: string
          due_at?: string
          id?: never
          lead?: Json
          processado_em?: string | null
          status?: string
        }
        Relationships: []
      }
      motor_flags: {
        Row: {
          ativo: boolean
          atualizado_em: string | null
          nome: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string | null
          nome: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string | null
          nome?: string
        }
        Relationships: []
      }
      motor_roleta_contadores: {
        Row: {
          atualizado_em: string
          automacao_id: number
          bloco_id: string
          corretor_id: number
          peso: number
          recebidos: number
        }
        Insert: {
          atualizado_em?: string
          automacao_id: number
          bloco_id: string
          corretor_id: number
          peso?: number
          recebidos?: number
        }
        Update: {
          atualizado_em?: string
          automacao_id?: number
          bloco_id?: string
          corretor_id?: number
          peso?: number
          recebidos?: number
        }
        Relationships: []
      }
      negocios: {
        Row: {
          corretor_id: number | null
          criado_em: string
          datacrazy_negocio_id: string | null
          descarte_motivo: string | null
          descarte_status: string | null
          empreendimento_id: string | null
          estagio_desde: string | null
          id: number
          lead_id: number
          max_tentativas: number | null
          motivo_perda: string | null
          pipeline_id: number
          raw: Json | null
          stage_id: number | null
          status: string
          tentativa: number | null
          transferencia_para: number | null
          transferencia_status: string | null
          ultima_movimentacao: string | null
          unidade_id: string | null
          valor: number | null
          venda_id: string | null
        }
        Insert: {
          corretor_id?: number | null
          criado_em?: string
          datacrazy_negocio_id?: string | null
          descarte_motivo?: string | null
          descarte_status?: string | null
          empreendimento_id?: string | null
          estagio_desde?: string | null
          id?: never
          lead_id: number
          max_tentativas?: number | null
          motivo_perda?: string | null
          pipeline_id: number
          raw?: Json | null
          stage_id?: number | null
          status?: string
          tentativa?: number | null
          transferencia_para?: number | null
          transferencia_status?: string | null
          ultima_movimentacao?: string | null
          unidade_id?: string | null
          valor?: number | null
          venda_id?: string | null
        }
        Update: {
          corretor_id?: number | null
          criado_em?: string
          datacrazy_negocio_id?: string | null
          descarte_motivo?: string | null
          descarte_status?: string | null
          empreendimento_id?: string | null
          estagio_desde?: string | null
          id?: never
          lead_id?: number
          max_tentativas?: number | null
          motivo_perda?: string | null
          pipeline_id?: number
          raw?: Json | null
          stage_id?: number | null
          status?: string
          tentativa?: number | null
          transferencia_para?: number | null
          transferencia_status?: string | null
          ultima_movimentacao?: string | null
          unidade_id?: string | null
          valor?: number | null
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negocios_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "negocios_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "negocios_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_empreendimento_resumo"
            referencedColumns: ["empreendimento_id"]
          },
          {
            foreignKeyName: "negocios_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_produtos_publicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_erros_envio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "negocios_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "negocios_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "vw_erp_kanban_resumo"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "negocios_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "v_vendas_detalhe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      negocios_dup_backup_20260721: {
        Row: {
          backup_em: string | null
          corretor_id: number | null
          criado_em: string | null
          datacrazy_negocio_id: string | null
          descarte_motivo: string | null
          descarte_status: string | null
          empreendimento_id: string | null
          estagio_desde: string | null
          id: number | null
          keep_id: number | null
          lead_id: number | null
          max_tentativas: number | null
          motivo_perda: string | null
          pipeline_id: number | null
          raw: Json | null
          rn: number | null
          stage_id: number | null
          status: string | null
          tentativa: number | null
          transferencia_para: number | null
          transferencia_status: string | null
          ultima_movimentacao: string | null
          unidade_id: string | null
          valor: number | null
          venda_id: string | null
        }
        Insert: {
          backup_em?: string | null
          corretor_id?: number | null
          criado_em?: string | null
          datacrazy_negocio_id?: string | null
          descarte_motivo?: string | null
          descarte_status?: string | null
          empreendimento_id?: string | null
          estagio_desde?: string | null
          id?: number | null
          keep_id?: number | null
          lead_id?: number | null
          max_tentativas?: number | null
          motivo_perda?: string | null
          pipeline_id?: number | null
          raw?: Json | null
          rn?: number | null
          stage_id?: number | null
          status?: string | null
          tentativa?: number | null
          transferencia_para?: number | null
          transferencia_status?: string | null
          ultima_movimentacao?: string | null
          unidade_id?: string | null
          valor?: number | null
          venda_id?: string | null
        }
        Update: {
          backup_em?: string | null
          corretor_id?: number | null
          criado_em?: string | null
          datacrazy_negocio_id?: string | null
          descarte_motivo?: string | null
          descarte_status?: string | null
          empreendimento_id?: string | null
          estagio_desde?: string | null
          id?: number | null
          keep_id?: number | null
          lead_id?: number | null
          max_tentativas?: number | null
          motivo_perda?: string | null
          pipeline_id?: number | null
          raw?: Json | null
          rn?: number | null
          stage_id?: number | null
          status?: string | null
          tentativa?: number | null
          transferencia_para?: number | null
          transferencia_status?: string | null
          ultima_movimentacao?: string | null
          unidade_id?: string | null
          valor?: number | null
          venda_id?: string | null
        }
        Relationships: []
      }
      pagamentos_comissao: {
        Row: {
          beneficiario_id: string
          comissao_id: string | null
          created_at: string
          criado_por: string | null
          data_pagamento: string | null
          id: string
          observacao: string | null
          papel: string
          status: string
          updated_at: string
          valor: number
          venda_id: string
        }
        Insert: {
          beneficiario_id: string
          comissao_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_pagamento?: string | null
          id?: string
          observacao?: string | null
          papel: string
          status?: string
          updated_at?: string
          valor: number
          venda_id: string
        }
        Update: {
          beneficiario_id?: string
          comissao_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_pagamento?: string | null
          id?: string
          observacao?: string | null
          papel?: string
          status?: string
          updated_at?: string
          valor?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_comissao_beneficiario_id_fkey"
            columns: ["beneficiario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_comissao_beneficiario_id_fkey"
            columns: ["beneficiario_id"]
            isOneToOne: false
            referencedRelation: "v_painel_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "pagamentos_comissao_beneficiario_id_fkey"
            columns: ["beneficiario_id"]
            isOneToOne: false
            referencedRelation: "v_painel_socio"
            referencedColumns: ["socio_id"]
          },
          {
            foreignKeyName: "pagamentos_comissao_beneficiario_id_fkey"
            columns: ["beneficiario_id"]
            isOneToOne: false
            referencedRelation: "vw_ranking_vgv"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "pagamentos_comissao_comissao_id_fkey"
            columns: ["comissao_id"]
            isOneToOne: false
            referencedRelation: "comissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_comissao_comissao_id_fkey"
            columns: ["comissao_id"]
            isOneToOne: false
            referencedRelation: "v_ganhos_executivo"
            referencedColumns: ["comissao_id"]
          },
          {
            foreignKeyName: "pagamentos_comissao_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_comissao_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "v_painel_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "pagamentos_comissao_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "v_painel_socio"
            referencedColumns: ["socio_id"]
          },
          {
            foreignKeyName: "pagamentos_comissao_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_ranking_vgv"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "pagamentos_comissao_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "v_vendas_detalhe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_comissao_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      perf_eventos: {
        Row: {
          corretor_id: number | null
          id: string
          lead_id: number | null
          meta: Json
          negocio_id: number | null
          ocorrido_em: string
          origem: string | null
          quantidade: number
          tipo: string
          valor: number | null
        }
        Insert: {
          corretor_id?: number | null
          id?: string
          lead_id?: number | null
          meta?: Json
          negocio_id?: number | null
          ocorrido_em?: string
          origem?: string | null
          quantidade?: number
          tipo: string
          valor?: number | null
        }
        Update: {
          corretor_id?: number | null
          id?: string
          lead_id?: number | null
          meta?: Json
          negocio_id?: number | null
          ocorrido_em?: string
          origem?: string | null
          quantidade?: number
          tipo?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "perf_eventos_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perf_eventos_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "perf_eventos_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "perf_eventos_tipo_fkey"
            columns: ["tipo"]
            isOneToOne: false
            referencedRelation: "perf_tipos"
            referencedColumns: ["tipo"]
          },
        ]
      }
      perf_snapshots: {
        Row: {
          corretor_id: number
          criado_em: string
          crm_score: number
          dia: string
          fup_score: number
          id: number
          resp_score: number
          score: number
          tarefa_score: number
          venda_score: number
          vendas_mes: number
          vgv_mes: number
          visita_score: number
        }
        Insert: {
          corretor_id: number
          criado_em?: string
          crm_score?: number
          dia?: string
          fup_score?: number
          id?: never
          resp_score?: number
          score?: number
          tarefa_score?: number
          venda_score?: number
          vendas_mes?: number
          vgv_mes?: number
          visita_score?: number
        }
        Update: {
          corretor_id?: number
          criado_em?: string
          crm_score?: number
          dia?: string
          fup_score?: number
          id?: never
          resp_score?: number
          score?: number
          tarefa_score?: number
          venda_score?: number
          vendas_mes?: number
          vgv_mes?: number
          visita_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "perf_snapshots_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perf_snapshots_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "perf_snapshots_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
        ]
      }
      perf_tipos: {
        Row: {
          ativo: boolean
          categoria: string
          descricao: string | null
          rotulo: string
          tipo: string
          unidade: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          descricao?: string | null
          rotulo: string
          tipo: string
          unidade?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          descricao?: string | null
          rotulo?: string
          tipo?: string
          unidade?: string
        }
        Relationships: []
      }
      perfis: {
        Row: {
          atualizado_em: string
          id: string
          is_system: boolean
          nome: string
          permissoes: Json
        }
        Insert: {
          atualizado_em?: string
          id: string
          is_system?: boolean
          nome: string
          permissoes?: Json
        }
        Update: {
          atualizado_em?: string
          id?: string
          is_system?: boolean
          nome?: string
          permissoes?: Json
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          alarme: boolean | null
          chave: string | null
          cor: string | null
          criado_em: string
          datacrazy_stage_nome: string | null
          grupo: number | null
          icone: string | null
          id: number
          nome: string
          ordem: number
          pipeline_id: number
          rotulo: string | null
          sla_situacao: string | null
          tipo: string
          visivel_operacao: boolean
        }
        Insert: {
          alarme?: boolean | null
          chave?: string | null
          cor?: string | null
          criado_em?: string
          datacrazy_stage_nome?: string | null
          grupo?: number | null
          icone?: string | null
          id?: never
          nome: string
          ordem?: number
          pipeline_id: number
          rotulo?: string | null
          sla_situacao?: string | null
          tipo?: string
          visivel_operacao?: boolean
        }
        Update: {
          alarme?: boolean | null
          chave?: string | null
          cor?: string | null
          criado_em?: string
          datacrazy_stage_nome?: string | null
          grupo?: number | null
          icone?: string | null
          id?: never
          nome?: string
          ordem?: number
          pipeline_id?: number
          rotulo?: string | null
          sla_situacao?: string | null
          tipo?: string
          visivel_operacao?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          empreendimento_id: string | null
          grupo: string | null
          id: number
          nome: string
          ordem: number
        }
        Insert: {
          empreendimento_id?: string | null
          grupo?: string | null
          id?: never
          nome: string
          ordem?: number
        }
        Update: {
          empreendimento_id?: string | null
          grupo?: string | null
          id?: never
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipelines_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipelines_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_empreendimento_resumo"
            referencedColumns: ["empreendimento_id"]
          },
          {
            foreignKeyName: "pipelines_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_produtos_publicos"
            referencedColumns: ["id"]
          },
        ]
      }
      presenca_config: {
        Row: {
          ativa: boolean
          atualizado_em: string
          corretores: number[] | null
          dias: string
          dias_semana: number[]
          hora_fim: string
          hora_inicio: string
          id: number
          intervalo_min: number
          prazo_seg: number
        }
        Insert: {
          ativa?: boolean
          atualizado_em?: string
          corretores?: number[] | null
          dias?: string
          dias_semana?: number[]
          hora_fim?: string
          hora_inicio?: string
          id?: number
          intervalo_min?: number
          prazo_seg?: number
        }
        Update: {
          ativa?: boolean
          atualizado_em?: string
          corretores?: number[] | null
          dias?: string
          dias_semana?: number[]
          hora_fim?: string
          hora_inicio?: string
          id?: number
          intervalo_min?: number
          prazo_seg?: number
        }
        Relationships: []
      }
      presenca_estado: {
        Row: {
          aguardando_desde: string | null
          corretor_id: number
          prazo_em: string | null
          ultima_confirmacao: string | null
        }
        Insert: {
          aguardando_desde?: string | null
          corretor_id: number
          prazo_em?: string | null
          ultima_confirmacao?: string | null
        }
        Update: {
          aguardando_desde?: string | null
          corretor_id?: number
          prazo_em?: string | null
          ultima_confirmacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presenca_estado_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: true
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presenca_estado_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: true
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "presenca_estado_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: true
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
        ]
      }
      produto_favoritos: {
        Row: {
          created_at: string
          empreendimento_id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          empreendimento_id: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          empreendimento_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_favoritos_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_favoritos_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_favoritos_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_empreendimento_resumo"
            referencedColumns: ["empreendimento_id"]
          },
          {
            foreignKeyName: "produto_favoritos_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_produtos_publicos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          criado_em: string
          id: number
          nome: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: never
          nome: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: never
          nome?: string
        }
        Relationships: []
      }
      projeto_anexos: {
        Row: {
          criado_em: string
          criado_por: string | null
          id: string
          mime: string | null
          nome: string
          path: string
          tamanho: number | null
          tarefa_id: string
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          id?: string
          mime?: string | null
          nome: string
          path: string
          tamanho?: number | null
          tarefa_id: string
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          id?: string
          mime?: string | null
          nome?: string
          path?: string
          tamanho?: number | null
          tarefa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_anexos_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "projeto_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_atividades: {
        Row: {
          acao: string
          criado_em: string
          detalhe: string | null
          id: number
          projeto_id: string | null
          tarefa_id: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          criado_em?: string
          detalhe?: string | null
          id?: never
          projeto_id?: string | null
          tarefa_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          criado_em?: string
          detalhe?: string | null
          id?: never
          projeto_id?: string | null
          tarefa_id?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      projeto_colunas: {
        Row: {
          arquivada: boolean
          cor: string | null
          id: string
          limite: number | null
          nome: string
          ordem: number
          projeto_id: string
        }
        Insert: {
          arquivada?: boolean
          cor?: string | null
          id?: string
          limite?: number | null
          nome: string
          ordem?: number
          projeto_id: string
        }
        Update: {
          arquivada?: boolean
          cor?: string | null
          id?: string
          limite?: number | null
          nome?: string
          ordem?: number
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_colunas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_comentarios: {
        Row: {
          criado_em: string
          id: string
          tarefa_id: string
          texto: string
          usuario_id: string | null
        }
        Insert: {
          criado_em?: string
          id?: string
          tarefa_id: string
          texto: string
          usuario_id?: string | null
        }
        Update: {
          criado_em?: string
          id?: string
          tarefa_id?: string
          texto?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_comentarios_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "projeto_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_participantes: {
        Row: {
          projeto_id: string
          usuario_id: string
        }
        Insert: {
          projeto_id: string
          usuario_id: string
        }
        Update: {
          projeto_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_participantes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_tarefas: {
        Row: {
          arquivada: boolean
          atualizado_em: string
          checklist: Json
          coluna_id: string | null
          concluida: boolean
          concluida_em: string | null
          criado_em: string
          criado_por: string | null
          data_inicio: string | null
          descricao: string | null
          etiquetas: Json
          id: string
          ordem: number
          prazo: string | null
          prioridade: string
          projeto_id: string
          responsavel_id: string | null
          titulo: string
          vinculo_id: string | null
          vinculo_rotulo: string | null
          vinculo_tipo: string | null
        }
        Insert: {
          arquivada?: boolean
          atualizado_em?: string
          checklist?: Json
          coluna_id?: string | null
          concluida?: boolean
          concluida_em?: string | null
          criado_em?: string
          criado_por?: string | null
          data_inicio?: string | null
          descricao?: string | null
          etiquetas?: Json
          id?: string
          ordem?: number
          prazo?: string | null
          prioridade?: string
          projeto_id: string
          responsavel_id?: string | null
          titulo: string
          vinculo_id?: string | null
          vinculo_rotulo?: string | null
          vinculo_tipo?: string | null
        }
        Update: {
          arquivada?: boolean
          atualizado_em?: string
          checklist?: Json
          coluna_id?: string | null
          concluida?: boolean
          concluida_em?: string | null
          criado_em?: string
          criado_por?: string | null
          data_inicio?: string | null
          descricao?: string | null
          etiquetas?: Json
          id?: string
          ordem?: number
          prazo?: string | null
          prioridade?: string
          projeto_id?: string
          responsavel_id?: string | null
          titulo?: string
          vinculo_id?: string | null
          vinculo_rotulo?: string | null
          vinculo_tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_tarefas_coluna_id_fkey"
            columns: ["coluna_id"]
            isOneToOne: false
            referencedRelation: "projeto_colunas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_tarefas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          atualizado_em: string
          cor: string | null
          criado_em: string
          criado_por: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          nome: string
          prazo: string | null
          prioridade: string
          responsavel_id: string | null
          setor: string | null
          status: string
          visibilidade: string
        }
        Insert: {
          atualizado_em?: string
          cor?: string | null
          criado_em?: string
          criado_por?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome: string
          prazo?: string | null
          prioridade?: string
          responsavel_id?: string | null
          setor?: string | null
          status?: string
          visibilidade?: string
        }
        Update: {
          atualizado_em?: string
          cor?: string | null
          criado_em?: string
          criado_por?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          prazo?: string | null
          prioridade?: string
          responsavel_id?: string | null
          setor?: string | null
          status?: string
          visibilidade?: string
        }
        Relationships: []
      }
      proprietarios: {
        Row: {
          created_at: string
          created_by: string
          email: string
          id: string
          nome: string
          telefone: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          email: string
          id?: string
          nome: string
          telefone: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string
          id?: string
          nome?: string
          telefone?: string
        }
        Relationships: []
      }
      recebimentos: {
        Row: {
          created_at: string
          data_prevista: string | null
          data_recebimento: string | null
          id: string
          numero_parcela: number
          status: string
          valor_total: number
          venda_id: string
        }
        Insert: {
          created_at?: string
          data_prevista?: string | null
          data_recebimento?: string | null
          id?: string
          numero_parcela: number
          status?: string
          valor_total: number
          venda_id: string
        }
        Update: {
          created_at?: string
          data_prevista?: string | null
          data_recebimento?: string | null
          id?: string
          numero_parcela?: number
          status?: string
          valor_total?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "v_vendas_detalhe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_msg_cache: {
        Row: {
          atualizado_em: string | null
          cliente_ultima: string | null
          env_ultima: string | null
          lead_id: number
          qtd_enviadas: number | null
          qtd_recebidas: number | null
          ultima_interacao: string | null
        }
        Insert: {
          atualizado_em?: string | null
          cliente_ultima?: string | null
          env_ultima?: string | null
          lead_id: number
          qtd_enviadas?: number | null
          qtd_recebidas?: number | null
          ultima_interacao?: string | null
        }
        Update: {
          atualizado_em?: string | null
          cliente_ultima?: string | null
          env_ultima?: string | null
          lead_id?: number
          qtd_enviadas?: number | null
          qtd_recebidas?: number | null
          ultima_interacao?: string | null
        }
        Relationships: []
      }
      sla_regras: {
        Row: {
          amarelo_min: number
          descricao: string | null
          preto_min: number
          situacao: string
          vermelho_min: number
        }
        Insert: {
          amarelo_min: number
          descricao?: string | null
          preto_min: number
          situacao: string
          vermelho_min: number
        }
        Update: {
          amarelo_min?: number
          descricao?: string | null
          preto_min?: number
          situacao?: string
          vermelho_min?: number
        }
        Relationships: []
      }
      unidades: {
        Row: {
          acesso_codigo: string | null
          acesso_instrucoes: string | null
          acesso_tipo: string | null
          aprovacao: string
          area_m2: number | null
          captador_corretor_id: number | null
          de_terceiros: boolean
          disponivel: boolean
          empreendimento_id: string
          enquadramento: string | null
          id: string
          numero: string | null
          obs: string | null
          proprietario_contato: string | null
          proprietario_nome: string | null
          reprovacao_motivo: string | null
          tipologia: string | null
          vagas: number | null
          valor_m2: number | null
          valor_promo: number | null
          valor_tabela: number | null
        }
        Insert: {
          acesso_codigo?: string | null
          acesso_instrucoes?: string | null
          acesso_tipo?: string | null
          aprovacao?: string
          area_m2?: number | null
          captador_corretor_id?: number | null
          de_terceiros?: boolean
          disponivel?: boolean
          empreendimento_id: string
          enquadramento?: string | null
          id?: string
          numero?: string | null
          obs?: string | null
          proprietario_contato?: string | null
          proprietario_nome?: string | null
          reprovacao_motivo?: string | null
          tipologia?: string | null
          vagas?: number | null
          valor_m2?: number | null
          valor_promo?: number | null
          valor_tabela?: number | null
        }
        Update: {
          acesso_codigo?: string | null
          acesso_instrucoes?: string | null
          acesso_tipo?: string | null
          aprovacao?: string
          area_m2?: number | null
          captador_corretor_id?: number | null
          de_terceiros?: boolean
          disponivel?: boolean
          empreendimento_id?: string
          enquadramento?: string | null
          id?: string
          numero?: string | null
          obs?: string | null
          proprietario_contato?: string | null
          proprietario_nome?: string | null
          reprovacao_motivo?: string | null
          tipologia?: string | null
          vagas?: number | null
          valor_m2?: number | null
          valor_promo?: number | null
          valor_tabela?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "unidades_captador_corretor_id_fkey"
            columns: ["captador_corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidades_captador_corretor_id_fkey"
            columns: ["captador_corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "unidades_captador_corretor_id_fkey"
            columns: ["captador_corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "unidades_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidades_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidades_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_empreendimento_resumo"
            referencedColumns: ["empreendimento_id"]
          },
          {
            foreignKeyName: "unidades_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_produtos_publicos"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario_dados_bancarios: {
        Row: {
          agencia: string | null
          atualizado_em: string
          banco_codigo: string | null
          banco_nome: string | null
          conta: string | null
          conta_tipo: string | null
          pix_chave: string | null
          pix_tipo: string | null
          titular_cpf: string | null
          titular_nome: string | null
          usuario_id: string
        }
        Insert: {
          agencia?: string | null
          atualizado_em?: string
          banco_codigo?: string | null
          banco_nome?: string | null
          conta?: string | null
          conta_tipo?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          titular_cpf?: string | null
          titular_nome?: string | null
          usuario_id: string
        }
        Update: {
          agencia?: string | null
          atualizado_em?: string
          banco_codigo?: string | null
          banco_nome?: string | null
          conta?: string | null
          conta_tipo?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          titular_cpf?: string | null
          titular_nome?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_dados_bancarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_dados_bancarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "v_painel_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "usuario_dados_bancarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "v_painel_socio"
            referencedColumns: ["socio_id"]
          },
          {
            foreignKeyName: "usuario_dados_bancarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "vw_ranking_vgv"
            referencedColumns: ["corretor_id"]
          },
        ]
      }
      usuarios: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_logradouro: string | null
          endereco_numero: string | null
          endereco_uf: string | null
          id: string
          nome: string
          permissoes: Json | null
          role: Database["public"]["Enums"]["user_role"]
          superior_id: string | null
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          id: string
          nome: string
          permissoes?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          superior_id?: string | null
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          id?: string
          nome?: string
          permissoes?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          superior_id?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_superior_id_fkey"
            columns: ["superior_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_superior_id_fkey"
            columns: ["superior_id"]
            isOneToOne: false
            referencedRelation: "v_painel_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "usuarios_superior_id_fkey"
            columns: ["superior_id"]
            isOneToOne: false
            referencedRelation: "v_painel_socio"
            referencedColumns: ["socio_id"]
          },
          {
            foreignKeyName: "usuarios_superior_id_fkey"
            columns: ["superior_id"]
            isOneToOne: false
            referencedRelation: "vw_ranking_vgv"
            referencedColumns: ["corretor_id"]
          },
        ]
      }
      venda_comissao: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          forma_pgto: string | null
          imobiliaria: string | null
          participantes: Json
          percentual_total: number | null
          processo_ref: string
          valor_total: number | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          forma_pgto?: string | null
          imobiliaria?: string | null
          participantes?: Json
          percentual_total?: number | null
          processo_ref: string
          valor_total?: number | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          forma_pgto?: string | null
          imobiliaria?: string | null
          participantes?: Json
          percentual_total?: number | null
          processo_ref?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "venda_comissao_processo_ref_fkey"
            columns: ["processo_ref"]
            isOneToOne: true
            referencedRelation: "venda_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_comissao_parcelas: {
        Row: {
          data_efetiva: string | null
          data_prevista: string | null
          gatilho: string | null
          id: string
          ordem: number
          processo_ref: string
          responsavel: string | null
          status: string
          valor: number | null
        }
        Insert: {
          data_efetiva?: string | null
          data_prevista?: string | null
          gatilho?: string | null
          id?: string
          ordem?: number
          processo_ref: string
          responsavel?: string | null
          status?: string
          valor?: number | null
        }
        Update: {
          data_efetiva?: string | null
          data_prevista?: string | null
          gatilho?: string | null
          id?: string
          ordem?: number
          processo_ref?: string
          responsavel?: string | null
          status?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "venda_comissao_parcelas_processo_ref_fkey"
            columns: ["processo_ref"]
            isOneToOne: false
            referencedRelation: "venda_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_condicoes: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          comprador_tem_conjuge: boolean
          data_assinatura: string | null
          data_conclusao: string | null
          data_entrada: string | null
          origem_recursos: Json
          processo_ref: string
          qtd_parcelas: number | null
          valor_assinatura: number | null
          valor_chaves: number | null
          valor_entrada: number | null
          valor_fgts: number | null
          valor_financiado: number | null
          valor_parcela: number | null
          valor_parcelas_interm: number | null
          valor_recursos_proprios: number | null
          valor_total: number | null
          vendedor_tem_conjuge: boolean
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          comprador_tem_conjuge?: boolean
          data_assinatura?: string | null
          data_conclusao?: string | null
          data_entrada?: string | null
          origem_recursos?: Json
          processo_ref: string
          qtd_parcelas?: number | null
          valor_assinatura?: number | null
          valor_chaves?: number | null
          valor_entrada?: number | null
          valor_fgts?: number | null
          valor_financiado?: number | null
          valor_parcela?: number | null
          valor_parcelas_interm?: number | null
          valor_recursos_proprios?: number | null
          valor_total?: number | null
          vendedor_tem_conjuge?: boolean
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          comprador_tem_conjuge?: boolean
          data_assinatura?: string | null
          data_conclusao?: string | null
          data_entrada?: string | null
          origem_recursos?: Json
          processo_ref?: string
          qtd_parcelas?: number | null
          valor_assinatura?: number | null
          valor_chaves?: number | null
          valor_entrada?: number | null
          valor_fgts?: number | null
          valor_financiado?: number | null
          valor_parcela?: number | null
          valor_parcelas_interm?: number | null
          valor_recursos_proprios?: number | null
          valor_total?: number | null
          vendedor_tem_conjuge?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "venda_condicoes_processo_ref_fkey"
            columns: ["processo_ref"]
            isOneToOne: true
            referencedRelation: "venda_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_corretores: {
        Row: {
          corretor_id: string | null
          corretor_nome: string | null
          eh_indicador: boolean
          fracao: number
          id: string
          venda_id: string
        }
        Insert: {
          corretor_id?: string | null
          corretor_nome?: string | null
          eh_indicador?: boolean
          fracao?: number
          id?: string
          venda_id: string
        }
        Update: {
          corretor_id?: string | null
          corretor_nome?: string | null
          eh_indicador?: boolean
          fracao?: number
          id?: string
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_corretores_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_corretores_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "v_painel_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "venda_corretores_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "v_painel_socio"
            referencedColumns: ["socio_id"]
          },
          {
            foreignKeyName: "venda_corretores_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_ranking_vgv"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "venda_corretores_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "v_vendas_detalhe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_corretores_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_observacoes: {
        Row: {
          autor: string | null
          autor_nome: string | null
          criado_em: string
          id: string
          processo_ref: string
          texto: string
        }
        Insert: {
          autor?: string | null
          autor_nome?: string | null
          criado_em?: string
          id?: string
          processo_ref: string
          texto: string
        }
        Update: {
          autor?: string | null
          autor_nome?: string | null
          criado_em?: string
          id?: string
          processo_ref?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_observacoes_processo_ref_fkey"
            columns: ["processo_ref"]
            isOneToOne: false
            referencedRelation: "venda_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_processo_historico: {
        Row: {
          etapa_de: string | null
          etapa_para: string
          id: string
          movido_em: string
          movido_por: string | null
          processo_id: string
          venda_id: string | null
        }
        Insert: {
          etapa_de?: string | null
          etapa_para: string
          id?: string
          movido_em?: string
          movido_por?: string | null
          processo_id: string
          venda_id?: string | null
        }
        Update: {
          etapa_de?: string | null
          etapa_para?: string
          id?: string
          movido_em?: string
          movido_por?: string | null
          processo_id?: string
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venda_processo_historico_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "venda_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_processos: {
        Row: {
          aprovacao_motivo: string | null
          aprovacao_status: string
          aprovado_em: string | null
          aprovado_por: string | null
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          etapa: string
          id: string
          negocio_id: number | null
          observacoes: string | null
          prazo_em: string | null
          responsavel_usuario_id: string | null
          solicitado_por: string | null
          tipo_venda: string
          venda_id: string
        }
        Insert: {
          aprovacao_motivo?: string | null
          aprovacao_status?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          etapa?: string
          id?: string
          negocio_id?: number | null
          observacoes?: string | null
          prazo_em?: string | null
          responsavel_usuario_id?: string | null
          solicitado_por?: string | null
          tipo_venda?: string
          venda_id: string
        }
        Update: {
          aprovacao_motivo?: string | null
          aprovacao_status?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          etapa?: string
          id?: string
          negocio_id?: number | null
          observacoes?: string | null
          prazo_em?: string | null
          responsavel_usuario_id?: string | null
          solicitado_por?: string | null
          tipo_venda?: string
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_processos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_processos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_erp_cards"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "venda_processos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_erros_envio"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "venda_processos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_escalonamento"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "venda_processos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "venda_processos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_sla_leads"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "venda_processos_responsavel_usuario_id_fkey"
            columns: ["responsavel_usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_processos_responsavel_usuario_id_fkey"
            columns: ["responsavel_usuario_id"]
            isOneToOne: false
            referencedRelation: "v_painel_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "venda_processos_responsavel_usuario_id_fkey"
            columns: ["responsavel_usuario_id"]
            isOneToOne: false
            referencedRelation: "v_painel_socio"
            referencedColumns: ["socio_id"]
          },
          {
            foreignKeyName: "venda_processos_responsavel_usuario_id_fkey"
            columns: ["responsavel_usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_ranking_vgv"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "venda_processos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: true
            referencedRelation: "v_vendas_detalhe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_processos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: true
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_solicitacoes: {
        Row: {
          corretor_id: number | null
          criado_em: string
          decidido_em: string | null
          decidido_por: string | null
          forma_pgto: string | null
          id: string
          motivo_recusa: string | null
          negocio_id: number | null
          obs: string | null
          produto_id: string | null
          solicitado_por: string | null
          status: string
          venda_id: string | null
          vgv: number | null
        }
        Insert: {
          corretor_id?: number | null
          criado_em?: string
          decidido_em?: string | null
          decidido_por?: string | null
          forma_pgto?: string | null
          id?: string
          motivo_recusa?: string | null
          negocio_id?: number | null
          obs?: string | null
          produto_id?: string | null
          solicitado_por?: string | null
          status?: string
          venda_id?: string | null
          vgv?: number | null
        }
        Update: {
          corretor_id?: number | null
          criado_em?: string
          decidido_em?: string | null
          decidido_por?: string | null
          forma_pgto?: string | null
          id?: string
          motivo_recusa?: string | null
          negocio_id?: number | null
          obs?: string | null
          produto_id?: string | null
          solicitado_por?: string | null
          status?: string
          venda_id?: string | null
          vgv?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "venda_solicitacoes_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_solicitacoes_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_erp_cards"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "venda_solicitacoes_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_erros_envio"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "venda_solicitacoes_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_escalonamento"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "venda_solicitacoes_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "venda_solicitacoes_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_sla_leads"
            referencedColumns: ["negocio_id"]
          },
        ]
      }
      vendas: {
        Row: {
          cliente_nome: string | null
          corretor_id: number | null
          created_at: string
          custos: number
          data_venda: string
          documentos: Json
          empreendimento_id: string | null
          empreendimento_nome: string | null
          forma_pgto: string | null
          id: string
          obs: string | null
          percentual_comissao: number | null
          proprietario_nome: string | null
          status: Database["public"]["Enums"]["status_venda"]
          unidade_id: string | null
          unidade_rotulo: string | null
          vgv: number
        }
        Insert: {
          cliente_nome?: string | null
          corretor_id?: number | null
          created_at?: string
          custos?: number
          data_venda: string
          documentos?: Json
          empreendimento_id?: string | null
          empreendimento_nome?: string | null
          forma_pgto?: string | null
          id?: string
          obs?: string | null
          percentual_comissao?: number | null
          proprietario_nome?: string | null
          status?: Database["public"]["Enums"]["status_venda"]
          unidade_id?: string | null
          unidade_rotulo?: string | null
          vgv: number
        }
        Update: {
          cliente_nome?: string | null
          corretor_id?: number | null
          created_at?: string
          custos?: number
          data_venda?: string
          documentos?: Json
          empreendimento_id?: string | null
          empreendimento_nome?: string | null
          forma_pgto?: string | null
          id?: string
          obs?: string | null
          percentual_comissao?: number | null
          proprietario_nome?: string | null
          status?: Database["public"]["Enums"]["status_venda"]
          unidade_id?: string | null
          unidade_rotulo?: string | null
          vgv?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendas_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_empreendimento_resumo"
            referencedColumns: ["empreendimento_id"]
          },
          {
            foreignKeyName: "vendas_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_produtos_publicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      visitas: {
        Row: {
          atualizado_em: string
          cliente_nome: string | null
          com_gerente: boolean
          corretor_id: number | null
          created_by: string | null
          criado_em: string
          data: string
          dc_lead_id: string | null
          dc_negocio_id: string | null
          empreendimento_id: string | null
          gerente_id: number | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          lead_id: number | null
          lembrete: boolean
          local: string | null
          motivo_cancelamento: string | null
          negocio_id: number | null
          observacoes: string | null
          participantes: string | null
          produto: string | null
          status: string
          unidade: string | null
        }
        Insert: {
          atualizado_em?: string
          cliente_nome?: string | null
          com_gerente?: boolean
          corretor_id?: number | null
          created_by?: string | null
          criado_em?: string
          data: string
          dc_lead_id?: string | null
          dc_negocio_id?: string | null
          empreendimento_id?: string | null
          gerente_id?: number | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          lead_id?: number | null
          lembrete?: boolean
          local?: string | null
          motivo_cancelamento?: string | null
          negocio_id?: number | null
          observacoes?: string | null
          participantes?: string | null
          produto?: string | null
          status?: string
          unidade?: string | null
        }
        Update: {
          atualizado_em?: string
          cliente_nome?: string | null
          com_gerente?: boolean
          corretor_id?: number | null
          created_by?: string | null
          criado_em?: string
          data?: string
          dc_lead_id?: string | null
          dc_negocio_id?: string | null
          empreendimento_id?: string | null
          gerente_id?: number | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          lead_id?: number | null
          lembrete?: boolean
          local?: string | null
          motivo_cancelamento?: string | null
          negocio_id?: number | null
          observacoes?: string | null
          participantes?: string | null
          produto?: string | null
          status?: string
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "visitas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "visitas_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_empreendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_empreendimento_resumo"
            referencedColumns: ["empreendimento_id"]
          },
          {
            foreignKeyName: "visitas_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_produtos_publicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "gerentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_erros_envio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "visitas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "visitas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_erp_cards"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "visitas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_erros_envio"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "visitas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_escalonamento"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "visitas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["negocio_id"]
          },
          {
            foreignKeyName: "visitas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "vw_sla_leads"
            referencedColumns: ["negocio_id"]
          },
        ]
      }
      visitas_gerente_backup_20260721: {
        Row: {
          backup_em: string | null
          gerente_id: number | null
          id: string | null
        }
        Insert: {
          backup_em?: string | null
          gerente_id?: number | null
          id?: string | null
        }
        Update: {
          backup_em?: string | null
          gerente_id?: number | null
          id?: string | null
        }
        Relationships: []
      }
      wa_automacao_fila: {
        Row: {
          conversa_id: string | null
          criado_em: string
          id: number
          instancia_id: string | null
          mensagem_id: string | null
          payload: Json | null
          status: string
          tentativas: number
          tipo_gatilho: string
        }
        Insert: {
          conversa_id?: string | null
          criado_em?: string
          id?: number
          instancia_id?: string | null
          mensagem_id?: string | null
          payload?: Json | null
          status?: string
          tentativas?: number
          tipo_gatilho?: string
        }
        Update: {
          conversa_id?: string | null
          criado_em?: string
          id?: number
          instancia_id?: string | null
          mensagem_id?: string | null
          payload?: Json | null
          status?: string
          tentativas?: number
          tipo_gatilho?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_automacao_fila_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "wa_mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_backfill_log: {
        Row: {
          achou: boolean | null
          detalhe: string | null
          lead_id: number
          salvas: number | null
          tentado_em: string
        }
        Insert: {
          achou?: boolean | null
          detalhe?: string | null
          lead_id: number
          salvas?: number | null
          tentado_em?: string
        }
        Update: {
          achou?: boolean | null
          detalhe?: string | null
          lead_id?: number
          salvas?: number | null
          tentado_em?: string
        }
        Relationships: []
      }
      wa_contatos: {
        Row: {
          criado_em: string
          id: string
          jid: string | null
          lead_id: number | null
          nome: string | null
          telefone: string
        }
        Insert: {
          criado_em?: string
          id?: string
          jid?: string | null
          lead_id?: number | null
          nome?: string | null
          telefone: string
        }
        Update: {
          criado_em?: string
          id?: string
          jid?: string | null
          lead_id?: number | null
          nome?: string | null
          telefone?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_contatos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_contatos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_erros_envio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "wa_contatos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      wa_conversas: {
        Row: {
          ad_ctwa_clid: string | null
          ad_source_id: string | null
          contato_id: string
          criado_em: string
          id: string
          instancia_id: string
          origem: string | null
          status: string
          ultima_msg_em: string | null
        }
        Insert: {
          ad_ctwa_clid?: string | null
          ad_source_id?: string | null
          contato_id: string
          criado_em?: string
          id?: string
          instancia_id: string
          origem?: string | null
          status?: string
          ultima_msg_em?: string | null
        }
        Update: {
          ad_ctwa_clid?: string | null
          ad_source_id?: string | null
          contato_id?: string
          criado_em?: string
          id?: string
          instancia_id?: string
          origem?: string | null
          status?: string
          ultima_msg_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_conversas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "wa_contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_conversas_instancia_id_fkey"
            columns: ["instancia_id"]
            isOneToOne: false
            referencedRelation: "wa_instancias"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_eventos: {
        Row: {
          erro: string | null
          evento: string | null
          id: number
          payload: Json
          processado: boolean
          recebido_em: string
          session_id: string | null
          trace_id: string | null
        }
        Insert: {
          erro?: string | null
          evento?: string | null
          id?: number
          payload: Json
          processado?: boolean
          recebido_em?: string
          session_id?: string | null
          trace_id?: string | null
        }
        Update: {
          erro?: string | null
          evento?: string | null
          id?: number
          payload?: Json
          processado?: boolean
          recebido_em?: string
          session_id?: string | null
          trace_id?: string | null
        }
        Relationships: []
      }
      wa_instancias: {
        Row: {
          atualizado_em: string
          corretor_id: number
          criado_em: string
          id: string
          rotulo: string | null
          session_id: string
          status: string
          telefone: string | null
          ultimo_heartbeat: string | null
        }
        Insert: {
          atualizado_em?: string
          corretor_id: number
          criado_em?: string
          id?: string
          rotulo?: string | null
          session_id: string
          status?: string
          telefone?: string | null
          ultimo_heartbeat?: string | null
        }
        Update: {
          atualizado_em?: string
          corretor_id?: number
          criado_em?: string
          id?: string
          rotulo?: string | null
          session_id?: string
          status?: string
          telefone?: string | null
          ultimo_heartbeat?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_instancias_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_instancias_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "wa_instancias_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
        ]
      }
      wa_mensagens: {
        Row: {
          conteudo: string | null
          conversa_id: string
          criado_em: string
          direcao: string
          enviado_em: string | null
          id: string
          instancia_id: string
          is_grupo: boolean
          media_url: string | null
          raw: Json
          respondendo_wa_id: string | null
          status: string | null
          status_detalhe: string | null
          status_em: string | null
          tipo: string
          transcricao: string | null
          transcrito_em: string | null
          wa_message_id: string
        }
        Insert: {
          conteudo?: string | null
          conversa_id: string
          criado_em?: string
          direcao: string
          enviado_em?: string | null
          id?: string
          instancia_id: string
          is_grupo?: boolean
          media_url?: string | null
          raw: Json
          respondendo_wa_id?: string | null
          status?: string | null
          status_detalhe?: string | null
          status_em?: string | null
          tipo: string
          transcricao?: string | null
          transcrito_em?: string | null
          wa_message_id: string
        }
        Update: {
          conteudo?: string | null
          conversa_id?: string
          criado_em?: string
          direcao?: string
          enviado_em?: string | null
          id?: string
          instancia_id?: string
          is_grupo?: boolean
          media_url?: string | null
          raw?: Json
          respondendo_wa_id?: string | null
          status?: string | null
          status_detalhe?: string | null
          status_em?: string | null
          tipo?: string
          transcricao?: string | null
          transcrito_em?: string | null
          wa_message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "wa_conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_mensagens_instancia_id_fkey"
            columns: ["instancia_id"]
            isOneToOne: false
            referencedRelation: "wa_instancias"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_mensagens_ocultas: {
        Row: {
          criado_em: string
          lead_id: number | null
          ocultado_por: string | null
          wa_message_id: string
        }
        Insert: {
          criado_em?: string
          lead_id?: number | null
          ocultado_por?: string | null
          wa_message_id: string
        }
        Update: {
          criado_em?: string
          lead_id?: number | null
          ocultado_por?: string | null
          wa_message_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_balanco_caixa: {
        Row: {
          aporte_socios: number | null
          efeito_capital: number | null
          entradas_operacionais: number | null
          resultado_operacional: number | null
          retirada_socios: number | null
          saidas_operacionais: number | null
          saldo_final: number | null
          saldo_inicial: number | null
        }
        Relationships: []
      }
      v_caixa_mensal: {
        Row: {
          aportes: number | null
          entradas: number | null
          mes: string | null
          resultado_operacional: number | null
          retiradas: number | null
          saidas: number | null
          saldo_acumulado: number | null
          variacao_caixa: number | null
        }
        Relationships: []
      }
      v_catalogo_empreendimentos: {
        Row: {
          bairro: string | null
          endereco: string | null
          entrega: string | null
          id: string | null
          incorporadora: string | null
          maior_preco: number | null
          menor_preco: number | null
          nome: string | null
          status: Database["public"]["Enums"]["status_empreend"] | null
          tipologias: string[] | null
          total_unidades: number | null
          unidades_disponiveis: number | null
        }
        Relationships: []
      }
      v_dre_mensal: {
        Row: {
          categoria: string | null
          mes: string | null
          tipo: Database["public"]["Enums"]["tipo_caixa"] | null
          total: number | null
        }
        Relationships: []
      }
      v_ganhos_executivo: {
        Row: {
          comissao_id: string | null
          data_venda: string | null
          empreendimento: string | null
          executivo_id: string | null
          ganho: number | null
          ganho_previsto: number | null
          ganho_recebido: number | null
          situacao: string | null
          status_venda: Database["public"]["Enums"]["status_venda"] | null
          unidade: string | null
          venda_id: string | null
          vgv: number | null
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_beneficiario_id_fkey"
            columns: ["executivo_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_beneficiario_id_fkey"
            columns: ["executivo_id"]
            isOneToOne: false
            referencedRelation: "v_painel_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "comissoes_beneficiario_id_fkey"
            columns: ["executivo_id"]
            isOneToOne: false
            referencedRelation: "v_painel_socio"
            referencedColumns: ["socio_id"]
          },
          {
            foreignKeyName: "comissoes_beneficiario_id_fkey"
            columns: ["executivo_id"]
            isOneToOne: false
            referencedRelation: "vw_ranking_vgv"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "comissoes_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "v_vendas_detalhe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_painel_corretor: {
        Row: {
          comissao_paga: number | null
          comissao_prevista: number | null
          comissao_total: number | null
          corretor: string | null
          corretor_id: string | null
          indicacoes: number | null
          vendas: number | null
          vgv_rateado: number | null
        }
        Relationships: []
      }
      v_painel_socio: {
        Row: {
          aportes: number | null
          comissao_executivo: number | null
          retiradas: number | null
          socio: string | null
          socio_id: string | null
        }
        Insert: {
          aportes?: never
          comissao_executivo?: never
          retiradas?: never
          socio?: string | null
          socio_id?: string | null
        }
        Update: {
          aportes?: never
          comissao_executivo?: never
          retiradas?: never
          socio?: string | null
          socio_id?: string | null
        }
        Relationships: []
      }
      v_vendas_detalhe: {
        Row: {
          bairro: string | null
          comissao_apecerto: number | null
          comissao_bruta: number | null
          comissao_corretores: number | null
          comissao_executivo: number | null
          corretores: string | null
          data_venda: string | null
          empreendimento: string | null
          forma_pgto: string | null
          id: string | null
          incorporadora: string | null
          indicacao: number | null
          mes: string | null
          obs: string | null
          percentual_comissao: number | null
          status: Database["public"]["Enums"]["status_venda"] | null
          unidade: string | null
          vgv: number | null
        }
        Relationships: []
      }
      vw_empreendimento_resumo: {
        Row: {
          area_max: number | null
          area_min: number | null
          empreendimento_id: string | null
          preco_max: number | null
          preco_min: number | null
          tipologias: string[] | null
          unidades_disponiveis: number | null
        }
        Relationships: []
      }
      vw_erp_cards: {
        Row: {
          corretor: string | null
          fonte: string | null
          negocio_id: number | null
          nome: string | null
          pipeline_id: number | null
          stage_id: number | null
          tags: Json | null
          tel: string | null
          ultima_mov: string | null
          valor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "negocios_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "vw_erp_kanban_resumo"
            referencedColumns: ["stage_id"]
          },
        ]
      }
      vw_erp_kanban_resumo: {
        Row: {
          cor: string | null
          etapa: string | null
          ordem_etapa: number | null
          pipeline: string | null
          pipeline_id: number | null
          stage_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_erros_envio: {
        Row: {
          corretor: string | null
          criado_em: string | null
          lead_id: number | null
          lead_nome: string | null
          lead_telefone: string | null
          motivo: string | null
          negocio_id: number | null
          tentativas: number | null
        }
        Relationships: []
      }
      vw_escalonamento: {
        Row: {
          cliente: string | null
          cor_ativa: string | null
          corretor: string | null
          etapa: string | null
          lead_id: number | null
          minutos: number | null
          negocio_id: number | null
          sla_situacao: string | null
          telefone: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negocios_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_erros_envio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "negocios_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      vw_metricas_automacao: {
        Row: {
          distribuidos_hoje: number | null
          em_erro: number | null
          em_lead_novo: number | null
          msgs_erro_hoje: number | null
          msgs_ok_hoje: number | null
          presos_lead_novo_3h: number | null
        }
        Relationships: []
      }
      vw_metricas_corretor: {
        Row: {
          aguardando_resposta: number | null
          corretor: string | null
          corretor_id: number | null
          em_agendamento: number | null
          em_alarme: number | null
          em_atendimento: number | null
          leads_ativos: number | null
          parados_24h: number | null
          parados_48h: number | null
          parados_72h: number | null
          pior_espera_min: number | null
          tarefas_vencidas: number | null
        }
        Relationships: []
      }
      vw_negocios_kanban: {
        Row: {
          corretor_id: number | null
          corretor_nome: string | null
          criado_em: string | null
          lead_id: number | null
          lead_nome: string | null
          lead_origem: string | null
          lead_telefone: string | null
          motivo_perda: string | null
          negocio_id: number | null
          pipeline_id: number | null
          pipeline_nome: string | null
          stage_cor: string | null
          stage_id: number | null
          stage_nome: string | null
          stage_ordem: number | null
          stage_tipo: string | null
          status: string | null
          ultima_movimentacao: string | null
          valor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "negocios_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "vw_erp_kanban_resumo"
            referencedColumns: ["stage_id"]
          },
        ]
      }
      vw_notificacoes: {
        Row: {
          ago: string | null
          icon: string | null
          sub: string | null
          titulo: string | null
          ts: string | null
        }
        Relationships: []
      }
      vw_produtos_publicos: {
        Row: {
          area_max: number | null
          area_min: number | null
          bairro: string | null
          capa_path: string | null
          descricao: string | null
          destaque: boolean | null
          diferenciais: string[] | null
          endereco: string | null
          entrega: string | null
          id: string | null
          incorporadora: string | null
          latitude: number | null
          lazer: string[] | null
          link_maps: string | null
          longitude: number | null
          nome: string | null
          ordem: number | null
          preco_max: number | null
          preco_min: number | null
          published_at: string | null
          slogan: string | null
          slug: string | null
          status: Database["public"]["Enums"]["status_empreend"] | null
          tipologias: string[] | null
          unidades_disponiveis: number | null
        }
        Relationships: []
      }
      vw_ranking_vgv: {
        Row: {
          corretor: string | null
          corretor_id: string | null
          vendas: number | null
          vgv: number | null
        }
        Relationships: []
      }
      vw_sla_leads: {
        Row: {
          aguardando_humano: boolean | null
          alarme_ativo: boolean | null
          cliente: string | null
          cliente_ultima: string | null
          cor_ativa: string | null
          corretor: string | null
          corretor_id: number | null
          estagio_desde: string | null
          etapa: string | null
          etapa_alarme: boolean | null
          etapa_chave: string | null
          grupo: number | null
          humano_ultima: string | null
          lead_id: number | null
          max_tentativas: number | null
          min_aguardando: number | null
          min_ativo: number | null
          min_ativo_int: number | null
          min_no_estagio: number | null
          min_sem_interacao: number | null
          min_tarefa_atraso: number | null
          negocio_id: number | null
          prox_venc: string | null
          qtd_enviadas: number | null
          qtd_recebidas: number | null
          sla_situacao: string | null
          stage_id: number | null
          telefone: string | null
          tentativa: number | null
          ultima_interacao: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negocios_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_corretor"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "negocios_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["corretor_id"]
          },
          {
            foreignKeyName: "negocios_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_erros_envio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "negocios_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_negocios_kanban"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "negocios_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "vw_erp_kanban_resumo"
            referencedColumns: ["stage_id"]
          },
        ]
      }
    }
    Functions: {
      _stage_aguardando: { Args: { p_stage: number }; Returns: boolean }
      aceitar_transferencia: { Args: { p_negocio: number }; Returns: Json }
      admin_dashboard_financeiro: { Args: never; Returns: Json }
      admin_dashboard_rodagem: { Args: never; Returns: Json }
      agenda_link_regenerar: { Args: never; Returns: string }
      agenda_link_token: { Args: never; Returns: string }
      agenda_publica: {
        Args: { p_ate?: string; p_de?: string; p_token: string }
        Returns: Json
      }
      agendar_mensagem: {
        Args: {
          p_corretor_nome?: string
          p_file_name?: string
          p_instancia_id?: number
          p_lead_id?: number
          p_mimetype?: string
          p_quando: string
          p_telefone: string
          p_texto?: string
          p_tipo?: string
          p_url?: string
        }
        Returns: Json
      }
      aprovar_descarte: { Args: { p_negocio: number }; Returns: Json }
      aprovar_empreendimento: {
        Args: { p_aprovar: boolean; p_id: string; p_motivo?: string }
        Returns: Json
      }
      aprovar_solicitacao: { Args: { p_id: string }; Returns: Json }
      aquario_importar: { Args: { p_rows: Json }; Returns: Json }
      aquario_pescar: { Args: never; Returns: Json }
      aquario_stage_id: { Args: never; Returns: number }
      aquario_status: { Args: never; Returns: Json }
      atualizar_meu_perfil: {
        Args: {
          p_creci?: string
          p_endereco_bairro?: string
          p_endereco_cep?: string
          p_endereco_cidade?: string
          p_endereco_complemento?: string
          p_endereco_logradouro?: string
          p_endereco_numero?: string
          p_endereco_uf?: string
          p_foto_path?: string
          p_nome?: string
          p_notif_leads?: boolean
          p_notif_mensagens?: boolean
          p_notif_som?: boolean
          p_online?: boolean
          p_telefone?: string
        }
        Returns: Json
      }
      atualizar_momento_lead: {
        Args: {
          p_lead_id: number
          p_momento: string
          p_negocio_id: number
          p_observacao?: string
          p_proxima_acao?: string
          p_proxima_acao_em?: string
          p_resultado?: string
          p_temperatura?: string
        }
        Returns: Json
      }
      atualizar_momento_lead_interno_inteligente: {
        Args: {
          p_lead_id: number
          p_momento: string
          p_negocio_id: number
          p_observacao?: string
          p_proxima_acao?: string
          p_proxima_acao_em?: string
          p_resultado?: string
          p_temperatura?: string
        }
        Returns: Json
      }
      automacao_tags: { Args: never; Returns: string[] }
      calc_comissao: {
        Args: {
          p_custos: number
          p_pct: number
          p_tem_indicador: boolean
          p_tier_taxa: number
          p_vgv: number
        }
        Returns: Json
      }
      can_manage_all: { Args: never; Returns: boolean }
      classificar_caixa: {
        Args: {
          p_descricao: string
          p_tipo: Database["public"]["Enums"]["tipo_caixa"]
        }
        Returns: string
      }
      corretor_elegivel: {
        Args: {
          p_no_esc: boolean
          p_online: boolean
          p_presente_data: string
          p_ultima: string
        }
        Returns: boolean
      }
      corretor_gerente: { Args: { p_corretor: number }; Returns: number }
      corretor_pode_receber: { Args: { p_id: number }; Returns: boolean }
      criar_disparo: {
        Args: {
          p_dias?: string
          p_dry_run?: boolean
          p_hora_fim?: string
          p_hora_ini?: string
          p_instancia_id?: number
          p_msg: string
          p_tag?: string
          p_velocidade?: string
        }
        Returns: Json
      }
      crm_etapa_excluir: { Args: { p_id: number }; Returns: undefined }
      crm_etapa_reordenar: {
        Args: { p_ids: number[]; p_pipeline_id: number }
        Returns: undefined
      }
      crm_etapa_salvar: {
        Args: {
          p_cor?: string
          p_id?: number
          p_nome?: string
          p_pipeline_id?: number
        }
        Returns: number
      }
      crm_funil_excluir: {
        Args: { p_destino_id?: number; p_id: number }
        Returns: undefined
      }
      crm_funil_salvar: {
        Args: { p_empreendimento_id?: string; p_id?: number; p_nome?: string }
        Returns: number
      }
      current_broker_id: { Args: never; Returns: number }
      dapi_backfill_historico: { Args: { p_dias?: number }; Returns: Json }
      dapi_habilitar_eventos: { Args: never; Returns: Json }
      dapi_listar_sessoes: {
        Args: never
        Returns: {
          apikey_fim: string
          session_id: string
          status: string
        }[]
      }
      dapi_manutencao: { Args: never; Returns: undefined }
      dapi_set_webhook_all: {
        Args: never
        Returns: {
          ok: boolean
          session_id: string
          status: number
        }[]
      }
      dapi_sync_instancias: {
        Args: never
        Returns: {
          acao: string
          session_id: string
          status_dapi: string
        }[]
      }
      dashboard_kpis: { Args: never; Returns: Json }
      dc_cursor_get: { Args: never; Returns: Json }
      dc_cursor_set: {
        Args: {
          p_consec: number
          p_count: number
          p_cutoff: string
          p_done: boolean
          p_skip: number
        }
        Returns: undefined
      }
      dc_registrar_movimentacao: {
        Args: { p_payload: Json; p_secret: string }
        Returns: Json
      }
      dc_stage_upsert: { Args: { p_rows: Json }; Returns: number }
      distribuicao_config_ler: { Args: never; Returns: Json }
      distribuicao_config_salvar: {
        Args: {
          p_failover_envio: boolean
          p_failover_transfere_lead: boolean
          p_fds_exige_presencas: number
          p_janela_fim: string
          p_janela_inicio: string
          p_modo_fora_janela: string
          p_modo_rodizio?: string
          p_receber_ate: string
          p_resgate_orfaos: boolean
        }
        Returns: undefined
      }
      distribuicao_saude: { Args: never; Returns: Json }
      distribuir_leads_orfaos: { Args: never; Returns: number }
      enviar_abordagem_lead: { Args: { p_lead: number }; Returns: Json }
      erp_config_atual: { Args: never; Returns: Json }
      erp_salvar_ips: { Args: { p_ips: string[] }; Returns: undefined }
      erp_settings_salvar: {
        Args: { p_chave: string; p_valor: Json }
        Returns: undefined
      }
      erp_toggle_distribuicao: {
        Args: { p_pausada: boolean }
        Returns: undefined
      }
      excluir_instancia: { Args: { p_id: number }; Returns: Json }
      fmt_brl_compact: { Args: { v: number }; Returns: string }
      gerar_comissoes: { Args: { p_venda: string }; Returns: Json }
      gerente_conflitos: {
        Args: {
          p_data: string
          p_exclude?: string
          p_fim: string
          p_gerente: number
          p_inicio: string
        }
        Returns: {
          cliente_nome: string
          corretor_id: number
          hora_fim: string
          hora_inicio: string
          id: string
        }[]
      }
      gerente_disponibilidade: {
        Args: {
          p_corretor: number
          p_data: string
          p_exclude?: string
          p_fim: string
          p_inicio: string
        }
        Returns: Json
      }
      has_perm: { Args: { p_acao: string; p_modulo: string }; Returns: boolean }
      ia_audios_pendentes: {
        Args: { p_limite?: number }
        Returns: {
          id: string
          media_url: string
        }[]
      }
      ia_avaliacao_dados: { Args: { p_lead_id: number }; Returns: Json }
      ia_buscar_unidades: {
        Args: {
          p_bairro?: string
          p_dormitorios?: number
          p_limite?: number
          p_texto?: string
          p_vagas_min?: number
          p_valor_max?: number
        }
        Returns: {
          area_m2: number
          bairro: string
          cidade: string
          empreendimento: string
          entrega: string
          tipologia: string
          unidade: string
          vagas: number
          valor: number
          valor_tabela: number
        }[]
      }
      ia_carteira: {
        Args: { p_corretor_id?: number; p_filtro?: string; p_limite?: number }
        Returns: Json
      }
      ia_conversa: {
        Args: { p_limite?: number; p_texto: string }
        Returns: Json
      }
      ia_criar_tarefa: {
        Args: {
          p_confirmar?: boolean
          p_corretor_id: number
          p_dias?: number
          p_texto_lead: string
          p_titulo: string
        }
        Returns: Json
      }
      ia_estrutura_crm: { Args: never; Returns: Json }
      ia_lead: { Args: { p_texto: string }; Returns: Json }
      ia_leads_para_avaliar: {
        Args: { p_limite?: number }
        Returns: {
          lead_id: number
          nome: string
        }[]
      }
      ia_mover_lead: {
        Args: {
          p_confirmar?: boolean
          p_corretor_id: number
          p_etapa_destino: string
          p_texto_lead: string
        }
        Returns: Json
      }
      ia_recebiveis: { Args: { p_corretor_id?: number }; Returns: Json }
      ia_registrar_feedback: {
        Args: {
          p_confirmar?: boolean
          p_corretor_id: number
          p_texto: string
          p_texto_lead: string
        }
        Returns: Json
      }
      ia_salvar_avaliacao: {
        Args: {
          p_contexto: Json
          p_feedbacks: Json
          p_lead_id: number
          p_negocio_id: number
          p_nota: number
        }
        Returns: number
      }
      ia_salvar_nota_atendimento: {
        Args: {
          p_clareza: number
          p_conducao: number
          p_cordialidade: number
          p_corretor_id: number
          p_destaque?: string
          p_escrita: number
          p_modelo?: string
          p_msgs: number
          p_nota_geral: number
          p_objecoes: number
          p_personalizacao: number
          p_qualificacao: number
          p_telefone: string
        }
        Returns: undefined
      }
      ia_ultima_avaliacao: { Args: { p_lead_id: number }; Returns: Json }
      ia_vendas: {
        Args: { p_corretor_id?: number; p_limite?: number }
        Returns: Json
      }
      instancia_saudavel: { Args: { p_corretor_id: number }; Returns: boolean }
      instancias_vincular_corretores: { Args: never; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      is_admin_exec: { Args: never; Returns: boolean }
      lead_vincular_wa: { Args: { p_lead_id: number }; Returns: string }
      listar_aquario_leads: { Args: never; Returns: Json }
      listar_corretores_transferencia: {
        Args: never
        Returns: {
          id: number
          nome: string
          online: boolean
        }[]
      }
      meu_perfil: { Args: never; Returns: Json }
      migrar_negocios_funil: {
        Args: {
          p_negocio_ids: number[]
          p_pipeline_destino: number
          p_stage_destino: number
        }
        Returns: Json
      }
      motor_acoes: {
        Args: {
          p_actions: Json
          p_auto: number
          p_bloco: string
          p_depth: number
          p_lead: Json
          p_lead_id: number
          p_neg_id: number
          p_nome: string
        }
        Returns: Json
      }
      motor_campo_valor: {
        Args: {
          p_campo: string
          p_lead: Json
          p_lead_id: number
          p_neg_id: number
        }
        Returns: string
      }
      motor_campos: {
        Args: {
          p_auto: number
          p_bloco: string
          p_lead: Json
          p_lead_id: number
          p_map: Json
          p_neg_id: number
          p_nome: string
        }
        Returns: number
      }
      motor_cond: {
        Args: {
          p_lead: Json
          p_lead_id: number
          p_name: string
          p_neg_id: number
          p_opt: Json
        }
        Returns: boolean
      }
      motor_demo: { Args: { auto: Json }; Returns: string }
      motor_enfileirar: {
        Args: { p_auto_id: number; p_lead: Json }
        Returns: number
      }
      motor_envia_abordagem: {
        Args: {
          p_abordagem_ids: Json
          p_auto: number
          p_bloco: string
          p_corretor_id: number
          p_lead: Json
          p_lead_id: number
          p_nome: string
          p_produto_id: number
        }
        Returns: undefined
      }
      motor_execucoes_recentes: { Args: never; Returns: Json }
      motor_fone_br: { Args: { p: string }; Returns: string }
      motor_logs: {
        Args: { p_auto_id: number }
        Returns: {
          automacao_id: number | null
          automacao_nome: string | null
          bloco_id: string | null
          criado_em: string | null
          detalhe: string | null
          evento: string | null
          id: number
          lead_nome: string | null
          lead_telefone: string | null
          status: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "motor_execucoes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      motor_processar_fila: { Args: never; Returns: number }
      motor_resolve_valor: {
        Args: { p_lead: Json; p_raw: string }
        Returns: string
      }
      motor_rodar: {
        Args: {
          p_auto_id: number
          p_depth?: number
          p_lead: Json
          p_start_block?: string
        }
        Returns: string
      }
      motor_rodar_unchecked: {
        Args: {
          p_auto_id: number
          p_depth?: number
          p_lead: Json
          p_start_block?: string
        }
        Returns: string
      }
      motor_roleta: {
        Args: {
          p_auto: number
          p_bloco: string
          p_items: Json
          p_lead: Json
          p_lead_id: number
          p_neg_id: number
          p_nome: string
          p_online_only: boolean
          p_protecao?: Json
          p_tambem_negocio: boolean
        }
        Returns: number
      }
      motor_roleta_transferir_contagem: {
        Args: { p_auto: number; p_bloco: string; p_de: number; p_para: number }
        Returns: undefined
      }
      motor_subst: { Args: { lead: Json; txt: string }; Returns: string }
      mover_negocio: {
        Args: { p_motivo?: string; p_negocio_id: number; p_stage_id: number }
        Returns: Json
      }
      perf_amostrar_online: { Args: never; Returns: undefined }
      perf_derivar_eventos: { Args: { p_desde?: string }; Returns: Json }
      perf_log: {
        Args: {
          p_corretor_id: number
          p_lead_id?: number
          p_meta?: Json
          p_negocio_id?: number
          p_origem?: string
          p_quando?: string
          p_quantidade?: number
          p_tipo: string
          p_valor?: number
        }
        Returns: string
      }
      perf_log_sessao: { Args: { p_tipo: string }; Returns: string }
      perf_metricas_base: {
        Args: { p_fim: string; p_inicio: string }
        Returns: {
          corretor_id: number
          crm_score: number
          fup_score: number
          resp_score: number
          score: number
          tarefa_score: number
          venda_score: number
          vendas: number
          vgv: number
          visita_score: number
        }[]
      }
      perf_snapshot_diario: { Args: never; Returns: undefined }
      performance_corretores: {
        Args: { p_fim?: string; p_inicio?: string }
        Returns: Json
      }
      performance_corretores_base: {
        Args: { p_fim?: string; p_inicio?: string }
        Returns: Json
      }
      performance_operacional: {
        Args: { p_fim?: string; p_inicio?: string }
        Returns: Json
      }
      pescar_lead_aquario: { Args: { p_negocio_id: number }; Returns: Json }
      pipelines_com_etapas: { Args: never; Returns: Json }
      pj_alerta_atrasadas: { Args: never; Returns: number }
      pj_listar_usuarios: {
        Args: never
        Returns: {
          ativo: boolean
          id: string
          nome: string
          role: string
        }[]
      }
      pj_log: {
        Args: {
          p_acao: string
          p_detalhe: string
          p_projeto: string
          p_tarefa: string
        }
        Returns: undefined
      }
      posicao_solo: {
        Args: { p_corretor: string; p_venda: string }
        Returns: number
      }
      presenca_config_ler: { Args: never; Returns: Json }
      presenca_config_salvar: {
        Args: {
          p_ativa: boolean
          p_corretores: number[]
          p_dias_semana: number[]
          p_fim: string
          p_inicio: string
          p_intervalo: number
          p_prazo: number
        }
        Returns: Json
      }
      presenca_confirmar: { Args: never; Returns: Json }
      presenca_derrubar: { Args: never; Returns: Json }
      presenca_derrubar_expirados: { Args: never; Returns: number }
      presenca_registrar_dia: { Args: never; Returns: undefined }
      presenca_status: { Args: never; Returns: Json }
      processar_agendadas: { Args: never; Returns: number }
      projeto_visivel: { Args: { p_projeto: string }; Returns: boolean }
      ranking_vgv_corretores: {
        Args: { p_fim?: string; p_inicio?: string }
        Returns: Json
      }
      receber_parcela: {
        Args: { p_data: string; p_recebimento: string }
        Returns: Json
      }
      recusar_solicitacao: {
        Args: { p_id: string; p_motivo: string }
        Returns: Json
      }
      redistribuir_lead: { Args: { p_negocio: number }; Returns: Json }
      reenviar_abordagem: { Args: { p_negocio: number }; Returns: Json }
      registrar_acao: {
        Args: {
          p_canal?: string
          p_negocio: number
          p_prox_horas?: number
          p_resultado?: string
          p_texto?: string
          p_tipo: string
        }
        Returns: Json
      }
      registrar_auditoria: {
        Args: {
          p_acao: string
          p_antes?: Json
          p_depois?: Json
          p_detalhe?: string
          p_entidade?: string
          p_entidade_id?: string
          p_modulo: string
        }
        Returns: undefined
      }
      registrar_observacao: {
        Args: { p_lead_id: number; p_texto: string }
        Returns: Json
      }
      registrar_presenca: {
        Args: { p_no_esc: boolean; p_sub: string }
        Returns: undefined
      }
      rotate_automation_webhook_token: {
        Args: { p_automacao_id: number }
        Returns: string
      }
      set_empreendimento_coords: {
        Args: { p_id: string; p_lat: number; p_lon: number }
        Returns: undefined
      }
      simular_comissao: { Args: { p_venda: string }; Returns: Json }
      sla_cor: { Args: { p_min: number; p_situacao: string }; Returns: string }
      sla_msg_cache_refresh: { Args: never; Returns: undefined }
      solicitar_descarte: {
        Args: { p_motivo: string; p_negocio: number; p_obs?: string }
        Returns: Json
      }
      solicitar_venda: {
        Args: {
          p_forma?: string
          p_negocio: number
          p_obs?: string
          p_produto: string
          p_vgv: number
        }
        Returns: Json
      }
      transferir_com_aceite: {
        Args: { p_corretor: number; p_negocio: number }
        Returns: Json
      }
      transferir_negocio: {
        Args: { p_corretor_id: number; p_negocio_id: number }
        Returns: Json
      }
      transferir_negocios_massa: {
        Args: {
          p_from_pipeline: number
          p_only_stage?: number
          p_to_pipeline: number
          p_to_stage: number
        }
        Returns: Json
      }
      unaccent: { Args: { "": string }; Returns: string }
      wa_backfill_progresso: { Args: never; Returns: Json }
      wa_backfill_proximos: {
        Args: { p_limit?: number }
        Returns: {
          r_corretor_id: number
          r_lead_id: number
          r_telefone: string
        }[]
      }
      wa_espelhar_historico: {
        Args: { p_msgs: Json; p_session: string; p_telefone: string }
        Returns: Json
      }
      wa_ingerir: { Args: { p_payload: Json }; Returns: Json }
      wa_match_lead: { Args: { p_tel: string }; Returns: number }
      wa_move_respondeu: { Args: { p_lead: number }; Returns: undefined }
      wa_proxima_instancia: { Args: { p_corretor: number }; Returns: string }
      wa_registrar_saida: {
        Args: {
          p_conteudo: string
          p_lead_id: number
          p_media_url?: string
          p_quando?: string
          p_sess: string
          p_tel: string
          p_tipo: string
        }
        Returns: undefined
      }
    }
    Enums: {
      papel_comissao: "corretor" | "executivo" | "indicacao" | "apecerto"
      status_empreend: "pronto" | "em_obras" | "lancamento"
      status_venda: "pendente" | "concluido" | "pago" | "distrato"
      tipo_caixa: "entrada" | "saida"
      tipo_midia: "pdf" | "video" | "apresentacao" | "foto"
      user_role: "admin" | "corretor" | "executivo" | "gerente" | "diretor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      papel_comissao: ["corretor", "executivo", "indicacao", "apecerto"],
      status_empreend: ["pronto", "em_obras", "lancamento"],
      status_venda: ["pendente", "concluido", "pago", "distrato"],
      tipo_caixa: ["entrada", "saida"],
      tipo_midia: ["pdf", "video", "apresentacao", "foto"],
      user_role: ["admin", "corretor", "executivo", "gerente", "diretor"],
    },
  },
} as const
