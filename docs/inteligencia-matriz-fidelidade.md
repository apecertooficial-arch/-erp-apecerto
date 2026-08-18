# Matriz de fidelidade — Inteligência: canvas aprovado × código no ar

Leitura da `main` em 2026-08-18 (árvore `0e33b05da5bf`). Nenhum número desta matriz é estimado:
cada linha vem de leitura direta de `app/features/inteligencia/*`, `app/styles/inteligencia.css`,
`app/api/inteligencia/route.ts` e dos arquivos finais do Design.

## Fontes de referência

| Arquivo do Design | Turnos | Artboards | Cobre |
|---|---|---|---|
| `Inteligência Digital.dc.html` | 17 | 45 | 8 telas do digital, Visão da empresa, filtros/drill-downs, biblioteca, Copiloto |
| `Inteligência - Performance.dc.html` | 15 | 35 | 9 telas de Performance em alta fidelidade, permissões, mobile |

80 referências, **78 únicas** — `23a` e `23b` (arquitetura do menu) aparecem nos dois arquivos.

As 9 telas de Performance em alta fidelidade **só** existem no segundo arquivo.

## Diferença de sistema — as 14 peças do artboard 30b

| Peça | Situação | Evidência | Ação |
|---|---|---|---|
| 01 Cabeçalho de seção | fiel | `.ape-int-secao` eyebrow 11/600 roxo + h2 20/700 | — |
| 02 KPI | parcial | cartão e estado vazio corretos; falta chip de comparação e tooltip de definição | estender `Kpi` com `delta` + `definicao` |
| 03 Tile de ícone 34px | **ausente** | zero ícone Lucide em toda a área | criar `.ape-int-tile` + Lucide 17px |
| 04 Abas e grupos pill | fiel | `<a href>` reais, ativo #FFF3EA/#FF7000/#CC5800 | — |
| 05 Barra de filtros | parcial | só período, em estado de React (não na URL) | barra do 11a com query string |
| 06 Chip de filtro ativo | **ausente** | nenhum chip removível | sai com a peça 05 |
| 07 Selo de procedência | fiel | "DADO REAL · hh:mm" / "aguardando dado"; DEMONSTRAÇÃO omitido de propósito | — |
| 08 Linha de funil | parcial | barra e taxa corretas; falta perda absoluta e clique | 5ª coluna + drill-down |
| 09 Tabela | parcial | tipografia fiel; nenhuma coluna ordenável | ordenação + linha clicável |
| 10 Drawer 420px | **ausente** | sem drawer/scrim na folha | componente único da área |
| 11 Bloco de pendência | fiel | `.ape-int-pendencia` alimentado por `pendencias[]` | — |
| 12 Vazio e erro | fiel | tracejado neutro / #FBE5E5 com "Tentar novamente" | — |
| 13 Esqueleto | parcial | 3 barras genéricas em vez da forma do conteúdo | variantes por bloco |
| 14 Cartão de celular | parcial | grade colapsa, mas tabela continua tabela | lista de cartões < 900px |

Os **tokens não divergem**: a folha já usa #FAF8F6, cartão branco raio 18 sombra 0 2px 6px
rgba(31,28,26,.06), eyebrow 11/600 +0.12em, KPI 26/700 tabular, chips pill em tint, ativo laranja e
avatar roxo #F7ECFC/#66009A. O desvio é de peças que faltam, não de estilo errado.

## Cobertura tela por tela

