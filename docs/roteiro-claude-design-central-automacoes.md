# Roteiro de execução no Claude Design — Central existente

Este roteiro usa o briefing técnico `brief-claude-design-central-automacoes.md` como fonte. Os comandos devem ser enviados em sequência. Não enviar todos de uma vez: cada etapa precisa ser revisada antes da próxima.

## Comando 1 — Compreensão e matriz de aderência

Estamos redesenhando a Central de Automações **já existente** no ERP ApêCerto. Não crie um produto novo, outro builder, outro runtime ou uma arquitetura paralela.

Use o ApêCerto Design System vinculado e considere obrigatórias estas fontes da implementação atual:

- rota `/automacoes` dentro do ERP autenticado;
- `app/features/automations/AutomationsWorkspace.tsx`;
- `app/features/automations/automationBuilderRuntime.js`;
- `app/features/automations/CentralOperationsPanel.tsx`;
- `app/styles/automation-builder.css`;
- `app/styles/redesign-apecerto-automacoes.css`;
- `automacoes.mapa_rascunho` como rascunho;
- `automacao_versoes.mapa` como versão publicada;
- mapas compatíveis com `editor.blocks`, `editor.wires` e `automation.blocks`.

Não presuma que leu esses arquivos apenas porque os nomes foram informados. Se o código-fonte ainda não estiver anexado ao projeto, declare essa limitação e trabalhe somente com o inventário funcional fornecido neste comando. Antes de propor mudanças em componentes ou estrutura de arquivos, peça o pacote sanitizado dos arquivos atuais. Nunca complete lacunas inventando comportamento.

A Central atual já possui:

- lista de automações e grupos;
- canvas visual;
- biblioteca de módulos;
- salvar rascunho;
- validação;
- publicação versionada;
- ativar/desativar;
- organizar fluxo;
- histórico de versões;
- monitor;
- painel de saúde;
- fila, quarentena e reprocessamento idempotente;
- freio geral de mensagens.

Os módulos reais e publicáveis são:

- Início;
- Operações de campos;
- Condição;
- Ação;
- Randomizador;
- Distribuir lead;
- Enviar abordagem;
- Aguardar resposta;
- Espera;
- Agente de IA.

Princípio funcional obrigatório: cada módulo recebe uma entrada, executa apenas sua responsabilidade, devolve uma saída e segue somente a conexão desenhada. A IA analisa; apenas uma ação explícita aplica a análise.

Antes de desenhar qualquer tela nova, produza uma matriz com estas colunas:

1. Área ou controle atual.
2. Onde existe hoje.
3. Problema observado.
4. O que será preservado.
5. Reorganização visual proposta.
6. Evolução funcional necessária, se houver.
7. Risco de implantação.
8. Critério de aceite.

Inclua obrigatoriamente na matriz:

- cabeçalho da Central;
- Saúde da Central;
- lista e grupos de automações;
- busca e filtros;
- biblioteca de módulos;
- canvas;
- cartões dos blocos;
- configuração inline dos blocos;
- conexões e saídas de erro;
- barra de comandos;
- salvar versus publicar;
- validação;
- versões;
- monitor;
- simulação;
- quarentena;
- responsividade;
- acessibilidade.

Problemas já confirmados na tela atual:

- abre com “CLARIS | Entrada” e canvas vazio até escolher um fluxo;
- comandos importantes aparecem apenas como ícones;
- configurações extensas ficam dentro dos cartões e tornam o canvas enorme;
- lista de automações e biblioteca disputam espaço;
- expandir Saúde da Central domina a área do construtor;
- o botão Simular ainda não executa uma simulação real;
- o monitor lista eventos, mas não reconstrói uma jornada;
- a Miruna passa sem erros, porém mostra oito alertas repetidos de saída de erro;
- falhas históricas e falhas novas não estão suficientemente separadas.

Nesta etapa, **não desenhe ainda o redesign final**. Entregue primeiro a matriz, o mapa da arquitetura atual e a lista de decisões que precisam de aprovação. Não invente dados nem automações.

## Critério para avançar ao comando 2

Só avançar quando a matriz:

- reconhecer a Central como estrutura existente;
- mapear todos os controles atuais;
- não propor segundo builder ou nova persistência;
- separar mudança visual de mudança funcional;
- preservar mapas e automações publicadas.

## Comando 2 — Redesign do construtor atual

Com base na matriz aprovada, redesenhe **a mesma tela `/automacoes`**. A proposta precisa ser implantável incrementalmente nos componentes atuais e preservar os contratos do banco e dos mapas.

Use a automação existente **Entrada Miruna** como referência real. Ela possui nove blocos e deve continuar representando as mesmas responsabilidades:

