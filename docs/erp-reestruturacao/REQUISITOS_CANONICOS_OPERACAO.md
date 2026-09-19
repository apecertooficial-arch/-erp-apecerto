# Requisitos canônicos da operação ApeCerto

Fonte: decisões fornecidas pelo usuário na conversa de 2026-09-19. Este arquivo
é o contrato funcional para impedir que a reconstrução perca requisitos ou
substitua decisões por conveniência técnica.

## 1. Entrada, identidade e distribuição do lead

- entradas atuais: formulário Meta e formulário do site;
- caminho atual conhecido: Meta/site → Make → HTTP/webhook ERP → automação do produto;
- identidade deve considerar nome, telefone e e-mail, com regras explícitas para
  conflito, ausência e divergência;
- um novo cadastro pode ir para outro corretor quando não existe proteção;
- proteção operacional existe quando o lead está em visita ou negociação;
- lead protegido que entrar novamente deve voltar ao corretor responsável e a
  abordagem prevista deve continuar sendo disparada de forma idempotente;
- cessão voluntária corretor → corretor é permitida, com aceite do destinatário;
- gerente pode redistribuir a carteira;
- toda distribuição, retorno, cessão e aceite precisa de auditoria.

## 2. Atendimento dirigido pela Sara

A Sara deve produzir e persistir cinco resultados:

1. etapa;
2. momento;
3. próxima ação;
4. temperatura;
5. qualidade do atendimento.

Regras:

- o corretor executa a próxima ação; não inventa livremente o fluxo;
- a Sara interpreta o que ocorreu e atualiza o estado operacional;
- não reavaliar a cada mensagem durante uma conversa ativa;
- usar janela de silêncio, evento terminal ou ação concluída para disparar a análise;
- mensagem de cadência enviada precisa retirar o lead da fila desatualizada;
- resultados devem ter versão, origem, horário, auditoria e proteção contra
  processamento duplicado ou fora de ordem;
- falha da IA não pode apagar o estado anterior nem inventar certeza;
- Meu Dia deve refletir ações vencidas, de hoje e futuras.

## 3. CRM e pipelines

- Central de foco é a entrada inteligente da operação;
- Kanban é uma visão operacional complementar;
- gestor pode criar pipelines e etapas com rapidez e de forma determinística;
- automações devem apontar explicitamente para pipeline e etapa válidos;
- captação, atendimento comercial e venda têm jornadas distintas, porém conectadas;
- a esteira de venda precisa cobrir documentação, contrato, leitura, assinatura e pagamento;
- não manter múltiplas autoridades de CRM consultadas simultaneamente;
- legado ativo só pode ser removido depois de dependências, substituição e rollback.

## 4. Visitas e feedback

- corretor agenda, confirma, reage, realiza, cancela ou reagenda;
- depois da visita, feedback obrigatório e estruturado;
- perguntas mínimas: presença, acompanhantes, produtos visitados, percepção,
  pontos positivos/negativos, objeções, alternativas oferecidas, intenção,
  proposta e próximo passo;
- feedback pode ser digitado ou enviado por áudio, com transcrição e confirmação;
- qualidade do feedback recebe avaliação; meta operacional mínima configurável;
- todo cliente visitado precisa de definição explícita e próxima ação;
- cliente sem decisão permanece em carteira de acompanhamento;
- perda/cancelamento usa motivo estruturado e pode exigir aprovação do gerente;
- motivos incluem falta de fit, financiamento negado, busca exploratória,
  produto inadequado, preço e expectativa incompatível com recursos;
- gerente cobra o corretor; não assume o atendimento do cliente;
- tarefa gerencial fecha quando o corretor registra feedback válido e reabre no
  prazo seguinte se a definição continuar pendente.

## 5. Notificações e cobrança

- lembrete inicial após tempo razoável para retorno da visita;
- cobrança progressiva se o feedback continuar pendente;
- alerta explícito ao gerente por cliente e por corretor;
- central de notificações no ERP e aplicativo/PWA;
- push no celular e WhatsApp do gerente são canais desejados;
- som/urgência precisam respeitar permissões do dispositivo e configuração;
- deduplicação, confirmação de entrega e escalonamento auditáveis;
- nenhuma mensagem real é disparada em teste sem ambiente/canal autorizado.

## 6. Performance

Medir por corretor e período:

- tempo de primeira resposta;
- percentual de leads atendidos;
- visitas agendadas por lead recebido;
- visitas realizadas, canceladas e sem feedback;
- tempo e qualidade do feedback;
- ações e atualizações vencidas;
- propostas, conversão e motivos de perda;
- aderência às próximas ações determinadas pela Sara.

O gerente e o CEO precisam distinguir volume, qualidade, atraso e resultado.

## 7. Aplicativo/PWA do corretor

