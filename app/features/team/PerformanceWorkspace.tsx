"use client";

import { useEffect, useMemo, useState } from "react";

type Periodo = "todo" | "7d" | "mes" | "trimestre" | "ano";
type Aba = "comando" | "receita" | "pessoas" | "dados";
type Numero = number | string | null;

type Corretor = {
  corretorId: number; nome: string; limiteCarteira: Numero;
  carteiraAtiva: Numero; acoesVencidas: Numero; emVisita: Numero; capacidadePct: Numero; vencidasPct: Numero;
  mensagens: Numero; conversas: Numero; diasComunicando: Numero; ultimaMensagem: string | null;
  minutosErp: Numero; diasComAcesso: Numero; ultimoAcesso: string | null;
  visitasMarcadas: Numero; visitasRealizadas: Numero; visitasCanceladas: Numero; visitasComFeedback: Numero;
  slaAmostra: Numero; medianaRespostaMin: Numero; sla15Pct: Numero;
  iaAmostra: Numero; notaAtendimento: Numero; vendas: Numero; vgv: Numero;
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

type Origem = { origem: string; leads: Numero; negocios: Numero; vendas_vinculadas: Numero; vgv_vinculado: Numero };
type Painel = {
  periodo?: { inicio: string; fim: string; anteriorInicio: string; anteriorFim: string };
  empresa?: Empresa | null; corretores?: Corretor[]; qualidadeDado?: QualidadeDado | null; origens?: Origem[]; error?: string;
};

const ABAS: Array<{ id: Aba; nome: string }> = [
  { id: "comando", nome: "Sala de comando" },
  { id: "receita", nome: "Receita e funil" },
  { id: "pessoas", nome: "Corretores" },
  { id: "dados", nome: "Confiança dos dados" },
];

const num = (v: unknown) => Number(v) || 0;
const tem = (v: unknown) => v !== null && v !== undefined && v !== "";
const inteiro = (v: unknown) => Math.round(num(v)).toLocaleString("pt-BR");
const decimal = (v: unknown) => num(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const dinheiro = (v: unknown) => num(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const duracao = (v: unknown) => num(v) >= 60 ? `${decimal(num(v) / 60)} h` : `${inteiro(v)} min`;
const pct = (v: unknown) => tem(v) ? `${decimal(v)}%` : "Sem amostra";
const cobertura = (parte: unknown, total: unknown) => num(total) > 0 ? (100 * num(parte)) / num(total) : 0;
const dataCurta = (v: string | null | undefined) => v ? new Date(v).toLocaleDateString("pt-BR") : "Sem registro";

function variacao(atual: unknown, anterior: unknown) {
  const a = num(atual), b = num(anterior);
  if (!b) return a ? "iniciou neste período" : "sem movimento nos dois períodos";
  const d = ((a - b) / b) * 100;
  return `${d >= 0 ? "+" : ""}${decimal(d)}% vs. período anterior`;
}

function situacao(c: Corretor) {
  if (!num(c.mensagens) && !num(c.visitasMarcadas) && !num(c.vendas)) return { ordem: 1, tom: "critico", rotulo: "Sem execução", acao: "Confirmar disponibilidade e retirar da distribuição até regularizar." };
  if (num(c.capacidadePct) > 100) return { ordem: 2, tom: "critico", rotulo: "Sobrecarga", acao: "Pausar novos leads e reduzir a carteira até o limite operacional." };
  if (num(c.vencidasPct) >= 60) return { ordem: 3, tom: "atencao", rotulo: "Carteira travada", acao: "Mutirão de próximas ações e descarte justificado dos casos sem potencial." };
  if (num(c.slaAmostra) >= 10 && num(c.sla15Pct) < 70) return { ordem: 4, tom: "atencao", rotulo: "Resposta em risco", acao: "Treinar velocidade da primeira resposta e revisar cobertura de atendimento." };
  if (num(c.vendas) > 0) return { ordem: 6, tom: "forte", rotulo: "Gerando receita", acao: "Identificar o padrão vencedor e replicar no time." };
  if (num(c.visitasRealizadas) > 0) return { ordem: 5, tom: "neutro", rotulo: "Avançando funil", acao: "Acompanhar pós-visita e garantir feedback registrado." };
  return { ordem: 5, tom: "neutro", rotulo: "Em acompanhamento", acao: "Converter conversas em visita confirmada." };
}

function Kpi({ titulo, valor, detalhe, tom = "neutro" }: { titulo: string; valor: string; detalhe: string; tom?: string }) {
  return <article className={`ceo-kpi ${tom}`}><span>{titulo}</span><strong>{valor}</strong><small>{detalhe}</small></article>;
}

function Barra({ valor }: { valor: number }) {
  return <div className="ceo-barra"><i style={{ width: `${Math.max(0, Math.min(100, valor))}%` }} /></div>;
}

function LeituraCeo({ empresa }: { empresa: Empresa }) {
  const meta = num(empresa.metaVgv), vgv = num(empresa.vgv), atingimento = num(empresa.atingimentoVgvPct);
  const titulo = vgv === 0 && meta > 0 ? "A operação ainda não virou receita neste mês."
    : atingimento >= 100 ? "A meta foi atingida; agora proteja margem e previsibilidade."
      : atingimento >= 60 ? "Há tração, mas o fechamento ainda precisa acelerar."
        : "O funil precisa produzir mais compromissos de compra.";
  return <section className="ceo-leitura">
    <div><span>LEITURA DO CEO</span><h2>{titulo}</h2><p>O maior risco atual é operacional: {inteiro(empresa.riscos.acoes_vencidas)} ações vencidas em {inteiro(empresa.riscos.carteira_ativa)} carteiras ativas.</p></div>
    <aside><small>VGV realizado</small><strong>{dinheiro(vgv)}</strong><em>de {meta ? dinheiro(meta) : "meta não cadastrada"}</em><Barra valor={atingimento} /></aside>
  </section>;
}

function Fluxo({ empresa }: { empresa: Empresa }) {
  const f = empresa.fluxo;
  const passos = [
    ["Base nova", inteiro(f.leads), "leads operacionais"], ["Oportunidades", inteiro(f.negocios), "negócios criados"],
    ["Relacionamento", inteiro(f.conversas), "conversas distintas"], ["Compromisso", inteiro(f.visitasMarcadas), "visitas marcadas"],
    ["Experiência", inteiro(f.visitasRealizadas), "visitas realizadas"], ["Resultado", inteiro(empresa.vendas), "vendas fechadas"],
  ];
  return <section className="ceo-bloco"><header><div><span>JORNADA COMERCIAL</span><h2>Onde o volume deixa de avançar</h2></div><small>Volumes do período; não é uma coorte de conversão</small></header>
    <div className="ceo-fluxo">{passos.map(([fase, valor, nome], i) => <article key={fase}><i>{i + 1}</i><span>{fase}</span><strong>{valor}</strong><small>{nome}</small></article>)}</div>
  </section>;
}

function Decisoes({ empresa }: { empresa: Empresa }) {
  const itens = [
    { n: num(empresa.riscos.acoes_vencidas), titulo: "Ações vencidas", texto: "Redistribuir capacidade e executar um mutirão de carteira hoje.", tom: "critico" },
    { n: num(empresa.riscos.corretores_sobrecarregados), titulo: "Corretores acima do limite", texto: "Pausar distribuição até a carteira voltar ao limite configurado.", tom: "critico" },
    { n: num(empresa.riscos.visitas_sem_feedback), titulo: "Visitas sem conclusão", texto: "Exigir feedback no encerramento para recuperar aprendizado e follow-up.", tom: "atencao" },
    { n: num(empresa.pipelineQuente.oportunidades), titulo: "Oportunidades quentes", texto: "Revisar uma a uma; o valor financeiro ainda tem baixa cobertura.", tom: "neutro" },
  ];
  return <section className="ceo-bloco"><header><div><span>DECISÕES DE HOJE</span><h2>O que precisa de intervenção</h2></div></header><div className="ceo-decisoes">
    {itens.map((x) => <article className={x.tom} key={x.titulo}><strong>{inteiro(x.n)}</strong><div><b>{x.titulo}</b><p>{x.texto}</p></div></article>)}
  </div></section>;
}

function Prioridades({ corretores, onAbrir }: { corretores: Corretor[]; onAbrir: (id: number) => void }) {
  const lista = [...corretores].map((c) => ({ c, s: situacao(c) })).sort((a, b) => a.s.ordem - b.s.ordem || num(b.c.acoesVencidas) - num(a.c.acoesVencidas)).slice(0, 5);
  return <section className="ceo-bloco"><header><div><span>GESTÃO DO TIME</span><h2>Quem precisa de qual decisão</h2></div><button type="button" onClick={() => document.getElementById("ceo-pessoas")?.scrollIntoView({ behavior: "smooth" })}>Ver equipe</button></header>
    <div className="ceo-prioridades">{lista.map(({ c, s }) => <button type="button" key={c.corretorId} onClick={() => onAbrir(c.corretorId)}><mark className={s.tom}>{s.rotulo}</mark><strong>{c.nome}</strong><span>{s.acao}</span><small>{inteiro(c.acoesVencidas)} vencidas · {pct(c.capacidadePct)} da capacidade</small></button>)}</div>
  </section>;
}

function Comando({ empresa, corretores, qualidade, onAbrir }: { empresa: Empresa; corretores: Corretor[]; qualidade?: QualidadeDado | null; onAbrir: (id: number) => void }) {
  const confianca = qualidade ? cobertura(qualidade.vendas_vinculadas, qualidade.vendas_total) : 0;
  return <>
    <LeituraCeo empresa={empresa} />
    <div className="ceo-kpis">
      <Kpi titulo="VGV fechado" valor={dinheiro(empresa.vgv)} detalhe={variacao(empresa.vgv, empresa.anterior.vgv)} tom={num(empresa.vgv) ? "forte" : "critico"} />
      <Kpi titulo="Margem de contribuição" valor={dinheiro(empresa.margemContribuicao)} detalhe={`${dinheiro(empresa.receitaBruta)} de comissão bruta menos custos registrados`} />
      <Kpi titulo="Visitas realizadas" valor={inteiro(empresa.fluxo.visitasRealizadas)} detalhe={`${inteiro(empresa.fluxo.visitasCanceladas)} canceladas · ${variacao(empresa.fluxo.visitasRealizadas, empresa.anterior.visitasRealizadas)}`} />
      <Kpi titulo="Previsibilidade" valor={`${decimal(confianca)}%`} detalhe="vendas ligadas ao negócio e à origem" tom={confianca < 80 ? "critico" : "forte"} />
    </div>
    <Decisoes empresa={empresa} /><Fluxo empresa={empresa} /><Prioridades corretores={corretores} onAbrir={onAbrir} />
  </>;
}

function Receita({ empresa, origens }: { empresa: Empresa; origens: Origem[] }) {
  const presencaValor = cobertura(empresa.pipelineQuente.com_valor, empresa.pipelineQuente.oportunidades);
  return <>
    <section className="ceo-bloco"><header><div><span>RESULTADO ECONÔMICO</span><h2>Receita, meta e margem</h2></div></header><div className="ceo-kpis">
      <Kpi titulo="Vendas fechadas" valor={inteiro(empresa.vendas)} detalhe={variacao(empresa.vendas, empresa.anterior.vendas)} />
      <Kpi titulo="VGV" valor={dinheiro(empresa.vgv)} detalhe={`${pct(empresa.atingimentoVgvPct)} da meta`} />
      <Kpi titulo="Comissão bruta" valor={dinheiro(empresa.receitaBruta)} detalhe="Receita comercial antes dos custos fixos" />
      <Kpi titulo="Custos vinculados" valor={dinheiro(empresa.custos)} detalhe="Somente custos cadastrados nas vendas" />
      <Kpi titulo="VGV pendente" valor={dinheiro(empresa.vgvPendente)} detalhe={`${inteiro(empresa.vendasPendentes)} vendas pendentes`} />
    </div></section>
    <section className="ceo-bloco"><header><div><span>PIPELINE QUENTE</span><h2>O que pode avançar para fechamento</h2></div></header><div className="ceo-pipeline">
      <div><strong>{inteiro(empresa.pipelineQuente.oportunidades)}</strong><span>oportunidades em visita, negociação ou fechamento</span></div>
      <div><strong>{dinheiro(empresa.pipelineQuente.valor_informado)}</strong><span>valor informado em apenas {inteiro(empresa.pipelineQuente.com_valor)} casos</span></div>
      <aside><b>{decimal(presencaValor)}% com valor</b><Barra valor={presencaValor} /><p>Enquanto o valor do negócio não for obrigatório, este painel não apresentará forecast financeiro como se fosse confiável.</p></aside>
    </div></section>
    <Fluxo empresa={empresa} />
    <section className="ceo-bloco"><header><div><span>AQUISIÇÃO</span><h2>Origem da base operacional no período</h2></div><small>ROI indisponível até custo e venda estarem ligados à origem</small></header>
      <div className="ceo-tabela-wrap"><table className="ceo-tabela"><thead><tr><th>Origem</th><th>Leads</th><th>Negócios</th><th>Vendas vinculadas</th><th>VGV vinculado</th></tr></thead><tbody>
        {origens.map((o) => <tr key={o.origem}><td><b>{o.origem}</b></td><td>{inteiro(o.leads)}</td><td>{inteiro(o.negocios)}</td><td>{inteiro(o.vendas_vinculadas)}</td><td>{dinheiro(o.vgv_vinculado)}</td></tr>)}
      </tbody></table></div>
    </section>
  </>;
}

function DetalheCorretor({ c }: { c: Corretor }) {
  const s = situacao(c);
  return <section className="ceo-detalhe"><header><div><mark className={s.tom}>{s.rotulo}</mark><h2>{c.nome}</h2><p>{s.acao}</p></div><strong>{inteiro(c.vendas)} venda(s)<small>{dinheiro(c.vgv)} em VGV</small></strong></header>
    <div className="ceo-kpis">
      <Kpi titulo="Carteira" valor={`${inteiro(c.carteiraAtiva)} / ${inteiro(c.limiteCarteira)}`} detalhe={`${inteiro(c.acoesVencidas)} ações vencidas`} tom={num(c.capacidadePct) > 100 ? "critico" : "neutro"} />
      <Kpi titulo="Relacionamento" valor={`${inteiro(c.conversas)} conversas`} detalhe={`${inteiro(c.mensagens)} mensagens em ${inteiro(c.diasComunicando)} dias`} />
      <Kpi titulo="Uso ativo do ERP" valor={num(c.minutosErp) ? duracao(c.minutosErp) : "Sem medição"} detalhe={num(c.diasComAcesso) ? `${inteiro(c.diasComAcesso)} dia(s) · último acesso ${dataCurta(c.ultimoAcesso)}` : "Medição recente; não representa horas trabalhadas fora do sistema"} />
      <Kpi titulo="Visitas" valor={`${inteiro(c.visitasRealizadas)} realizadas`} detalhe={`${inteiro(c.visitasMarcadas)} marcadas · ${inteiro(c.visitasCanceladas)} canceladas`} />
      <Kpi titulo="Primeira resposta" valor={num(c.slaAmostra) ? `${decimal(c.medianaRespostaMin)} min` : "Sem amostra"} detalhe={num(c.slaAmostra) ? `${pct(c.sla15Pct)} em até 15 min · ${inteiro(c.slaAmostra)} casos` : "Não classificar sem casos medidos"} />
      <Kpi titulo="Atendimento" valor={num(c.iaAmostra) ? decimal(c.notaAtendimento) : "Sem amostra"} detalhe={`${inteiro(c.iaAmostra)} avaliações de IA`} />
      <Kpi titulo="Última comunicação" valor={dataCurta(c.ultimaMensagem)} detalhe="Evidência do D-API" />
    </div>
  </section>;
}

function Pessoas({ corretores, selecionado, onSelecionar }: { corretores: Corretor[]; selecionado: number | null; onSelecionar: (id: number | null) => void }) {
  const pessoa = corretores.find((c) => c.corretorId === selecionado) ?? null;
  return <section id="ceo-pessoas" className="ceo-bloco"><header><div><span>GESTÃO DE CORRETORES</span><h2>Resultado, jornada, cliente e risco</h2></div><select value={selecionado ?? ""} onChange={(e) => onSelecionar(e.target.value ? Number(e.target.value) : null)}><option value="">Equipe completa</option>{corretores.map((c) => <option key={c.corretorId} value={c.corretorId}>{c.nome}</option>)}</select></header>
    {pessoa && <DetalheCorretor c={pessoa} />}
    <div className="ceo-tabela-wrap"><table className="ceo-tabela pessoas"><thead><tr><th>Corretor</th><th>Situação</th><th>Resultado</th><th>Jornada</th><th>Cliente</th><th>Carteira</th><th>Decisão gerencial</th></tr></thead><tbody>
      {corretores.map((c) => { const s = situacao(c); return <tr key={c.corretorId} onClick={() => onSelecionar(c.corretorId)}>
        <td><b>{c.nome}</b><small>{inteiro(c.diasComunicando)} dias comunicando · {num(c.minutosErp) ? `${duracao(c.minutosErp)} no ERP` : "ERP sem medição"}</small></td><td><mark className={s.tom}>{s.rotulo}</mark></td>
        <td><b>{inteiro(c.vendas)} venda(s)</b><small>{dinheiro(c.vgv)}</small></td><td><b>{inteiro(c.conversas)} conversas</b><small>{inteiro(c.visitasRealizadas)}/{inteiro(c.visitasMarcadas)} visitas</small></td>
        <td><b>{num(c.slaAmostra) ? `${pct(c.sla15Pct)} SLA` : "Sem SLA"}</b><small>{num(c.iaAmostra) ? `IA ${decimal(c.notaAtendimento)} · ${inteiro(c.iaAmostra)} casos` : "Sem avaliação"}</small></td>
        <td><b>{inteiro(c.carteiraAtiva)}/{inteiro(c.limiteCarteira)}</b><small>{inteiro(c.acoesVencidas)} vencidas</small></td><td><span>{s.acao}</span></td>
      </tr>; })}
    </tbody></table></div>
  </section>;
}

function Dados({ q }: { q: QualidadeDado }) {
  const itens = [
    { nome: "Negócios com valor", parte: q.negocios_com_valor, total: q.negocios_operacionais, impacto: "Sem isso, não existe forecast financeiro confiável." },
    { nome: "Vendas ligadas ao negócio", parte: q.vendas_vinculadas, total: q.vendas_total, impacto: "Sem vínculo, origem, corretor e ciclo da venda ficam quebrados." },
    { nome: "Visitas com feedback", parte: q.visitas_com_feedback, total: q.visitas_realizadas, impacto: "Sem feedback, não sabemos por que a visita avançou ou travou." },
    { nome: "Leads com origem", parte: q.leads_com_origem, total: q.leads_operacionais, impacto: "Sem origem, não é possível comparar aquisição por canal." },
    { nome: "Perdas com motivo", parte: q.perdas_com_motivo, total: q.perdas, impacto: "Este é o dado mais saudável e deve virar rotina de coaching." },
  ];
  return <>
    <section className="ceo-bloco"><header><div><span>CONFIANÇA DO DADO</span><h2>O que já sustenta decisão — e o que ainda não sustenta</h2></div></header><div className="ceo-qualidade">
      {itens.map((x) => { const p = cobertura(x.parte, x.total); return <article key={x.nome}><div><span>{x.nome}</span><strong>{decimal(p)}%</strong></div><Barra valor={p} /><small>{inteiro(x.parte)} de {inteiro(x.total)}</small><p>{x.impacto}</p></article>; })}
    </div></section>
    <section className="ceo-recusas"><div><span>O PAINEL NÃO VAI INVENTAR</span><h2>Indicadores bloqueados até a captura ficar correta</h2></div><ul><li><b>Forecast de receita:</b> exige valor em cada oportunidade.</li><li><b>ROI e CAC por canal:</b> exigem custo de aquisição e venda ligada ao negócio/origem.</li><li><b>Conversão por coorte:</b> exige preservar a ligação do lead desde a entrada até a venda.</li><li><b>Qualidade da visita:</b> exige feedback e motivo de cancelamento obrigatórios.</li></ul></section>
    <section className="ceo-principios"><h2>Contrato de gestão</h2><div><p><b>Resultado</b> mede venda, VGV, comissão e margem.</p><p><b>Jornada</b> mede resposta, compromisso e avanço real.</p><p><b>Capacidade</b> mede carteira, prazo e sobrecarga.</p><p><b>Experiência</b> mede atendimento e feedback do cliente.</p><p><b>Confiança</b> acompanha a cobertura antes de liberar conclusões.</p></div></section>
  </>;
}

export function PerformanceWorkspace({ accessToken }: { accessToken: string; sessionRole?: string }) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [aba, setAba] = useState<Aba>("comando");
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [painel, setPainel] = useState<Painel | null>(null);
  const [estado, setSituacao] = useState<"carregando" | "pronto" | "falhou">("carregando");
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true; const ctrl = new AbortController();
    fetch(`/api/performance?periodo=${periodo}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: ctrl.signal })
      .then(async (res) => ({ ok: res.ok, json: await res.json() as Painel }))
      .then(({ ok, json }) => {
        if (!ativo) return;
        if (json.error) {
          console.error("[performance] falha do backend:", json.error);
          setSituacao("falhou");
          return;
        }
        if (!ok) throw new Error("Falha HTTP");
        setPainel(json);
        setSituacao("pronto");
      })
      .catch((e: unknown) => {
        if (!ativo || ctrl.signal.aborted) return;
        console.error("[performance] falha na consulta:", e);
        setSituacao("falhou");
      });
    return () => { ativo = false; ctrl.abort(); };
  }, [accessToken, periodo, tentativa]);

  const corretores = useMemo(() => painel?.corretores ?? [], [painel]);
  const falhou = estado === "falhou";
  const temDadoAnterior = painel !== null;
  const mudarPeriodo = (p: Periodo) => { setSituacao("carregando"); setPeriodo(p); };
  const tentarDeNovo = () => { setSituacao("carregando"); setTentativa((n) => n + 1); };
  const abrirPessoa = (id: number) => { setSelecionado(id); setAba("pessoas"); requestAnimationFrame(() => document.getElementById("ceo-pessoas")?.scrollIntoView({ behavior: "smooth" })); };
  const empresa = painel?.empresa ?? null;
  const conteudo = falhou && !temDadoAnterior ? null : <>
    {empresa && aba === "comando" && <Comando empresa={empresa} corretores={corretores} qualidade={painel?.qualidadeDado} onAbrir={abrirPessoa} />}
    {empresa && aba === "receita" && <Receita empresa={empresa} origens={painel?.origens ?? []} />}
    {aba === "pessoas" && <Pessoas corretores={corretores} selecionado={selecionado} onSelecionar={setSelecionado} />}
    {painel?.qualidadeDado && aba === "dados" && <Dados q={painel.qualidadeDado} />}
    {!empresa && estado === "pronto" && corretores.length > 0 && <Pessoas corretores={corretores} selecionado={selecionado} onSelecionar={setSelecionado} />}
    {painel?.periodo && <footer className="ceo-rodape">Período analisado: {painel.periodo.inicio} até {painel.periodo.fim} (fim exclusivo). Aquário/Bolsão e Pescado não contam como performance.</footer>}
  </>;

  return <main className="ceo-wrap">
    <header className="ceo-topo"><div><span>PERFORMANCE COMERCIAL</span><h1>Sala de Comando</h1><p>Receita, vazamentos, capacidade e decisões — sem confundir atividade com resultado.</p></div><div className="ceo-periodos">{(["mes", "7d", "trimestre", "ano", "todo"] as Periodo[]).map((p) => <button type="button" key={p} className={p === periodo ? "ativo" : ""} onClick={() => mudarPeriodo(p)}>{p === "mes" ? "Mês" : p === "7d" ? "7 dias" : p === "trimestre" ? "Trimestre" : p === "ano" ? "Ano" : "Todo histórico"}</button>)}</div></header>
    <nav className="ceo-abas" aria-label="Visões da performance">{ABAS.map((x) => <button type="button" key={x.id} className={aba === x.id ? "ativo" : ""} onClick={() => setAba(x.id)}>{x.nome}</button>)}</nav>
    {estado === "carregando" && !painel && <div className="ceo-carregando">Conectando receita, atendimento, carteira e financeiro…</div>}
    {falhou && <div className="ceo-erro" role="alert"><b>Não foi possível carregar a performance agora.</b><span>{temDadoAnterior ? "Os últimos dados válidos continuam visíveis." : "Nenhum número foi apresentado sem confirmação."}</span><button type="button" onClick={tentarDeNovo}>Tentar novamente</button></div>}
    {conteudo}
  </main>;
}
