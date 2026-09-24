# Trace — entrada pública de leads

Atualizado em: 2026-09-24

## Base verificada

- repositório canônico: `https://github.com/apecertooficial-arch/-erp-apecerto.git`;
- base: `origin/main` em `3969f08aaab79fc51ffe3290f9d35523d3da1b90`;
- Edge Function produtiva: `entrada`, versão 23, ativa, `verify_jwt=false` e
  pacote `7513b214a045b69cf1fcfc8c1274f7f98422a096141c846fe5ac922403703ece`;
- automação produtiva 73 (`Entrada Autoral`) publicada e ativa na versão 174;
- nenhuma função, configuração ou linha produtiva foi alterada nesta prova.

## Falhas reproduzidas no código publicado

- corpo sem limite real podia consumir memória antes de ser recusado;
- identificador de automação aceitava inteiro fora da faixa segura;
- resposta de consulta/fila era usada sem validar HTTP e formato;
- erro do Postgres e exceção inesperada podiam atravessar no campo `detail`;
- payload profundo ou com campos de protótipo não era recusado;
- configuração ausente só falhava depois de montar chamadas inválidas.

## Contrato publicado

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

- testes direcionados de entrada e automações: 55/55;
- prova produtiva sanitizada em transação com `ROLLBACK`: a primeira chamada da
  chave sintética criou uma fila, a repetição retornou `duplicado=true` com o
  mesmo `fila_id`, e os módulos publicados materializaram exatamente 1 lead, 1
  negócio e 1 card;
- a prova executou apenas entrada, campos e criação de negócio/card. O bloco de
  abordagem externa não foi chamado;
- após o rollback, evento de entrada, fila, lead, negócio e card da prova ficaram
  todos em zero;
- o fluxo positivo completo por HTTP não foi disparado contra a automação
  comercial, porque isso atravessaria o bloco de abordagem real.
