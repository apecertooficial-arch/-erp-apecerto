# Miruna — conclusão do motor e regra de monitoramento

## Conclusão

Não há evidência de bug do motor. A versão publicada 124 concluiu 19 entradas, mantém a indisponibilidade como pendência (não como sucesso nem erro terminal), reavalia em até 300 segundos e registra alerta na primeira tentativa e a cada 30 tentativas. No caso observado, os sete corretores configurados estavam inelegíveis por `fora_do_escritorio` durante a janela oficial.

## Regra operacional proposta

- Fora da janela: informativo; nenhuma intervenção.
- Até 15 minutos na janela: aguardar a reavaliação automática.
- De 15 a 59 minutos: alerta ao gerente para conferir presença e conexão DAPI dos corretores configurados.
- A partir de 60 minutos: crítico operacional; escalar ao gestor, sem reenfileirar até identificar a causa de elegibilidade.

O monitor somente leitura está em `supabase/verificacao/20260827_miruna_distribution_monitor.sql`. Ele não revela PII, não altera disponibilidade e não movimenta leads.

## Quatro registros antigos

Permanecem intocados. São da versão 123, anteriores ao corte de recuperação aplicado na publicação da política. A decisão sobre eles exige autorização separada: manter para auditoria, arquivar administrativamente ou reprocessar individualmente após verificar se ainda há interesse comercial. O padrão seguro é **manter sem reprocessar**.
