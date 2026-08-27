# Evidências — fatia de catálogo, canvas e histórico do ApêCerto Studio

Data: 27/08/2026  
Escopo: implementação local, sem deploy, sem publicação no Instagram e sem credenciais externas.

## Entregue

- Catálogo versionado com 20 templates oficiais (5 para Feed, Carrossel, Stories e Reel), cada um com slug, variante de layout, manifesto, slots e versão publicada. Migration idempotente: `supabase/migrations/20260827170000_studio_template_catalog_20.sql`.
- Biblioteca visual no construtor com miniaturas, origem (Figma/Design System), versão e seleção por formato.
- Briefing e estratégia editáveis com persistência de nova versão em `social_briefs`.
- Workspace com edição de headline, legenda, CTA e estrutura JSON de slides/stories/cenas. A edição cria versão filha e mantém o histórico.
- Mídias do snapshot real do ERP exibidas no canvas; seleção e ação “Salvar mídia nesta versão” persistem `media_index` em nova versão.
- Histórico visual com comparação lado a lado e “Desfazer” não destrutivo (gera nova versão a partir de uma anterior).
- Figma representado honestamente como catálogo de manifestos importados/versionados; não há alegação de sincronização ao vivo.
- Canva representado honestamente: exporta pacote JSON local e deixa a abertura automática desativada quando a conexão não está configurada.

## Verificações

- 54 testes comportamentais e de contrato passaram.
- Build `vinext` passou.
- ESLint passou sem erros (20 avisos preexistentes de `<img>`/variáveis não utilizadas).
- A fixture visual foi ampliada para 20 modelos e três mídias, permitindo validar estados de biblioteca e seleção de mídia no modo visual local.

## Limitações conhecidas

- A migration ainda não foi aplicada ao Supabase remoto, por solicitação explícita de não fazer deploy nesta rodada.
- A sessão autenticada publicada não contém esta versão local; portanto, a validação autenticada de persistência nova aguarda publicação autorizada. A validação local usa o mesmo módulo nativo e contratos reais, sem declarar integração externa inexistente como ativa.
- Renderização e publicação continuam condicionadas aos workers/integrações configurados; nenhum conteúdo real foi publicado.
