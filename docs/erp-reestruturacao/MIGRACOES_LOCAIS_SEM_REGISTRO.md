# Classificação dos arquivos locais sem registro remoto pelo mesmo nome

Leitura somente leitura em 2026-09-19. Projeto remoto:
`diaegvfveqezispcthwk`. Nenhum SQL foi aplicado.

## Método

Os 27 arquivos foram comparados por nome com os 953 registros remotos. Em
seguida, foram confrontados com migrations remotas de nome semelhante e com o
catálogo/estado atual do banco. “Efeito presente” significa que o objeto ou a
invariante principal foi observada; não significa igualdade byte a byte entre o
arquivo local e o SQL originalmente executado.

## Resultado

| Arquivo local | Classificação | Evidência sanitizada |
|---|---|---|
| `apecerto_legacy_baseline` | baseline para instalação limpa | `apecerto_baseline_metadata` não existe em produção; o arquivo consolida o legado, não representa uma migration histórica aplicada |
| `ncrm_ingest_lifecycle` | consolidado local de efeitos presentes | tabela/config e RPC existem; histórico remoto contém as partes 1, 2 e 3 |
| `push_vencendo_e_deep_links_reais` | alias remoto provável; efeito presente | remoto registra `push_acao_vencendo_e_deep_links_reais` |
| `ncrm_guarda_saidas_sql_restantes` | versão reexecutável de migration aplicada | o próprio arquivo referencia a versão produtiva `ncrm_guarda_saidas_sql_restantes_v3` |
| `ncrm_sla_criterio_canonico` | alias remoto; efeito presente | remoto registra `ncrm_sla_criterio_canonico_git`; função de elegibilidade existe |
| `ncrm_confirmacao_no_reconciliador` | alias remoto | remoto registra `ncrm_confirmacao_no_reconciliador_git` |
| `ncrm_remove_reconhecimento_negativo` | alias remoto | remoto registra `ncrm_remove_reconhecimento_negativo_git` |
| `ncrm_recusa_de_contrato_e_noop` | alias remoto | remoto registra `ncrm_recusa_de_contrato_e_noop_git` |
| `funil_2_zerar_com_arquivo_e_fila_independente` | efeito presente, histórico sem nome equivalente | tabelas de arquivo e controle existem; não reaplicar sem recuperar a origem |
| `funil_2_notificacao_lead_novo` | efeito presente, histórico sem nome equivalente | função/trigger canônicos existem |
| `ncrm_roleta_igualitaria_e_presenca` | não presente/supersedido | tabelas específicas da roleta igualitária não existem; não aplicar, pois a distribuição atual possui autoridade posterior |
| `motor_bloco_distribuicao_simples` | efeito presente | corpo atual do motor contém `distribution-simple` |
| `sla_respeita_protecao_do_dono` | alias/efeito presente | remoto registra `sla_respeita_protecao_do_dono_do_lead`; rotina atual contém proteção |
| `carga_de_leads_da_planilha` | efeito presente e evoluído | tabela/RPCs existem; histórico posterior registra a carga obedecendo automação e tick |
| `varredura_whatsapp_veredito` | efeito presente/alias remoto | tabela existe; remoto registra `carga_veredito_de_whatsapp_por_numero` |
| `voz_nova_obrigatoria_com_memoria_completa` | alias remoto; efeito presente | remoto registra `voz_nova_vira_regra_obrigatoria_com_memoria_completa`; tabela de bloqueio existe |
| `motor_nao_dispara_automacao_desligada` | versão anterior de migration aplicada | remoto registra a versão ampliada `..._e_respeita_a_chave_geral` |
| `excluir_regras_aposentadas` | efeito presente por outra trilha | funções e tabela antigas consultadas não existem; remoto contém etapas de arquivamento anteriores |
| `produtos_site_conectados` | efeito presente e evoluído | view `site_produtos` existe e recebeu migrations posteriores |
| `codigo_imovel_e_site` | dividido em migrations remotas | colunas existem; remoto registra `codigo_imovel` e `site_produtos_codigo` |
| `produtos_captador_unidade_obrigatorio` | efeito presente, nome remoto divergente | constraint `unidades_terceiros_exige_captador_check` existe |
| `isolar_leads_legado` | efeito presente e evoluído | etapa/momento legado existem; remoto registra `isolar_legado_por_data_e_bloquear_sara` |
| `unidades_valor_m2_consistente` | não aplicado | funções e triggers específicos não existem; tratar como mudança candidata, nunca como histórico aplicado |
| `apecerto_studio_operacional` | alias remoto; efeito presente | remoto registra `apecerto_studio_operacional_v1`; tabelas sociais existem |
| `remover_tracking_360` | estado convergiu, histórico não rastreado pelo mesmo nome | RPCs gerenciais removidas não existem; preservar tabelas operacionais até provar dependências |
| `alertas_fila_destino_e_diagnostico_presenca` | parcialmente presente; draft local | coluna `execution_id` existe, mas as funções principais de alerta não; comentário do arquivo confirma que aguardava autorização |
| `fase0_automacao_entrada_site` | efeito presente, histórico sem mesmo nome | automação 42 está ativa como `Entrada Site` em `Campanhas de Entrada` |

## Decisão de segurança

Nenhum dos 27 arquivos deve ser aplicado automaticamente:

- os itens com efeito presente podem duplicar mutações ou sobrescrever versões
  posteriores;
- o baseline é somente para reconstrução limpa;
- `ncrm_roleta_igualitaria_e_presenca` está supersedido;
- `unidades_valor_m2_consistente` precisa virar uma nova migration revisada se
  ainda representar a regra atual;
- `alertas_fila_destino_e_diagnostico_presenca` precisa ser desmembrado e
  confrontado com o P0 atual de alertas, sem reutilizar o arquivo como está.

## Próximo gate

Recuperar ou reconstruir em ambiente isolado o catálogo final esperado, sem
forçar os timestamps locais. A nova linha de base deve preservar a história
remota e produzir migrations aditivas apenas para diferenças comprovadas.
