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

O contador segue igual ao do Commit 2 e isso é deliberado: o Commit 3 fecha duas **peças** da
biblioteca (09 e 14) dentro do artboard `30b`, e `30b` só sai de "parcial" quando as 14 peças
estiverem fiéis — faltam 02 e 08. Mover o contador antes disso seria inflar cobertura.

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
no aviso roxo — seleção guardada não passa por filtro aplicado. `CONSUMIDOS_PELAS_TELAS` encolhe a cada
commit de grupo de telas, e o aviso desaparece sozinho quando a lista fecha.

## Commit 2 — Drawer e drill-down

Commits `fb6396a` + `a23a9b22` + fechamento subsequente deste escopo: um drawer compartilhado de 420 px no desktop e folha inferior abaixo de
900 px, com scrim, fechamento por botão/Escape/clique externo, foco devolvido ao disparador e estado
`drawer` preservado na URL sem apagar os filtros globais.

| Corte | Agora | Limite declarado |
|---|---|---|
| `6a` · imóvel | linhas de finalidade e status abrem o corte do estoque com total e participação | visualização, galeria, favorito e lead por imóvel seguem bloqueados até a telemetria identificar o item |
| `5a` · jornada do lead | cada etapa do funil abre a leitura agregada e mantém as nove etapas visíveis | lista nominal e linha do tempo individual continuam no Funil 2.0, atrás da permissão de dado pessoal |
| `18a` · perfil do corretor | a linha acessível por mouse/Enter/Espaço abre o perfil no drawer; o bloco expandido paralelo foi removido | sem amostra, a tela não classifica a pessoa |

O contador geral permanece conservador nesta etapa: `6a` continua bloqueado por dado e `5a` parcial
enquanto a jornada individual não existir. A peça compartilhada 10 está fechada; a peça 09 continua
parcial até ordenação e cartão móvel no Commit 3.

**Controles selecionáveis hoje** (vocabulário fechado pelo próprio 11a): comparação, dispositivo,
finalidade, tipo de lead, consentimento. **Lista aberta** (origem, página/tipo, bairro): selecionável
quando a tela passar `fontes` — o endpoint já devolve os agregados. **Sem fonte no ERP** (mídia,
campanha, imóvel): abrem e explicam o que falta conectar, nunca ficam selecionáveis e nunca recebem
opção inventada.

## Commit 3 — Tabelas e mobile

Um único commit, três arquivos: `CascaInteligencia.tsx`, `app/styles/inteligencia.css` e esta matriz.
As oito tabelas da área ganharam ordenação e cartão móvel **sem uma linha de alteração nas telas** —
tudo entrou no componente compartilhado `Tabela`, que as oito já usavam.

Inventário das instâncias reais na ponta `dc1f1cc`, todas cobertas:

| Tela | Tabela | Colunas | Linha clicável |
|---|---|---|---|
| Atendimento e SLA | corretores por SLA | 8 | — |
| Corretores | pessoa por pilar | 9 | sim → drawer 18a |
| Gerentes | ocupação de carteira | 7 | — |
| Qualidade | notas de IA | 7 | — |
| Conversão e CRM | conversão por corretor | 6 | — |
| Comportamento | páginas do site | 4 | — |
| Imóveis e procura | estágio e status | 4 | sim → drawer 6a |
| Aquisição | dispositivos | 3 | — |

**Peça 09 · ordenação só onde a comparação existe.** O cabeçalho vira botão (`aria-sort`,
crescente/decrescente, chevron roxo na coluna ativa) apenas nas colunas que o componente consegue
comparar de verdade, lendo o conteúdo já formatado em pt-BR (`1.234`, `12,5%`, `R$ 4.200`). A coluna é
**recusada** quando: tem menos de dois valores comparáveis (só traços), mistura número e texto, ou
mistura unidade — o caso real de `45 min` ao lado de `1,2 h` na mediana de resposta, em que ordenar
pelo número cru mentiria. Cabeçalho que não ordena continua texto puro: sem botão morto, sem
`aria-sort`. Linha sem valor comparável vai para o fim nas duas direções — ela não é "a menor", é
desconhecida.