- Meu Dia como entrada;
- botão WhatsApp e resumo do lead;
- pesquisa e cadastro de cliente;
- agenda, visita, reagendamento e cancelamento;
- feedback digitado ou por áudio;
- situação da conexão WhatsApp;
- ganhos, valores previstos e performance conforme autorização;
- interface responsiva, rápida e utilizável em campo;
- estados offline, sincronização pendente, conflito e erro.

## 8. Aplicativo/PWA do gerente

- visitas do dia, recentes e sem direcionamento;
- central de notificações e cobranças;
- tarefas por corretor e resolução automática pela evidência registrada;
- bloqueio de horário pessoal na agenda;
- visão de performance;
- acesso à Sara para perguntas operacionais com respostas fundamentadas nos
  dados autorizados;
- CEO/gestor consegue verificar o trabalho do gerente e dos corretores.

## 9. Produtos, captação e proprietários

- pipeline de captação;
- captador dedicado e corretores podem cadastrar captações;
- proprietário é entidade preservada e relacionada ao imóvel;
- cadastro cobre fotos, vídeos, características, preço e dados necessários;
- IA avalia completude, qualidade e padronização sem publicar sozinha;
- gestor aprova entrada do imóvel no ERP e, separadamente, publicação no site;
- produto aprovado sincroniza com o site por contrato rastreável;
- portal futuro do proprietário: login, imóvel, publicação, visitas e feedbacks;
- notificações ao proprietário dependem de consentimento e configuração.

## 10. Financeiro

- contas fixas, variáveis, caixa, cartão e classificação de despesas;
- entradas, saídas, aportes, faturamento bruto/líquido e previsão de impostos;
- associação de despesas a anúncios, campanhas, vendas e centros de custo;
- comissão por venda, corretor, indicador, sócios, gerente e demais partes;
- corretor visualiza previsto, aprovado, pago e composição;
- somente gestor autorizado executa lançamentos e ajustes sensíveis;
- futuro banco de pagamentos deve ser adapter externo, não autoridade contábil
  escondida no navegador;
- trilha de auditoria, conciliação, idempotência e segregação de permissões.

## 11. Automação determinística

- blocos visuais têm contrato, versão, entradas, saídas e erro explícitos;
- execução é idempotente e observável;
- retries, timeout, dead letter e compensação quando aplicável;
- vínculo entre produto/campanha, pipeline, etapa, corretor e instância é explícito;
- nenhuma regra crítica depende apenas de estado visual no navegador;
- integrações Meta, Make, WhatsApp, site e IA têm adapter e autoridade definidos;
- teste cobre duplicidade, reordenação, atraso, indisponibilidade e resposta parcial.

## 12. Repositório, banco e legado

- provar cópia, remoto, branch, commit, build e Supabase canônicos;
- catalogar todos os módulos e cópias históricas antes de absorver código;
- consolidar autoridades duplicadas por domínio;
- migrations representam o estado real e possuem rollback quando possível;
- remover código, rota, tabela, função, trigger ou aplicativo antigo somente após:
  1. prova de não uso ou substituição;
  2. mapa de dependências;
  3. migração/reconciliação de histórico;
  4. testes positivos e negativos;
  5. backup e rollback;
  6. aprovação para ação destrutiva em produção;
- reorganizar estrutura sem apagar histórico necessário à migração para o S3.

## 13. Identidade visual

- preservar inicialmente logo e cores laranja/roxo;
- nova linguagem unificada, limpa, moderna, responsiva e acessível;
- Central de foco e Kanban V4/V5 são referências iniciais, não produto final;
- KPIs precisam ter métrica, interpretação e ação;
- usar 21st.dev como referência, sem copiar dependência/licença desconhecida;
- mesmos tokens e comportamentos em desktop e aplicativo/PWA.

## 14. Critério de pronto por função

Conforme aplicável:

- contrato rastreável;
- modelo de dados e constraints;
- autorização server-side fail-closed;
- comando/consulta canônicos;
- idempotência, concorrência e revisão otimista;
- auditoria/outbox;
- loading, vazio, filtro vazio, pending, parcial, offline, negado, conflito,
  unknown, erro e sucesso;
- testes de domínio, banco, autorização, API e UI;
- E2E positivo e negativo em navegador real;
- validação desktop e aplicativo/PWA;
- build publicado confirmado e produção revalidada;
- evidência sanitizada e rollback.

## 15. Critério de ERP vendável

Não declarar vendável até existir:

- baseline/versionamento reproduzíveis;
- jornada mínima real ponta a ponta, sem fixtures;
- isolamento e autorização fail-closed;
- ausência de escrita privilegiada pelo navegador;
- provisionamento repetível por imobiliária;
- personalização sem editar o núcleo;
- importação/migração com dry-run, reconciliação e rollback;
- backup restaurado em ambiente isolado;
- observabilidade, runbooks e suporte;
- E2E positivo e negativo;
- piloto controlado com aceite objetivo.
