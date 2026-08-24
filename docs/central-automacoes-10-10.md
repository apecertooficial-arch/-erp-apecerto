# Central de Automações 10/10

Status do documento: projeto executivo iniciado em 24/08/2026.

## Resultado esperado

A Central deve ser a única autoridade para regras comerciais automatizadas. Um fluxo publicado executa somente os blocos conectados, na versão publicada, na ordem desenhada. Se um bloco falhar, o próximo não roda por suposição. A falha fica visível, explicada e recuperável sem duplicar efeitos.

O padrão de aceitação é simples: o gestor consegue criar, testar, publicar, acompanhar e corrigir uma automação sem depender de código ou de rotinas ocultas.

## Diagnóstico confirmado

### O que já existe e deve ser preservado

- Rascunho separado da versão publicada.
- Publicação versionada com proteção contra sobrescrita concorrente.
- Validação antes de publicar.
- Fila com identidade idempotente, retentativas e quarentena.
- Freio geral de mensagens.
- Saída de erro nos módulos que podem falhar.
- Distribuição separada do envio de abordagem.
- Rota explícita de instância por corretor no bloco de mensagem.
- Análise da Sara separada da aplicação explícita da análise.
- Painel de saúde com nove contratos operacionais.

### Lacunas que impedem a nota 10

1. **A simulação não existe de verdade.** O botão atual apenas informa que nenhuma ação foi executada.
2. **O monitor não reconstrói uma execução.** Ele lista eventos recentes, mas não apresenta entrada, saída, decisão e duração bloco a bloco para uma mesma jornada.
3. **O runtime visual é um arquivo monolítico.** Biblioteca, edição, validação, publicação e monitoramento estão acoplados, aumentando o risco de regressão.
4. **Os contratos de módulos estão duplicados.** Interface, validador e banco conhecem listas próprias; uma divergência pode permitir uma configuração que o motor não executa igual.
5. **Falhas de entrega não aparecem como jornada completa.** Há partes de mensagem com erro ou confirmação antiga que não aparecem com clareza no painel principal.
6. **A saúde informa contratos estruturais, mas não mede SLO.** Falta mostrar taxa de sucesso, latência, backlog por idade e falhas novas por módulo.
7. **A abertura do construtor é vazia.** Nenhuma automação é selecionada automaticamente e os principais comandos são ícones sem contexto.
8. **A publicação não mostra um resumo de impacto.** O gestor não vê claramente quais gatilhos, corretores, mensagens, campos e saídas mudaram.
9. **Rotinas operacionais ainda coexistem fora da linguagem visual.** O relógio deve transportar eventos, nunca decidir regra comercial; toda rotina deve ter proprietário, classe e prova de que não altera o funil por fora.
10. **Falta uma suíte de contrato por módulo.** Hoje existem testes importantes, mas não uma matriz executável que rode cada módulo isoladamente com entrada, saída, erro e repetição.

## Matriz canônica de módulos

| Família | Módulo | Entrada mínima | Único efeito permitido | Saídas | Falha segura | Prova obrigatória |
|---|---|---|---|---|---|---|
| Entrada | Início | evento e payload | materializar o contexto uma vez | próxima | rejeitar entrada inválida | evento, versão e id da execução |
| Dados | Operações de campos | contexto | mapear apenas campos configurados | próxima, erro | não salvar mapeamento parcial | antes/depois por campo |
| Lógica | Condição | contexto | avaliar regras sem modificar dados | verdadeiro, falso | erro de avaliação | expressão e evidências |
| Lógica | Randomizador | contexto e pesos | escolher um ramo conforme regra publicada | um ramo | bloquear soma inválida | ramo e valor usado |
| Distribuição | Distribuir lead | lead e lista publicada | escolher e atribuir um corretor elegível | próxima, erro | não atribuir por fallback oculto | candidatos, exclusões e escolhido |
| Mensagem | Enviar abordagem | lead, proprietário, grupo, abordagens e rota | criar partes e enviar na ordem publicada | próxima, erro | não considerar HTTP 2xx como entrega | abordagem, instância, parte e confirmação |
| Espera | Espera | contexto e prazo | agendar continuação da mesma versão | próxima | não continuar fora da versão | início, vencimento e retomada |
| Espera | Aguardar resposta | contexto e janela | observar evidência de mensagem recebida | respondeu, não respondeu | não inferir resposta | mensagem/evento ou expiração |
| IA | Agente de IA | conversa e versão do lead | devolver análise estruturada | próxima, erro | não alterar cadastro | evidências, confiança e versão |
| CRM | Aplicar análise da IA | análise válida | alterar somente campos explicitamente marcados | próxima, erro | zero alteração em análise velha/fraca | antes/depois e análise usada |
| CRM | Ação | contexto e ações | executar somente as subações configuradas | próxima, erro | parar no primeiro erro não recuperável | efeito de cada subação |

