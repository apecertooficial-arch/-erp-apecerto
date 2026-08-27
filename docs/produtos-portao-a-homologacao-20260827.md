# Produtos — Portão A de homologação — 27/08/2026

## 1. Decisão

**`BLOQUEADO`** antes de qualquer escrita em banco ou implantação.

O conjunto de Produtos foi preservado, reaplicado sobre o `origin/main` atual, commitado e enviado a branches de feature. Entretanto, não existe uma instância Supabase de homologação ou branch preview comprovadamente isolada entre os ambientes acessíveis. O único projeto com o schema da ApêCerto é o mesmo project ref usado pelo ERP/site de produção. O outro projeto acessível tem finalidade diferente e não pode ser reutilizado como homologação.

Pela autorização recebida, é proibido testar na produção, criar serviço externo pago ou improvisar sobre ambiente de outra finalidade. Por isso o Portão A foi interrompido exatamente antes de backup, preflight de dados, migration, contas sintéticas e deploy.

## 2. Ambientes e prova de isolamento

### Supabase

O conector oficial retornou dois projetos acessíveis:

1. o projeto ApêCerto utilizado pelo ERP/site atual;
2. um projeto separado de Instagram, sem finalidade de homologação de Produtos.

A listagem de branches do projeto ApêCerto retornou somente `main`, marcada como branch padrão e com o mesmo project ref do projeto pai. Não há branch preview, staging, QA ou desenvolvimento isolado.

O vínculo com produção foi comprovado sem consultar tabelas ou dados:

- o project ref do único projeto ApêCerto coincide com o endpoint versionado nos arquivos de publicação do ERP e com o rewrite público de SEO do site;
- a branch Supabase disponível é `main` e não possui project ref próprio de preview;
- o segundo projeto tem nome/finalidade incompatível e não foi inspecionado nem alterado;
- os `render.yaml` versionados descrevem somente os serviços `apecerto-erp` e `apecerto-site`; não há serviço de homologação declarado no repositório.

Documentação oficial atual consultada confirma que uma branch Supabase isolada deve ter instância, credenciais, Auth, Storage e banco próprios, e que branches preview nascem sem dados de produção. Ela também confirma que branching pode gerar custo de compute. Portanto não foi criada uma branch sem uma autorização de custo independente.

### Ações externas não executadas

- nenhuma consulta a tabelas de produção;
- nenhuma obtenção de chave de produção;
- nenhuma criação/alteração de usuário;
- nenhum backup ou restore;
- nenhuma migration ou SQL;
- nenhum advisor contra produção;
- nenhum deploy de ERP, site ou Edge Function;
- nenhuma chamada de IA;
- nenhum dado, foto ou PII processado.

## 3. Branches, commits e artefatos persistentes

### ERP

| Item | Valor |
|---|---|
| Remoto | `apecertooficial-arch/-erp-apecerto` |
| Branch enviada | `codex/produtos-portao-a-homolog-20260827` |
| Base incorporada | `764283c` — correção posterior de Agenda preservada |
| Commit funcional | `9b0201b` — Produtos, migration, hardening e testes |
| Commit de documentação | `8723bb0` |
| Árvore após push | limpa e rastreando a branch remota |

### Site

| Item | Valor |
|---|---|
| Remoto | `apecertooficial-arch/apecerto-site` |
| Branch enviada | `codex/produtos-portao-a-site-homolog-20260827` |
| Base | `24c66a9` |
| Commit funcional | `553c03b` — editorial/SEO por unidade e testes |
| Árvore após push | limpa e rastreando a branch remota |

Nenhum merge, PR automático ou alteração em `main` foi feito. Os commits usam identidade técnica genérica e o delta foi verificado contra literais semelhantes a segredo antes do push.

## 4. Backup e preflight

**Não executados**, porque não existe banco de homologação identificado. Isso é uma interrupção de segurança, não uma omissão operacional.

Executar backup ou preflight no único projeto ApêCerto disponível violaria a proibição de usar produção “só para testar”. Também não seria seguro apontar a migration para o projeto de Instagram.

Assim que houver uma homologação inequívoca, o preflight já especificado em `docs/produtos-fechamento-tecnico-20260827.md` deve ser executado antes da primeira escrita: migrations/schema, versão, volume e locks de `midias`, integridade de capa/ordem/path, grants/RLS/Storage, funções privilegiadas, projeção pública e backup restaurável.

