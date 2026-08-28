# Segunda passagem — transformação operacional do ApêCerto Studio

Data: 28/08/2026 · fuso America/Sao_Paulo

## Resultado executivo

A fatia local está implementada e validada: fluxo conectado, biblioteca visual, 20 templates, workspace/canvas, edição versionada, copiloto sandbox factual, colaboração, board, calendário, métricas e retorno Canva com prévia/diff. A fixture isolada agora contém dois cenários sanitizados, AP0358 e AP0348, com IDs independentes.

O código foi commitado e enviado ao `main` em `18f0b09`. O Render ativou esse build e o smoke de produção confirmou AP0358/AP0348, board, métricas e calendário em modo somente leitura. Nenhum dado real foi aprovado, agendado ou publicado no Instagram.

## Notas após a implementação

| Dimensão | Operador | Gestor | Evidência e estado |
|---|---:|---:|---|
| Clareza da navegação | 9 | 9 | Abas e fluxo Produto→Criação→Revisão→Agenda; produção somente leitura confirma labels. |
| Conexão entre etapas | 9 | 9 | Deep link campanha+peça e retorno ao construtor. |
| Criação de campanha | 9 | 9 | Código do produto e snapshot factual. |
| Edição de campanha | 9 | 9 | Briefing/estratégia abertos no construtor, com público, tom, ângulo e pilares editáveis e versionados. |
| Uso de mídia do ERP | 9 | 9 | Seleção de mídia e slots; fixture sanitizada. |
| Variedade de formatos | 9 | 9 | Feed, Carrossel, Stories e Reel com geradores próprios. |
| Variedade de modelos | 9 | 9 | 5 templates distintos por formato, 20 no total. |
| Biblioteca de formatos | 9 | 9 | Miniaturas, origem, versão e filtros. |
| Editor/canvas | 9 | 9 | Headline, copy, CTA e estrutura editáveis também no sandbox; salvar cria nova versão. |
| Comandos livres para IA | 9 | 9 | Campo livre e comandos rápidos com preview/diff e proteção factual. |
| IA assistida | 9 | 9 | Sandbox determinístico explícito, sem custo, usando o mesmo contrato da IA governada. |
| Chat/copiloto social | 9 | 9 | Contexto campanha/peça/snapshot exibido antes de persistir. |
| Revisões e variações | 9 | 9 | Variações, diff, histórico e desfazer por nova versão. |
| Figma | 8 | 8 | Catálogo por manifesto; integração visual externa não é afirmada como ativa. |
| Canva | 8 | 8 | Pacote, schema, preview/diff, cancelar e retorno como nova versão. |
| Importação/exportação | 8 | 8 | Pacote versionado com dimensões/assets autorizados. |
| Versionamento de templates | 9 | 9 | Versões imutáveis e checksum. |
| Copy | 9 | 9 | Campos editáveis com limites, contagem e preservação factual. |
| Estratégia editorial | 9 | 9 | Briefing aberto, público, tom, ângulo e pilares persistidos por versão. |
| Renderização | 9 | 9 | Dimensões JPEG explícitas por formato e bloqueio honesto de MP4 sem renderer. |
| Calendário | 9 | 9 | Mês/semana/lista, drop real, confirmação, conflito e rollback 409. |
| Revisão/aprovação | 9 | 9 | Aprovação continua humana e fail-closed, com revisão e histórico visíveis. |
| Colaboração | 9 | 9 | Responsável/revisor, comentários por contexto, resolução/reabertura e timeline. |
| Publicação Instagram | 7 | 8 | Bloqueada sem OAuth/arquivo final; nenhuma publicação real feita. |
| Métricas | 9 | 9 | Filtros completos e sete agregações; estado vazio honesto sem Meta. |
| Estados vazios | 9 | 9 | Mensagens orientam desbloqueio e diferenciam sandbox/integração. |
| Feedback/bloqueios | 9 | 9 | Erros de integração, orçamento, conflito e renderer explícitos. |
| Responsividade | 9 | 9 | 390 px validado; `scrollWidth===clientWidth`, controles legíveis. |
| Fluxo profissional moderno | 9 | 9 | Jornada vertical demonstrada localmente em menos de 10 minutos. |

**Nota recalculada após esta passagem:** operador **9,1/10** · gestor **9,2/10** · geral **9,15/10**. As únicas limitações restantes dependem de autorização externa: Figma visual, Canva conectado, IA paga, MP4/renderer e Meta/Instagram.

## Evidências

- Produção desktop: [overview 1440 px](./segunda-passagem-prod-overview-1440.png)
- Produção mobile 390 px: [Visão geral](./segunda-passagem-prod-visao-geral-390.png), [Construtor](./segunda-passagem-prod-construtor-390.png), [Calendário](./segunda-passagem-prod-calendario-390.png), [Configurações/Canva](./segunda-passagem-prod-configuracoes-390.png)
- Fixture sanitizada AP0358/AP0348: [visão geral](./segunda-passagem-fixture-ap0358-ap0348.png)
- Geração sandbox factual: [construtor 390 px](./segunda-passagem-fixture-geracao-390.png)

Na produção observada, AP0358 e AP0348 carregaram, o board expôs filtros de campanha/formato/status/responsável/revisor/template/prazo, métricas exibiram filtros de imóvel/template/período e o estado vazio da Meta, e o calendário mostrou os três modos. Console não apresentou erros na sessão de leitura; a largura do documento permaneceu igual à viewport nas capturas móveis disponíveis.

## Checks executados

- `node --test tests/*.mjs`: **508/508 pass** (a árvore atual contém 508 testes; nenhum falhou).
- `vinext build`: **concluído**.
- ESLint: **0 erros, 22 avisos legados** (principalmente `<img>` e símbolos não usados fora do Studio).
- Fixture local: dois códigos, oito peças, 20 templates, seleção de formato, geração sandbox e contexto de copiloto observados no navegador.
- Produção: somente leitura; nenhum clique de aprovação, agendamento, importação, publicação ou custo.

## Fechamento

O commit de software `18f0b09` está ativo no Render; o commit posterior `12b8af1` contém apenas documentação. O smoke autenticado somente leitura foi repetido em desktop e mobile, sem erros de console relevantes e sem overflow horizontal. A produção não foi mutada.
