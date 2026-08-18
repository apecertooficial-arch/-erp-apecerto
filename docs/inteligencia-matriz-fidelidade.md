# Matriz de fidelidade — Inteligência: canvas aprovado × código no ar

Leitura da `main` em 2026-08-18 (árvore `0e33b05`). Nenhum número desta matriz é estimado:
cada linha vem de leitura direta de `app/features/inteligencia/*`, `app/styles/inteligencia.css`,
`app/api/inteligencia/route.ts` e dos arquivos finais do Design.

## Cobertura

    Implementado ............  5 / 78
    Parcial ................. 42 / 78
    Bloqueado por dados .....  7 / 78
    Pendente ................ 24 / 78

**Implementado (5):** `12a` arquitetura · `23a` menu com 4 grupos e 16 abas · `23b` retirada da
Performance antiga com `/performance?vista=antiga` preservado · `30a` tokens · `1b` anatomia da barra
de filtros.

**Bloqueado por dados (7):** `8a` e `25b` Sara (sem fonte) · `3a` e `24a` custo de mídia (Ads) ·
`4a` e `24b` rolagem e mapa de calor (Clarity) · `6a` telemetria por imóvel. Nos sete, a interface e o
estado de indisponibilidade **são** implementados — o que não existe é o número.

**Parcial e Pendente:** enumerados na tabela por tela, com o commit que fecha cada um. Nenhum artboard
foi descartado: os 78 estão nesta página.

## Fontes de referência

| Arquivo do Design | Turnos | Artboards | Cobre |
|---|---|---|---|
| `Inteligência Digital.dc.html` | 17 | 45 | 8 telas do digital, Visão da empresa, filtros/drill-downs, biblioteca, Copiloto |
| `Inteligência - Performance.dc.html` | 15 | 35 | 9 telas de Performance em alta fidelidade, permissões, mobile |
| `Inteligência Digital - Wireframes.dc.html` | — | complementar | arquitetura, estados, regras de comportamento |

80 referências, **78 únicas** — `23a` e `23b` (arquitetura do menu) aparecem nos dois arquivos.

As 9 telas de Performance em alta fidelidade **só** existem no segundo arquivo.

## Commit 1 — Casca e filtros

Commits `b3a0fcd` + `00b7aa5` + `1098288` (um escopo lógico; o fatiamento foi erro de execução, não de
escopo — o diff somado é o do Commit 1).

| Peça / artboard | Antes | Agora | O que ficou de fora |
|---|---|---|---|
| 03 · Tile de ícone 34px | ausente | **implementado** — `.ape-int-tile` em 5 tints, 7 ícones Lucide por máscara CSS (mesmo mecanismo da folha do menu; nenhuma dependência nova) | ícones específicos por tela entram com cada grupo |
| 05 · Barra de filtros | só período, em estado de React | **implementado** — barra única no início do conteúdo, 13 controles do 11a, período em segmento laranja, cada página escondendo o que não se aplica | período personalizado (intervalo livre) e `Exportar` |
| 06 · Chip de filtro ativo | ausente | **implementado** — chip roxo removível, contador "N filtros ativos", "Limpar filtros" preservando o período, estado sem filtros | — |
| 13 · Esqueleto | 3 barras genéricas | **implementado** — três formas (`kpis`, `linhas`, `tabela`) que imitam o bloco que vai chegar | telas passam a pedir a forma certa nos commits de grupo |
| 11a · persistência | inexistente | **implementado** — URL é a fonte da verdade (`replaceState`), espelho em `localStorage` por 24 h na chave `apecerto-int-filtros`, e cada `<a href>` de grupo/aba carrega a query: filtro sobrevive à troca de página | folha de baixo com "Aplicar" no celular |
| 1b · cabeçalho de contexto | selo de procedência | **parcial** — selo "DADO REAL · hh:mm" no topo e "Atualizado hh:mm · America/Sao_Paulo" na barra | linha "1–30 ago vs. 1–31 jul" e cobertura de consentimento |

**O que este commit deliberadamente NÃO faz:** aplicar filtro em número nenhum. A seleção é guardada e
exposta; nenhuma tela consome `filtros` além do período, que o endpoint já recebe. A barra declara isso
no aviso roxo — sele\u00e7ão guardada não passa por filtro aplicado. `CONSUMIDOS_PELAS_TELAS` encolhe a cada
commit de grupo de telas, e o aviso desaparece sozinho quando a lista fecha.