**Peça 14 · cartão abaixo de 900px.** Nenhuma tabela espreme nove colunas nem rola de lado num
aparelho de 390: cada linha vira cartão branco raio 16 com sombra do sistema, primeira célula como
título (rótulo pequeno em cima, valor 14px/700, separador) e cada valor seguinte ao lado do **rótulo da
sua coluna**. Os rótulos chegam ao CSS em `--c1..--c9`, publicados pelo componente — nenhuma tela
precisou repetir texto no markup. Status e chips continuam onde estavam; a linha clicável segue
clicável como cartão, com chevron, alvo de 44px e o mesmo `aberta` em tint roxo. O esqueleto de tabela
também virou cartão: o vazio promete o formato que vai chegar.

**Drawers intactos.** Ordenar reordena os próprios elementos `<tr>` recebidos como children, com
`onClick`, `tabIndex`, `className` e `key` preservados — Imóveis e Corretores continuam abrindo o
drawer sem saber que existe ordenação. Nada de novo em endpoint, permissão, dado ou service worker.

**O que ficou de fora, declarado:** paginação (nenhuma tabela da área passa de algumas dezenas de
linhas hoje; entra quando passar), ordenação persistida na URL, e navegação por setas dentro da grade
— hoje a tabela usa Tab e Enter/Espaço, que é o padrão de lista clicável, não de planilha.

## Commit 4 — KPIs e comparações

Todo KPI carrega definição acessível, valor, nota, comparação e confiança como campos separados.
Quando o endpoint não devolve período anterior, o chip diz “sem base comparável” — não calcula delta
contra zero nem esconde o espaço. O componente aceita delta absoluto/percentual com direção e fonte
específica; telas sem essa fonte permanecem honestamente neutras. Valor confirmado recebe confiança
alta por padrão; valor ausente vira pendente, sem transformar ausência em zero.

## Commit 5 — Empresa

As quatro telas executivas formam uma leitura contínua: Visão da empresa separa resultado, risco e
próximo movimento; Vendas usa o bloco `anterior` para comparação real de quantidade e VGV; Financeiro
identifica a origem de cada degrau e continua parando em contribuição estimada; Captação nomeia
`captacoes_portal` em cada indicador. Nenhuma previsão usa média e nenhum VGV é chamado de receita ou
lucro. As fontes ausentes permanecem visíveis como pendência.

## Commit 6 — Operação comercial

Atendimento transforma os quatro riscos agregados em filas clicáveis: o drawer mantém volume e
contexto, e a ação nominal segue para o Funil 2.0 atrás da permissão de dado pessoal. Conversão passa
a mostrar perda absoluta junto da taxa entre etapas. Qualidade abre a ficha de critérios por pessoa
com amostra, sem criar ranking e sem classificar quem não atingiu o mínimo. Os números continuam vindo
do mesmo endpoint autenticado; nenhum nome novo é exposto por agregação.

## Commit 7 — Gestão de pessoas

Performance preserva quatro pilares independentes e expõe a base de cada um; Corretores mantém a
leitura individual sem ranking público e declara que atividade no ERP não é controle de ponto. Em
Gerentes, cada linha abre o drawer compartilhado com capacidade, pendências e uma decisão calculada
sobre o limite cadastrado. A hierarquia corretor → gerente continua visível como dependência, portanto
nenhuma equipe fictícia foi criada para preencher a referência visual.

## Commit 8 — Mercado e digital

Aquisição e Comportamento usam GA4 real quando configurado e distinguem sessões de pessoas; custos de
Google/Meta e mapas do Clarity permanecem pendências explícitas. Imóveis cruza o estoque publicado com
procura agregada e abre o detalhe do segmento no drawer, sem inventar visualização por anúncio. Sara
mantém as sete etapas, os indicadores de procura e saúde em estado conectável; texto digitado nunca é
exposto e atribuição ao negócio só será exibida quando a origem chegar ao lead.

## Commit 9 — Governança

A Central avalia limiares fixos sobre o dado confirmado, separa crítico, atenção, normalidade e regra
inativa, e nunca converte falha de consulta em zero. Privacidade mostra por nível o que a coleta pode
fazer, a saúde de cada conexão e as lacunas de qualidade. Ausência de Ads, Clarity ou consentimento não
é escondida por decoração visual.

