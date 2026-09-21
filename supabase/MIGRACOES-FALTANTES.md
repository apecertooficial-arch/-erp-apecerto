# Migrações aplicadas em produção sem arquivo no repositório

Atualizado em **20/09/2026** durante a reconstrução do ERP. Regenerável com
`node scripts/migracoes-faltantes.mjs`.

| | |
|---|---|
| Migrações em produção a partir do baseline `20260727000000` | **608** |
| Com arquivo neste repositório, comparando por nome | **272** |
| **Sem arquivo — existem só no banco** | **336 (55%)** |
| Sem arquivo desde `20260824000000` | **37** |

Nesta atualização, duas migrations remotas que não tinham fonte local foram
recuperadas sem reaplicação no banco:

- `20260901015921_blindagem_dono_visita_legado.sql`: conteúdo local e registro
  remoto têm o mesmo MD5 `db23a94c6477a2db717eb090a619c1e9`;
- `20260918174605_fix_f2_config_audit_tipo_carteira_antiga.sql`: conteúdo SQL
  reconciliado pelo MD5 remoto `21eba3ebd9a09e5b1e40e7a243b73263` (desconsiderando
  apenas a quebra de linha final do arquivo POSIX).

Na fatia de determinismo da Sara, outras quatro fontes aplicadas foram
recuperadas diretamente do histórico `supabase_migrations`, também sem executar
SQL remoto:

- `20260829042905_sara_tempo_real_eficiente.sql`: MD5
  `4cb009e86766025254472b47310ebb5e`;
- `20260829043401_sara_orcamento_a_partir_da_ativacao.sql`: MD5
  `9ec0fab8eb8fc3fc6acaae460054cf5b`;
- `20260901183229_sara_checkpoint_preservado_sem_evidencia_nova.sql`: MD5
  `3fd8113ac2545c489276a70a5bdad14c` antes da quebra de linha POSIX;
- `20260901183732_sara_checkpoint_preservado_etapa_protegida.sql`: MD5
  `38cb2431533cd64093261cfb399112f6` antes da quebra de linha POSIX.

Essas fontes comprovam a janela de silêncio configurável, o teto de espera do
lote, o orçamento auditável e as guardas que renovam checkpoint sem fabricar
evidência. A recuperação reduz o desvio, mas as 336 migrations restantes ainda
impedem reconstruir o banco apenas pelo Git.

A primeira restaura no repositório a autoridade de continuidade do dono que já
opera em produção: identidade por IDs, telefone e e-mail; visita/negociação
protegidas; conflito de donos bloqueado; alinhamento auditável entre lead,
negócio e card. Ela não usa nome como identidade.

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