## Regras inegociáveis

1. Somente a versão publicada pode executar em produção.
2. Salvar rascunho nunca altera o que está rodando.
3. Cada execução recebe um `execution_id` e preserva a versão até terminar.
4. Um bloco recebe um contrato de entrada e devolve um contrato de saída.
5. Nenhum módulo lê uma fonte oculta para tomar decisão comercial.
6. Nenhuma falha vira sucesso por conveniência.
7. Repetir uma etapa com o mesmo identificador não duplica lead, negócio, mensagem, tag ou notificação.
8. Erro recuperável usa retentativa com limite; erro definitivo vai para exceções.
9. IA analisa; somente um bloco explícito aplica a análise.
10. Relógios e filas apenas transportam eventos criados por automações publicadas.
11. “Nenhum corretor elegível” é um resultado operacional do módulo de distribuição, não uma pane técnica: o mapa publicado define se aguarda, por quanto tempo, quando tenta novamente e qual saída recebe o prazo vencido.
12. Uma evolução de contrato nunca invalida silenciosamente uma execução histórica. Compatibilidade, migração explícita para a versão atual ou encerramento seguro precisam ser decididos e auditados pela Central.

## Produto e experiência

### Arquitetura da tela

- **Coluna esquerda:** automações, grupos, busca e estado.
- **Biblioteca recolhível:** módulos agrupados por Entrada, Dados, Lógica, Distribuição, Mensagem, IA, CRM e Tempo.
- **Canvas central:** fluxo da esquerda para a direita, ramos nomeados e erros visíveis.
- **Inspector direito:** contrato, configuração, entrada esperada, saída produzida e comportamento de erro do bloco selecionado.
- **Barra superior textual:** Salvar rascunho, Validar, Testar, Publicar e Ativar/Desativar.
- **Barra inferior:** zoom, organizar, minimapa e status do rascunho.

### Modos do produto

1. **Construir:** editar blocos e conexões.
2. **Testar:** rodar uma entrada sintética sem efeitos externos.
3. **Comparar:** ver rascunho versus publicado com impacto operacional.
4. **Acompanhar:** reconstruir execuções reais por jornada.
5. **Resolver:** tratar exceções, decidir entre repetir, ignorar ou corrigir o fluxo.

### Proteção para publicação

O modal de publicação deve apresentar:

- gatilho que será ligado;
- módulos e conexões;
- corretores e regra de presença;
- abordagens e ordem das partes;
- instância exata por corretor;
- campos que serão alterados;
- automações chamadas;
- alertas sem saída de erro;
- comparação com a versão atual;
- resultado do teste sintético mais recente.

## Observabilidade 10/10

Cada jornada deve mostrar:

- automação e versão;
- evento de entrada;
- horário de início e fim;
- bloco atual;
- entrada sanitizada do bloco;
- saída sanitizada do bloco;
- efeito confirmado;
- próxima conexão escolhida;
- tentativas e espera;
- erro classificado como recuperável ou definitivo;
- mensagens como vídeo/texto, ordem, aceite, entrega e leitura;
- alterações da Sara com valor anterior, novo, evidência e confiança.

Indicadores mínimos:

- taxa de sucesso por automação e módulo;
- p50/p95 de duração;
- fila pendente por idade;
- exceções abertas;
- entrega de mensagem por parte;
- distribuição indisponível;
- itens aguardando corretor elegível, com próxima tentativa e SLA visíveis;
- incompatibilidades entre a versão presa à execução e o contrato atual;
- análises da Sara aplicadas, ignoradas e enviadas para revisão humana;
- entradas sem card, negócio ou abordagem confirmada.

## Plano de execução