## Commit 10 — Copiloto de Inteligência

Todas as 16 rotas recebem o mesmo Copiloto. Ao abrir, ele resume imediatamente os KPIs e pendências
que já estão renderizados, sem nova transmissão. Perguntas usam o agente `inteligencia-ceo` pela rota
autenticada existente e enviam somente agregados da tela; nome, telefone e texto de conversa ficam de
fora. Carregamento, resposta, indisponibilidade do agente e ausência de dado têm estados próprios. Se
o agente ainda não estiver publicado, o resumo local continua funcional e a interface informa a ação
necessária sem simular uma resposta de IA.

## Diferença de sistema — as 14 peças do artboard 30b

| Peça | Situação | Evidência | Ação |
|---|---|---|---|
| 01 Cabeçalho de seção | fiel | `.ape-int-secao` eyebrow 11/600 roxo + h2 20/700 | — |
| 02 KPI | **fiel (Commit 4)** | definição acessível, chip de comparação/ausência, confiança e procedência tipadas | — |
| 03 Tile de ícone 34px | **fiel (Commit 1)** | `.ape-int-tile` + `.ape-int-ic` por máscara | — |
| 04 Abas e grupos pill | fiel | `<a href>` reais, ativo #FFF3EA/#FF7000/#CC5800 | — |
| 05 Barra de filtros | **fiel (Commit 1)** | `.ape-int-barra` com os 13 controles do 11a | período personalizado e Exportar |
| 06 Chip de filtro ativo | **fiel (Commit 1)** | `.ape-int-chip-ativo` roxo com ✕ | — |
| 07 Selo de procedência | fiel | "DADO REAL · hh:mm" / "aguardando dado"; DEMONSTRAÇÃO omitido de propósito | — |
| 08 Linha de funil | **fiel (Commit 6)** | barra, volume, perda absoluta, taxa e clique para o drawer agregador | — |
| 09 Tabela | **fiel (Commit 3)** | ordenação só em coluna comparável, `aria-sort`, linha clicável por mouse/Enter/Espaço, foco visível | paginação e ordem na URL, quando o volume pedir |
| 10 Drawer 420px | **fiel (Commits 2 e 7)** | um componente para imóvel, jornada, corretor e gerente; URL, foco, Esc, scrim e folha móvel | — |
| 11 Bloco de pendência | fiel | `.ape-int-pendencia` alimentado por `pendencias[]` | — |
| 12 Vazio e erro | fiel | tracejado neutro / #FBE5E5 com "Tentar novamente" | — |
| 13 Esqueleto | **fiel (Commit 1)** | três formas por bloco; o de tabela vira cartão no celular (Commit 3) | — |
| 14 Cartão de celular | **fiel (Commit 3)** | as 8 tabelas viram lista de cartões abaixo de 900px, com rótulo de coluna, status e drill-down | — |

Os **tokens não divergem**: a folha usa #FAF8F6, cartão branco raio 18 sombra 0 2px 6px
rgba(31,28,26,.06), eyebrow 11/600 +0.12em, KPI 26/700 tabular, chips pill em tint, ativo laranja e
avatar roxo #F7ECFC/#66009A. O desvio é de peças que faltam, não de estilo errado.

## Cobertura tela por tela

