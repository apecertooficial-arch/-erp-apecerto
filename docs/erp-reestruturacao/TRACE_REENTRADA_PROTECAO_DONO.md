# Trace — reentrada, identidade e proteção do dono

Estado: correção local preparada; banco não alterado.

## Fluxo confrontado

`Meta/site → Make/webhook → motor_materializar_entrada → negócio → motor_roleta → bloco seguinte de abordagem`

| Passo | Autoridade encontrada | Evidência | Estado |
|---|---|---|---|
| identificar contato | `public.motor_materializar_entrada(jsonb)` | migration `20260820205500_*` | parcial: telefone anulava a busca por e-mail e conflitos não eram explícitos |
| decidir dono | `public.motor_roleta(...)` | migration `20260820171225_*` | parcial: venda ganha e `visitas` legada, sem Agenda/Esteira canônicas |
| visita atual | `public.f2_visita` ligada por `f2_lead.origem_negocio_id` | `f2_salvar_visita` mais recente em `20260911140525_*` | canônica para a Agenda nova |
| negociação atual | `public.f2_negociacao` ligada a `f2_lead` | `f2_salvar_negociacao` e esteira importada | canônica candidata; toda etapa exceto `perdida` protege |
| abordagem | bloco separado `send-approach` | editor + ramo `distribution-simple` | preservado: dono protegido retorna sucesso e segue `nextBlockId` |

## Decisão de identidade

| Situação | Resultado preparado |
|---|---|
| telefone ou e-mail encontra um único lead coerente | reutiliza o lead |
| telefone e e-mail encontram leads diferentes | para com `LEAD_IDENTITY_CONFLICT` |
| uma chave encontra o lead, mas a outra diverge do cadastro | para com `LEAD_IDENTITY_DIVERGENCE` |
| sem telefone e sem e-mail | para com `LEAD_WITHOUT_STRONG_CONTACT` |
| apenas nome igual | não mescla; nome não é identificador único |

As exceções não incluem telefone, e-mail ou nome, evitando PII em logs. Locks
transacionais separados por telefone e e-mail fecham a corrida de duas entradas
simultâneas.

## Decisão de distribuição

| Estado anterior comprovado | Resultado |
|---|---|
| sem visita e sem negociação | pode voltar ao rodízio |
| visita agendada/confirmada em `f2_visita` ou legado | mantém o dono |
| visita realizada em `f2_visita` ou legado | mantém o dono |
| negociação `f2_negociacao` diferente de `perdida` | mantém o dono |
| venda formal ganha | mantém o dono |
| `negocios.status='aberto'` sozinho | não protege; criar um negócio de entrada não pode provar negociação |

`venda` continua aceito como alias dos mapas antigos. Mapas novos passam a
mostrar e salvar `negociacao`, `visita_agendada` e `visita_realizada`.

## Artefatos e gates

- draft aditivo: `P0_REENTRADA_PROTECAO_DONO_DRAFT.sql`;
- contrato: `tests/p0-reentrada-protecao-dono-draft.test.mjs`;
- 52/52 contratos combinados de automação + reentrada aprovados;
- gate frontend 527/527, typecheck, ESLint direcionado e build aprovados;
- navegador real em 1440 × 1000, com fixture sanitizada e rede de produção
  bloqueada: o bloco novo abriu com `Negociação ativa`, `Visita agendada` e
  `Visita realizada` marcados, salvou somente o rascunho e preservou a versão
  publicada;
- o draft está fora de `supabase/migrations`, não foi compilado em Postgres e
  não foi aplicado;
- falta ensaio isolado positivo/negativo com concorrência, depois migration
  versionada, autorização específica de banco e E2E sanitizado no webhook.

## Cenários obrigatórios do ensaio isolado

1. contato novo cria um lead e distribui;
2. mesmo telefone/e-mail sem proteção pode trocar de corretor;
3. visita agendada, realizada ou negociação ativa preserva o dono;
4. retorno protegido ainda percorre o bloco de abordagem uma única vez;
5. telefone e e-mail apontando para pessoas diferentes falham sem mutação;
6. duas entradas simultâneas não criam duplicata;
7. mapa antigo com `venda` e mapa novo com `negociacao` produzem resultado compatível.
