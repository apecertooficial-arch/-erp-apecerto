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
      abordagens: {
        Row: {
          ativo: boolean
          criado_em: string
          id: number
          mensagens: Json
          nome: string
          ordem: number
          produto_id: number | null
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: never
          mensagens?: Json
          nome: string
          ordem?: number
          produto_id?: number | null
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: never
          mensagens?: Json
          nome?: string
          ordem?: number
          produto_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "abordagens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
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
          ativo: boolean
          doc_contrato_em: string | null
          doc_contrato_nome: string | null
          doc_contrato_path: string | null
          doc_rg_em: string | null
          doc_rg_nome: string | null
          doc_rg_path: string | null
          email: string | null
          id: number
          no_escritorio: boolean
          nome: string
          online: boolean
          ordem: number
          peso: number
          presente_data: string | null
          telefone: string | null
          ultima_presenca: string | null
          usuario_id: string | null
        }
        Insert: {
          ativo?: boolean
          doc_contrato_em?: string | null
          doc_contrato_nome?: string | null
          doc_contrato_path?: string | null
          doc_rg_em?: string | null
          doc_rg_nome?: string | null
          doc_rg_path?: string | null
          email?: string | null
          id?: never
          no_escritorio?: boolean
          nome: string
          online?: boolean
          ordem: number
          peso?: number
          presente_data?: string | null
          telefone?: string | null
          ultima_presenca?: string | null
          usuario_id?: string | null
        }
        Update: {
          ativo?: boolean
          doc_contrato_em?: string | null
          doc_contrato_nome?: string | null
          doc_contrato_path?: string | null
          doc_rg_em?: string | null
          doc_rg_nome?: string | null
          doc_rg_path?: string | null
          email?: string | null
          id?: never
          no_escritorio?: boolean
          nome?: string
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
          id?: never
          negocio_id: number
          reconhecido_em?: string | null
          reconhecido_por?: string | null
        }
        Update: {
          corretor_id?: number | null
          criado_em?: string
          id?: never
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
            foreignKeyName: "crm_lead_alertas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
        ]
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
      empreendimentos: {
        Row: {
          acesso_codigo: string | null
          acesso_instrucoes: string | null
          acesso_tipo: string | null
          andar: string | null
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
          proprietario_id: string | null
          proprietario_email: string | null
          proprietario_nome: string | null
          proprietario_tel: string | null
          publicado: boolean
          published_at: string | null
          rascunho: boolean
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
          proprietario_id?: string | null
          proprietario_email?: string | null
          proprietario_nome?: string | null
          proprietario_tel?: string | null
          publicado?: boolean
          published_at?: string | null
          rascunho?: boolean
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
          proprietario_id?: string | null
          proprietario_email?: string | null
          proprietario_nome?: string | null
          proprietario_tel?: string | null
          publicado?: boolean
          published_at?: string | null
          rascunho?: boolean
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
          enviado_por: string | null
          id: string
          mime: string | null
          negocio_id: number | null
          nome: string
          path: string
          processo_ref: string
          tamanho: number | null
        }
        Insert: {
          criado_em?: string
          enviado_por?: string | null
          id?: string
          mime?: string | null
          negocio_id?: number | null
          nome: string
          path: string
          processo_ref: string
          tamanho?: number | null
        }
        Update: {
          criado_em?: string
          enviado_por?: string | null
          id?: string
          mime?: string | null
          negocio_id?: number | null
          nome?: string
          path?: string
          processo_ref?: string
          tamanho?: number | null
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
      instancias: {
        Row: {
          ativa: boolean
          conectada: boolean
          conectada_em: string | null
          corretor_id: number | null
          id: number
          instancia_dapi: string
          nome: string
          status_dapi: string | null
          telefone: string | null
        }
        Insert: {
          ativa?: boolean
          conectada?: boolean
          conectada_em?: string | null
          corretor_id?: number | null
          id?: never
          instancia_dapi: string
          nome: string
          status_dapi?: string | null
          telefone?: string | null
        }
        Update: {
          ativa?: boolean
          conectada?: boolean
          conectada_em?: string | null
          corretor_id?: number | null
          id?: never
          instancia_dapi?: string
          nome?: string
          status_dapi?: string | null
          telefone?: string | null
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
          categoria: string
          created_at: string
          data: string
          descricao: string | null
          id: string
          origem: string | null
          papel: Database["public"]["Enums"]["papel_comissao"] | null
          recebimento_id: string | null
          tipo: Database["public"]["Enums"]["tipo_caixa"]
          valor: number
          venda_id: string | null
        }
        Insert: {
          categoria: string
          created_at?: string
          data: string
          descricao?: string | null
          id?: string
          origem?: string | null
          papel?: Database["public"]["Enums"]["papel_comissao"] | null
          recebimento_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_caixa"]
          valor: number
          venda_id?: string | null
        }
        Update: {
          categoria?: string
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
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
      leads: {
        Row: {
          atualizado_em: string | null
          corretor_id: number | null
          criado_em: string
          datacrazy_lead_id: string | null
          disparo_optout: boolean
          email: string | null
          extras: Json | null
          id: number
          instagram: string | null
          nome: string | null
          origem: string | null
          pipeline_id: number | null
          status: string
          tags: Json | null
          telefone: string | null
          wa_contato_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          corretor_id?: number | null
          criado_em?: string
          datacrazy_lead_id?: string | null
          disparo_optout?: boolean
          email?: string | null
          extras?: Json | null
          id?: never
          instagram?: string | null
          nome?: string | null
          origem?: string | null
          pipeline_id?: number | null
          status?: string
          tags?: Json | null
          telefone?: string | null
          wa_contato_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          corretor_id?: number | null
          criado_em?: string
          datacrazy_lead_id?: string | null
          disparo_optout?: boolean
          email?: string | null
          extras?: Json | null
          id?: never
          instagram?: string | null
          nome?: string | null
          origem?: string | null
          pipeline_id?: number | null
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
            foreignKeyName: "lead_produtos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
        Relationships: []
      }
      metas_corretor: {
        Row: {
          atualizado_em: string
          meta_vgv: number
          nome: string
        }
        Insert: {
          atualizado_em?: string
          meta_vgv?: number
          nome: string
        }
        Update: {
          atualizado_em?: string
          meta_vgv?: number
          nome?: string
        }
        Relationships: []
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
        ]
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
          grupo: string | null
          id: number
          nome: string
          ordem: number
        }
        Insert: {
          grupo?: string | null
          id?: never
          nome: string
          ordem?: number
        }
        Update: {
          grupo?: string | null
          id?: never
          nome?: string
          ordem?: number
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
        ]
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
          tipologia: string | null
          vagas: number | null
          valor_m2: number | null
          valor_promo: number | null
          valor_tabela: number | null
        }
        Insert: {
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
          tipologia?: string | null
          vagas?: number | null
          valor_m2?: number | null
          valor_promo?: number | null
          valor_tabela?: number | null
        }
        Update: {
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
      usuarios: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id: string
          nome: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      venda_processos: {
        Row: { id: string; venda_id: string; negocio_id: number | null; etapa: string; tipo_venda: string; responsavel_usuario_id: string | null; prazo_em: string | null; observacoes: string | null; criado_por: string | null; criado_em: string; atualizado_em: string }
        Insert: { id?: string; venda_id: string; negocio_id?: number | null; etapa?: string; tipo_venda?: string; responsavel_usuario_id?: string | null; prazo_em?: string | null; observacoes?: string | null; criado_por?: string | null; criado_em?: string; atualizado_em?: string }
        Update: { id?: string; venda_id?: string; negocio_id?: number | null; etapa?: string; tipo_venda?: string; responsavel_usuario_id?: string | null; prazo_em?: string | null; observacoes?: string | null; criado_por?: string | null; criado_em?: string; atualizado_em?: string }
        Relationships: []
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
      vendas: {
        Row: {
          created_at: string
          custos: number
          data_venda: string
          empreendimento_id: string | null
          empreendimento_nome: string | null
          forma_pgto: string | null
          id: string
          obs: string | null
          percentual_comissao: number | null
          status: Database["public"]["Enums"]["status_venda"]
          unidade_id: string | null
          vgv: number
        }
        Insert: {
          created_at?: string
          custos?: number
          data_venda: string
          empreendimento_id?: string | null
          empreendimento_nome?: string | null
          forma_pgto?: string | null
          id?: string
          obs?: string | null
          percentual_comissao?: number | null
          status?: Database["public"]["Enums"]["status_venda"]
          unidade_id?: string | null
          vgv: number
        }
        Update: {
          created_at?: string
          custos?: number
          data_venda?: string
          empreendimento_id?: string | null
          empreendimento_nome?: string | null
          forma_pgto?: string | null
          id?: string
          obs?: string | null
          percentual_comissao?: number | null
          status?: Database["public"]["Enums"]["status_venda"]
          unidade_id?: string | null
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
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          lembrete: boolean
          lead_id: number | null
          local: string | null
          motivo_cancelamento: string | null
          observacoes: string | null
          negocio_id: number | null
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
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          lembrete?: boolean
          lead_id?: number | null
          local?: string | null
          motivo_cancelamento?: string | null
          observacoes?: string | null
          negocio_id?: number | null
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
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          lembrete?: boolean
          lead_id?: number | null
          local?: string | null
          motivo_cancelamento?: string | null
          observacoes?: string | null
          negocio_id?: number | null
          participantes?: string | null
          produto?: string | null
          status?: string
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
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
        ]
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
          tipo: string
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
          tipo: string
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
          tipo?: string
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
      aceitar_transferencia: { Args: { p_negocio: number }; Returns: Json }
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
      corretor_pode_receber: { Args: { p_id: number }; Returns: boolean }
      current_broker_id: { Args: never; Returns: number }
      can_manage_all: { Args: never; Returns: boolean }
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
      enviar_abordagem_lead: { Args: { p_lead: number }; Returns: Json }
      fmt_brl_compact: { Args: { v: number }; Returns: string }
      gerar_comissoes: { Args: { p_venda: string }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      is_admin_exec: { Args: never; Returns: boolean }
      lead_vincular_wa: { Args: { p_lead_id: number }; Returns: string }
      listar_corretores_transferencia: {
        Args: never
        Returns: { id: number; nome: string; online: boolean }[]
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
          p_tambem_negocio: boolean
        }
        Returns: number
      }
      motor_subst: { Args: { lead: Json; txt: string }; Returns: string }
      mover_negocio: {
        Args: { p_motivo?: string; p_negocio_id: number; p_stage_id: number }
        Returns: Json
      }
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
      performance_corretores: {
        Args: { p_fim?: string; p_inicio?: string }
        Returns: Json
      }
      pipelines_com_etapas: { Args: never; Returns: Json }
      posicao_solo: {
        Args: { p_corretor: string; p_venda: string }
        Returns: number
      }
      processar_agendadas: { Args: never; Returns: number }
      receber_parcela: {
        Args: { p_data: string; p_recebimento: string }
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
      registrar_observacao: {
        Args: { p_lead_id: number; p_texto: string }
        Returns: Json
      }
      registrar_presenca: {
        Args: { p_no_esc: boolean; p_sub: string }
        Returns: undefined
      }
      simular_comissao: { Args: { p_venda: string }; Returns: Json }
      sla_cor: { Args: { p_min: number; p_situacao: string }; Returns: string }
      solicitar_descarte: {
        Args: { p_motivo: string; p_negocio: number; p_obs?: string }
        Returns: Json
      }
      sync_instancias_status: { Args: never; Returns: number }
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
      wa_ingerir: { Args: { p_payload: Json }; Returns: Json }
      wa_match_lead: { Args: { p_tel: string }; Returns: number }
      wa_move_respondeu: { Args: { p_lead: number }; Returns: undefined }
      wa_proxima_instancia: { Args: { p_corretor: number }; Returns: string }
    }
    Enums: {
      papel_comissao: "corretor" | "executivo" | "indicacao" | "apecerto"
      status_empreend: "pronto" | "em_obras" | "lancamento"
      status_venda: "pendente" | "concluido" | "pago" | "distrato"
      tipo_caixa: "entrada" | "saida"
      tipo_midia: "pdf" | "video" | "apresentacao" | "foto"
      user_role: "admin" | "corretor" | "executivo"
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
      user_role: ["admin", "corretor", "executivo"],
    },
  },
} as const
