# Documento-base para o Claude Design — Redesign incremental da Central de Automações ApêCerto existente

Este documento contém o escopo completo. Para conduzir o Claude Design sem induzi-lo a criar uma solução do zero, use os comandos faseados de `docs/roteiro-claude-design-central-automacoes.md`.

Este trabalho **não é a criação de uma Central nova**. Redesenhe e reorganize a Central de Automações que já existe no ERP ApêCerto, usando obrigatoriamente o ApêCerto Design System já vinculado ao projeto.

A estrutura atual é a fonte de verdade. Preserve os fluxos, contratos, nomes de módulos, formato dos mapas, estados de rascunho/publicação, versionamento, validação, fila, quarentena, monitoramento e integrações existentes. A proposta visual deve poder ser aplicada incrementalmente sobre o produto atual, sem criar uma segunda Central, um runtime paralelo ou uma experiência desconectada do código real.

Antes de desenhar, trate as informações deste briefing como um mapeamento da implementação existente. Não invente módulos, regras comerciais ou estados. Quando houver uma melhoria ainda não implementada — como a simulação real e o raio-X por jornada — apresente-a como evolução da estrutura atual e indique claramente onde ela entra.

## Objetivo

Queremos elevar a Central existente a uma experiência comparável aos melhores construtores visuais, como ManyChat, sem substituir sua arquitetura funcional. O gestor deve conseguir criar, testar, publicar, acompanhar e corrigir automações sem código. O princípio central já adotado deve ficar mais legível e protegido: cada módulo recebe uma entrada, executa uma única responsabilidade, devolve uma saída e segue somente a conexão desenhada.

## Entrega

Primeiro reproduza a estrutura atual e apresente uma **matriz “como está → como ficará → o que será preservado”**. Depois produza a proposta interativa de redesign sobre essa mesma estrutura, não uma tela isolada. Inclua no mínimo:

1. Central com lista de automações e estado operacional.
2. Construtor visual em canvas.
3. Inspector lateral de um bloco.
4. Biblioteca de módulos.
5. Validação e publicação com resumo de impacto.
6. Simulador com lead sintético e resultado bloco a bloco.
7. Raio-X de uma execução real por jornada.
8. Caixa de exceções/quarentena.
9. Comparação de rascunho com versão publicada.

Para cada tela ou componente proposto, informe:

- qual parte existente ele reorganiza;
- quais dados e ações atuais continua consumindo;
- o que muda somente na apresentação;
- o que exige evolução funcional;
- como a mudança pode ser implantada sem interromper automações publicadas.

## Estrutura existente que deve ser preservada

- Rota atual: `/automacoes` dentro do ERP autenticado.
- Casca React: `app/features/automations/AutomationsWorkspace.tsx`.
- Construtor atual: `app/features/automations/automationBuilderRuntime.js`.
- Painel operacional: `app/features/automations/CentralOperationsPanel.tsx`.
- Estilos atuais: `app/styles/automation-builder.css` e `app/styles/redesign-apecerto-automacoes.css`.
- Persistência: `automacoes.mapa_rascunho` para edição e `automacao_versoes.mapa` para a versão publicada.
- Compatibilidade do mapa: `editor.blocks`, `editor.wires` e `automation.blocks`.
- Estados existentes: rascunho, publicado, ativo, inativo e arquivado.
- Ações existentes: salvar rascunho, validar, publicar, ativar/desativar, organizar, versões, monitor e exportar.
- Operação existente: fila, quarentena, freio de mensagens, contratos de saúde e reprocessamento idempotente.

O redesign não pode renomear ou remover silenciosamente esses contratos. Se sugerir uma substituição visual, mostre o mapeamento exato para o controle atual.

## Arquitetura visual desejada

- Navegação do ERP preservada.
- Coluna de automações à esquerda, com grupos, busca e estados.
- Canvas central dominante, da esquerda para a direita.
- Inspector à direita com configuração e contrato do bloco selecionado.
- Barra superior com comandos textuais: Salvar rascunho, Validar, Testar, Publicar e Ativar/Desativar.
- Estados claros: Rascunho, Publicado, Ativo, Inativo, Com erro e Em atenção.
- Nada importante deve depender apenas de ícone ou tooltip.
- O monitoramento pode ser responsivo; a edição completa é desktop-first.

## Problemas confirmados na tela atual

- A tela abre com o título antigo “CLARIS | Entrada” e canvas vazio até o usuário escolher uma automação.
- A barra principal é quase toda formada por ícones sem rótulo.
- Configurações extensas ficam dentro do cartão; um bloco de mapeamento com dezenas de campos fica enorme e domina o canvas.
- A biblioteca e a lista de automações competem pelo mesmo espaço à esquerda.
- Expandir “Saúde da Central” empurra o construtor e ocupa praticamente toda a área útil.
- O botão Simular existe, mas a tela atual apenas informa que a simulação segura ainda não está disponível.
- O monitor atual é uma lista de eventos, não uma jornada por execução.
- A automação Miruna passa na validação sem erros, mas apresenta oito alertas genéricos de saída de erro ausente, repetidos sem explicar impacto ou prioridade.
- Estados e contadores existem, porém não orientam claramente qual problema é histórico e qual está acontecendo agora.

Resolva esses problemas na arquitetura, não apenas com troca de cores ou espaçamento.

## Biblioteca real de módulos

Agrupe os módulos desta forma:

