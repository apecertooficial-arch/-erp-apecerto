# Trace — visita, resultado e cobrança

Atualizado em: 2026-09-19
Estado: fatia em reconstrução; sete correções P0/P1 locais validadas

## Contrato atual comprovado

`Agenda web/app → GET /api/agenda → ncrm_agenda_corretor +
f2_visitas_resultado_pendente → fila de cobrança →
PATCH /api/agenda registerVisitResult → f2_registrar_resultado_visita`

- desktop e aplicativo usam a mesma API e a mesma RPC de gravação;
- resultado exige `status`, motivo compatível e justificativa útil;
- a fila permite leitura ao gestor ou ao corretor dono da carteira;
- as duas APIs locais de gravação exigem que o usuário seja o corretor dono;
- o resultado atualiza visita, lead, próxima ação e histórico;
- a fila inclui visita passada ainda agendada/confirmada e encerramento sem
  motivo ou justificativa suficiente.

## Falha P0 reproduzida e corrigida localmente

Antes, qualquer erro de `f2_visitas_resultado_pendente` era convertido em
`itens: []`. Web e aplicativo exibiam zero pendências, embora o banco pudesse
estar indisponível. Isso viola o requisito operacional de nunca perder a
cobrança pós-visita.

Agora a API devolve `pendencias_resultado_erro` sem expor detalhes internos. A
agenda continua utilizável, mas web e aplicativo mostram um alerta explícito e
uma ação de nova tentativa. A interface só apresenta a fila vazia quando a
consulta foi concluída com sucesso.

Uma segunda falha foi confirmada por contagem agregada no banco: setembro tinha
8 pendências, enquanto 53 pendências de agosto ficavam invisíveis porque a API
consultava somente o mês selecionado. Nenhum nome, telefone ou registro de
cliente foi lido. A API local agora consulta uma janela operacional de 365 dias,
o máximo seguro dentro do limite vigente da RPC, e deixa de vincular a cobrança
ao mês exibido no calendário. Isso cobre integralmente o histórico atual, que
começa em agosto de 2026.

A fila também permitia que a gestão abrisse o formulário e registrasse o
resultado no lugar do corretor. A interface foi fechada para esse atalho: a
gestão agora vê pendências agrupadas por responsável, quantidade e idade, mas
somente o corretor dono recebe a ação `Responder`. Web e aplicativo repetem a
mesma regra. Isso não substitui o futuro escalonamento persistido; apenas impede
que a cobrança seja confundida com execução pelo gerente.

As duas entradas de gravação (`/api/agenda` e `/api/funil2`) agora também
confirmam, no servidor, que o usuário atual é o corretor dono do card antes de
chamar a RPC. Gestor, usuário sem carteira e corretor diferente falham de forma
fechada. A RPC remota ainda aceita o administrador diretamente por reutilizar
`f2_pode_operar_lead`; portanto a invariável só estará completa quando a mesma
regra existir no banco por migration aditiva validada em ambiente isolado.

O formulário compartilhado por desktop e aplicativo passou a exigir, nas
visitas realizadas, presença/acompanhantes, percepção, pontos positivos e
negativos, objeções, alternativas oferecidas, definição atual e próxima ação.
As respostas formam um envelope legível e versionado `FEEDBACK_VISITA_V1`, com
até 800 caracteres, preservando compatibilidade com o campo textual atual e
permitindo promoção futura para JSONB sem descartar o histórico da transição.

A exigência não ficou somente na interface: `/api/agenda` e `/api/funil2`
rejeitam texto livre que tente encerrar uma visita realizada sem o envelope. O
draft de banco repete a validação, além do ownership já preparado. Cancelamento
e não comparecimento continuam usando motivo compatível e justificativa, sem
forçar perguntas próprias de uma visita que não ocorreu.

A qualidade agora é calculada por uma rubrica determinística de dez critérios,
um ponto por critério, sem nota opaca de IA: participantes, contexto dos
acompanhantes, percepção, positivos, negativos, objeções, alternativas,
definição, próxima ação e detalhamento operacional da próxima ação. Interface e
APIs exigem no mínimo 9/10; o formulário mostra a nota e as pendências enquanto
o corretor escreve. O draft de banco repete a mesma barreira e registra a nota
no evento, mas segue fora de migrations e não foi aplicado.

A gestão agora recebe um resumo factual da fila: total sem feedback válido,
quantos corretores estão envolvidos, quantos casos têm dois dias ou mais, idade
da pendência mais antiga e eventual visita sem responsável. Não é uma nota de
performance: o resumo deliberadamente não projeta conversão ou qualidade sem
evidência persistida. Desktop e aplicativo repetem o mesmo cálculo.

## Evidência

- teste escrito antes da correção falhou no comportamento anterior;
- testes direcionados após a barreira nas APIs: 63/63 passaram;
- gate frontend oficial ampliado com os novos contratos: 450/450 passou;
- ESLint dos arquivos alterados: passou;
- build Vinext completo: passou;
- `git diff --check`: passou.
- navegador desktop 1600 × 1000: 2 grupos, 3 cobranças, 0 botões de resultado
  para a gestão, largura do documento igual à viewport e console limpo;
- navegador móvel 375 × 844: 3 cobranças com responsável/idade, 0 botões de
  resultado para a gestão e nenhum overflow horizontal;
- perfil corretor no navegador: 2 pendências próprias com `Responder`, uma de
  terceiro somente leitura, formulário validado e erro de escrita explícito no
  harness que bloqueia mutações;
