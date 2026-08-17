"use client";

import { useEffect, useMemo, useState } from "react";

type Periodo = "todo" | "7d" | "mes" | "trimestre" | "ano";
type Aba = "vendas" | "trabalho" | "atendimento";
type Numero = number | string | null;

type Trabalho = {
  diasComSinalDisponibilidade: Numero; logins: Numero; minutosAtivosErp: Numero; diasAtivosErp: Numero; ultimoAcesso: string | null;
  minutosProdutivosEstimados: Numero; blocosProdutivos: Numero; diasComExecucao: Numero; amplitudeMediaDiaMin: Numero;
  mensagensEnviadas: Numero; mensagensRecebidas: Numero; mensagensPorDia: Numero; textosEnviados: Numero; audiosEnviados: Numero;
  imagensEnviadas: Numero; videosEnviados: Numero; documentosEnviados: Numero; primeiraMensagem: string | null; ultimaMensagem: string | null;
  contatosTrabalhados: Numero; contatosBilaterais: Numero; taxaRespostaPct: Numero; entreguesConfirmadas: Numero; lidasConfirmadas: Numero;
  acoesComerciais: Numero; tentativas: Numero; respostasCliente: Numero; mudancasEtapa: Numero; transferencias: Numero; negociosTrabalhados: Numero;
};

type Atendimento = {
  amostraTurnos: Numero; respostaP50Min: Numero; respostaP75Min: Numero; respostaP90Min: Numero;
  sla2Pct: Numero; sla5Pct: Numero; sla15Pct: Numero; sla60Pct: Numero;
  amostraRespostaCliente: Numero; respostaClienteP50Min: Numero; iaAmostra: Numero; iaMensagensAvaliadas: Numero; notaGeral: Numero;
  clareza: Numero; cordialidade: Numero; personalizacao: Numero; qualificacao: Numero; conducao: Numero; objecoes: Numero; escrita: Numero;
};

type MeuDia = {
  tarefasCriadas: Numero; tarefasConcluidasCoorte: Numero; tarefasDevidas: Numero; taxaConclusaoCoortePct: Numero;
  backlogVencido: Numero; backlogFuturo: Numero; acoesConfirmadas: Numero; momentosAlterados: Numero; notasAdicionadas: Numero;
  descartes: Numero; leadsMovimentados: Numero; carteiraAtiva: Numero; carteiraEmDia: Numero; acoesVencidas: Numero;
  semProximaAcao: Numero; carteiraMovimentadaPeriodo: Numero; coberturaCarteiraPct: Numero;
};

type Producao = {
  leadsRecebidos: Numero; contatosTrabalhados: Numero; conversasBilaterais: Numero; visitasMarcadas: Numero;
  visitasRealizadas: Numero; visitasCanceladas: Numero; visitasComFeedback: Numero; vendas: Numero; vgv: Numero;
};

type Corretor = {
  corretorId: number; nome: string; limiteCarteira: Numero;
  carteiraAtiva: Numero; acoesVencidas: Numero; emVisita: Numero; capacidadePct: Numero; vencidasPct: Numero;
  mensagens: Numero; conversas: Numero; diasComunicando: Numero; ultimaMensagem: string | null;
  minutosErp: Numero; diasComAcesso: Numero; ultimoAcesso: string | null;
  visitasMarcadas: Numero; visitasRealizadas: Numero; visitasCanceladas: Numero; visitasComFeedback: Numero;
  slaAmostra: Numero; medianaRespostaMin: Numero; sla15Pct: Numero;
  iaAmostra: Numero; notaAtendimento: Numero; vendas: Numero; vgv: Numero;
  trabalho: Trabalho; atendimento: Atendimento; meuDia: MeuDia; producao: Producao;
};