**Controles selecionáveis hoje** (vocabulário fechado pelo próprio 11a): comparação, dispositivo,
finalidade, tipo de lead, consentimento. **Lista aberta** (origem, página/tipo, bairro): selecionável
quando a tela passar `fontes` — o endpoint já devolve os agregados. **Sem fonte no ERP** (mídia,
campanha, imóvel): abrem e explicam o que falta conectar, nunca ficam selecionáveis e nunca recebem
opção inventada.

## Diferença de sistema — as 14 peças do artboard 30b

| Peça | Situação | Evidência | Ação |
|---|---|---|---|
| 01 Cabeçalho de seção | fiel | `.ape-int-secao` eyebrow 11/600 roxo + h2 20/700 | — |
| 02 KPI | parcial | cartão e estado vazio corretos; falta chip de comparação e tooltip de definição | Commit 4 |
| 03 Tile de ícone 34px | **fiel (Commit 1)** | `.ape-int-tile` + `.ape-int-ic` por máscara | — |
| 04 Abas e grupos pill | fiel | `<a href>` reais, ativo #FFF3EA/#FF7000/#CC5800 | — |
| 05 Barra de filtros | **fiel (Commit 1)** | `.ape-int-barra` com os 13 controles do 11a | período personalizado e Exportar |
| 06 Chip de filtro ativo | **fiel (Commit 1)** | `.ape-int-chip-ativo` roxo com ✕ | — |
| 07 Selo de procedência | fiel | "DADO REAL · hh:mm" / "aguardando dado"; DEMONSTRAÇÃO omitido de propósito | — |
| 08 Linha de funil | parcial | barra e taxa corretas; falta perda absoluta e clique | Commit 2 |
| 09 Tabela | parcial | tipografia fiel; nenhuma coluna ordenável | Commit 3 |
| 10 Drawer 420px | ausente | sem drawer/scrim na folha | Commit 2 |
| 11 Bloco de pendência | fiel | `.ape-int-pendencia` alimentado por `pendencias[]` | — |
| 12 Vazio e erro | fiel | tracejado neutro / #FBE5E5 com "Tentar novamente" | — |
| 13 Esqueleto | **fiel (Commit 1)** | três formas por bloco | — |
| 14 Cartão de celular | parcial | grade colapsa e alvos ≥44px; tabela ainda é tabela | Commit 3 |

Os **tokens não divergem**: a folha usa #FAF8F6, cartão branco raio 18 sombra 0 2px 6px
rgba(31,28,26,.06), eyebrow 11/600 +0.12em, KPI 26/700 tabular, chips pill em tint, ativo laranja e
avatar roxo #F7ECFC/#66009A. O desvio é de peças que faltam, não de estilo errado.

## Cobertura tela por tela

