# Trace — entrada pública de leads

Atualizado em: 2026-09-20

## Base verificada

- repositório canônico: `https://github.com/apecertooficial-arch/-erp-apecerto.git`;
- base: `origin/main` em `f935431c61a3a52f7558e5e6f6c76ca0dd677db5`;
- Edge Function produtiva: `entrada`, versão 22, ativa e com `verify_jwt=false`;
- o arquivo produtivo recuperado em modo somente leitura corresponde ao contrato
  do `main` antes desta correção;
- nenhuma função foi implantada e nenhum dado/configuração foi alterado.

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

- testes direcionados: 9/9;
- Deno/CLI Supabase não estão disponíveis no ambiente local;
- antes de promoção: executar gate frontend, typecheck, lint/build aplicáveis,
  comparar novamente o hash da função produtiva e obter autorização específica
  para deploy da Edge Function;
- depois de eventual promoção: webhook sintético sem PII deve provar rejeição,
  aceitação, idempotência e enfileiramento sem disparar a automação comercial real.