## Registro atual de rotinas agendadas

Existem 26 rotinas cadastradas: 18 ativas e oito inativas. Ter relógio ou fila não é, por si só, um problema; o problema é uma rotina tomar decisão comercial invisível. A revisão de cada rotina seguirá esta classificação:

| Rotina ativa | Frequência | Classe inicial | Pode decidir regra comercial? |
|---|---:|---|---|
| `motor-relogio-central` | 30 segundos | transporte da Central | não |
| `central_varredura` | 10 minutos | tracking/observabilidade | não |
| `tracking_meta_retry` | 5 minutos | integração de tracking | não |
| `processar_agendadas` | 1 minuto | mensagens agendadas | somente se a agenda foi criada explicitamente |
| `presenca_avisar_pendentes` | 30 segundos | presença/notificação | não distribuir nem alterar funil |
| `presenca_derrubar_expirados` | 1 minuto | presença/manutenção | não distribuir nem alterar funil |
| `ncrm_push_enfileirar` | 30 segundos | transporte de push | não |
| `ncrm_push_entregar` | 30 segundos | transporte de push | não |
| `ncrm_push_liberar_leases` | 2 minutos | recuperação de push | não |
| `monitor_wa_conexao` | 10 minutos | saúde de integração | não |
| `sync-instancias-status` | 5 minutos | saúde de integração | não |
| `dapi_manutencao` | 15 minutos | manutenção de integração | não |
| `wa_core_inventario` | 5 minutos | inventário/saúde | não |
| `transcrever-audios` | 2 minutos | integração | não |
| `integracao_enviar_catalogo` | diário | integração | não |
| `perf_derivar_eventos` | 10 minutos | observabilidade | não |
| `apecerto-site-telemetry-retention` | diário | retenção | não |
| `projetos-alerta-atrasadas` | diário | outro módulo do ERP | fora do escopo comercial da Central |

As oito rotinas inativas serão mantidas desligadas e documentadas para posterior remoção segura. A auditoria também verificará se algum comando agendado guarda credencial diretamente; segredos devem ficar em armazenamento seguro, não no texto da rotina.

### Fase 0 — Verdade única e linha de base

- [x] Inventariar automações publicadas, tipos de bloco, filas e mensagens.
- [x] Confirmar a separação rascunho/publicado e a versão presa à fila.
- [x] Identificar rotinas que só transportam eventos e rotinas que ainda merecem isolamento.
- [ ] Criar um registro canônico de contratos consumido por interface, validador, banco e testes.
- [ ] Classificar cada rotina existente como transporte, integração, manutenção ou regra comercial.

Critério de saída: nenhuma regra comercial fora de automação publicada sem uma exceção documentada e aprovada.

### Fase 1 — Construtor confiável

- Seleção inicial explícita e estado vazio útil.
- Comandos com texto e hierarquia visual.
- Inspector de contrato por bloco.
- Validação incremental no próprio cartão.
- Resumo de publicação e comparação semântica entre versões.
- Biblioteca de módulos derivada do registro canônico.

Critério de saída: não é possível publicar módulo, gatilho, ação, campo, rota ou conexão que o motor não reconheça.

### Fase 2 — Simulador sem efeitos

- Entrada sintética com modelos de webhook.
- Interpretador da mesma versão publicada/rascunho.
- Adaptadores `dry-run` por módulo.
- Resultado bloco a bloco, incluindo ramos e valores calculados.
- Proibição técnica de escrita, mensagem, notificação ou chamada externa.

Critério de saída: cada módulo possui teste unitário de sucesso, erro e repetição; o fluxo completo pode ser validado sem lead real.

### Fase 3 — Raio-X e central de exceções

- Jornada por `execution_id`.
- Entrega de mensagem por parte.
- Fila de exceções com motivo, impacto e ação segura.
- Reprocessamento preso à mesma versão e identidade.
- Recuperação excepcional na versão publicada somente quando não houve efeito externo, com troca de versão explícita, validação prévia e trilha de auditoria.
- SLOs e alertas apenas para falhas novas e acionáveis.

Critério de saída: uma falha pode ser localizada em menos de dois minutos, sem consulta manual ao banco.

### Fase 4 — Modularização técnica