## 5. Migration e hardening

| Artefato | Estado |
|---|---|
| `20260826193000_produtos_editorial_midias_rascunhos.sql` | commitado e enviado; **não aplicado externamente** |
| `produtos_proprietarios_pos_deploy.sql` | commitado e enviado; **não aplicado** |

O hardening permanece corretamente separado da expansão e só poderá ser aplicado depois de o ERP novo estar implantado e de a matriz provar que as RPCs substituíram todo acesso direto a `public.proprietarios`.

## 6. Resultado por perfil

| Perfil | Resultado nesta execução |
|---|---|
| Corretor captador | não executado em ambiente externo; falta Auth isolado |
| Corretor não captador | não executado em ambiente externo; falta Auth/RLS isolado |
| Gestor | não executado em ambiente externo; falta Auth/RLS isolado |

Os 76 testes locais de Produtos e a matriz sintética de autorização do fechamento anterior continuam sendo a evidência local vigente. Eles não foram reclassificados como prova autenticada.

## 7. Correções adicionais

Nenhuma correção funcional adicional foi necessária nesta tentativa. A integração de base acrescentou somente o commit posterior de Agenda; não houve conflito nem alteração nos arquivos de Produtos.

O trabalho novo desta etapa foi operacional e rastreável:

- converter árvores temporárias em commits persistentes;
- reaplicar o ERP sobre o `origin/main` atual sem perder Agenda;
- separar commits funcionais e documentação;
- revisar o delta consolidado e ausência de segredos;
- enviar apenas as branches de feature autorizadas.

## 8. ERP, site, SEO e mídia

Nenhum artefato foi implantado porque não há backend de homologação seguro para receber ERP/site. Consequentemente, catálogo, ficha, SEO, deep-link, galeria e payload de rede não foram alegados como validados em homologação.

O estado local já comprovado permanece:

- Produtos 76/76;
- frontend ERP 290/290;
- site 91/91;
- typecheck, lint e builds aprovados;
- uma falha antiga de CSS do CRM fora do escopo.

Esses resultados foram reutilizados conforme a regra de velocidade. A rebase incorporou apenas arquivos de Agenda, sem tocar no artefato de Produtos. O gate final completo não foi repetido porque o candidato não pôde ser implantado; ele deve ocorrer uma única vez sobre a homologação final.

## 9. Testes direcionados e gate final

| Verificação | Resultado |
|---|---|
| comparação da base antiga com `origin/main` | somente dois arquivos de Agenda; sem conflito de Produtos |
| `git diff --check` antes dos commits | aprovado |
| revisão de arquivos rastreados/não rastreados | aprovado |
| varredura de literais semelhantes a segredo no delta | aprovado |
| push das duas branches de feature | aprovado |
| gate final de banco/RLS/Storage | não iniciado por ausência de homologação |
| gate final de navegador | não iniciado por ausência de homologação |

## 10. Evidência visual

Não foi produzida nova evidência visual. Abrir produção ou usar sessões reais para simular homologação seria contrário às restrições. A validação visual única fica reservada à URL final de homologação com fixtures sintéticas.

## 11. Riscos e recomendação de produção

**Não recomendar produção.** O código está persistente e pronto para ser implantado em homologação, mas migration, RLS, Storage, três perfis, hardening e navegador ainda não foram provados no ambiente isolado obrigatório.

Não há risco adicional criado em produção: nenhuma branch foi mesclada em `main`, nenhuma migration foi aplicada e nenhum serviço produtivo foi implantado.

## 12. Recurso mínimo necessário

Disponibilizar **uma instância Supabase de homologação inequivocamente isolada**, já criada e sem dados reais, ou uma branch Supabase preview já existente com project ref e credenciais próprios. Ela precisa permitir Auth e Storage sintéticos e oferecer um método de backup/restore verificável.

Também deve existir um ERP/site de preview que possa usar exclusivamente as variáveis dessa homologação. Não é necessário fornecer credenciais pelo chat: basta conectar o ambiente isolado às ferramentas/serviços autorizados.

Não foi solicitada a criação automática de branch Supabase porque a documentação oficial informa custo de compute e a autorização vigente proíbe criar serviço externo pago ou alterar cobrança.