| Tela | Artboards | Rota | Componente | Fonte de dados | Diferença | Ação |
|---|---|---|---|---|---|---|
| Visão da empresa | 2a 14b 2b 25d 1c 12b 10a 22a | `/inteligencia` | `VisaoEmpresa.tsx` | RPC `performance_sala_comando` + `site_leads` | sem briefing do Copiloto, sem delta, sem drill-down de etapa | 02 03 08 + Copiloto |
| Vendas e previsão | 19b 27b 29a 12g | `/inteligencia/vendas` | `VendasPrevisao.tsx` | empresa: vendas, vgv, pendentes, metas, pipelineQuente | sem ordenação, sem drawer | 09 10 14 |
| Financeiro e comissões | 20a 27c 29a 12h | `/inteligencia/financeiro` | `Financeiro.tsx` + GuardaModulo | receitaBruta, custos, margemContribuicao | cascata VGV→lucro sem componente | peça nova de cascata |
| Captação de proprietários | 7a 25a 28a 1h | `/inteligencia/proprietarios` | `Proprietarios.tsx` | `captacoes_portal` | sem drawer, sem tile por status | 03 10 |
| Atendimento e SLA | 15a 26a 22a 12c | `/inteligencia/atendimento` | `AtendimentoSla.tsx` | corretores: slaAmostra, mediana, sla15Pct; limiares 5/15 min | tabela de 8 colunas sem ordenação/clique | 09 10 14 |
| Performance da equipe | 16a 26b 29a 12d | `/inteligencia/equipe` | `PerformanceEquipe.tsx` | corretores agregado nos 4 pilares | sem tile por pilar, sem clique para lista filtrada | 03 09 |
| Gerentes | 17a 26c 29a 12e | `/inteligencia/gerentes` | `Gerentes.tsx` | corretores por ocupação e vencidas | página do gerente não existe como destino | 10 |
| Corretores | 18a 26d 29a 12f | `/inteligencia/corretores` | `Corretores.tsx` | corretores completo | clique abre bloco expandido, não drawer; visão própria sem escopo por perfil | 10 + 12j |
| Conversão e CRM | 5a 24d 10a 1g | `/inteligencia/conversao` | `ConversaoCrm.tsx` | empresa.fluxo + qualidadeDado | jornada individual do lead inexistente | 10 + trilha por lead |
| Qualidade | 19a 27a 29a 12g | `/inteligencia/qualidade` | `Qualidade.tsx` | qualidadeDado + notas de IA (amostra mínima 8) | sem drawer, sem ordenação | 09 10 |
| Aquisição e campanhas | 3a 24a 28a 1d | `/inteligencia/aquisicao` | `Aquisicao.tsx` | GA4 (`app/lib/ga4.ts`) + `site_leads`; custo de mídia = pendência | sem delta, sem tile, sem filtro de origem | 02 03 05 |
| Comportamento e conteúdo | 4a 24b 28a 1e | `/inteligencia/comportamento` | `Comportamento.tsx` | GA4 páginas/entradas/dispositivos | sem rolagem/mapa de calor (Clarity), sem ordenação | 09 |
| Imóveis e procura | 6a 24c 10a 1f | `/inteligencia/imoveis` | `Imoveis.tsx` | `anuncios_site` × `captacoes_portal` | tabela ordenável e drawer do imóvel ausentes | 09 10 |
| Sara | 8a 25b 28a 1i | `/inteligencia/sara` | `Sara.tsx` | sem fonte: tela em ausência de integração | layout completo com traços | manter |
| Central de alertas | 21a 27d 22a 12i | `/inteligencia/alertas` | `CentralAlertas.tsx` | empresa.riscos + corretores | sem tile de gravidade, sem drawer da evidência | 03 10 |
| Privacidade e tracking | 9a 25c 28a 1j | `/inteligencia/privacidade` | `PrivacidadeTracking.tsx` | qualidadeDado; consentimento/Clarity pendentes | sem semáforo em tile | 03 |
| **Copiloto ApêCerto** | 31a–31h | nenhuma | **não existe** | backend de IA inexistente | 8 artboards sem nada no ar | interface + estados, sem endpoint inventado |
| Casca e navegação | 23a 23b 11a 11b 12j 30a 30b | `/performance` → Visão | `CascaInteligencia.tsx` + AppShell (`e81f254`) | — | filtros globais e drill-downs não implementados | 05 06 + escopo por perfil |

Os 10 estados obrigatórios estão cobertos por construção nas 16 rotas pela regra "layout sempre
completo" (`ac62f9f`): KPI sem dado mostra "—" + "aguardando conexão", nenhum cartão desaparece.

## Depende de integração externa

- **Google Ads / Meta Ads** — custo, impressão, CPL (Aquisição).
- **Microsoft Clarity** — rolagem, mapa de calor, gravação (Comportamento, Privacidade).
- **Telemetria por imóvel** — `property_search`, `view_item`, `favorite_toggle`.
- **Conversas da Sara** — a tela inteira.
- **Backend do Copiloto** — resumo, conversa e briefing; a interface sobe sem ele.

## Ordem de implementação nesta branch

1. Casca: peças 05, 06, 03.
2. Drawer + tabela ordenável: 09, 10.
3. KPI com comparação + esqueleto por formato: 02, 13.
4. Lista de cartões no celular: 14.
5. Interface do Copiloto, sem simular IA.
