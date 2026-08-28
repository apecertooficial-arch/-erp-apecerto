# Correção do CRM após auditoria 5,0/10

Data: 28/08/2026

Base inicial: `aa01cbb9d42c40c2f9e9fa2a9e0a798dc73cf037`

Branch: `codex/crm-v3-paralelo-local-20260827`
Ambiente de implementação: local; publicação e revalidação serão registradas ao final.

## Resultado implementado

1. **Fechamento honesto:** Ganho/Perdido deixaram de alterar apenas `f2_negociacao`. A ficha mostra os negócios canônicos e direciona para a Esteira; restauração e Desfazer não são simulados.
2. **Lote protegido:** sem RPC atômica existente, seleção múltipla é bloqueada antes de qualquer PATCH. Movimento individual por menu e arrasto continua no mesmo motor.
3. **Atividades reais:** `GET /api/funil2` consulta `crm_tarefas` sob a sessão/RLS existente e combina tarefas e visitas como objetos distintos.
4. **Conflito humano:** `versao_conflito` não faz retry silencioso; retorna 409 e o estado atual para revisão humana.
5. **Erros honestos:** 401/403/409/422 preservam significado. Falha de tracking após mutação retorna reconciliação necessária. Falhas auxiliares de Sara, canal e configuração não são mascaradas como dado vazio.
6. **Acessibilidade:** o cartão não possui mais controles interativos aninhados; a ação de abrir é um controle irmão com foco visível. Alvos operacionais móveis corrigidos para no mínimo 44 px.
7. **Navegação mobile:** menu Mais respeita o papel recebido pelo shell e expõe somente destinos compatíveis, sem criar permissão no cliente.

## Dados e segurança

- Nenhuma migration, tabela, policy, RLS ou RPC foi criada ou alterada.
- Nenhuma credencial, sessão simulada, fixture de produção ou `service_role` foi adicionada.
- Nenhuma mutação ou comunicação externa foi executada durante a validação.
- `crm_tarefas` é consultada com o mesmo cliente autenticado e as policies existentes.
- Os contratos de banco ainda necessários estão documentados separadamente em [especificacao-contratos-banco-pendentes.md](especificacao-contratos-banco-pendentes.md).

## Testes comportamentais adicionados

`tests/crm-pos-auditoria.test.mjs` cobre:

- semântica HTTP;
- ausência de retry automático em conflito humano;
- bloqueio de lote sem RPC atômica;
- combinação de tarefas e visitas;
- estado vazio real;
- vínculo de `crm_tarefas` ao lead original;
- impossibilidade de fechar só a cópia operacional;
- retorno 409 com estado atual;
- reconciliação após falha de tracking;
- falhas auxiliares visíveis.

## Gates locais

| Gate | Resultado |
|---|---|
| Teste pós-auditoria | 10/10 passou |
| `test:frontend` | 317/317 passou |
| Suíte local ampliada | 534/534 passou |
| Lint dos arquivos alterados | passou |
| Build completo | passou |
| `git diff --check` | passou |
| TypeScript global | dois erros preexistentes em `StudioModule.tsx:267-268`; nenhum erro do CRM |

## Limitação local de navegador

A rota local foi aberta no Chrome real, mas o ambiente local não possui a configuração pública do Supabase e exibiu `Configuração pública do Supabase não encontrada`. Não foi criado bypass nem foram copiadas credenciais para contornar essa proteção. A validação autenticada será feita no build publicado, em modo read-only para dados reais; mutações permanecem comprovadas pelos testes seguros.

## Publicação e reauditoria

Esta seção será completada somente depois de confirmar o commit em `/api/build`, percorrer desktop/mobile em produção, verificar console e recalcular a nota sem arredondar para cima.
