# Produtos 10/10 — plano, execução e validação

Data da auditoria: 26/08/2026
Estado: implementado e validado localmente; ainda não publicado em produção.

## Critérios de aceite

1. Uma unidade é sempre um imóvel próprio, mesmo quando vinculada a condomínio ou empreendimento.
2. Fotos privativas da unidade e fotos de áreas comuns não se misturam.
3. O captador permanece associado à captação; somente ele e a gestão veem o proprietário.
4. Corretor e gestor conseguem editar cadastro e galeria dentro das respectivas permissões.
5. Preço ambíguo exige confirmação explícita e nunca é reinterpretado silenciosamente.
6. Publicação exige conteúdo mínimo real; nota de qualidade não pode mascarar campo obrigatório vazio.
7. Ordem, capa, categoria e texto alternativo das fotos são persistidos.
8. O ERP é a fonte do título, descrição e SEO consumidos pelo site.
9. O cadastro suporta retomada segura dos campos após recarregamento.
10. Nenhum dado privado aparece no contrato público do site.

## Matriz de execução

| Problema identificado | Correção executada | Como foi validado | Estado |
|---|---|---|---|
| Valor digitado em milhares podia virar outro valor, como 710 mil virar 710 milhões | Interpretação por finalidade, faixa plausível e confirmação com o valor completo antes de salvar | Testes unitários de preço e build do ERP | Concluído localmente |
| Produto podia chegar a nota 100 sem descrição comercial | Qualidade e aprovação agora exigem título e descrição comercial mínima da unidade | Teste de regra editorial e suíte de Produtos | Concluído localmente |
| Arquivos de imagem eram apresentados sem contexto visual suficiente | Classificador agora mostra miniatura, categoria, capa e texto alternativo | Teste de componente/contrato e build | Concluído localmente |
| Ordem da galeria existia só na tela e podia se perder | Campo de ordem, índice e operação atômica de reordenação com permissão de captador/gestão | Testes de galeria e inspeção da migração | Concluído localmente |
| Falha de gravação após upload podia deixar arquivo órfão | Compensação remove o objeto do armazenamento quando a inserção no banco falha | Testes de código e build | Concluído localmente |
| Fotos do condomínio podiam ocupar o lugar das fotos da unidade | Contrato público separa `fotos_meta` da unidade e do empreendimento; site monta galeria privativa e comum separadamente | 91 testes do site e abertura de imóvel real no navegador | Concluído localmente |
| Unidade vinculada herdava identidade editorial do condomínio | Unidade ganha título, descrição e SEO próprios; visualização e publicação priorizam esses campos | Suíte Produtos, testes do site e build | Concluído localmente |
| Consulta de proprietários era ampla demais no cadastro | Nova operação segura retorna somente proprietários ligados às captações do usuário | Inspeção de autorização e contrato público | Concluído localmente |
| Captador podia perder capacidade de organizar mídia da própria unidade | Reordenação e edição editorial autorizam gestão ou captador original | Testes de permissão/galeria | Concluído localmente |
| Campos do cadastro se perdiam ao recarregar | Rascunho privado por usuário, salvamento automático com atraso curto e exclusão após conclusão | Testes da API e build | Concluído para campos; arquivos precisam ser escolhidos novamente |
| SEO do site era genérico e desconectado do ERP | Título, descrição e metadados passam a priorizar a unidade e cair para o empreendimento somente como alternativa | 91/91 testes do site | Concluído localmente |
| Não havia auditoria gerencial de valores fora de faixa | Consulta somente leitura e restrita à gestão lista preços suspeitos; nunca corrige automaticamente | Revisão da migração e tipos | Concluído localmente |
| Sugestão automática de categoria/ordem/alt por IA | Não executada: exige consentimento explícito para enviar fotos ou dados comerciais a um provedor externo | Bloqueio de segurança confirmado | Aguardando autorização específica |

## Verificações executadas

- ERP: build de produção aprovado.
- ERP: 75/75 testes relacionados a Produtos aprovados.
- Site: build e verificações de empacotamento aprovados.
- Site: 91/91 testes aprovados.
- Navegador: catálogo local carregou 71 unidades com dados reais; detalhe abriu com fotos privativas e áreas comuns separadas; console sem erros.
- ERP no navegador: aplicação local chegou à tela de login. O fluxo autenticado não foi executado sem credenciais de corretor e gestor.
- Suíte integral do ERP: permanecem duas falhas de base, não relacionadas a Produtos — uma migração de funil referenciada e ausente no `main`, e uma asserção antiga de CSS do CRM.
- TypeScript isolado: o arquivo legado de detalhe já possui erros de nulabilidade anteriores; o build oficial, que é o check adotado pelo projeto, passou.

## Riscos que impedem declarar produção 10/10 hoje

1. A migração ainda não foi aplicada no banco de produção.
2. ERP e site ainda não foram implantados a partir destas branches.
3. Falta teste autenticado de ponta a ponta com uma conta de corretor captador, outra de corretor não captador e uma de gestor.
4. O salvamento automático recupera os campos, não os arquivos locais selecionados pelo navegador; isso é uma restrição de segurança do próprio navegador e é informado na interface.
5. IA não pode receber fotos ou informações comerciais sem consentimento explícito sobre dados, finalidade e fornecedor.

## Publicação controlada

1. Fazer backup e aplicar a migração em homologação.
2. Implantar o ERP em homologação e executar a matriz autenticada: criar, retomar, editar, excluir, inativar, aprovar, publicar e despublicar.
3. Validar privacidade com três perfis: captador vê proprietário; outro corretor não vê; gestor vê.
4. Validar AP0356 e uma unidade de cada modalidade: terceiro, lançamento e remanescente.
5. Implantar o site em homologação e conferir deep-link, SEO, capa, ordem e separação de galerias.
6. Somente após aceite, promover banco, ERP e site para produção, nesta ordem.
7. Monitorar erros e amostrar imóveis publicados imediatamente após a promoção.

## Nota honesta no estado atual

- Código e regras de Produtos: **9,2/10**, local.
- Experiência do corretor: **9,0/10**, pendente teste autenticado.
- Experiência do gestor: **9,0/10**, pendente teste autenticado.
- Integração ERP → site: **9,5/10**, pendente migração e homologação.
- Produção: **não pontuada**, porque esta entrega ainda não foi implantada.

O 10/10 só pode ser atribuído após a publicação controlada e a validação autenticada sem regressões.