- estado de erro no navegador: alerta, calendário preservado e nova tentativa.
- navegador celular 390 × 844 e desktop: formulário estruturado completo,
  envio inicialmente bloqueado, liberação somente após todas as respostas e
  tentativa de PATCH interceptada pelo harness sem efeito externo;
- gate atualizado: 510/510 testes frontend, 20/20 contratos direcionados,
  typecheck, ESLint direcionado e build completo aprovados.
- gate atual após a rubrica de qualidade: 520/520 testes frontend e 16/16
  contratos direcionados de agenda/feedback; typecheck, ESLint e build passaram;
- navegador desktop 1440 × 1000 e celular 390 × 844: nota 0/10 explica o que
  falta, feedback sanitizado chega a 10/10, botão de salvar é liberado e nenhuma
  mutação foi enviada.
- gate após o resumo gerencial: 521/521 testes frontend, typecheck, ESLint e
  build aprovados; navegador desktop e 390 × 844 mostram 3 cobranças, 2
  corretores, 3 casos com 2+ dias e idade máxima de 33 dias, sem permitir que o
  gerente responda pelo corretor.

## Lacunas ainda abertas

1. A correção local cobre os últimos 365 dias e todo o histórico atual, mas o
   contrato definitivo precisa manter a pendência sem prazo de expiração. Isso
   exige migration aditiva, paginação e teste isolado antes de produção.
2. O formulário agora cobre acompanhantes, percepção, pontos
   positivos/negativos, objeções, alternativas, intenção e próxima ação. O
   produto visitado já vem da visita, mas múltiplos produtos e proposta
   financeira estruturada ainda precisam do modelo JSONB definitivo.
3. A rubrica e o resumo gerencial estão validados localmente, mas persistência
   produtiva, cobrança progressiva, confirmação do gerente e histórico de
   qualidade por corretor ainda não estão comprovados ponta a ponta.
4. A validação autenticada no navegador local depende de configuração pública
   segura do Supabase; nenhum segredo foi copiado ou criado.
5. A base possui notificações de visita próxima, mas não foi encontrada uma
   notificação persistente pós-visita ligada à visita/card para cobrar corretor
   e escalar à gestão. Logo, o aviso progressivo ainda não existe de ponta a
   ponta.
6. A RPC de gravação ainda permite o atalho administrativo direto no banco. As
   APIs locais já o bloqueiam, mas a defesa em profundidade depende de migration.
7. Contrato privado, upload server-side, consulta, interface compartilhada e
   dispatcher cron → Edge → claim estão preparados localmente. O dispatcher
   nasce desligado e sem segredos. Ainda faltam ensaio SQL/Deno e validação
   autenticada com persistência antes de anunciar áudio como funcional.

## Contrato de banco preparado, ainda não aplicado

O schema remoto foi revalidado por metadados em 2026-09-19, sem ler linhas com
PII:

- `f2_registrar_resultado_visita` é `SECURITY DEFINER`, contém
  `f2_pode_operar_lead` e não contém `current_broker_id`;
- a definição produtiva tem SHA-256
  `4f9cc889bdc980a10843e810f7d1417c5bd055b3f207e43ec17f5edbbd68ec88`;
- `ncrm_notificacao` ainda não possui `visita_id`;
- existem zero notificações abertas de visita/feedback no recorte agregado;
- nenhum cron ativo chama um sincronizador de feedback pós-visita.

O contrato aditivo está em `P0_VISITA_OWNER_COBRANCA_DRAFT.sql`. Ele propõe:

- ownership pelo `current_broker_id` igual ao dono do card, com locks sobre
  visita e card;
- vínculo direto `ncrm_notificacao.visita_id` e FK sem exclusão em cascata;
- no máximo uma cobrança aberta por `visita + público`;
- prazo do corretor por `feedback_visita_min` e escalonamento de gestão em duas
  vezes esse prazo;
- resolução imediata quando o corretor registra feedback válido;
- nota de qualidade 0–10 com mínimo 9, repetida no banco e auditada no evento;
- reconciliador privado a cada dez minutos, somente in-app;
- push/WhatsApp desligados até autorização separada.

Os seis testes do contrato e os 23 testes combinados de visita/Sara passaram. O
gate frontend oficial, agora incluindo os contratos de banco, passou 450/450.
Isso prova a coerência estática do contrato, não sua execução no Postgres.

O draft complementar `P1_VISITA_FEEDBACK_AUDIO_DRAFT.sql` evita o bucket
`chat-midia` público e propõe armazenamento privado append-only, hash, limites
de MIME/tamanho, ownership, claim service-only e retry com backoff. A fonte
local `f2-feedback-visita-transcrever` verifica segredo, bytes e SHA-256 antes
de chamar a transcrição, com timeout e erro sanitizado. A API e a interface
falham fechadas sem a migration, usam o JWT do corretor no Storage e exigem
confirmação humana para levar a transcrição ao resumo. O dispatcher limitado e
service-only lê três segredos nomeados do Vault, possui lease/retry e nasce
desligado. Seus 8/8 contratos e o
gate frontend 521/521 passaram; desktop e 390 × 844 foram validados com dados
sanitizados e zero mutações. Nada foi aplicado ou enviado.

## Próximo gate

Gerar a migration pela CLI oficial em ambiente isolado, aplicar o contrato e
executar cenários de corretor dono,
gestor, corretor diferente, troca de dono, concorrência, retry, resolução e
cron ainda com `enabled=false`. Rodar advisors de segurança/desempenho. A
ativação, os segredos e qualquer chamada externa exigem cutover separado;
nenhuma aplicação produtiva ou efeito externo está autorizado por este draft.