type Empresa = {
  vendas: Numero; vgv: Numero; vendasPendentes: Numero; vgvPendente: Numero;
  receitaBruta: Numero; custos: Numero; margemContribuicao: Numero;
  metaVgv: Numero; metaVendas: Numero; atingimentoVgvPct: Numero;
  anterior: { vendas: Numero; vgv: Numero; conversas: Numero; visitasMarcadas: Numero; visitasRealizadas: Numero };
  fluxo: { leads: Numero; negocios: Numero; conversas: Numero; visitasMarcadas: Numero; visitasRealizadas: Numero; visitasCanceladas: Numero };
  riscos: { carteira_ativa: Numero; acoes_vencidas: Numero; corretores_sobrecarregados: Numero; visitas_sem_feedback: Numero };
  pipelineQuente: { oportunidades: Numero; com_valor: Numero; valor_informado: Numero };
};

type QualidadeDado = {
  negocios_operacionais: Numero; negocios_com_valor: Numero; vendas_total: Numero; vendas_vinculadas: Numero;
  visitas_realizadas: Numero; visitas_com_feedback: Numero; leads_operacionais: Numero; leads_com_origem: Numero;
  perdas: Numero; perdas_com_motivo: Numero;
};

type Painel = {
  periodo?: { inicio: string; fim: string; anteriorInicio: string; anteriorFim: string };
  empresa?: Empresa | null; corretores?: Corretor[]; qualidadeDado?: QualidadeDado | null; error?: string;
};

const ABAS: Array<{ id: Aba; numero: string; nome: string; explicacao: string }> = [
  { id: "vendas", numero: "01", nome: "Vendas", explicacao: "Resultado e avanço comercial" },
  { id: "trabalho", numero: "02", nome: "Trabalho", explicacao: "Execução, tempo e disciplina" },
  { id: "atendimento", numero: "03", nome: "Atendimento e conduta", explicacao: "Velocidade, qualidade e pós-visita" },
];

const PERIODOS: Array<{ id: Periodo; nome: string }> = [
  { id: "todo", nome: "Todo histórico" }, { id: "ano", nome: "Ano" }, { id: "trimestre", nome: "Trimestre" },
  { id: "mes", nome: "Mês" }, { id: "7d", nome: "7 dias" },
];