1. Entrada por webhook.
2. Mapear campos.
3. Distribuir lead.
4. Criar negócio.
5. Ajustar tags.
6. Enviar abordagem.
7. Notificar o corretor quando concluir.
8. Notificar a gestão quando concluir.
9. Notificar explicitamente quando a abordagem não puder ser entregue.

Não simplifique removendo responsabilidades. Não una Distribuição com Mensagem. Não faça a IA alterar o CRM diretamente. Não crie decisões ocultas.

Desenhe:

1. **Coluna de automações:** grupos, busca, filtros e estados.
2. **Biblioteca recolhível:** módulos agrupados por Entrada, Dados, Lógica, Distribuição, Mensagem, Tempo, IA e CRM.
3. **Canvas dominante:** fluxo horizontal, minimapa, zoom e organizar.
4. **Inspector direito:** configuração do bloco selecionado, em vez de configuração gigante dentro do cartão.
5. **Barra superior textual:** Salvar rascunho, Validar, Testar, Publicar e Ativar/Desativar.
6. **Cartões compactos:** nome, resumo, validade, portas, última execução e contadores.
7. **Saídas de erro visíveis:** com impacto e prioridade, sem alertas repetidos genéricos.

No inspector, sempre mostrar:

- O que recebe.
- O que faz.
- O que devolve.
- Se falhar.
- Configuração atual.
- Exemplo sintético de entrada e saída.

No bloco de distribuição, preserve corretores, pesos, presença e proteções. No bloco de mensagem, preserve grupo, três abordagens round-robin, vídeo antes do texto e instância exata por corretor.

Mostre os estados: rascunho salvo, alterações não salvas, publicado, ativo, inativo, inválido, erro de versão concorrente e automação arquivada.

Entregue o protótipo navegável da tela principal e indique, em cada área, qual componente atual será reorganizado. Não avance ainda para criar um novo backend.

## Critério para avançar ao comando 3

- Todos os controles atuais continuam alcançáveis.
- O canvas ganhou espaço e legibilidade.
- Configuração saiu do cartão sem perder campos.
- Salvar, publicar e ativar não foram confundidos.
- A proposta usa Entrada Miruna sem alterar seu contrato.

## Comando 3 — Simulação, raio-X e exceções como evolução da estrutura atual

Agora desenhe as evoluções funcionais faltantes, integradas ao mesmo construtor e claramente marcadas como “requer implementação”. Não apresente essas funções como se já existissem.

### Simulação segura

- usar somente lead sintético;
- tarja “SIMULAÇÃO — nenhum dado será alterado”;
- percorrer a mesma versão do mapa;
- exibir entrada, operação, saída, ramo, efeito previsto, tempo e erro por bloco;
- permitir falhas controladas: sem corretor elegível, instância desconectada, vídeo instável e IA indisponível;
- impedir tecnicamente escrita, mensagem, notificação ou chamada externa.

### Raio-X por jornada

- agrupar por `execution_id` e versão;
- mostrar bloco a bloco;
- mostrar distribuição e motivo da escolha;
- mostrar vídeo e texto na ordem;
- diferenciar aceito, confirmado, entregue e lido;
- mostrar retentativas;
- mostrar análise da IA e aplicação explícita;
- mostrar valor anterior e novo;
- separar falha nova de passivo histórico.

### Caixa de exceções

- automação, versão, bloco e motivo;
- classificação recuperável ou definitiva;
- efeito interrompido;
- tentativas;
- ação “Reprocessar com segurança” explicando idempotência;
- ação para abrir o bloco responsável;
- filtros por atual, histórico, distribuição, mensagem, IA e ação.

Integre essas telas à proposta aprovada. Não crie outro painel separado do produto.

## Comando 4 — Handoff implementável

Finalize com uma matriz de implementação, sem escrever regras de negócio novas:

1. Tela/componente.
2. Arquivo atual afetado.
3. Mudança visual.
4. Mudança funcional.
5. Dados existentes reutilizados.
6. Novo dado necessário, se houver.
7. Compatibilidade com mapas publicados.
8. Testes exigidos.
9. Ordem segura de implantação.
10. Critério de rollback.

Separe o plano em:

- Fase A: reorganização visual sem mudança de comportamento.
- Fase B: registro canônico dos contratos de módulos.
- Fase C: simulação sem efeitos.
- Fase D: raio-X e caixa de exceções.
- Fase E: modularização incremental do runtime atual.

Inclua testes de desktop, teclado, contraste, zoom, canvas extenso, publicação concorrente, mapas antigos e rollback de versão.

O resultado final deve ser uma evolução aplicável à Central existente, nunca uma segunda implementação.
