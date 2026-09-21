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

- autoridade visual do CRM consolidada em `app/styles/funil.css`: o layout e o
  harness carregam a mesma folha e a injeção pública duplicada foi removida;
- regras de trilhas incorporadas à mesma autoridade visual; a folha paralela
  `funil-trilhas.css` não é mais carregada;
- CRM desktop validado em 1440×900 e aplicativo em 390×844, com menu/rota
  coerentes, trilhas separadas, console limpo, zero overflow e alvos móveis de
  44 px;
- erro móvel agora é anunciado como alerta e estados vazios como status;
- gerente pode registrar de forma auditável que cobrou um corretor por feedback
  de visita; o comando reutiliza `central_alerta_acoes`, confirma no servidor
  que a pendência ainda existe e não marca a visita como resolvida;
- confirmação explícita de ação operacional no CRM, desktop e celular;
- draft fail-closed para evento `lead.action_confirmed` e fila idempotente;
- drafts reversíveis para ownership/qualidade/cobrança de visita e áudio;
- quatro fontes já aplicadas da Sara recuperadas do histórico remoto;
- draft da janela de conversa: 90 s de silêncio, teto de 10 min;
- função produtiva de preservação de dono confirmada: identidade por IDs,
  telefone/e-mail; visita e negociação mantêm o corretor anterior.

## Verificações

- regressão local completa: 1032/1032;
- cobrança gerencial: 23/23 no recorte gestão/Agenda, typecheck e lint;
- navegador 390×844 confirmou o histórico, o novo lembrete e a permanência de
  1 visita pendente após registrar a cobrança; zero overflow e alvos ≥44 px;
- autoridade visual CRM: 56/56; recorte mobile adicional: 39/39; typecheck,
  lint e build Vinext completos;
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
- recuperação histórica adicional: 22/22 fontes, incluindo uma correlação por
  conteúdo com nome remoto diferente; hashes fixados em testes e nenhum SQL
  executado;
- drafts P0 revalidados: retry de resultado de visita agora é idempotente,
  sucesso parcial visita/lead aborta e a fila de ação usa o novo prazo;
- seis RPCs legadas de carteira agora possuem draft local de ownership, gestão,
  ACL, idempotência e etapa escopada ao funil, coberto por 6/6 testes; nenhuma
  definição foi aplicada;
- dez RPCs internas adicionais de D-API, WhatsApp, distribuição, funil,
  Sara/cascata e performance possuem draft de ACL somente interna; o wrapper de
  sessão foi limitado à própria identidade e a `login/logout/online`, coberto
  por 5/5 testes; nenhuma definição foi aplicada;
- seis RPCs internas de avaliação de IA, vínculo/histórico WhatsApp, guardião e
  redistribuição possuem segundo draft de ACL somente interna, coberto por 3/3
  testes; nenhuma ACL foi aplicada;
- dez RPCs internas de agente, IP, projetos, presença, SLA e backfill/histórico
  WhatsApp possuem terceiro draft de ACL somente interna, coberto por 3/3
  testes; nenhuma ACL foi aplicada;
- webhook DataCrazy legado foi classificado para quarentena: zero movimentos,
  nenhuma chamada atual no código e segredo configurado abaixo do mínimo; draft
  fecha acesso público sem ler/rotacionar segredo, coberto por 3/3 testes;
- ficha pública possui draft que leva ao banco as proteções hoje contornáveis da
  API: resposta sem PII, 32 KiB, allowlist, consentimento, estado editável e ACL,
  coberto por 5/5 testes; nenhum token ou registro foi consultado;
- CRM validado em navegador sanitizado desktop e 390×844;
- aplicação compilou depois da consolidação visual do CRM; rota `/crm` presente
  no artefato de build.

## Gates e riscos

- `f2_confirmar_acao` e `f2_registrar_resultado_visita` são `SECURITY DEFINER`,
  executáveis por `authenticated` e sem ownership interno; APIs mitigam a rota
  normal, mas não impedem RPC direta;
- seis RPCs legadas adicionais de ação, descarte e transferência possuem bypass
  de autorização confirmado; `registrar_acao` e `transferir_negocio` também
  continuam executáveis por `anon`;
- dez rotinas operacionais internas continuam executáveis diretamente por
  `authenticated`; `perf_log_sessao` também está aberto a `PUBLIC`/`anon` e
  aceita os 39 tipos de performance, inclusive eventos comerciais;
- outras seis rotinas internas sem guarda continuam executáveis por
  `authenticated`; uma delas redistribui carteira usando etapa global, e o
  guardião histórico correspondente está inativo no cron produtivo;
- dez rotinas adicionais de manutenção e histórico continuam executáveis por
  `authenticated`; `wa_move_respondeu` também resolve a etapa globalmente, sem
  escopo de pipeline;
- webhook DataCrazy privilegiado continua aberto a `PUBLIC`/`anon` com fallback
  embutido; não existe uso persistido, mas a ausência de histórico ainda não
  autoriza sua remoção;
- RPCs da ficha pública continuam expondo PII e escrita ampla a chamadas diretas
  com token; não há expiração/rotação do link no schema atual;
- vinte e duas migrations adicionais foram recuperadas por hash remoto, sem
  executar SQL; uma delas foi identificada somente pelo conteúdo porque o nome
  histórico local divergia do nome aplicado;
- banco remoto possui 314 migrations sem arquivo mesmo após a recuperação;
- projeto principal Supabase está com status de migrations `MIGRATIONS_FAILED`;
- drafts de banco não serão executados em produção sem ensaio isolado;
- branch Supabase isolada custa US$ 0,01344/h; gate solicitado: até 4 h,
  máximo US$ 0,05376, exclusão após evidência;
- aproximadamente 285 MiB livres depois de criar a worktree isolada de release;
  o `dist/` anterior ocupa cerca de 460 MiB e o novo build aguarda autorização
  explícita para remover somente esse artefato regenerável;
- fluxo positivo da entrada não foi exercitado contra campanha real para não
  criar lead nem disparar WhatsApp.
- `app/styles/funil-2.css`, `app/styles/funil-trilhas.css` e
  `public/funil-web-sexta.css` estão depreciados e não são carregados, mas foram
  preservados até a primeira validação publicada e confirmação do rollback;
  não devem voltar a receber correções.

## Próximo passo

Com aprovação do custo: criar a branch Supabase, executar os drafts com dados
sintéticos, testar concorrência/rollback e promover apenas o contrato aprovado.
Sem essa aprovação: continuar inventário e correções locais independentes.
A próxima autoridade incompleta é a persistência/resolução da cobrança; a fila
visual do gerente já inclui em produção a dívida de feedback de visita por
corretor.
