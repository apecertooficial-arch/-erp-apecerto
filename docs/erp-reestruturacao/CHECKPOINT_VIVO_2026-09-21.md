# ERP ApeCerto — checkpoint vivo

Atualizado em: 2026-09-21

## Objetivo ativo

Fechar primeiro as jornadas que protegem receita: entrada e distribuição do
lead, Sara determinística, próxima ação, visita, feedback e cobrança gerencial,
com desktop/mobile, autorização server-side e evidência.

## Autoridades confirmadas

- repositório: `https://github.com/apecertooficial-arch/-erp-apecerto.git`;
- aplicação publicada: `main` / `2e05089c5a3684d00a94402cfaf351d92d727928`;
- Supabase: `diaegvfveqezispcthwk`;
- trabalho: `codex/crm-sara-determinismo-20260921`;
- produção web: `https://apecerto-erp.onrender.com`.

## Concluído e publicado

- `entrada` Supabase Edge Function versão 23, hash
  `7513b214a045b69cf1fcfc8c1274f7f98422a096141c846fe5ac922403703ece`;
- início móvel do gerente publicado no build
  `27b8f960ab22f6fa682ec866c0f540ebba746ed1`: visitas sem feedback são
  atribuídas por corretor e a cobrança abre a Agenda;
- limite real de 256 KiB, JSON/ID validados, erros internos redigidos e retorno
  da fila validado;
- smoke de produção sem efeito comercial: 200/400/405/413 conforme contrato;
- branch e evidências preservadas no remoto.

## Concluído localmente

- confirmação explícita de ação operacional no CRM, desktop e celular;
- draft fail-closed para evento `lead.action_confirmed` e fila idempotente;
- drafts reversíveis para ownership/qualidade/cobrança de visita e áudio;
- quatro fontes já aplicadas da Sara recuperadas do histórico remoto;
- draft da janela de conversa: 90 s de silêncio, teto de 10 min;
- função produtiva de preservação de dono confirmada: identidade por IDs,
  telefone/e-mail; visita e negociação mantêm o corretor anterior.

## Verificações

- regressão sem o HTML compilado: 1004/1004;
- recorte gestão móvel/Agenda: 39/39, typecheck e lint;
- gestão móvel validada em navegador real 390×844: sem overflow, alvos de
  44 px, deep link `/agenda`, estado de erro fail-closed e console limpo;
- produção validada autenticada no build `27b8f960`: 59 pendências no snapshot
  consultado, soma por corretor consistente, seis cobranças acionáveis, sem
  overflow nem console de erro; nenhum dado foi alterado;
- Sara/dispatcher/janela: 48/48;
- entrada/distribuição/ownership: 66/66;
- CRM validado em navegador sanitizado desktop e 390×844;
- aplicação compilou antes da última mudança exclusiva de Edge/SQL/documentação.

## Gates e riscos

- banco remoto possui 336 migrations sem arquivo mesmo após a recuperação;
- projeto principal Supabase está com status de migrations `MIGRATIONS_FAILED`;
- drafts de banco não serão executados em produção sem ensaio isolado;
- branch Supabase isolada custa US$ 0,01344/h; gate solicitado: até 4 h,
  máximo US$ 0,05376, exclusão após evidência;
- aproximadamente 1,1 GiB livre impede manter `dist/` e restauração local grande;
- fluxo positivo da entrada não foi exercitado contra campanha real para não
  criar lead nem disparar WhatsApp.

## Próximo passo

Com aprovação do custo: criar a branch Supabase, executar os drafts com dados
sintéticos, testar concorrência/rollback e promover apenas o contrato aprovado.
Sem essa aprovação: continuar inventário e correções locais independentes.
A próxima autoridade incompleta é a persistência/resolução da cobrança; a fila
visual do gerente já inclui em produção a dívida de feedback de visita por
corretor.
