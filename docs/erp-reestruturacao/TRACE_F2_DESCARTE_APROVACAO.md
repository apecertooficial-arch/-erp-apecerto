# Rastreio — descarte de lead com aprovação da gestão

Atualizado em: 2026-09-19

## Regra operacional

O corretor pode solicitar o descarte com motivo canônico e detalhe. O lead,
seu histórico e suas tarefas permanecem intactos enquanto a solicitação estiver
pendente. Somente gestor ou administrador podem aprovar ou rejeitar. A rejeição
mantém o lead na carteira; a aprovação registra a decisão e só então marca o
card como descartado.

## Falha reproduzida

A função remota `public.f2_descartar_lead(uuid,int,text,text)` ainda concede ao
dono do card a capacidade de preencher `descartado_em` imediatamente. Ela não
modela solicitação, decisão ou rejeição gerencial. As funções legadas
`solicitar_descarte` e `aprovar_descarte` operam outra autoridade (`negocios`)
e não corrigem o contrato do Funil 2.

A definição remota inspecionada possui SHA-256
`221449da857474a39b0fae8012ef3f487ff11f57777f7a60f21a8444ed9a610e`.
Nenhuma linha de cliente foi consultada.

## Correção local

- a API não chama mais a porta de descarte imediato e devolve conflito se um
  cliente antigo tentar usar essa ação;
- `solicitarDescarte` usa versão otimista e chave idempotente;
- `decidirDescarte` é uma operação separada, restrita à capacidade devolvida
  pelo servidor;
- desktop e aplicativo mantêm o lead visível e explicam o estado pendente;
- a gestão recebe uma fila com ações explícitas `Manter na carteira` e
  `Aprovar descarte`;
- se o contrato novo ainda não existir no banco, a interface falha fechada sem
  derrubar a leitura normal do CRM;
- o draft `P0_F2_DESCARTE_APROVACAO_DRAFT.sql` cria autoridade única, RLS,
  idempotência, lock, revisão otimista, eventos auditáveis e revoga a execução
  humana da função antiga. Ele está fora de `supabase/migrations` e não foi
  aplicado.

## Evidência

- 10/10 contratos específicos aprovados;
- 538/538 testes do gate frontend aprovados;
- TypeScript aprovado;
- ESLint completo sem erros; dez avisos preexistentes;
- build Vinext completo aprovado;
- navegador real sanitizado em desktop 1440 × 1000 e aplicativo 390 × 844;
- botão de envio desabilitado sem motivo e habilitado após motivo válido;
- fila gerencial validada nos dois formatos;
- sem overflow horizontal, envio, PII ou mutação externa.

## Estado e gates restantes

Classificação: **parcial localmente comprovado**. A interface e o contrato da
aplicação estão cobertos, mas a invariável ainda não existe no banco produtivo.

Antes de publicar a função como pronta:

1. compilar e ensaiar o SQL em Postgres/Supabase isolado;
2. testar negações para anônimo, corretor alheio e gestor fora de escopo;
3. testar concorrência, repetição e conflito de versão;
4. aplicar migration aditiva somente com autorização específica;
5. validar persistência e auditoria no ambiente aprovado;
6. só depois remover ou adaptar chamadores legados comprovadamente substituídos.
