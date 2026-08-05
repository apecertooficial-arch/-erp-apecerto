# Contexto — quem usa este sistema e para quê

Leia antes de qualquer trabalho de design ou interface. As decisões visuais deste
ERP só fazem sentido se você entender o negócio por trás delas.

---

## A empresa

**ApeCerto** — imobiliária de São Paulo, focada na zona sul: Moema (onde está a
maior parte do estoque), Campo Belo, Vila Mariana, Santo Amaro, Planalto
Paulista e São Judas.

O negócio é **venda de apartamento novo e na planta**, direto das incorporadoras
(Eztec, Cyrela, Trisul, Benx, Conx, One Innovation, Canopus, Kallas, entre
outras), mais unidades de terceiros indicadas pelos próprios corretores.

Ordem de grandeza hoje:

| | |
|---|---|
| Empreendimentos no portfólio | 49 |
| Unidades cadastradas | 253 (≈235 disponíveis) |
| VGV disponível | ~R$ 263 milhões |
| Ticket médio | ~R$ 1,1 milhão |
| Leads na base | ~13.400 |
| Conversas de WhatsApp | ~6.600 |

## Quem usa

**Corretores** (hoje: Claudia, Elizângela, Tica, Fabiano, Edrisia, Kapri) — são a
maioria dos acessos. Trabalham **majoritariamente no celular**, em movimento,
entre visitas. Precisam de: receber o lead, abrir o WhatsApp, saber o que
oferecer, registrar o que aconteceu.

**Gestores e admin** — acompanham funil, performance, aprovam indicações de
unidades, cuidam do financeiro e das comissões. Usam mais o desktop.

## O ciclo que o sistema serve

1. O lead chega (Meta Ads, formulário, indicação) via webhook do Make
2. Uma automação distribui por rodízio entre os corretores ativos
3. O app **notifica o corretor no celular**
4. Ele abre o WhatsApp e faz a primeira abordagem — **prazo de 5 minutos**
5. Qualifica, agenda visita, faz a visita
6. Proposta → esteira de vendas → contrato → comissão

**O elo crítico é o passo 3.** Se a notificação não chega ou o corretor não
entende em dois segundos o que fazer, todo o resto perde o sentido. Qualquer
decisão de interface que atrase esse caminho é uma decisão errada.

## O que isso significa para o design

**Isto é ferramenta de trabalho, não vitrine.** Densidade de informação vale
mais que respiro. O corretor tem 5 minutos para abordar um lead e alguns
segundos para decidir o que oferecer — cada clique a mais custa.

**Celular é primeira classe, não adaptação.** A maior parte do uso real
acontece em tela pequena, com uma mão, na rua, às vezes com sol na tela.
Contraste e área de toque importam mais que sutileza.

**Número é para decidir, não para enfeitar.** Todo indicador na tela precisa
responder a uma pergunta que alguém realmente faz: quanto tenho para vender,
quem está sem atender, o que está fora da curva. Indicador que ninguém usa para
agir deve sair da tela.

**Dado faltando se declara, não se disfarça.** O catálogo já mostrou "0 dorm."
em 47 de 49 produtos porque a coluna era nula — o corretor lia "studio" onde
havia apartamento de 3 dormitórios. Quando falta dado, escreva que falta.

**Urgência precisa ser visível sem ser lida.** Prazo estourando, lead sem
abordagem, estoque acabando: isso tem que saltar por cor e posição, antes de
qualquer texto.

## Os módulos

| Módulo | Para quê |
|---|---|
| **Início** | O dia do corretor: o que fazer agora |
| **CRM / Funil 2.0** | Funil de leads, do primeiro contato à proposta |
| **Produtos** | Catálogo de empreendimentos e unidades |
| **Performance** | Ranking, metas, produtividade da equipe |
| **Chat ao Vivo** | Conversas de WhatsApp dentro do sistema |
| **Financeiro** | Caixa, comissões, recebimentos |
| **Minha Equipe** | Gestão de corretores |
| **Abordagens** | Modelos de primeira mensagem |
| **Automações** | Construtor visual de fluxos |
| **Financiamento** | Fichas e simulações |
| **Disparos** | Envio em massa por WhatsApp |
| **Calendário** | Visitas e compromissos |
| **Projetos e Tarefas** | Kanban interno |
| **Agentes de IA** | Sara e os demais agentes |
| **Usuários / Perfis** | Acesso e permissões |

O módulo **Produtos** já foi redesenhado e serve de referência do padrão novo:
faixa de preço em vez de valor único, barra de estoque, chips de tipologia,
faixa de KPIs no topo, estado vazio declarado.

## Identidade

```
Laranja  #FF7000   ação e preço
Roxo     #8B00CC   dado derivado (R$/m², VGV, indicadores)
Fonte    Quicksand
```

Laranja é o que o usuário faz ou paga. Roxo é o que o sistema calculou. Nunca
disputam a mesma posição num componente.

> O arquivo `APECERTO_DIRECAO_DESIGN.md` na raiz traz `#ff6500` e `#8d2bd1`.
> São valores antigos e **estão errados**. Use `docs/design/tokens.css`.

## Restrições que vêm do negócio

- **Nada abaixo de 11px.** Já houve texto de 7px no sistema; foi corrigido.
- **Posse de lead é sagrada.** Lead com visita agendada nunca muda de corretor
  automaticamente. Se a interface sugerir que isso acontece, está errada.
- **O sistema não pode parar.** A equipe usa em horário comercial (9h30 às
  18h30). Mudança grande entra fora desse horário.
