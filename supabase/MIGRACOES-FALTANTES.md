# Reconciliação das migrations do Supabase

Levantamento somente leitura atualizado em **19/09/2026** no projeto
`diaegvfveqezispcthwk`. Nenhuma migration foi aplicada ou reparada.

## Estado verificável

| Evidência | Quantidade |
|---|---:|
| Registros remotos em `schema_migrations` | **953** |
| Nomes remotos distintos | **952** |
| Registros remotos a partir do baseline `20260727000000` | **608** |
| Nomes remotos distintos após o baseline | **607** |
| Arquivos SQL locais | **294** |
| Nomes locais distintos | **293** |
| Nomes pós-baseline remotos com arquivo local | **266** |
| **Nomes pós-baseline remotos sem arquivo local** | **341** |
| Arquivos locais cujo nome não aparece no histórico remoto | **27** |
| Prefixos/timestamps locais duplicados | **4** |

Os 27 arquivos locais já foram classificados por efeito em
`docs/erp-reestruturacao/MIGRACOES_LOCAIS_SEM_REGISTRO.md`. A análise encontrou
um baseline deliberado para instalação limpa, vários aliases/consolidações com
efeito já presente e três casos que não correspondem integralmente ao estado
remoto. Nenhum deles é candidato a aplicação automática.

O relatório anterior, de 14/09/2026, registrava 571 migrations pós-baseline e
332 ausentes. O aumento para 608/341 comprova que o banco continuou recebendo
alterações enquanto o repositório permanecia incompleto.

## Veredito

**O banco de produção não é reconstruível apenas com este repositório.** O
arquivo `20260727000000_apecerto_legacy_baseline.sql` consolida o estado legado
para instalações limpas, mas não substitui os 341 artefatos pós-baseline
ausentes nem prova equivalência com o catálogo atual.

Não é seguro executar `supabase db push` contra produção neste estado. Antes de
qualquer aplicação é necessário reconstruir um pacote versionado, comparar o
catálogo em ambiente isolado e resolver as colisões abaixo.

## Como comparar corretamente

A comparação é por **nome**, não pelo timestamp local. Os arquivos do
repositório frequentemente usam versões diferentes das registradas
remotamente. Comparar somente por versão cria falsos positivos.

Também é necessário separar três conjuntos:

1. migrations aplicadas e versionadas localmente;
2. migrations aplicadas cujo SQL só existe no banco/histórico operacional;
3. arquivos locais ainda não registrados remotamente, que podem ser drafts,
   consolidações para instalação limpa ou mudanças realmente pendentes.

Nenhum item do terceiro conjunto pode ser aplicado por inferência.

## Colisões locais que bloqueiam o fluxo automático

- `20260814160000`: `limpeza_desativados_com_arquivo` e
  `remove_pescas_legadas_funil2_canonico`;
- `20260814170000`: `disable_ncrm_parallel_entry_keep_funil2` e
  `motor_nao_dispara_automacao_desligada`;
- `20260820223000`: `central_automacoes_sara_conversa_tempo_real` e
  `produtos_captador_unidade_obrigatorio`;
- `20260917160000`: `fase2_datas_sp_sql` e
  `fase3_site_lead_protegido`.

Há ainda dois arquivos locais com o mesmo nome lógico,
`funil_2_integridade_seguranca_performance`, em versões diferentes. No remoto,
o único nome duplicado é `acao_enviar_notificacao_passa_a_funcionar`, registrado
nas versões `20260811132205` e `20260811132208`.

## Próxima reconciliação segura

1. preservar um snapshot lógico e os metadados antes de qualquer mudança;
2. obter o SQL original das 341 migrations ausentes quando houver fonte
   confiável; quando não houver, registrar explicitamente como irrecuperável;
3. usar a classificação dos 27 arquivos locais para evitar reaplicação e
   transformar somente diferenças atuais em migrations novas;
4. criar uma linha de base reproduzível em Postgres/Supabase isolado;
5. comparar schemas, funções, grants, RLS, triggers, índices, cron, Auth e
   Storage entre o ambiente reconstruído e produção;
6. somente depois gerar migrations de reconciliação aditivas, revisáveis e com
   rollback.

`supabase db pull` pode ajudar a capturar o estado atual do schema, mas não
recupera automaticamente o conteúdo histórico das migrations ausentes. Ele não
é, sozinho, evidência de restaurabilidade.

## Regra permanente proposta

Nenhuma alteração de schema em produção fora do fluxo de migration versionada,
revisada e testada em ambiente isolado. Isso inclui mudanças pelo painel,
ferramentas de IA ou comandos avulsos.

O script `scripts/migracoes-faltantes.mjs` continua útil para repetir a
comparação por nome quando houver conexão read-only via `DATABASE_URL`; essa
credencial e as ferramentas de Postgres não estão disponíveis no ambiente
local atual e não serão criadas ou redefinidas automaticamente.
