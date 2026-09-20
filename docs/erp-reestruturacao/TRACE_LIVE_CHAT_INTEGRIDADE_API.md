# Trace — integridade do Chat ao Vivo

Atualizado em: 2026-09-20
Estado: P0 corrigido localmente; transações e idempotência de agendamento ainda pendentes

## Falhas reproduzidas

`/api/live-chat` devolvia mensagens técnicas do banco e do Storage diretamente
ao navegador. Falhas ao validar instância, carteira, conversa, contato, lead e
corretor eram convertidas em ausência ou `403`, escondendo indisponibilidade.
A leitura detalhada também devolvia o envelope `raw` da mensagem, embora a tela
não o consumisse.

Agendar, cancelar, observar, criar tarefa e abrir ficha de financiamento podiam
confirmar sucesso sem comprovar linha retornada. O aplicativo removia um
agendamento da tela sem verificar a resposta HTTP e convertia falha de leitura
em lista vazia. Uma proposta atualizava o negócio antes de registrar o
histórico; se a segunda escrita falhasse, a interface recebia erro genérico e
podia induzir repetição sobre um efeito já aplicado.

## Correção local

- falhas de banco e Storage são sanitizadas; logs contêm somente operação fixa
  e código técnico, sem telefone, conteúdo, payload ou PII;
- falha de infraestrutura ao validar instância/carteira não vira recusa de
  autorização;
- conversa, contato, lead, instâncias D-API, corretor e negócio falham fechados;
- `raw` e respostas brutas do provedor deixaram de atravessar a API;
- agendamento exige lead visível e telefone correspondente; lista e
  cancelamento repetem a validação server-side;
- abordagem imediata ou programada exige lead, instância e telefone coerentes;
- gravações só confirmam sucesso com linha retornada; cancelamento ausente ou
  já encerrado tem conflito explícito;
- proposta sem negócio afetado retorna conflito; se o histórico falhar depois
  do valor atualizado, a API responde `reconciliacao_necessaria` e orienta não
  repetir;
- a tela separa loading, erro e lista vazia real, preserva a lista anterior
  quando uma atualização falha e só remove agendamento após resposta positiva;
- uma ação já confirmada continua como sucesso mesmo se apenas o reload do
  painel falhar.

## Evidência

- 7/7 contratos específicos do Chat ao Vivo;
- 110/110 no recorte Chat + autorização + idempotência WhatsApp;
- 493/493 no gate frontend completo;
- typecheck, lint focado e build completo aprovados;
- navegador real sanitizado em 1280 px e 390 px: conversa normal, erro inicial e
  erro de agendamentos explícitos, ação de tentar novamente com alvo mínimo de
  44 px, zero falso “0 conversas”, zero mutações e nenhum overflow horizontal.

Nenhum envio real, mutation remota, migration, push ou deploy foi executado.

## Limites ainda abertos

A proposta continua formada por duas escritas e precisa virar RPC transacional
e idempotente. Agendamentos ainda não possuem chave idempotente nem constraint
única no schema catalogado; retry concorrente pode duplicar uma mensagem ou uma
abordagem. O envio de mídia combina upload, provedor e limpeza compensatória;
se a limpeza falhar, o objeto pode ficar órfão — agora isso é observável, mas
ainda exige outbox/retention job.

Essas correções dependem de contrato aditivo, ensaio em Postgres/Storage
isolado e autorização específica antes de qualquer migration produtiva.
