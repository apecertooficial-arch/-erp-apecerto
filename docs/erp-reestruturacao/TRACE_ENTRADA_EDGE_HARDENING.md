# Trace — entrada pública de leads

Atualizado em: 2026-09-21

## Base verificada

- repositório canônico: `https://github.com/apecertooficial-arch/-erp-apecerto.git`;
- base publicada e `origin/main`: `2e05089c5a3684d00a94402cfaf351d92d727928`;
- branch local isolada: `codex/crm-sara-determinismo-20260921`;
- Edge Function anterior: `entrada`, versão 22, `verify_jwt=false`, hash do
  pacote `019ef84158897e87d0a44c299e851d63fdabbe78b6506c02d10d14a831e0b14e`;
- o arquivo produtivo recuperado em modo somente leitura corresponde ao contrato
  do `main` antes desta correção;
- correção publicada em 2026-09-21 como versão 23, ativa, `verify_jwt=false`,
  hash do pacote `7513b214a045b69cf1fcfc8c1274f7f98422a096141c846fe5ac922403703ece`;
- nenhuma configuração de automação, dado ou schema foi alterado.

## Falhas reproduzidas no código publicado

- corpo sem limite real podia consumir memória antes de ser recusado;
- identificador de automação aceitava inteiro fora da faixa segura;
- resposta de consulta/fila era usada sem validar HTTP e formato;
- erro do Postgres e exceção inesperada podiam atravessar no campo `detail`;
- payload profundo ou com campos de protótipo não era recusado;
- configuração ausente só falhava depois de montar chamadas inválidas.

## Correção local

- limite de 256 KiB durante a leitura do stream;
- profundidade máxima e bloqueio de `__proto__`, `constructor` e `prototype`;
- normalização determinística de contato e JSON canônico para idempotência;
- consulta da automação e retorno da fila validados antes do sucesso;
- conflito de idempotência classificado por código, sem devolver conteúdo bruto;
- erros públicos estáveis e sem exceção, SQL, segredo ou resposta interna.

## Gate de autenticação ainda aberto

Metadados sanitizados da produção mostram 7 automações publicadas e ativas:
1 exige `x-automation-token`; 6 permanecem com webhook público. A correção local
preserva essa compatibilidade para não interromper Meta/Make. Tornar o token
obrigatório exige inventário dos seis emissores, distribuição segura de segredo,
janela de transição, monitoramento e autorização específica de configuração/Edge.

## Evidência e limites

- testes exclusivos da entrada: 9/9;
- conjunto de entrada, automações, distribuição e continuidade do dono: 66/66;
- regressão do repositório sem o teste que depende do artefato compilado: 995/995;
- smoke seguro em produção: `OPTIONS` 200, `POST` sem automação 400,
  JSON inválido 400, método indevido 405 e corpo acima de 256 KiB 413;
- Deno/CLI Supabase não estão disponíveis no ambiente local;
- o teste de HTML compilado não foi repetido porque o artefato `dist/` havia sido
  removido para preservar o disco, que tinha aproximadamente 1,1 GiB livre;
- o fluxo positivo, a idempotência e o enfileiramento não foram exercitados em
  produção sem uma automação sintética isolada, pois isso poderia criar lead ou
  disparar uma automação comercial real.
