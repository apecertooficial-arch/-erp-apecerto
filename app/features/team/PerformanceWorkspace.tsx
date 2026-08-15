"use client";

import { useEffect, useMemo, useState } from "react";

type Periodo = "todo" | "7d" | "mes" | "trimestre" | "ano";
type Aba = "visao" | "operacao" | "atendimento" | "funil" | "resultado" | "dados";
type Numero = number | string | null;

type CorretorPerformance = {
  corretorId: number;
  nome: string;
  notaExecucao: number;
  coberturaNotaPct: number;
  pilares: Record<"carteira" | "sla" | "trabalho" | "visitas" | "qualidade" | "atividade", Numero>;
  atividade: {
    minutosAtivos: Numero; diasComAcesso: Numero; primeiroAcesso: string | null;
    ultimoAcesso: string | null; disponivelDistribuicaoAgora: boolean;
    diasComComunicacao: Numero; primeiraComunicacao: string | null; ultimaComunicacao: string | null;
  };
  trabalho: {
    mensagensEnviadas: Numero; mensagensRecebidas: Numero; audiosEnviados: Numero;
    imagensEnviadas: Numero; videosEnviados: Numero; documentosEnviados: Numero; conversas: Numero;
    followups: Numero; reativacoes: Numero; leadsRecebidos: Numero;
    leadsAtualizados: Numero; contatosTrabalhados: Numero; contatosRespondidos: Numero;
    acoesComerciaisCrm: Numero; tentativasCrm: Numero; respostasClienteCrm: Numero;
    mudancasEtapaCrm: Numero; transferenciasCrm: Numero; correcoesManuaisCrm: Numero;
    entidadesTrabalhadasCrm: Numero;
  };
  atendimento: {
    amostraPrimeiraResposta: Numero; medianaPrimeiraRespostaMin: Numero; sla15Pct: Numero;
    avaliacoesIa: Numero; conversasAvaliadasIa: Numero; notaIa: Numero; clareza: Numero;
    cordialidade: Numero; personalizacao: Numero; qualificacao: Numero; conducao: Numero;
    objecoes: Numero; escrita: Numero;
  };
  carteira: {
    ativa: Numero; limite: Numero; acoesVencidas: Numero; vencem2h: Numero;
    emDiaPct: Numero; saraCobertos: Numero; descartes: Numero;
  };
  visitas: {
    marcadas: Numero; realizadas: Numero; canceladas: Numero;
    comFeedback: Numero; comparecimentoPct: Numero;
  };
  processo: {
    propostas: Numero; contratos: Numero; tarefasTotal: Numero;
    tarefasConcluidas: Numero; tarefasVencidas: Numero;
    leadsCriados: Numero; negociosCriados: Numero; movimentacoesEstagio: Numero;
    negociosMovimentados: Numero; f2AcoesConfirmadas: Numero; f2MomentosAlterados: Numero;
    f2SaraReavaliacoes: Numero; f2LeadsMovimentados: Numero; avaliacoesLead: Numero;
    notaMediaLead: Numero; entidadesAvaliadas: Numero;
  };
  resultado: {
    vendas: Numero; vgv: Numero; comissao: Numero; metaVgv: Numero;
    metaVendas: Numero; atingimentoPct: Numero; vendasPagas: Numero; vendasConcluidas: Numero;
    vendasPendentes: Numero; vgvPendente: Numero; comissaoFinal: Numero; custos: Numero;
    processosVenda: Numero; processosVendaVencidos: Numero; processosRegistrados: Numero;
    processosDocumentacao: Numero;
  };
};

type ResumoEquipe = {
  leadsCadastrados: Numero; leadsAtribuidos: Numero; negociosCadastrados: Numero; negociosAtribuidos: Numero;
  leadsTotais: Numero; leadsBolsao: Numero; leadsOperacionais: Numero;
  negociosTotais: Numero; negociosBolsao: Numero; negociosOperacionais: Numero;
  vendas: Numero; vendasPagas: Numero; vendasConcluidas: Numero; vendasPendentes: Numero;
  vgv: Numero; vgvPendente: Numero; comissaoBruta: Numero; custos: Numero;
  comissaoCorretores: Numero; comissaoEmpresa: Numero; comissaoExecutivos: Numero; comissaoIndicacoes: Numero;
  processosVenda: Numero; processosVendaVencidos: Numero; processosRegistrados: Numero; processosDocumentacao: Numero;
};

type CoberturaFonte = { fonte: string; registros: Numero; atribuidos?: Numero; semAtribuicao?: Numero; excluidosPerformance?: Numero; primeiroRegistro: string | null; ultimoRegistro: string | null };