| Tela | Artboards | Rota | Componente | Fonte de dados | Diferença | Fecha em |
|---|---|---|---|---|---|---|
| Visão da empresa | 2a 14b 2b 25d 1c 12b 10a 22a | `/inteligencia` | `VisaoEmpresa.tsx` | RPC `performance_sala_comando` + `site_leads` | sem briefing do Copiloto, sem delta, sem drill-down de etapa | 4 · 5 · 11 |
| Vendas e previsão | 19b 27b 29a 12g | `/inteligencia/vendas` | `VendasPrevisao.tsx` | empresa: vendas, vgv, pendentes, metas, pipelineQuente | sem ordenação, sem drawer | 2 · 3 · 5 |
| Financeiro e comissões | 20a 27c 29a 12h | `/inteligencia/financeiro` | `Financeiro.tsx` + GuardaModulo | receitaBruta, custos, margemContribuicao | cascata VGV→lucro sem componente | 5 |
| Captação de proprietários | 7a 25a 28a 1h | `/inteligencia/proprietarios` | `Proprietarios.tsx` | `captacoes_portal` | sem drawer, sem tile por status | 2 · 5 |
| Atendimento e SLA | 15a 26a 22a 12c | `/inteligencia/atendimento` | `AtendimentoSla.tsx` | corretores: slaAmostra, mediana, sla15Pct; limiares 5/15 min | tabela de 8 colunas sem ordenação/clique | 3 · 6 |
| Performance da equipe | 16a 26b 29a 12d | `/inteligencia/equipe` | `PerformanceEquipe.tsx` | corretores agregado nos 4 pilares | sem tile por pilar, sem clique para lista filtrada | 7 |
| Gerentes | 17a 26c 29a 12e | `/inteligencia/gerentes` | `Gerentes.tsx` | corretores por ocupação e vencidas | página do gerente não existe como destino | 2 · 7 |
| Corretores | 18a 26d 29a 12f | `/inteligencia/corretores` | `Corretores.tsx` | corretores completo | clique abre bloco expandido, não drawer; visão própria sem escopo por perfil | 2 · 7 |
| Conversão e CRM | 5a 24d 10a 1g | `/inteligencia/conversao` | `ConversaoCrm.tsx` | empresa.fluxo + qualidadeDado | jornada individual do lead inexistente | 2 · 6 |
| Qualidade | 19a 27a 29a 12g | `/inteligencia/qualidade` | `Qualidade.tsx` | qualidadeDado + notas de IA (amostra mínima 8) | sem drawer, sem ordenação | 3 · 6 |
| Aquisição e campanhas | 3a 24a 28a 1d | `/inteligencia/aquisicao` | `Aquisicao.tsx` | GA4 (`app/lib/ga4.ts`) + `site_leads`; custo de mídia = pendência | sem delta, sem tile por canal | 4 · 8 |
| Comportamento e conteúdo | 4a 24b 28a 1e | `/inteligencia/comportamento` | `Comportamento.tsx` | GA4 páginas/entradas/dispositivos | sem rolagem/mapa de calor (Clarity), sem ordenação | 3 · 8 |
| Imóveis e procura | 6a 24c 10a 1f | `/inteligencia/imoveis` | `Imoveis.tsx` | `anuncios_site` × `captacoes_portal` | tabela ordenável e drawer do imóvel ausentes | 2 · 3 · 8 |
| Sara | 8a 25b 28a 1i | `/inteligencia/sara` | `Sara.tsx` | sem fonte: tela em ausência de integração | layout completo com traços | 9 |
| Central de alertas | 21a 27d 22a 12i | `/inteligencia/alertas` | `CentralAlertas.tsx` | empresa.riscos + corretores | sem tile de gravidade, sem drawer da evidência | 2 · 10 |
| Privacidade e tracking | 9a 25c 28a 1j | `/inteligencia/privacidade` | `PrivacidadeTracking.tsx` | qualidadeDado; consentimento/Clarity pendentes | sem semáforo em tile | 10 |
| **Copiloto ApêCerto** | 31a–31h | nenhuma | **não existe** | backend de IA inexistente | 8 artboards sem nada no ar | 11 |
| Casca e navegação | 23a 23b 11a 11b 12j 30a 30b 1b | `/performance` → Visão | `CascaInteligencia.tsx` + `BarraFiltros.tsx` + `filtros.ts` | — | filtros na URL e chips prontos (Commit 1); drill-downs (11b) e escopo por perfil (12j) pendentes | 2 · 7 |

Os 10 estados obrigatórios estão cobertos por construção nas 16 rotas pela regra "layout sempre
completo" (`ac62f9f`): KPI sem dado mostra "—" + "aguardando conexão", nenhum cartão desaparece.

## Depende de integração externa

- **Google Ads / Meta Ads** — custo, impressão, CPL (Aquisição).
- **Microsoft Clarity** — rolagem, mapa de calor, gravação (Comportamento, Privacidade).
- **Telemetria por imóvel** — `property_search`, `view_item`, `favorite_toggle`.
- **Conversas da Sara** — a tela inteira.
- **Backend do Copiloto** — resumo, conversa e briefing; a interface sobe sem ele.
- **Consentimento** — origem do nível de consentimento para a tela de Privacidade.
- **Jornada individual do lead** — trilha de eventos por lead no endpoint agregador.
- **Filtros além do período** — o endpoint recebe só `periodo`; aplicar origem, bairro e companhia aos
  números exige corte no agregador ou filtragem sobre os agregados em cada tela.

## Ordem de implementação nesta branch

1. ✅ Casca: peças 05, 06, 03, 13 + persistência do 11a.
2. Drawer + drill-down: 09 (linha clicável) e 10.
3. Tabelas e mobile: ordenação, teclado, cartões abaixo de 900px.
4. KPIs e comparações: 02 + esqueleto por bloco nas telas.
5. Empresa · 6. Operação comercial · 7. Performance · 8. Mercado e digital · 9. Sara · 10. Governança.
11. Interface do Copiloto, sem simular IA.
12. Responsividade e acabamento (1440×900 e 390×844).
