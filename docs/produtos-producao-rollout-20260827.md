# Produtos — relatório do rollout de produção — 2026-08-27

## 1. Decisão

**PRODUÇÃO APROVADA.**

Banco, ERP e site foram publicados progressivamente e permaneceram estáveis no gate final. Não houve correção em massa de preços, status ou conteúdo. Nenhuma integração de IA foi ativada ou usada.

## 2. Backup e possibilidade de retorno

- Projeto de produção confirmado como ativo e saudável, Postgres 17.6.
- Backup físico diário de 27/08/2026 às 07:38:35 UTC disponível no painel oficial com ação de restauração.
- Backups físicos dos sete dias anteriores também estavam disponíveis.
- Rollback de aplicação confirmado no Render por deploy anterior: ERP `757503816681c47efea6d1a586755887afd758af`; site `879b611a7bf3140d4eacceb4cf12ab20a89a01a9`.
- A expansão foi aditiva. A reversão rápida prevista é de aplicação e grants/policies; não usa `DROP COLUMN`.

## 3. Preflight

- `midias`: 2.077 registros, aproximadamente 1,6 MB.
- Mídias órfãs de empreendimento: 0.
- Mídias órfãs de unidade: 0.
- Galerias com múltiplas capas: 0.
- Sessões esperando lock e locks não concedidos: 0.
- Colunas de PII na view pública: 0.
- RLS ativo em `empreendimentos`, `unidades`, `midias`, `proprietarios` e `storage.objects`.
- As 23 colunas-base exigidas pela expansão estavam presentes.
- Findings gerais antigos fora de Produtos foram preservados; nenhum finding de alta gravidade foi introduzido pelo delta.

## 4. Migration de expansão

- Migration local: `20260826193000_produtos_editorial_midias_rascunhos.sql`.
- Registro de produção: `20260827165201_produtos_editorial_midias_rascunhos`.
- Primeira tentativa: recusada transacionalmente por diferença de nome em colunas da tabela privada legada. Rollback confirmado: 0 coluna nova, 0 tabela de rascunho e contagens intactas.
- Correção mínima: commit `91c78dd85032358d1b40047d6936aceed941aeab`.
- Teste direcionado após correção: 8/8.
- Aplicação bem-sucedida: 5,664 s.
- Verificação: 5 colunas editoriais de mídia, 4 colunas editoriais de unidade, tabela privada de rascunho, 12 funções de Produtos e nenhuma ordem nula.
- Assinaturas de integridade de empreendimento e unidade ficaram idênticas antes/depois. Preços, publicação, disponibilidade, aprovação e descrição existentes não foram alterados em massa.

## 5. ERP publicado

- Merge de Produtos: `c597d7f320db38d037a7351eb8eab982585b663b`.
- Versão final servida, já incorporando o commit posterior de tracking: `b61aa7c510f771e6bfec09f992497575513c2279`.
- Produtos abriu autenticado sem 5xx ou erro de console.
- Ficha individual validada com painel de preço, seis abas, galeria, edição, publicar/despublicar, inativar/reativar e excluir.
- A versão final manteve 288 unidades no estoque total e a unidade como imóvel comercial canônico.

## 6. Resultado por perfil

### Gestor

- Sessão autenticada no navegador aprovada.
- Leitura autorizada de proprietário por RPC aprovada.
- Auditoria de preço somente leitura aprovada.
- Controles gerenciais de publicação e ciclo de vida presentes.

### Captador

- Verificação autenticada no banco, sob o papel `authenticated`, aprovada.
- O usuário operacional não foi reconhecido como gestor.
- Proprietário da própria captação ficou visível por RPC.
- Carteira própria de proprietários ficou disponível por RPC.

### Corretor não captador

- Verificação autenticada no banco, sob o papel `authenticated`, aprovada.
- Proprietário de captação alheia retornou vazio, sem PII parcial.

As verificações de captador e não captador foram somente leitura e não alteraram imóveis ou pessoas reais.

## 7. Hardening de proprietário

- Registro de produção: `20260827165810_produtos_proprietarios_pos_deploy`.
- Aplicação: 7,746 s.
- `SELECT`, `INSERT`, `UPDATE` e `DELETE` diretos para `authenticated` ficaram negados.
- RPCs autorizadas continuaram funcionando para gestor e captador.
- Não captador continuou sem acesso a PII.
- View pública permaneceu legível por `anon`.
- O ERP publicado não contém leitura direta de `public.proprietarios` nas rotas de Produtos.

## 8. Site publicado

- Versão final servida: `91aefc981472b80201a828e98aedbc3a796c9b78`.
- Catálogo carregou e expôs deep-links individuais por unidade.
- Ficha individual validada com title, meta description, Open Graph, canonical de unidade e JSON-LD.
- Galeria privativa e áreas comuns do condomínio apareceram separadas.
- HTML não contém chaves de proprietário, contato, captador ou notas internas.
- 25 de 27 imagens observadas na ficha tinham alt text; as duas restantes pertencem ao shell/terceiros, não à galeria editorial da unidade.
- O único erro de console foi do script externo Microsoft Clarity e não afetou Produtos, catálogo, ficha ou conversão.

## 9. Gate final

- Produtos ERP: 72/72.
- Frontend ERP: 291/291.
- Typecheck ERP: aprovado.
- Lint ERP: 0 erros; 20 warnings existentes.
- Build ERP: aprovado.
- Build/verificador do site: aprovado; pacote `81e5f5197b36a499`, seis rotas.
- Site: 97/97.
- `git diff --check`: aprovado nos candidatos.
- Desktop e mobile: sem overflow horizontal no ERP e no site; navegação móvel, ficha e galeria presentes.

## 10. Monitoramento e integridade final

- Build ERP servido: `b61aa7c510f771e6bfec09f992497575513c2279`.
- Build site servido: `91aefc981472b80201a828e98aedbc3a796c9b78`.
- API: 0 respostas 5xx na janela pós-rollout amostrada.
- Postgres: 0 erro relacionado a Produtos na janela pós-rollout; dois erros de outras rotinas permaneceram fora do escopo.
- Locks pendentes: 0.
- Contagens finais: 64 empreendimentos, 288 unidades e 2.077 mídias.
- Assinaturas de integridade finais iguais às congeladas antes da migration.
- PII na projeção pública: 0 coluna.

## 11. Risco residual

- A comprovação de captador e não captador foi feita por autorização autenticada/RPC no banco, sem abrir duas sessões humanas adicionais no navegador. O controle de acesso efetivo foi comprovado sem enfraquecer policies e sem tocar dados reais.
- Há warnings de lint antigos e um erro de terceiro do Microsoft Clarity; nenhum bloqueia Produtos ou foi introduzido por esta entrega.
- Backups físicos não restauram objetos binários apagados do Storage. A entrega não apagou objetos nem registros reais.

