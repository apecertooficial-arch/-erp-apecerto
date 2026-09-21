# ERP ApeCerto — checkpoint vivo

Atualizado em: 2026-09-21

## Objetivo ativo

Fechar primeiro as jornadas que protegem receita: entrada e distribuição do
lead, Sara determinística, próxima ação, visita, feedback e cobrança gerencial,
com desktop/mobile, autorização server-side e evidência.

## Autoridades confirmadas

- repositório: `https://github.com/apecertooficial-arch/-erp-apecerto.git`;
- aplicação publicada: `main` / `b75aa537ac4af05d3115344876b3a9dc5bc6d39e`;
- Supabase: `diaegvfveqezispcthwk`;
- trabalho: `codex/crm-sara-determinismo-20260921`;
- produção web: `https://apecerto-erp.onrender.com`.

## Concluído e publicado

- `entrada` Supabase Edge Function versão 23, hash
  `7513b214a045b69cf1fcfc8c1274f7f98422a096141c846fe5ac922403703ece`;
- início móvel do gerente publicado no build
  `27b8f960ab22f6fa682ec866c0f540ebba746ed1`: visitas sem feedback são
  atribuídas por corretor e a cobrança abre a Agenda;
- cobrança focada publicada no build
  `04ab7759499b4cfa151b4e7af3ec66deb0273e48`: cada cartão abre somente as
  pendências do corretor selecionado e permite voltar à fila completa;
- fonte da Edge `entrada` consolidada na `main` no build `b4056a25`; os dois
  arquivos conferem byte a byte com a versão remota 23 ativa;
- quatro migrations já aplicadas da Sara recuperadas na `main` no build
  `b75aa537`; os IDs remotos e hashes dos arquivos foram confirmados, sem
  executar SQL;
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

- regressão sem o HTML compilado: 1006/1006;
- recorte gestão móvel/Agenda: 39/39, typecheck e lint;
- gestão móvel validada em navegador real 390×844: sem overflow, alvos de
  44 px, deep link `/agenda`, estado de erro fail-closed e console limpo;
- produção validada autenticada no build `27b8f960`: 59 pendências no snapshot
  consultado, soma por corretor consistente, seis cobranças acionáveis, sem
  overflow nem console de erro; nenhum dado foi alterado;
- novo deep link validado em harness real 390×844: 2 itens no corretor focado,
  3 ao remover o filtro, uma única leitura GET, 44 px, sem overflow/console e
  falha da fonte sem falso zero;
- pacote isolado sobre `main`: 984/984, typecheck, lint e build completo com os
  arquivos públicos exatos do commit;
- produção `04ab7759` validada autenticada em 390×844: seis cobranças na origem,
  11 itens no primeiro corretor exercitado, 59 ao remover o filtro, botão de
  44 px, sem overflow e sem console de erro; nenhuma escrita foi feita;
- Sara/dispatcher/janela: 48/48;
- entrada/distribuição/ownership: 66/66;
- promoção isolada da fonte `entrada`: 14/14 e paridade remota exata;
- fontes do runtime Sara: 4/4, quatro IDs remotos confirmados e hashes iguais;
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