type Painel = {
  periodo?: { inicio: string; fim: string; diasUteisObservados: number };
  geradoEm?: string;
  fontes?: {
    atividadeApp: boolean; atividadeRastreadaDesde: string | null; primeiraResposta: boolean;
    qualidadeIa: boolean; propostas: boolean; ligacoes: boolean; dapi: boolean; crm: boolean; funil2: boolean;
    cobertura: CoberturaFonte[]; observacao: string;
  };
  equipe?: ResumoEquipe | null;
  metaEquipe?: { meta_vgv: Numero; meta_vendas: Numero } | null;
  corretores?: CorretorPerformance[];
  error?: string;
};

const ABAS: Array<{ id: Aba; nome: string }> = [
  { id: "visao", nome: "Visão executiva" },
  { id: "operacao", nome: "Trabalho e disciplina" },
  { id: "atendimento", nome: "Atendimento" },
  { id: "funil", nome: "Funil e visitas" },
  { id: "resultado", nome: "Resultado comercial" },
  { id: "dados", nome: "Cobertura dos dados" },
];

const num = (valor: unknown) => typeof valor === "number" ? valor : Number(valor) || 0;
const tem = (valor: unknown): valor is number | string => valor !== null && valor !== undefined && valor !== "";
const inteiro = (valor: unknown) => Math.round(num(valor)).toLocaleString("pt-BR");
const decimal = (valor: unknown) => num(valor).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const dinheiro = (valor: unknown) => num(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const horas = (minutos: unknown) => `${(num(minutos) / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;
const pct = (valor: unknown) => tem(valor) ? `${decimal(valor)}%` : "Sem amostra";
const dataCurta = (valor: string | null | undefined) => valor ? new Date(valor).toLocaleDateString("pt-BR") : "Sem registro";

function faixa(nota: number) {
  if (nota >= 80) return { nome: "Forte", classe: "forte" };
  if (nota >= 60) return { nome: "Consistente", classe: "bom" };
  if (nota >= 40) return { nome: "Atenção", classe: "atencao" };
  return { nome: "Crítico", classe: "critico" };
}

function Metrica({ titulo, valor, detalhe, estado = "neutro" }: { titulo: string; valor: string; detalhe?: string; estado?: string }) {
  return <article className={`pc-metrica ${estado}`}><span>{titulo}</span><strong>{valor}</strong>{detalhe && <small>{detalhe}</small>}</article>;
}

function Pilar({ nome, nota, peso }: { nome: string; nota: Numero; peso: number }) {
  const disponivel = tem(nota);
  const n = num(nota);
  return <div className="pc-pilar">
    <div><span>{nome}<small>{peso}%</small></span><b>{disponivel ? inteiro(n) : "Sem amostra"}</b></div>
    <i><em className={disponivel ? faixa(n).classe : "indisponivel"} style={{ width: disponivel ? `${Math.max(2, n)}%` : "0%" }} /></i>
  </div>;
}

function CartaoFonte({ ativo, titulo, texto }: { ativo: boolean; titulo: string; texto: string }) {
  return <article className={`pc-fonte ${ativo ? "ok" : "pendente"}`}>
    <b>{ativo ? "✓" : "!"} {titulo}</b><p>{texto}</p>
  </article>;
}

function TabelaEquipe({ corretores, onAbrir }: { corretores: CorretorPerformance[]; onAbrir: (id: number) => void }) {
  const [ordem, setOrdem] = useState<"nota" | "vencidas" | "sla" | "visitas" | "vgv">("nota");
  const linhas = useMemo(() => [...corretores].sort((a, b) => {
    if (ordem === "vencidas") return num(b.carteira.acoesVencidas) - num(a.carteira.acoesVencidas);
    if (ordem === "sla") return num(b.atendimento.sla15Pct) - num(a.atendimento.sla15Pct);
    if (ordem === "visitas") return num(b.visitas.realizadas) - num(a.visitas.realizadas);
    if (ordem === "vgv") return num(b.resultado.vgv) - num(a.resultado.vgv);
    return num(b.notaExecucao) - num(a.notaExecucao);
  }), [corretores, ordem]);

  return <section className="pc-tabela-card">
    <div className="pc-secao-cab"><div><span>COMPARATIVO</span><h2>Quem está executando — e onde está travando</h2></div>
      <label>Ordenar por<select value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)}>
        <option value="nota">Nota de execução</option><option value="vencidas">Ações vencidas</option>
        <option value="sla">SLA</option><option value="visitas">Visitas</option><option value="vgv">VGV</option>
      </select></label>
    </div>
    <div className="pc-tabela-scroll"><table className="pc-tabela"><thead><tr>
      <th>Corretor</th><th>Execução</th><th>Dados</th><th>Dias comunicando</th><th>Conversas</th>
      <th>Ações CRM</th><th>Ações vencidas</th><th>SLA 15 min</th><th>Visitas</th><th>Nota IA</th><th>Vendas</th><th>VGV</th>
    </tr></thead><tbody>{linhas.map((c) => {
      const f = faixa(num(c.notaExecucao));
      return <tr key={c.corretorId} onClick={() => onAbrir(c.corretorId)}>
        <td><b>{c.nome}</b><small>{c.atividade.disponivelDistribuicaoAgora ? "Disponível na fila" : "Fora da fila"}</small></td>
        <td><mark className={f.classe}>{inteiro(c.notaExecucao)}</mark></td>
        <td>{inteiro(c.coberturaNotaPct)}%</td>
        <td>{inteiro(c.atividade.diasComComunicacao)}</td>
        <td>{inteiro(c.trabalho.conversas)}</td>
        <td>{inteiro(c.trabalho.acoesComerciaisCrm)}</td>
        <td className={num(c.carteira.acoesVencidas) ? "ruim" : "bom"}>{inteiro(c.carteira.acoesVencidas)}</td>
        <td>{pct(c.atendimento.sla15Pct)}</td><td>{inteiro(c.visitas.realizadas)}/{inteiro(c.visitas.marcadas)}</td>
        <td>{tem(c.atendimento.notaIa) ? decimal(c.atendimento.notaIa) : "Sem amostra"}</td>
        <td>{inteiro(c.resultado.vendas)}</td><td>{dinheiro(c.resultado.vgv)}</td>
      </tr>;
    })}</tbody></table></div>
  </section>;
}

function VisaoIndividual({ c, fontes }: { c: CorretorPerformance; fontes: NonNullable<Painel["fontes"]> }) {
  const f = faixa(num(c.notaExecucao));
  const principalRisco = num(c.carteira.acoesVencidas) > 0
    ? `${inteiro(c.carteira.acoesVencidas)} ações estão vencidas agora.`
    : tem(c.atendimento.sla15Pct) && num(c.atendimento.sla15Pct) < 85
      ? `O SLA está em ${pct(c.atendimento.sla15Pct)}, abaixo da meta de 85%.`
      : "Nenhum alerta crítico nas fontes disponíveis.";
  return <>
    <section className="pc-individual-hero">
      <div><span>LEITURA DE GESTÃO</span><h2>{c.nome}</h2><p>{principalRisco}</p></div>
      <div className={`pc-nota ${f.classe}`}><small>EXECUÇÃO</small><strong>{inteiro(c.notaExecucao)}</strong><span>{f.nome} · {inteiro(c.coberturaNotaPct)}% medido</span></div>
    </section>
    <section className="pc-pilares">
      <Pilar nome="Carteira em dia" nota={c.pilares.carteira} peso={25} />
      <Pilar nome="Primeira resposta" nota={c.pilares.sla} peso={20} />
      <Pilar nome="Trabalho realizado" nota={c.pilares.trabalho} peso={20} />
      <Pilar nome="Visitas" nota={c.pilares.visitas} peso={15} />
      <Pilar nome="Qualidade" nota={c.pilares.qualidade} peso={10} />
      <Pilar nome="Atividade no ERP" nota={fontes.atividadeApp ? c.pilares.atividade : null} peso={10} />
    </section>
  </>;
}

function ConteudoAba({ aba, corretores, fontes, metaEquipe, equipe }: { aba: Aba; corretores: CorretorPerformance[]; fontes: NonNullable<Painel["fontes"]>; metaEquipe?: Painel["metaEquipe"]; equipe?: ResumoEquipe | null }) {
  const soma = (ler: (c: CorretorPerformance) => unknown) => corretores.reduce((t, c) => t + num(ler(c)), 0);
  const media = (ler: (c: CorretorPerformance) => unknown) => {
    const valores = corretores.map(ler).filter(tem).map(num);
    return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
  };
  const unico = corretores.length === 1 ? corretores[0] : null;
  const corporativo = corretores.length > 1 ? equipe : null;

  if (aba === "operacao") return <>
    <div className="pc-grid-kpi">
      <Metrica titulo="Dias com comunicação" valor={inteiro(soma((c) => c.atividade.diasComComunicacao))} detalhe="Dias distintos com mensagem real no D-API" />
      <Metrica titulo="Conversas no D-API" valor={inteiro(soma((c) => c.trabalho.conversas))} detalhe={`${inteiro(soma((c) => c.trabalho.mensagensEnviadas) + soma((c) => c.trabalho.mensagensRecebidas))} mensagens brutas`} />
      <Metrica titulo="Ações comerciais no CRM" valor={inteiro(soma((c) => c.trabalho.acoesComerciaisCrm))} detalhe={`${inteiro(soma((c) => c.trabalho.entidadesTrabalhadasCrm))} leads/negócios trabalhados`} />
      <Metrica titulo="Tentativas registradas" valor={inteiro(soma((c) => c.trabalho.tentativasCrm))} detalhe={`${inteiro(soma((c) => c.trabalho.respostasClienteCrm))} respostas de clientes`} />
      <Metrica titulo="Ações vencidas agora" valor={inteiro(soma((c) => c.carteira.acoesVencidas))} detalhe={`${inteiro(soma((c) => c.carteira.vencem2h))} vencem nas próximas 2h`} estado={soma((c) => c.carteira.acoesVencidas) ? "critico" : "forte"} />
      <Metrica titulo="Carteira ativa" valor={inteiro(soma((c) => c.carteira.ativa))} detalhe="Leads sob responsabilidade hoje" />
      <Metrica titulo="Tarefas concluídas" valor={`${inteiro(soma((c) => c.processo.tarefasConcluidas))}/${inteiro(soma((c) => c.processo.tarefasTotal))}`} detalhe={`${inteiro(soma((c) => c.processo.tarefasVencidas))} vencidas`} />
      <Metrica titulo="Tempo ativo no ERP" valor={fontes.atividadeApp ? horas(soma((c) => c.atividade.minutosAtivos)) : "Medição iniciando"} detalhe="Horas confiáveis somente após o novo rastreamento" />
    </div>
    <p className="pc-nota-metodo">O histórico anterior de login não existia de forma confiável. Dias com comunicação comprovam atividade histórica; horas no ERP só contam após o início do rastreamento visível.</p>
  </>;

  if (aba === "atendimento") return <>
    <div className="pc-grid-kpi">
      <Metrica titulo="1ª resposta mediana" valor={tem(media((c) => c.atendimento.medianaPrimeiraRespostaMin)) ? `${decimal(media((c) => c.atendimento.medianaPrimeiraRespostaMin))} min` : "Sem amostra"} detalhe={`${inteiro(soma((c) => c.atendimento.amostraPrimeiraResposta))} casos medidos no horário comercial`} />
      <Metrica titulo="SLA em até 15 min" valor={pct(media((c) => c.atendimento.sla15Pct))} detalhe="Meta operacional: 85%" />
      <Metrica titulo="Conversas distintas" valor={inteiro(soma((c) => c.trabalho.conversas))} detalhe={`${inteiro(soma((c) => c.trabalho.contatosRespondidos))} primeiras respostas medidas`} />
      <Metrica titulo="Mensagens enviadas" valor={inteiro(soma((c) => c.trabalho.mensagensEnviadas))} detalhe={`${inteiro(soma((c) => c.trabalho.mensagensRecebidas))} recebidas`} />
      <Metrica titulo="Mídias enviadas" valor={inteiro(soma((c) => c.trabalho.audiosEnviados) + soma((c) => c.trabalho.imagensEnviadas) + soma((c) => c.trabalho.videosEnviados) + soma((c) => c.trabalho.documentosEnviados))} detalhe={`${inteiro(soma((c) => c.trabalho.audiosEnviados))} áudios · ${inteiro(soma((c) => c.trabalho.videosEnviados))} vídeos`} />
      <Metrica titulo="Nota de atendimento IA" valor={tem(media((c) => c.atendimento.notaIa)) ? decimal(media((c) => c.atendimento.notaIa)) : "Sem amostra"} detalhe={`${inteiro(soma((c) => c.atendimento.avaliacoesIa))} avaliações`} />
      <Metrica titulo="Reativações" valor={inteiro(soma((c) => c.trabalho.reativacoes))} detalhe="Cliente voltou após nova ação" />
    </div>
    {unico && tem(unico.atendimento.notaIa) && <section className="pc-qualidade"><div className="pc-secao-cab"><div><span>QUALIDADE DA CONVERSA</span><h2>O que a IA encontrou no atendimento</h2></div></div><div className="pc-pilares compactos">
      <Pilar nome="Clareza" nota={unico.atendimento.clareza} peso={0} /><Pilar nome="Cordialidade" nota={unico.atendimento.cordialidade} peso={0} />
      <Pilar nome="Personalização" nota={unico.atendimento.personalizacao} peso={0} /><Pilar nome="Qualificação" nota={unico.atendimento.qualificacao} peso={0} />
      <Pilar nome="Condução" nota={unico.atendimento.conducao} peso={0} /><Pilar nome="Objeções" nota={unico.atendimento.objecoes} peso={0} />
      <Pilar nome="Escrita" nota={unico.atendimento.escrita} peso={0} />
    </div></section>}
  </>;

  if (aba === "funil") return <>
    <section className="pc-fluxo">
      <div><strong>{inteiro(corporativo?.leadsCadastrados ?? soma((c) => c.processo.leadsCriados))}</strong><span>leads operacionais</span></div><i>→</i>
      <div><strong>{inteiro(corporativo?.negociosCadastrados ?? soma((c) => c.processo.negociosCriados))}</strong><span>negócios operacionais</span></div><i>→</i>
      <div><strong>{inteiro(soma((c) => c.trabalho.conversas))}</strong><span>conversas D-API</span></div><i>→</i>
      <div><strong>{inteiro(soma((c) => c.visitas.marcadas))}</strong><span>visitas marcadas</span></div><i>→</i>
      <div><strong>{inteiro(soma((c) => c.visitas.realizadas))}</strong><span>realizadas</span></div><i>→</i>
      <div className={!fontes.propostas ? "sem-fonte" : ""}><strong>{fontes.propostas ? inteiro(soma((c) => c.processo.propostas)) : "—"}</strong><span>{fontes.propostas ? "propostas" : "propostas sem captura"}</span></div><i>→</i>
      <div><strong>{inteiro(corporativo?.vendas ?? soma((c) => c.resultado.vendas))}</strong><span>vendas fechadas</span></div>
    </section>
    <div className="pc-grid-kpi">
      <Metrica titulo="Movimentações de estágio" valor={inteiro(soma((c) => c.processo.movimentacoesEstagio))} detalhe={`${inteiro(soma((c) => c.processo.negociosMovimentados))} negócios distintos`} />
      <Metrica titulo="Ações confirmadas no Funil 2" valor={inteiro(soma((c) => c.processo.f2AcoesConfirmadas))} detalhe={`${inteiro(soma((c) => c.processo.f2MomentosAlterados))} mudanças de momento`} />
      <Metrica titulo="Reavaliações da Sara" valor={inteiro(soma((c) => c.processo.f2SaraReavaliacoes))} detalhe={`${inteiro(soma((c) => c.processo.f2LeadsMovimentados))} leads movimentados`} />
      <Metrica titulo="Qualificação média do lead" valor={tem(media((c) => c.processo.notaMediaLead)) ? decimal(media((c) => c.processo.notaMediaLead)) : "Sem amostra"} detalhe={`${inteiro(soma((c) => c.processo.avaliacoesLead))} avaliações`} />
      <Metrica titulo="Comparecimento" valor={pct(media((c) => c.visitas.comparecimentoPct))} detalhe="Realizadas ÷ marcadas" />
      <Metrica titulo="Visitas canceladas" valor={inteiro(soma((c) => c.visitas.canceladas))} detalhe="Analisar motivo antes de atribuir responsabilidade" />
      <Metrica titulo="Visitas com feedback" valor={`${inteiro(soma((c) => c.visitas.comFeedback))}/${inteiro(soma((c) => c.visitas.realizadas))}`} detalhe="Resultado documentado" />
    </div>
    <p className="pc-nota-metodo">Aquário/Bolsão é estoque de pesca e fica fora da performance. Quando existe mensagem, ação, visita ou venda realmente executada, o fato continua contando para o responsável.</p>
  </>;

  if (aba === "resultado") {
    const vgv = num(corporativo?.vgv ?? soma((c) => c.resultado.vgv));
    const vendas = num(corporativo?.vendas ?? soma((c) => c.resultado.vendas));
    const meta = corretores.length === 1 ? num(unico?.resultado.metaVgv) : num(metaEquipe?.meta_vgv);
    return <div className="pc-grid-kpi">
      <Metrica titulo="VGV fechado" valor={dinheiro(vgv)} detalhe="Somente vendas concluídas ou pagas" />
      <Metrica titulo="Vendas fechadas" valor={inteiro(vendas)} detalhe={`${inteiro(corporativo?.vendasPagas ?? soma((c) => c.resultado.vendasPagas))} pagas · ${inteiro(corporativo?.vendasConcluidas ?? soma((c) => c.resultado.vendasConcluidas))} concluídas`} />
      <Metrica titulo="Vendas pendentes" valor={inteiro(corporativo?.vendasPendentes ?? soma((c) => c.resultado.vendasPendentes))} detalhe={`${dinheiro(corporativo?.vgvPendente ?? soma((c) => c.resultado.vgvPendente))} de VGV potencial`} />
      <Metrica titulo="Comissão bruta gerada" valor={dinheiro(corporativo?.comissaoBruta ?? soma((c) => c.resultado.comissao))} detalhe="Percentual oficial aplicado ao VGV" />
      <Metrica titulo="Comissão final dos corretores" valor={dinheiro(corporativo?.comissaoCorretores ?? soma((c) => c.resultado.comissaoFinal))} detalhe="Fonte oficial após regras e ajustes" />
      {corporativo && <Metrica titulo="Comissão da apêcerto" valor={dinheiro(corporativo.comissaoEmpresa)} detalhe={`${dinheiro(corporativo.comissaoExecutivos)} executivos · ${dinheiro(corporativo.comissaoIndicacoes)} indicações`} />}
      <Metrica titulo="Custos das vendas" valor={dinheiro(corporativo?.custos ?? soma((c) => c.resultado.custos))} detalhe="Custos registrados no financeiro" />
      <Metrica titulo="Processos de venda" valor={inteiro(corporativo?.processosVenda ?? soma((c) => c.resultado.processosVenda))} detalhe={`${inteiro(corporativo?.processosRegistrados ?? soma((c) => c.resultado.processosRegistrados))} registrados · ${inteiro(corporativo?.processosDocumentacao ?? soma((c) => c.resultado.processosDocumentacao))} em documentação`} />
      <Metrica titulo="Meta VGV" valor={meta > 0 ? dinheiro(meta) : "Não cadastrada"} detalhe={meta > 0 ? `${pct(vgv / meta * 100)} atingido` : "Sem meta, o painel não inventa uma"} />
      <Metrica titulo="Ticket médio" valor={vendas ? dinheiro(vgv / vendas) : "Sem vendas"} detalhe="VGV ÷ vendas" />
    </div>;
  }

  if (aba === "dados") return <>
    <section className="pc-cobertura-lista">
      <div className="pc-secao-cab"><div><span>RASTREABILIDADE</span><h2>Quanto existe em cada fonte</h2></div></div>
      <div className="pc-cobertura-grade">{fontes.cobertura.map((fonte) => <article key={fonte.fonte}>
        <span>{fonte.fonte}</span><strong>{inteiro(fonte.registros)}</strong><small>{dataCurta(fonte.primeiroRegistro)} → {dataCurta(fonte.ultimoRegistro)}</small>
        {num(fonte.semAtribuicao) > 0 && <em>{inteiro(fonte.semAtribuicao)} sem corretor atribuível</em>}
        {num(fonte.excluidosPerformance) > 0 && <em>{inteiro(fonte.excluidosPerformance)} excluídos da performance</em>}
      </article>)}</div>
    </section>
    <section className="pc-fontes-grid">
      <CartaoFonte ativo={fontes.dapi} titulo="D-API bruto" texto="Mensagens e conversas são contadas diretamente na origem, sem depender da derivação de performance." />
      <CartaoFonte ativo={fontes.crm} titulo="CRM operacional" texto="Ações, tentativas, respostas, transferências e mudanças de etapa." />
      <CartaoFonte ativo={fontes.funil2} titulo="Funil 2.0" texto="Ações confirmadas, mudanças de momento e reavaliações da Sara." />
      <CartaoFonte ativo={fontes.atividadeApp} titulo="Atividade real no ERP" texto={fontes.atividadeApp ? "Medição ativa por blocos de 5 minutos, sem duplicar abas." : "Não havia histórico confiável de login; a medição forma histórico daqui em diante."} />
      <CartaoFonte ativo={fontes.primeiraResposta} titulo="Primeira resposta e SLA" texto="Derivados das mensagens reais, considerando horário comercial." />
      <CartaoFonte ativo={fontes.qualidadeIa} titulo="Qualidade de atendimento" texto="Notas de IA com amostra e dimensões de qualidade." />
      <CartaoFonte ativo titulo="Vendas, VGV e comissão" texto="Lidos da fonte financeira oficial, inclusive pendências, custos e processos de venda." />
    </section>
    <section className="pc-definicoes"><h2>Regras de confiança</h2><ul><li>Aquário/Bolsão não é lead recebido nem carteira trabalhada; a etapa Pescado também não melhora a nota.</li><li>Mensagem bruta do D-API é a fonte de volume; eventos derivados não duplicam esse número.</li><li>Registro sem corretor continua no total da empresa, mas não é atribuído artificialmente a ninguém.</li><li>“Sem amostra” significa poucos casos; “Sem captura” significa que a etapa ainda não produz dado.</li><li>Login histórico não é reconstruído por aproximação; usamos dias com comunicação como evidência separada.</li><li>Resultado financeiro não altera silenciosamente a nota de disciplina.</li></ul></section>
  </>;

  const notaMedia = media((c) => c.notaExecucao);
  const vendasResumo = num(corporativo?.vendas ?? soma((c) => c.resultado.vendas));
  const vgvResumo = num(corporativo?.vgv ?? soma((c) => c.resultado.vgv));
  return <div className="pc-grid-kpi">
    <Metrica titulo="Nota de execução" valor={tem(notaMedia) ? inteiro(notaMedia) : "Sem dados"} detalhe="Média da equipe, com cobertura explícita" />
    <Metrica titulo="Histórico D-API" valor={`${inteiro(soma((c) => c.trabalho.mensagensEnviadas))} env. · ${inteiro(soma((c) => c.trabalho.mensagensRecebidas))} rec.`} detalhe={`${inteiro(soma((c) => c.trabalho.conversas))} conversas distintas`} />
    <Metrica titulo="Base operacional" valor={`${inteiro(corporativo?.leadsCadastrados ?? soma((c) => c.processo.leadsCriados))} leads`} detalhe={`${inteiro(corporativo?.negociosCadastrados ?? soma((c) => c.processo.negociosCriados))} negócios fora do Aquário`} />
    {corporativo && <Metrica titulo="Bolsão fora da performance" valor={inteiro(corporativo.leadsBolsao)} detalhe="Estoque disponível para pesca; não atribuído a corretores" />}
    <Metrica titulo="Trabalho no CRM" valor={inteiro(soma((c) => c.trabalho.acoesComerciaisCrm))} detalhe={`${inteiro(soma((c) => c.trabalho.tentativasCrm))} tentativas · ${inteiro(soma((c) => c.trabalho.mudancasEtapaCrm))} mudanças de etapa`} />
    <Metrica titulo="Ações vencidas" valor={inteiro(soma((c) => c.carteira.acoesVencidas))} detalhe="Pendências que exigem gestão agora" estado={soma((c) => c.carteira.acoesVencidas) ? "critico" : "forte"} />
    <Metrica titulo="Visitas realizadas" valor={inteiro(soma((c) => c.visitas.realizadas))} detalhe={`${inteiro(soma((c) => c.visitas.canceladas))} canceladas`} />
    <Metrica titulo="Vendas e VGV" valor={`${inteiro(vendasResumo)} · ${dinheiro(vgvResumo)}`} detalhe="Total oficial da empresa; rateio aparece no individual" />
    <Metrica titulo="Dias com comunicação" valor={inteiro(soma((c) => c.atividade.diasComComunicacao))} detalhe="Evidência histórica real do D-API" />
  </div>;
}

export function PerformanceWorkspace({ accessToken }: { accessToken: string; sessionRole?: string }) {
  const [periodo, setPeriodo] = useState<Periodo>("todo");
  const [aba, setAba] = useState<Aba>("visao");
  const [selecionado, setSelecionado] = useState<number | "equipe">("equipe");
  const [painel, setPainel] = useState<Painel | null>(null);
  const [situacao, setSituacao] = useState<"carregando" | "pronto" | "falhou">("carregando");
  const [tentativa, setTentativa] = useState(0);
  const tentarDeNovo = () => { setSituacao("carregando"); setTentativa((n) => n + 1); };
  const mudarPeriodo = (proximo: Periodo) => { setSituacao("carregando"); setPeriodo(proximo); };

  useEffect(() => {
    let vivo = true;
    const ctrl = new AbortController();
    fetch(`/api/performance?periodo=${periodo}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: ctrl.signal })
      .then(async (res) => ({ ok: res.ok, json: await res.json() as Painel }))
      .then(({ ok, json }) => {
        if (!vivo) return;
        if (json.error) {
          console.error("[performance] falha do backend:", json.error);
          setSituacao("falhou");
          return;
        }
        if (!ok) {
          console.error("[performance] resposta HTTP sem sucesso");
          setSituacao("falhou");
          return;
        }
        setPainel(json);
        setSituacao("pronto");
      })
      .catch((e: unknown) => {
        if (!vivo || ctrl.signal.aborted) return;
        console.error("[performance] falha ao consultar:", e);
        setSituacao("falhou");
      });
    return () => { vivo = false; ctrl.abort(); };
  }, [accessToken, periodo, tentativa]);

  const corretores = useMemo(() => painel?.corretores ?? [], [painel]);
  const temDadoAnterior = painel !== null;
  const falhou = situacao === "falhou";
  const fontes = painel?.fontes ?? { atividadeApp: false, atividadeRastreadaDesde: null, primeiraResposta: false, qualidadeIa: false, propostas: false, ligacoes: false, dapi: false, crm: false, funil2: false, cobertura: [], observacao: "" };
  const individual = selecionado === "equipe" ? null : corretores.find((c) => c.corretorId === selecionado) ?? null;
  const escopo = individual ? [individual] : corretores;
  const alertas = useMemo(() => corretores.flatMap((c) => {
    const itens: string[] = [];
    if (num(c.carteira.acoesVencidas) > 0) itens.push(`${inteiro(c.carteira.acoesVencidas)} ações vencidas`);
    if (num(c.atendimento.amostraPrimeiraResposta) >= 5 && num(c.atendimento.sla15Pct) < 70) itens.push(`SLA ${pct(c.atendimento.sla15Pct)}`);
    if (num(c.visitas.canceladas) > num(c.visitas.realizadas) && num(c.visitas.canceladas) > 0) itens.push("mais cancelamentos que visitas realizadas");
    return itens.length ? [{ corretor: c, motivos: itens }] : [];
  }).sort((a, b) => num(b.corretor.carteira.acoesVencidas) - num(a.corretor.carteira.acoesVencidas)), [corretores]);

  return <main className="pc-wrap">
    <header className="pc-topo"><div><span>GESTÃO COMERCIAL</span><h1>Central de Gestão de Corretores</h1><p>Trabalho, disciplina, atendimento, funil e resultado — cada número ligado a uma fonte real.</p></div><div className="pc-controles">
      <select aria-label="Escopo da performance" value={selecionado} onChange={(e) => setSelecionado(e.target.value === "equipe" ? "equipe" : Number(e.target.value))}>
        <option value="equipe">Equipe completa</option>{corretores.map((c) => <option value={c.corretorId} key={c.corretorId}>{c.nome}</option>)}
      </select><div className="pc-periodo">{(["todo", "7d", "mes", "trimestre", "ano"] as Periodo[]).map((p) => <button type="button" key={p} className={periodo === p ? "ativo" : ""} onClick={() => mudarPeriodo(p)}>{p === "todo" ? "Todo histórico" : p === "7d" ? "7 dias" : p === "mes" ? "Mês" : p === "trimestre" ? "Trimestre" : "Ano"}</button>)}</div>
    </div></header>

    {!fontes.atividadeApp && painel && <div className="pc-aviso"><b>Nova medição de atividade iniciada.</b><span>As horas anteriores eram baseadas no botão da distribuição e foram descartadas por não representarem uso real do ERP.</span></div>}
    {falhou && <div className="pc-erro" role="alert"><b>Não foi possível carregar a performance agora.</b><span>{temDadoAnterior ? "Os últimos dados válidos continuam visíveis." : "Nenhum número foi apresentado como se estivesse atualizado."}</span><button type="button" onClick={tentarDeNovo}>Tentar novamente</button></div>}
    {!painel && situacao === "carregando" ? <div className="pc-carregando">Conferindo as fontes e calculando a performance…</div> : null}

    {falhou && !temDadoAnterior ? null : painel && <>
      <nav className="pc-abas" aria-label="Áreas da performance">{ABAS.map((item) => <button type="button" className={aba === item.id ? "ativo" : ""} key={item.id} onClick={() => setAba(item.id)}>{item.nome}</button>)}</nav>
      {individual && aba === "visao" && <VisaoIndividual c={individual} fontes={fontes} />}
      <ConteudoAba aba={aba} corretores={escopo} fontes={fontes} metaEquipe={painel.metaEquipe} equipe={painel.equipe} />
      {!individual && aba === "visao" && <>
        <section className="pc-atencao"><div className="pc-secao-cab"><div><span>ATENÇÃO IMEDIATA</span><h2>Onde a gestão precisa agir hoje</h2></div><b>{alertas.length} corretor(es)</b></div>
          {alertas.length ? <div className="pc-alertas">{alertas.slice(0, 6).map(({ corretor, motivos }) => <button type="button" key={corretor.corretorId} onClick={() => setSelecionado(corretor.corretorId)}><strong>{corretor.nome}</strong><span>{motivos.join(" · ")}</span><i>Ver detalhe →</i></button>)}</div> : <p className="pc-sem-alerta">Nenhum alerta crítico nas fontes disponíveis.</p>}
        </section>
        <TabelaEquipe corretores={corretores} onAbrir={(id) => setSelecionado(id)} />
      </>}
      <footer className="pc-rodape">Atualizado em {painel.geradoEm ? new Date(painel.geradoEm).toLocaleString("pt-BR") : "—"}. Período de {painel.periodo?.inicio ?? "—"} até {painel.periodo?.fim ?? "—"} (fim exclusivo).</footer>
    </>}
  </main>;
}