const num = (v: unknown) => Number(v) || 0;
const tem = (v: unknown) => v !== null && v !== undefined && v !== "";
const inteiro = (v: unknown) => Math.round(num(v)).toLocaleString("pt-BR");
const decimal = (v: unknown) => num(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const dinheiro = (v: unknown) => num(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const duracao = (v: unknown) => num(v) >= 60 ? `${decimal(num(v) / 60)} h` : `${inteiro(v)} min`;
const taxa = (parte: unknown, total: unknown) => num(total) > 0 ? (100 * num(parte)) / num(total) : null;
const pct = (v: unknown) => tem(v) ? `${decimal(v)}%` : "Sem amostra";
const dataCurta = (v: string | null | undefined) => v ? new Date(v).toLocaleDateString("pt-BR") : "Sem registro";
const soma = (lista: Corretor[], ler: (c: Corretor) => unknown) => lista.reduce((total, c) => total + num(ler(c)), 0);
const mediaPonderada = (lista: Corretor[], valor: (c: Corretor) => unknown, peso: (c: Corretor) => unknown) => {
  const total = soma(lista, peso);
  return total ? lista.reduce((acc, c) => acc + num(valor(c)) * num(peso(c)), 0) / total : null;
};

function Cartao({ titulo, valor, detalhe, tom = "neutro" }: { titulo: string; valor: string; detalhe: string; tom?: "neutro" | "bom" | "alerta" }) {
  return <article className={`performance-card ${tom}`}><span>{titulo}</span><strong>{valor}</strong><small>{detalhe}</small></article>;
}

function Barra({ valor }: { valor: number | null }) {
  return <div className="performance-barra"><i style={{ width: `${Math.max(0, Math.min(100, valor ?? 0))}%` }} /></div>;
}

function CabecalhoSecao({ rotulo, titulo, apoio }: { rotulo: string; titulo: string; apoio?: string }) {
  return <header className="performance-section-head"><div><span>{rotulo}</span><h2>{titulo}</h2></div>{apoio && <small>{apoio}</small>}</header>;
}

function LinhaCorretor({ corretor, selecionado, onSelecionar, children }: { corretor: Corretor; selecionado: boolean; onSelecionar: () => void; children: React.ReactNode }) {
  return <tr className={selecionado ? "selecionado" : ""} onClick={onSelecionar}><td><button type="button" className="performance-person" onClick={onSelecionar}><i>{corretor.nome.slice(0, 1).toUpperCase()}</i><span><b>{corretor.nome}</b><small>Ver somente este corretor</small></span></button></td>{children}</tr>;
}

function Vendas({ corretores, empresa, qualidade, selecionado, onSelecionar }: { corretores: Corretor[]; empresa: Empresa | null; qualidade: QualidadeDado | null; selecionado: number | null; onSelecionar: (id: number) => void }) {
  const individual = corretores.length === 1 && selecionado !== null;
  const vendas = individual ? soma(corretores, (c) => c.producao.vendas) : num(empresa?.vendas ?? soma(corretores, (c) => c.producao.vendas));
  const vgv = individual ? soma(corretores, (c) => c.producao.vgv) : num(empresa?.vgv ?? soma(corretores, (c) => c.producao.vgv));
  const leads = soma(corretores, (c) => c.producao.leadsRecebidos);
  const contatos = soma(corretores, (c) => c.producao.contatosTrabalhados);
  const bilaterais = soma(corretores, (c) => c.producao.conversasBilaterais);
  const marcadas = soma(corretores, (c) => c.producao.visitasMarcadas);
  const realizadas = soma(corretores, (c) => c.producao.visitasRealizadas);
  const canceladas = soma(corretores, (c) => c.producao.visitasCanceladas);
  const funil = [
    { nome: "Leads recebidos", valor: leads, detalhe: "fora do Bolsão" },
    { nome: "Contatos trabalhados", valor: contatos, detalhe: "evidências no D-API" },
    { nome: "Conversas bilaterais", valor: bilaterais, detalhe: pct(taxa(bilaterais, contatos)) + " dos contatos" },
    { nome: "Visitas marcadas", valor: marcadas, detalhe: pct(taxa(marcadas, bilaterais)) + " das conversas" },
    { nome: "Visitas realizadas", valor: realizadas, detalhe: pct(taxa(realizadas, marcadas)) + " das marcadas" },
    { nome: "Vendas", valor: vendas, detalhe: pct(taxa(vendas, realizadas)) + " das visitas" },
  ];
  const vinculoVenda = qualidade ? taxa(qualidade.vendas_vinculadas, qualidade.vendas_total) : null;

  return <>
    <section className="performance-summary">
      <CabecalhoSecao rotulo="RESULTADO COMERCIAL" titulo={individual ? `O que ${corretores[0]?.nome ?? "o corretor"} vendeu` : "O que a equipe vendeu"} apoio="Somente vendas pagas ou concluídas" />
      <div className="performance-cards">
        <Cartao titulo="Vendas fechadas" valor={inteiro(vendas)} detalhe={empresa && !individual ? `${inteiro(empresa.vendasPendentes)} pendente(s)` : "resultado reconhecido no financeiro"} tom={vendas ? "bom" : "alerta"} />
        <Cartao titulo="VGV realizado" valor={dinheiro(vgv)} detalhe={empresa && !individual && num(empresa.metaVgv) ? `${pct(empresa.atingimentoVgvPct)} da meta` : "valor proporcional por corretor"} />
        <Cartao titulo="Visitas realizadas" valor={inteiro(realizadas)} detalhe={`${inteiro(marcadas)} marcadas · ${inteiro(canceladas)} canceladas`} />
        <Cartao titulo="Visita → venda" valor={pct(taxa(vendas, realizadas))} detalhe={`${inteiro(vendas)} venda(s) / ${inteiro(realizadas)} visita(s) realizadas`} />
      </div>
      {empresa && !individual && <div className="performance-finance"><div><span>Comissão bruta</span><b>{dinheiro(empresa.receitaBruta)}</b></div><div><span>Custos registrados</span><b>{dinheiro(empresa.custos)}</b></div><div><span>Margem de contribuição</span><b>{dinheiro(empresa.margemContribuicao)}</b></div><div><span>VGV pendente</span><b>{dinheiro(empresa.vgvPendente)}</b></div></div>}
    </section>

    <section className="performance-section">
      <CabecalhoSecao rotulo="CAMINHO ATÉ A VENDA" titulo="Em qual etapa o resultado está travando" apoio="Volumes do período; não é uma coorte dos mesmos leads" />
      <div className="performance-funil">{funil.map((item, index) => <article key={item.nome}><i>{index + 1}</i><span>{item.nome}</span><strong>{inteiro(item.valor)}</strong><small>{item.detalhe}</small></article>)}</div>
    </section>

    <section className="performance-section">
      <CabecalhoSecao rotulo="COMPARAÇÃO INDIVIDUAL" titulo="Produção de cada corretor" apoio="Clique em uma pessoa para investigar os três eixos" />
      <div className="performance-table-wrap"><table className="performance-table vendas"><thead><tr><th>Corretor</th><th>Resultado</th><th>Leads e contatos</th><th>Conversa</th><th>Visitas</th><th>Cancelamento</th><th>Visita → venda</th></tr></thead><tbody>
        {corretores.map((c) => <LinhaCorretor key={c.corretorId} corretor={c} selecionado={c.corretorId === selecionado} onSelecionar={() => onSelecionar(c.corretorId)}>
          <td><b>{inteiro(c.producao.vendas)} venda(s)</b><small>{dinheiro(c.producao.vgv)} em VGV</small></td>
          <td><b>{inteiro(c.producao.leadsRecebidos)} leads · {inteiro(c.producao.contatosTrabalhados)} contatos</b><small>volumes do período; bases diferentes</small></td>
          <td><b>{inteiro(c.producao.conversasBilaterais)} bilaterais</b><small>{pct(taxa(c.producao.conversasBilaterais, c.producao.contatosTrabalhados))} dos contatos</small></td>
          <td><b>{inteiro(c.producao.visitasRealizadas)} de {inteiro(c.producao.visitasMarcadas)}</b><small>{inteiro(c.producao.visitasComFeedback)} com feedback</small></td>
          <td><b>{pct(taxa(c.producao.visitasCanceladas, c.producao.visitasMarcadas))}</b><small>{inteiro(c.producao.visitasCanceladas)} cancelada(s)</small></td>
          <td><b>{pct(taxa(c.producao.vendas, c.producao.visitasRealizadas))}</b><small>{inteiro(c.producao.vendas)} / {inteiro(c.producao.visitasRealizadas)}</small></td>
        </LinhaCorretor>)}
      </tbody></table></div>
    </section>

    <aside className="performance-confidence"><b>Limite desta leitura</b><span>{vinculoVenda === null ? "A ligação venda → negócio ainda não tem amostra confirmada." : `${pct(vinculoVenda)} das vendas estão ligadas ao negócio de origem.`} Por isso, o fluxo acima mede volume de atividade, não conversão de coorte.</span></aside>
  </>;
}

function TrabalhoEquipe({ corretores, selecionado, onSelecionar }: { corretores: Corretor[]; selecionado: number | null; onSelecionar: (id: number) => void }) {
  const minutos = soma(corretores, (c) => c.trabalho.minutosProdutivosEstimados);
  const dias = soma(corretores, (c) => c.trabalho.diasComExecucao);
  const mensagens = soma(corretores, (c) => c.trabalho.mensagensEnviadas);
  const contatos = soma(corretores, (c) => c.trabalho.contatosTrabalhados);
  const acoes = soma(corretores, (c) => num(c.trabalho.acoesComerciais) + num(c.meuDia.acoesConfirmadas));
  const carteira = soma(corretores, (c) => c.meuDia.carteiraAtiva);
  const emDia = soma(corretores, (c) => c.meuDia.carteiraEmDia);
  const vencidas = soma(corretores, (c) => c.meuDia.acoesVencidas);
  const semAcao = soma(corretores, (c) => c.meuDia.semProximaAcao);
  const individual = corretores.length === 1 && selecionado !== null;

  return <>
    <section className="performance-summary">
      <CabecalhoSecao rotulo="TRABALHO COMPROVADO" titulo={individual ? `Como ${corretores[0]?.nome ?? "o corretor"} trabalhou` : "Quanto e como a equipe trabalhou"} apoio="D-API, CRM, Funil 2 e eventos operacionais" />
      <div className="performance-cards">
        <Cartao titulo="Tempo produtivo estimado" valor={duracao(minutos)} detalhe={`${inteiro(dias)} corretor-dia com execução`} />
        <Cartao titulo="Mensagens enviadas" valor={inteiro(mensagens)} detalhe={dias ? `${decimal(mensagens / dias)} por dia com execução` : "sem dia com execução"} />
        <Cartao titulo="Contatos trabalhados" valor={inteiro(contatos)} detalhe={`${inteiro(soma(corretores, (c) => c.trabalho.contatosBilaterais))} tiveram troca bilateral`} />
        <Cartao titulo="Ações registradas" valor={inteiro(acoes)} detalhe="ações comerciais + confirmações do Funil 2" />
      </div>
    </section>

    <section className="performance-reading"><div><span>COMO LER O TEMPO</span><h2>Evidência de execução, não controle de ponto</h2></div><div><p><b>Tempo produtivo estimado</b> soma blocos de 5 minutos com ação humana real.</p><p><b>Uso ativo do ERP</b> existe apenas desde o início do heartbeat confiável.</p><p><b>Amplitude do dia</b> inclui pausas; não representa horas trabalhistas.</p></div></section>

    <section className="performance-section">
      <CabecalhoSecao rotulo="EXECUÇÃO INDIVIDUAL" titulo="Evidências do trabalho de cada corretor" apoio="Receber lead, ficar online e receber mensagem não contam como trabalho" />
      <div className="performance-table-wrap"><table className="performance-table trabalho"><thead><tr><th>Corretor</th><th>Tempo e dias</th><th>Mensagens</th><th>Contatos</th><th>CRM e Funil 2</th><th>Disciplina da carteira</th><th>Último sinal</th></tr></thead><tbody>
        {corretores.map((c) => <LinhaCorretor key={c.corretorId} corretor={c} selecionado={c.corretorId === selecionado} onSelecionar={() => onSelecionar(c.corretorId)}>
          <td><b>{duracao(c.trabalho.minutosProdutivosEstimados)} estimadas</b><small>{inteiro(c.trabalho.diasComExecucao)} dia(s) · ERP {num(c.trabalho.minutosAtivosErp) ? duracao(c.trabalho.minutosAtivosErp) : "sem histórico"}</small></td>
          <td><b>{inteiro(c.trabalho.mensagensEnviadas)} enviadas</b><small>{inteiro(c.trabalho.mensagensRecebidas)} recebidas · {decimal(c.trabalho.mensagensPorDia)}/dia</small></td>
          <td><b>{inteiro(c.trabalho.contatosTrabalhados)} trabalhados</b><small>{inteiro(c.trabalho.contatosBilaterais)} bilaterais · {pct(c.trabalho.taxaRespostaPct)} responderam</small></td>
          <td><b>{inteiro(c.trabalho.acoesComerciais)} ações CRM</b><small>{inteiro(c.meuDia.acoesConfirmadas)} confirmações · {inteiro(c.trabalho.mudancasEtapa)} mudanças</small></td>
          <td><b>{pct(c.meuDia.coberturaCarteiraPct)} em dia</b><small>{inteiro(c.meuDia.acoesVencidas)} vencidas · {inteiro(c.meuDia.semProximaAcao)} sem próxima ação</small></td>
          <td><b>{dataCurta(c.trabalho.ultimaMensagem)}</b><small>amplitude média {tem(c.trabalho.amplitudeMediaDiaMin) ? duracao(c.trabalho.amplitudeMediaDiaMin) : "sem amostra"}</small></td>
        </LinhaCorretor>)}
      </tbody></table></div>
    </section>

    <section className="performance-section">
      <CabecalhoSecao rotulo="DISCIPLINA OPERACIONAL" titulo="A carteira está sendo cuidada direito?" />
      <div className="performance-discipline">
        <article><span>Carteira ativa</span><strong>{inteiro(carteira)}</strong><small>leads sob responsabilidade agora</small></article>
        <article><span>No prazo</span><strong>{inteiro(emDia)}</strong><small>{pct(taxa(emDia, carteira))} da carteira</small><Barra valor={taxa(emDia, carteira)} /></article>
        <article className={vencidas ? "alerta" : ""}><span>Ações vencidas</span><strong>{inteiro(vencidas)}</strong><small>exigem intervenção imediata</small></article>
        <article className={semAcao ? "alerta" : ""}><span>Sem próxima ação</span><strong>{inteiro(semAcao)}</strong><small>carteiras sem compromisso futuro</small></article>
      </div>
    </section>
  </>;
}

function AtendimentoEquipe({ corretores, selecionado, onSelecionar }: { corretores: Corretor[]; selecionado: number | null; onSelecionar: (id: number) => void }) {
  const turnos = soma(corretores, (c) => c.atendimento.amostraTurnos);
  const sla15 = mediaPonderada(corretores, (c) => c.atendimento.sla15Pct, (c) => c.atendimento.amostraTurnos);
  const contatos = soma(corretores, (c) => c.trabalho.contatosTrabalhados);
  const bilaterais = soma(corretores, (c) => c.trabalho.contatosBilaterais);
  const iaAmostra = soma(corretores, (c) => c.atendimento.iaAmostra);
  const notaIa = mediaPonderada(corretores, (c) => c.atendimento.notaGeral, (c) => c.atendimento.iaAmostra);
  const marcadas = soma(corretores, (c) => c.producao.visitasMarcadas);
  const realizadas = soma(corretores, (c) => c.producao.visitasRealizadas);
  const canceladas = soma(corretores, (c) => c.producao.visitasCanceladas);
  const feedbacks = soma(corretores, (c) => c.producao.visitasComFeedback);
  const individual = corretores.length === 1 && selecionado !== null;
  const dimensoes = [
    ["Clareza", mediaPonderada(corretores, (c) => c.atendimento.clareza, (c) => c.atendimento.iaAmostra)],
    ["Cordialidade", mediaPonderada(corretores, (c) => c.atendimento.cordialidade, (c) => c.atendimento.iaAmostra)],
    ["Personalização", mediaPonderada(corretores, (c) => c.atendimento.personalizacao, (c) => c.atendimento.iaAmostra)],
    ["Qualificação", mediaPonderada(corretores, (c) => c.atendimento.qualificacao, (c) => c.atendimento.iaAmostra)],
    ["Condução", mediaPonderada(corretores, (c) => c.atendimento.conducao, (c) => c.atendimento.iaAmostra)],
    ["Objeções", mediaPonderada(corretores, (c) => c.atendimento.objecoes, (c) => c.atendimento.iaAmostra)],
    ["Escrita", mediaPonderada(corretores, (c) => c.atendimento.escrita, (c) => c.atendimento.iaAmostra)],
  ] as Array<[string, number | null]>;

  return <>
    <section className="performance-summary">
      <CabecalhoSecao rotulo="ATENDIMENTO E CONDUTA" titulo={individual ? `Como ${corretores[0]?.nome ?? "o corretor"} atende` : "Como a equipe atende e conduz o cliente"} apoio="Velocidade sempre acompanhada da amostra" />
      <div className="performance-cards">
        <Cartao titulo="Respostas medidas" valor={inteiro(turnos)} detalhe="turnos do corretor após mensagem do cliente" />
        <Cartao titulo="Respondidas em até 15 min" valor={pct(sla15)} detalhe={`base: ${inteiro(turnos)} respostas`} tom={turnos && num(sla15) < 70 ? "alerta" : "bom"} />
        <Cartao titulo="Contatos que responderam" valor={pct(taxa(bilaterais, contatos))} detalhe={`${inteiro(bilaterais)} de ${inteiro(contatos)} contatos trabalhados`} />
        <Cartao titulo="Qualidade por IA" valor={iaAmostra ? decimal(notaIa) : "Sem amostra"} detalhe={`${inteiro(iaAmostra)} atendimento(s) avaliados`} />
      </div>
    </section>

    <section className="performance-section">
      <CabecalhoSecao rotulo="VELOCIDADE E RECIPROCIDADE" titulo="O cliente recebe resposta e continua a conversa?" apoio="P50 mostra o caso típico; P90 revela a cauda lenta" />
      <div className="performance-table-wrap"><table className="performance-table atendimento"><thead><tr><th>Corretor</th><th>Tempo de resposta</th><th>Até 2 min</th><th>Até 5 min</th><th>Até 15 min</th><th>Até 60 min</th><th>Resposta do contato</th><th>Qualidade IA</th></tr></thead><tbody>
        {corretores.map((c) => <LinhaCorretor key={c.corretorId} corretor={c} selecionado={c.corretorId === selecionado} onSelecionar={() => onSelecionar(c.corretorId)}>
          <td><b>{num(c.atendimento.amostraTurnos) ? `P50 ${duracao(c.atendimento.respostaP50Min)}` : "Sem amostra"}</b><small>{num(c.atendimento.amostraTurnos) ? `P90 ${duracao(c.atendimento.respostaP90Min)} · ${inteiro(c.atendimento.amostraTurnos)} casos` : "não classificar"}</small></td>
          <td>{pct(c.atendimento.sla2Pct)}</td><td>{pct(c.atendimento.sla5Pct)}</td><td><b>{pct(c.atendimento.sla15Pct)}</b></td><td>{pct(c.atendimento.sla60Pct)}</td>
          <td><b>{pct(c.trabalho.taxaRespostaPct)}</b><small>{inteiro(c.trabalho.contatosBilaterais)} bilaterais</small></td>
          <td><b>{num(c.atendimento.iaAmostra) ? decimal(c.atendimento.notaGeral) : "Sem amostra"}</b><small>{inteiro(c.atendimento.iaAmostra)} avaliações</small></td>
        </LinhaCorretor>)}
      </tbody></table></div>
    </section>

    <div className="performance-two-columns">
      <section className="performance-section">
        <CabecalhoSecao rotulo="CONDUTA NA VISITA" titulo="Marcou, compareceu e documentou?" />
        <div className="performance-visit-flow"><article><span>Marcadas</span><strong>{inteiro(marcadas)}</strong></article><i>→</i><article><span>Realizadas</span><strong>{inteiro(realizadas)}</strong><small>{pct(taxa(realizadas, marcadas))}</small></article><i>→</i><article className={canceladas ? "alerta" : ""}><span>Canceladas</span><strong>{inteiro(canceladas)}</strong><small>{pct(taxa(canceladas, marcadas))}</small></article><i>→</i><article className={realizadas > feedbacks ? "alerta" : ""}><span>Com feedback</span><strong>{inteiro(feedbacks)}</strong><small>{pct(taxa(feedbacks, realizadas))}</small></article></div>
      </section>
      <section className="performance-section">
        <CabecalhoSecao rotulo="QUALIDADE DA CONVERSA" titulo="Onde o atendimento precisa de coaching" apoio={`Base: ${inteiro(iaAmostra)} avaliações`} />
        <div className="performance-quality">{dimensoes.map(([nome, valor]) => <div key={nome}><span>{nome}</span><b>{valor === null ? "—" : decimal(valor)}</b><Barra valor={valor === null ? null : valor * 10} /></div>)}</div>
      </section>
    </div>

    <aside className="performance-confidence"><b>Regra de conduta</b><span>A IA orienta coaching e nunca substitui auditoria humana. Sem amostra suficiente, o corretor aparece como “sem amostra”, não como nota zero.</span></aside>
  </>;
}

export function PerformanceWorkspace({ accessToken }: { accessToken: string; sessionRole?: string }) {
  const [periodo, setPeriodo] = useState<Periodo>("todo");
  const [aba, setAba] = useState<Aba>("vendas");
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [painel, setPainel] = useState<Painel | null>(null);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "falhou">("carregando");
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    const controller = new AbortController();
    fetch(`/api/performance?periodo=${periodo}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal })
      .then(async (response) => ({ ok: response.ok, body: await response.json() as Painel }))
      .then(({ ok, body }) => {
        if (!ativo) return;
        if (!ok || body.error) throw new Error(body.error || "Falha HTTP");
        setPainel(body);
        setEstado("pronto");
      })
      .catch((error: unknown) => {
        if (!ativo || controller.signal.aborted) return;
        console.error("[performance] falha na consulta:", error);
        setEstado("falhou");
      });
    return () => { ativo = false; controller.abort(); };
  }, [accessToken, periodo, tentativa]);

  const todos = useMemo(() => painel?.corretores ?? [], [painel]);
  const corretores = useMemo(() => selecionado === null ? todos : todos.filter((c) => c.corretorId === selecionado), [todos, selecionado]);
  const mudarPeriodo = (novo: Periodo) => { setEstado("carregando"); setPeriodo(novo); };
  const limparSelecao = () => setSelecionado(null);
  const escopo = selecionado === null ? "Equipe inteira" : todos.find((c) => c.corretorId === selecionado)?.nome ?? "Corretor";

  return <main className="performance-wrap">
    <header className="performance-top">
      <div><span>GESTÃO COMERCIAL</span><h1>Performance da equipe</h1><p>Primeiro o resultado, depois o trabalho e por fim a qualidade do atendimento.</p></div>
      <div className="performance-controls"><label><span>Quem analisar</span><select value={selecionado ?? ""} onChange={(event) => setSelecionado(event.target.value ? Number(event.target.value) : null)}><option value="">Equipe inteira</option>{todos.map((c) => <option key={c.corretorId} value={c.corretorId}>{c.nome}</option>)}</select></label><div className="performance-periods">{PERIODOS.map((item) => <button type="button" key={item.id} className={periodo === item.id ? "ativo" : ""} onClick={() => mudarPeriodo(item.id)}>{item.nome}</button>)}</div></div>
    </header>

    <div className="performance-exclusion"><i>✓</i><div><b>Bolsão, Aquário e a ação de pescar estão fora da performance individual.</b><span>Esse estoque histórico não gera trabalho, produção ou mérito para nenhum corretor. Só a execução humana posterior é contabilizada.</span></div></div>

    <nav className="performance-tabs" aria-label="Etapas da análise de performance">{ABAS.map((item) => <button type="button" key={item.id} className={aba === item.id ? "ativo" : ""} onClick={() => setAba(item.id)}><i>{item.numero}</i><span><b>{item.nome}</b><small>{item.explicacao}</small></span></button>)}</nav>

    <div className="performance-scope"><div><span>Analisando</span><b>{escopo}</b></div>{selecionado !== null && <button type="button" onClick={limparSelecao}>Voltar para a equipe</button>}</div>

    {estado === "carregando" && !painel && <div className="performance-loading">Conectando todo o histórico do financeiro, D-API, CRM, Funil 2, visitas e avaliações…</div>}
    {estado === "falhou" && <div className="performance-error" role="alert"><div><b>Não foi possível confirmar os dados agora.</b><span>{painel ? "A última consulta válida continua visível." : "Nenhum número foi exibido sem confirmação."}</span></div><button type="button" onClick={() => { setEstado("carregando"); setTentativa((valor) => valor + 1); }}>Tentar novamente</button></div>}

    {painel && <>
      {aba === "vendas" && <Vendas corretores={corretores} empresa={painel.empresa ?? null} qualidade={painel.qualidadeDado ?? null} selecionado={selecionado} onSelecionar={setSelecionado} />}
      {aba === "trabalho" && <TrabalhoEquipe corretores={corretores} selecionado={selecionado} onSelecionar={setSelecionado} />}
      {aba === "atendimento" && <AtendimentoEquipe corretores={corretores} selecionado={selecionado} onSelecionar={setSelecionado} />}
      {painel.periodo && <footer className="performance-footer">Período: {painel.periodo.inicio} até {painel.periodo.fim} (fim exclusivo). Fonte histórica disponível no ERP; ausência de amostra nunca vira nota zero.</footer>}
    </>}
  </main>;
}
