# Funil 2.0 — contrato de produto

## Princípio

O Funil 2.0 organiza a operação em cinco perguntas, sempre na mesma ordem:

1. Quem é o cliente?
2. Em qual etapa ele está?
3. Qual é o momento dentro dessa etapa?
4. Qual é a única próxima ação oficial?
5. Até quando ela deve ser confirmada?

Abrir o WhatsApp ou clicar em um botão não conclui uma mensagem. A ação só é
considerada realizada quando o D-API confirma o envio feito pelo corretor no
celular. O histórico exibido na ficha é somente leitura.

## Responsabilidade de cada motor

- **Automação:** executa a distribuição e a roleta. Deve consumir as regras de
  horário, presença, D-API, pendências e suspensão definidas na configuração.
- **Funil:** guarda etapa, momento, obrigação e prazo.
- **Meu Dia:** ordena as obrigações vencidas e próximas do corretor.
- **D-API:** comprova mensagens enviadas e recebidas; nunca é substituído por
  clique de interface.
- **Sara:** lê a conversa, recomenda um momento do vocabulário oficial, aponta
  a próxima ação e fiscaliza coerência e prazo. Não envia mensagem.
- **Performance:** mede exclusivamente os fatos do CRM — prazo, evidência,
  atualização, visita, negociação e resultado comercial.

## Estado real da Sara no laboratório

A Sara do CRM Nova Era está em modo `observer` e seu runner está ligado sobre os
negócios originais. A reavaliação automática das cópias `f2_lead` ainda não está
conectada. Portanto, a interface deve mostrar essa pendência explicitamente e
nunca apresentar um texto de importação como se fosse uma análise nova da Sara.

A conexão definitiva precisa respeitar o corte da conversa feito na pesca. A
Sara do laboratório só pode analisar mensagens registradas depois de
`f2_lead.corte_conversa_em`.

## Aquário

A fonte única da pesca é a etapa canônica `operacao_aquario`: negócio aberto,
negócio sem corretor e lead sem corretor. O seletor não mostra corretor.

Ao pescar no laboratório:

- o original permanece intacto;
- a cópia nasce em `Novo / Primeira abordagem`;
- o prazo inicial é de cinco minutos;
- o responsável não é herdado;
- o histórico anterior fica oculto;
- a conversa da ficha começa no instante da pesca.

## Performance

Performance do CRM não mistura presença genérica do ERP, financeiro ou tarefas
de outros módulos. Ela é dividida em:

### Disciplina controlável

- primeira abordagem no prazo;
- ações dos momentos no prazo;
- confirmação real pelo D-API;
- feedback de visita;
- coerência do momento validada pela Sara;
- pendências e atrasos por corretor.

### Resultado comercial

- respostas;
- visitas agendadas e realizadas;
- negociações;
- propostas;
- vendas.

No laboratório de dois leads, os números são amostra de validação e não devem
ser apresentados como placar definitivo da equipe.