| Tela | Artboards | Rota | Componente | Fonte de dados | Diferença | Fecha em |
|---|---|---|---|---|---|---|
| Visão da empresa | 2a 14b 2b 25d 1c 12b 10a 22a | `/inteligencia` | `VisaoEmpresa.tsx` | RPC `performance_sala_comando` + `site_leads` | sem briefing do Copiloto, sem delta, sem drill-down de etapa | 4 · 5 · 11 |
| Vendas e previsão | 19b 27b 29a 12g | `/inteligencia/vendas` | `VendasPrevisao.tsx` | empresa: vendas, vgv, pendentes, metas, pipelineQuente | sem drawer da venda | 5 |
| Financeiro e comissões | 20a 27c 29a 12h | `/inteligencia/financeiro` | `Financeiro.tsx` + GuardaModulo | receitaBruta, custos, margemContribuição | cascata VGV→lucro sem componente | 5 |
| Captação de proprietários | 7a 25a 28a 1h | `/inteligencia/proprietarios` | `Proprietarios.tsx` | `captacoes_portal` | sem drawer da captação, sem tile por status | 5 |
| Atendimento e SLA | 15a 26a 22a 12c | `/inteligencia/atendimento` | `AtendimentoSla.tsx` | corretores: slaAmostra, mediana, sla15Pct; limiares 5/15 min | tabela já ordena e vira cartão (Commit 3); falta drill-down da fila | 6 |
| Performance da equipe | 16a 26b 29a 12d | `/inteligencia/equipe` | `PerformanceEquipe.tsx` | corretores agregado nos 4 pilares | sem tile por pilar, sem clique para lista filtrada | 7 |
| Gerentes | 17a 26c 29a 12e | `/inteligencia/gerentes` | `Gerentes.tsx` | corretores por ocupação e vencidas | página do gerente não existe como destino | 7 |
| Corretores | 18a 26d 29a 12f | `/inteligencia/corretores` | `Corretores.tsx` | corretores completo | perfil em drawer e tabela ordenada; falta escopo por perfil (visão própria sem ranking) | 7 |
| Conversão e CRM | 5a 24d 10a 1g | `/inteligencia/conversao` | `ConversaoCrm.tsx` | empresa.fluxo + qualidadeDado | jornada individual do lead segue no Funil 2.0 por permissão | 6 |
| Qualidade | 19a 27a 29a 12g | `/inteligencia/qualidade` | `Qualidade.tsx` | qualidadeDado + notas de IA (amostra mínima 8) | sem drawer da avaliação | 6 |
| Aquisição e campanhas | 3a 24a 28a 1d | `/inteligencia/aquisicao` | `Aquisicao.tsx` | GA4 (`app/lib/ga4.ts`) + `site_leads`; custo de mídia = pendência | sem delta, sem tile por canal | 4 · 8 |
| Comportamento e conteúdo | 4a 24b 28a 1e | `/inteligencia/comportamento` | `Comportamento.tsx` | GA4 páginas/entradas/dispositivos | sem rolagem/mapa de calor (Clarity) | 8 |
| Imóveis e procura | 6a 24c 10a 1f | `/inteligencia/imoveis` | `Imoveis.tsx` | `anuncios_site` × `captacoes_portal` | tabela ordenada e drawer do corte prontos; telemetria por imóvel bloqueada | 8 |
| Sara | 8a 25b 28a 1i | `/inteligencia/sara` | `Sara.tsx` | sem fonte: tela em ausência de integração | layout completo com traços | 9 |
| Central de alertas | 21a 27d 22a 12i | `/inteligencia/alertas` | `CentralAlertas.tsx` | empresa.riscos + corretores | sem tile de gravidade, sem drawer da evidência | 10 |
| Privacidade e tracking | 9a 25c 28a 1j | `/inteligencia/privacidade` | `PrivacidadeTracking.tsx` | qualidadeDado; consentimento/Clarity pendentes | sem semáforo em tile | 10 |
| **Copiloto ApêCerto** | 31a–31h | nenhuma | **não existe** | backend de IA inexistente | 8 artboards sem nada no ar | 11 |
| Casca e navegação | 23a 23b 11a 11b 12j 30a 30b 1b | `/performance` → Visão | `CascaInteligencia.tsx` + `BarraFiltros.tsx` + `filtros.ts` + `Drawer.tsx` | — | filtros na URL, chips, drawer e tabela prontos; escopo por perfil (12j) pendente | 7 |

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
2. ✅ Drawer + drill-down: peça 10, com imóvel, jornada e corretor.
3. ✅ Tabelas e mobile: peças 09 e 14 nas 8 tabelas da área.
4. ✅ KPIs e comparações: peça 02, confiança, procedência e ausência de base explícita.
5. Empresa · 6. Operação comercial · 7. Performance · 8. Mercado e digital · 9. Sara · 10. Governança.
11. Interface do Copiloto, sem simular IA.
12. Responsividade e acabamento (1440×900 e 390×844).
