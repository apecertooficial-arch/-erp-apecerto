# Gestão móvel — cobrança persistente por corretor

Data: 2026-09-21
Branch: `codex/crm-sara-determinismo-20260921`

## Falha reproduzida

A tela móvel do gerente mostrava quantas visitas estavam sem feedback por
corretor e abria a Agenda filtrada, mas não registrava que o gerente havia
cobrado aquela pessoa. Fechar ou recarregar a tela apagava esse contexto
operacional, embora a pendência da visita continuasse existindo.

## Autoridade reutilizada

Não foi criada tabela paralela. O registro usa `central_alerta_acoes`, já
protegida por RLS para perfis de gestão e já consumida pela Central de Comando.
A chave canônica é `visita-feedback-corretor:<corretor_id>`.

## Contrato local

- somente gestão autenticada alcança o comando;
- o servidor recebe apenas o ID do corretor e resolve o nome no banco;
- antes de gravar, o servidor relê `f2_visitas_resultado_pendente` e recusa a
  cobrança quando não existe feedback pendente para aquele corretor;
- o registro grava autor, horário, corretor e lembrete de dois dias;
- registrar cobrança mantém `resolvido=false` e não altera visita, feedback ou
  carteira;
- a obrigação desaparece da interface somente quando a fonte operacional deixa
  de devolver visitas pendentes; o histórico gerencial permanece na tabela.

## Evidência

- 23/23 testes direcionados de gestão/Agenda;
- regressão local completa: 1032/1032;
- TypeScript e lint sem erro;
- navegador sanitizado em 390×844:
  - três corretores renderizados;
  - nenhuma área clicável menor que 44 px;
  - zero overflow;
  - histórico anterior exibido com horário e próximo lembrete;
  - POST sintético permitido somente para `action=charge` e IDs inventados;
  - após registrar a cobrança, a confirmação apareceu e a quantidade de
    visitas pendentes permaneceu em 1;
  - erro de fonte não presumiu zero e fila vazia permaneceu explícita.

## Limites

Esta fatia não envia WhatsApp ou push e não aplica o draft de sincronização
automática de notificações de visita. A criação automática, deduplicação e
resolução no banco continuam dependentes do ensaio da migration em branch
Supabase isolada.