- Separar catálogo, editor, compilador, validador, publicação e monitor.
- Gerar tipos e validadores a partir do contrato canônico.
- Reduzir o runtime monolítico por migração incremental, mantendo compatibilidade de mapas.
- Criar testes de regressão para mapas publicados existentes.

Critério de saída: alterar um módulo não exige reemitir o construtor inteiro nem muda módulos vizinhos.

### Fase 5 — Homologação e liberação

- Testes de contrato de todos os módulos.
- Fluxos sintéticos Miruna e Adelmo, sem lead real.
- Instabilidade simulada de vídeo, DAPI, presença, IA e banco.
- Repetição e concorrência.
- Teste visual em desktop e monitoramento responsivo.
- Liberação progressiva com rollback por versão.

Critério de saída: zero efeito duplicado, zero continuação após erro, zero fallback oculto e rastreabilidade de 100% das jornadas.

## Cenários obrigatórios de teste

1. Webhook repetido com o mesmo evento.
2. Lead já existente que entrou novamente em campanha.
3. Corretor ausente em dia útil e regra de fim de semana.
4. Nenhum corretor elegível.
5. Instância publicada desconectada.
6. Vídeo falha antes do texto.
7. Vídeo aceito, mas confirmação demora.
8. Texto não pode ultrapassar vídeo pendente.
9. DAPI retorna erro definitivo de número sem WhatsApp.
10. IA indisponível.
11. IA sem evidências ou com baixa confiança.
12. Lead muda enquanto a IA analisa.
13. Condição verdadeira e falsa.
14. Espera retomada após nova publicação.
15. Duas sessões tentam publicar ao mesmo tempo.
16. Reprocessamento de exceção não duplica efeito.
17. Automação chama outra automação e respeita limite de encadeamento.
18. Caminho de erro conectado e caminho de erro ausente.

## Linha de base observada em produção

No início deste projeto foram encontrados 14 fluxos no total: 13 não arquivados e um arquivado. Os 13 fluxos operacionais somavam 79 blocos, com 10 automações ativas. Nas últimas 24 horas havia 4.810 registros de execução: 4.738 `ok`, 25 alertas e 47 erros. A fila possuía um item pendente e 97 itens históricos em erro. A entrega de mensagens dos últimos sete dias registrava 103 partes entregues e seis registros antigos sem confirmação conclusiva.

Os erros recentes concentravam-se em uma versão antiga da automação de resposta da Sara e em três tentativas de distribuição sem corretor elegível na Miruna. Isso confirma duas necessidades do projeto: separar erro histórico de falha nova e mostrar a execução completa por versão.

Em 24/08, os três itens da Miruna chegaram ao limite de seis tentativas em aproximadamente quinze minutos e foram para a quarentena. O primeiro replay seguro revelou uma segunda falha: a versão histórica 104 não possuía o roteamento explícito de instância exigido pelo contrato novo do runtime. Como nenhuma parte de mensagem existia, foi criada a operação administrativa `central_reprocessar_fila_versao_publicada`: ela exige gestão, valida a versão publicada, bloqueia qualquer execução que já possua parte de mensagem, migra a fila de forma explícita e registra a versão anterior e a nova. Os três itens migraram para a versão 123 e terminaram com distribuição e entrega confirmada de vídeo antes do texto. Esse caso passa a ser teste obrigatório de compatibilidade e recuperação, não uma exceção manual tolerada.

## Decisões de segurança

- Nenhum teste deste projeto usa lead real por padrão.
- Prompts e protótipos de design não recebem payloads, telefones, nomes de clientes ou segredos.
- Novas tabelas usam RLS e permissões explícitas.
- Segredos de rotinas devem sair de comandos agendados e ir para armazenamento seguro.
- Publicação e reprocessamento continuam restritos à gestão.

## Definição de 10/10

A Central só recebe nota 10 quando:

- criar e publicar um fluxo válido é suficiente para fazê-lo rodar;
- desligar ou não publicar é suficiente para impedir sua execução;
- cada decisão comercial é visível no canvas;
- cada módulo executa apenas seu contrato;
- todo efeito pode ser provado por jornada;
- toda falha para com segurança e pode ser recuperada sem duplicação;
- simulação real e testes de contrato cobrem todos os módulos;
- o gestor não precisa pedir a um programador para descobrir o que aconteceu.