- Entrada: Início/gatilho.
- Dados: Operações de campos e tags.
- Lógica: Condição e Randomizador.
- Distribuição: Distribuir lead.
- Mensagem: Enviar abordagem.
- Tempo: Espera e Aguardar resposta.
- IA: Agente de IA.
- CRM: Ação e Aplicar análise da IA como ação explícita.

Não apresente o módulo de IA como algo que altera o CRM sozinho. Ele apenas devolve análise estruturada. A alteração ocorre em um bloco de ação separado.

## Contrato visual dos cartões

Cada cartão deve mostrar:

- nome do bloco;
- resumo curto da configuração;
- estado válido, alerta ou erro;
- porta de entrada;
- saídas nomeadas;
- saída de erro para módulos que podem falhar;
- contadores recentes de sucesso, alerta e erro;
- indicação da última execução.

Ao selecionar um cartão, o inspector deve mostrar:

- “O que recebe”;
- “O que faz”;
- “O que devolve”;
- “Se falhar”;
- configuração editável;
- exemplo de entrada e saída, sem dados reais.

## Fluxo de exemplo obrigatório

Use como fluxo real de referência a automação existente **Entrada Miruna**:

Entrada por webhook → Mapear campos e tags → Distribuir lead → Criar negócio → Ajustar tags de produto → Enviar abordagem → Notificar sucesso.

Não recrie esse fluxo com uma estrutura diferente. Reorganize visualmente os mesmos nove blocos e suas conexões atuais. No módulo de distribuição, preserve corretores, pesos, presença e proteções. No módulo de mensagem, preserve grupo, três abordagens em alternância round-robin e instância exata por corretor. A abordagem é composta por vídeo antes do texto; o texto só segue após o vídeo ser aceito/confirmado conforme o contrato.

Inclua ramos de erro visíveis para distribuição, mapeamento, mensagem e notificação.

## Simulação

Crie uma experiência de teste com dados fictícios e uma tarja inequívoca “SIMULAÇÃO — nenhum dado será alterado”. O resultado deve percorrer o canvas e exibir, por bloco:

- entrada;
- operação executada;
- saída;
- ramo escolhido;
- efeito que seria produzido;
- tempo;
- alerta ou erro.

O simulador deve permitir falhas controladas: nenhum corretor elegível, instância desconectada, vídeo instável e IA indisponível.

## Raio-X da execução

Crie uma jornada com linha do tempo agrupada por `execution_id`, versão publicada e lead mascarado. Mostre distribuição, partes da mensagem em ordem, confirmação de entrega, decisões da Sara, aplicação no CRM, retentativas e conexão seguinte. Não use uma lista genérica de logs.

## Publicação

Antes de publicar, apresente uma revisão legível:

- gatilho;
- módulos e conexões;
- campos alterados;
- corretores e presença;
- abordagens e ordem;
- instância por corretor;
- saídas de erro;
- diferenças para a versão ativa;
- teste sintético mais recente;
- erros impeditivos e alertas.

## Caixa de exceções

Mostre falhas que pararam com segurança. Cada item deve informar automação, versão, bloco, motivo, impacto, tentativas e ações disponíveis. A ação “Reprocessar” precisa explicar que mantém a mesma identidade e não duplica efeitos.

Inclua dois estados que o incidente real de 24/08 tornou obrigatórios:

- **Aguardando corretor elegível:** não é erro técnico. O bloco de distribuição mostra candidatos, motivos de inelegibilidade, próxima tentativa, tempo aguardado, SLA configurado e as saídas desenhadas para “elegível encontrado” e “prazo vencido”. Retentativa e prazo pertencem à configuração visível do fluxo; o relógio apenas desperta a mesma execução.
- **Versão histórica incompatível:** mostre versão da execução, contrato que mudou e três desfechos distintos: reprocessar na mesma versão quando compatível; migrar explicitamente para a versão publicada somente sem efeito externo e com auditoria; ou encerrar sem executar. Nunca represente migração de versão como um replay comum.

Na matriz, trate como defeito confirmado a situação em que uma versão publicada anteriormente é rejeitada por uma validação adicionada depois. O critério de aceite é abrir e testar todos os mapas históricos referenciados por fila sem que uma mudança de contrato produza falha silenciosa.

## Direção estética

Siga estritamente o design system vinculado. A Central deve parecer profissional, calma e operacional, com canvas amplo, densidade controlada, laranja da marca para ação primária, roxo para IA/lógica e cores semânticas acessíveis para sucesso, atenção e erro. Evite excesso de cartões flutuantes, ícones sem rótulo, sombras pesadas e painéis que roubem espaço do canvas.

## Restrições

- Não crie uma Central nova, outro builder, outro runtime ou um protótipo sem correspondência com a implementação atual.
- Não altere banco, regras comerciais ou código de produção; esta entrega é o projeto visual incremental que orientará mudanças no produto existente.
- Preserve a compatibilidade dos mapas e das automações já publicadas.
- Diferencie claramente “reorganização visual” de “evolução funcional”.
- Não invente automações prontas fora do escopo.
- Não use dados pessoais, telefones, payloads ou segredos reais.
- Não esconda erro, fallback, versão ou estado de publicação.
- Não trate cron como regra de negócio. Rotinas de relógio apenas transportam eventos criados por automações publicadas.

Comece pela matriz de aderência ao produto atual. Em seguida, redesenhe a tela atual do construtor, usando Entrada Miruna como referência real, e só então produza os estados de simulação, raio-X, publicação e exceções. Abra a tela principal redesenhada para revisão, mantendo visível a correspondência com os controles existentes.
