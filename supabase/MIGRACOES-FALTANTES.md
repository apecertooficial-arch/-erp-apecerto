# Migrações aplicadas em produção sem arquivo no repositório

Levantado em **14/09/2026** durante a auditoria estrutural. Regenerável com
`node scripts/migracoes-faltantes.mjs`.

| | |
|---|---|
| Migrações em produção a partir do baseline `20260727000000` | **571** |
| Com arquivo neste repositório | **239** |
| **Sem arquivo — existem só no banco** | **332 (58%)** |

## Por que isso importa

**O banco não pode ser reconstruído a partir deste repositório.** Na prática:

- não existe ambiente de homologação fiel à produção;
- não existe recuperação de desastre testável;
- um comprador/auditor não consegue levantar uma cópia do sistema para avaliar;
- alterações feitas direto em produção (painel, MCP, psql) não deixam rastro no código.

## Como comparar corretamente

A comparação **tem de ser por nome**, não por versão: os arquivos deste repositório
usam timestamps próprios, diferentes dos gravados em `schema_migrations`. Comparar
por versão dá falso positivo (parece que faltam 557 quando faltam 332).

## Como resolver

```bash
# 1. Trazer o conteúdo real das migrações que faltam
supabase db pull --linked

# 2. Conferir o que sobrou
node scripts/migracoes-faltantes.mjs   # precisa de DATABASE_URL

# 3. Validar de verdade: subir um projeto limpo só com o repositório
#    e comparar o catálogo com produção. Enquanto esse diff não for vazio,
#    o problema não está resolvido.
```

## Regra que precisa passar a valer

Nenhuma alteração de schema em produção fora do fluxo de migração versionada.
Isso inclui alterações feitas pelo painel do Supabase e por ferramentas de IA.

## Natureza do que está faltando (amostra)

O conjunto não é acessório. Inclui, entre outros:

- **Distribuição de leads e fila**: `regra_unica_de_distribuicao`, `fila_sequencial_com_peso`,
  `portao_unico_de_distribuicao`, `resgate_orfaos_respeita_a_fila_sequencial`
- **Sara / IA**: `sara_camada_de_interpretacao_estrutura`, `sara_corte_de_confianca_por_risco`,
  `sara_tempo_real_eficiente`
- **Funil 2.0**: `funil2_estrutura_definitiva_etapas_momentos`, `funil_mover_porta_unica`
- **Tracking e atribuição**: `tracking_360_dashboard`, `tracking_360_attribution_scope`,
  `tracking_identity_attribution`, `meta_crm_lead_identity`
- **Segurança**: `harden_meta_lead_identity_rpc`, `fix_catalogo_publico_filtros_e_exposicao_anon`,
  `funil2_revoga_anon_das_rpcs_novas`
- **Financeiro**: `repasse_comissao_fonte_unica`, `extrato_bancario_importacao`
- **Ajustes operacionais pontuais** feitos direto em produção:
  `jamariz_pesos_temporarios_fds_20260904`, `reordenar_fila_tica_kapri_edrisia_20260908`,
  `fixar_instancia_claudia_3785`

As duas últimas categorias são o sintoma mais claro: **regra de negócio da operação
sendo alterada direto no banco**, sem passar pelo código.
