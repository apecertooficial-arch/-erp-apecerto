"use client";

import { useMemo, useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Banner, Cabecalho, GradeKpis, Tabela } from "../pecas";
import { useResumoInteligencia, type CorretorOperacao } from "../usar-resumo";

type Aba = "resumo" | "corretores" | "funil" | "atendimento" | "trabalho" | "resultado";
const abas: Array<{ chave: Aba; nome: string }> = [
  { chave: "resumo", nome: "Resumo do dono" },
  { chave: "corretores", nome: "Corretores" },
  { chave: "funil", nome: "Funil 2.0 e Bolsão" },
  { chave: "atendimento", nome: "Atendimento e qualidade" },
  { chave: "trabalho", nome: "Trabalho e presença" },
  { chave: "resultado", nome: "Visitas e vendas" },
];

const nota = (valor: number | null) => valor === null ? "—" : `${valor.toFixed(1).replace(".", ",")}/100`;
const horas = (valor: number | null | undefined) => fmt.duracaoMin(valor == null ? null : valor * 60);
const motivoPulo = (valor: string | undefined) => ({
  fora_da_rede_do_escritorio: "Fora da rede do escritório",
  dapi_desconectada: "D-API desconectada",
  presenca_expirada: "Presença expirada",
  offline: "Fora da fila",
}[valor ?? ""] ?? (valor?.replaceAll("_", " ") || "—"));

function Abas({ atual, mudar }: { atual: Aba; mudar: (aba: Aba) => void }) {
  return <nav className="int-subabas" aria-label="Leituras da operação">{abas.map((aba) => <button type="button" key={aba.chave} className={atual===aba.chave?"ativo":""} onClick={() => mudar(aba.chave)}>{aba.nome}</button>)}</nav>;
}

function BarraFunil({ itens }: { itens: Array<{ etapa: string; quantidade: number }> }) {
  const max = Math.max(1, ...itens.map((item) => item.quantidade));
  return <div className="int-barras">{itens.map((item) => <div key={item.etapa}><span>{item.etapa.replaceAll("_", " ")}</span><i><b style={{ width: `${Math.max(3,100*item.quantidade/max)}%` }} /></i><strong>{fmt.inteiro(item.quantidade)}</strong></div>)}</div>;
}

function CorretorFoco({ linha }: { linha: CorretorOperacao }) {
  return <section className="int-corretor-foco">
    <div className="int-corretor-foco-topo"><div><span className="intp-cab-eyebrow">LEITURA COMPLETA DO CORRETOR</span><h2>{linha.nome}</h2></div><span>{linha.no_escritorio_agora?"No escritório agora":`última presença ${fmt.hora(linha.ultima_presenca)}`}</span></div>
    <div className="int-corretor-grade">
      <article><h3>Carteira do Funil 2.0</h3><dl><div><dt>Ativos</dt><dd>{fmt.inteiro(linha.carteira_ativa)}</dd></div><div><dt>Pescados</dt><dd>{fmt.inteiro(linha.pescados_na_carteira)}</dd></div><div><dt>Cliente aguardando</dt><dd>{fmt.inteiro(linha.clientes_aguardando)}</dd></div><div><dt>Críticos +1h</dt><dd>{fmt.inteiro(linha.clientes_criticos)}</dd></div><div><dt>Ações vencidas</dt><dd>{fmt.inteiro(linha.followups_vencidos)}</dd></div></dl></article>
      <article><h3>Conversão comparável</h3><dl><div><dt>Entradas no período</dt><dd>{fmt.inteiro(linha.leads_novos)}</dd></div><div><dt>Coorte com visita</dt><dd>{fmt.inteiro(linha.cohort_com_visita)}</dd></div><div><dt>Lead → visita</dt><dd>{fmt.porcento(linha.conversao_coorte_visita,1)}</dd></div><div><dt>Visitas realizadas</dt><dd>{fmt.inteiro(linha.visitas_realizadas)}</dd></div><div><dt>Realização</dt><dd>{fmt.porcento(linha.realizacao_visita,1)}</dd></div></dl></article>
      <article><h3>Qualidade do atendimento</h3><dl><div><dt>Resposta mediana</dt><dd>{fmt.duracaoMin(linha.resposta_mediana_min)}</dd></div><div><dt>P90 de resposta</dt><dd>{fmt.duracaoMin(linha.resposta_p90_min)}</dd></div><div><dt>Nota da IA</dt><dd>{nota(linha.nota_ia)}</dd></div><div><dt>Texto / áudio / imagem</dt><dd>{linha.mensagens_texto} / {linha.audios} / {linha.imagens}</dd></div></dl></article>
      <article><h3>Resultado e presença</h3><dl><div><dt>Vendas</dt><dd>{fmt.inteiro(linha.vendas)}</dd></div><div><dt>VGV</dt><dd>{fmt.dinheiro(linha.vgv)}</dd></div><div><dt>Horas logadas / ativas</dt><dd>{horas(linha.horas_erp)} / {horas(linha.horas_ativas_erp)}</dd></div><div><dt>Pulos / leads recebidos</dt><dd>{fmt.inteiro(linha.pulos_distribuicao)} / {fmt.inteiro(linha.recebidos_distribuicao)}</dd></div><div><dt>Presença / sem confirmar</dt><dd>{linha.dias_presenca} / {linha.dias_uteis_sem_confirmacao}</dd></div><div><dt>Imóveis captados</dt><dd>{fmt.inteiro(linha.captacoes)}</dd></div></dl></article>
    </div>
    <div className="int-corretor-etapas"><h3>Distribuição atual por etapa</h3><div>{linha.etapas.map((e)=><span key={e.etapa}><b>{e.quantidade}</b>{e.etapa.replaceAll("_"," ")}</span>)}</div></div>
  </section>;
}

export function VisaoEmpresa({ accessToken, recorte }: PropsTela) {
  const { data, loading, error } = useResumoInteligencia(accessToken, recorte.periodo);
  const op = data?.operacao;
  const resumo = op?.operacao;
  const equipe = useMemo(() => op?.equipe ?? [], [op?.equipe]);
  const [aba, setAba] = useState<Aba>("resumo");
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);
  const selecionado = equipe.find((item)=>item.corretor_id===selecionadoId) ?? equipe[0];
  if (loading) return <Banner tom="tint-roxo" forte="Carregando a operação real." texto="Funil 2.0, D-API, visitas, vendas, presença e IA estão sendo reconciliados." />;
  if (error) return <Banner forte="A Inteligência não respondeu." texto={error} />;

  const tabelaCorretores = equipe.map((l)=>({ chave:String(l.corretor_id),abrir:()=>setSelecionadoId(l.corretor_id),destaque:l.corretor_id===selecionado?.corretor_id,celulas:[
    {texto:l.nome,forte:true,sub:l.no_escritorio_agora?"no escritório":undefined},{texto:fmt.inteiro(l.carteira_ativa),num:true},{texto:fmt.inteiro(l.clientes_aguardando),num:true,cor:l.clientes_criticos?"#D93E3E":undefined},{texto:fmt.duracaoMin(l.resposta_mediana_min),num:true},{texto:fmt.porcento(l.conversao_coorte_visita,1),num:true,forte:true},{texto:`${l.visitas_realizadas}/${l.visitas_canceladas}`,num:true},{texto:fmt.inteiro(l.vendas),num:true},{texto:fmt.dinheiro(l.vgv),num:true},{texto:nota(l.nota_ia),num:true},{texto:`${l.dias_presenca}/${l.dias_uteis_sem_confirmacao}`,num:true}
  ]}));

  const acoes = op?.acoes ?? [];
  const pior = [...equipe].sort((a,b)=>(b.clientes_criticos+b.followups_vencidos)-(a.clientes_criticos+a.followups_vencidos))[0];
  const melhor = [...equipe].filter(l=>l.leads_novos>=3&&l.conversao_coorte_visita!==null).sort((a,b)=>(b.conversao_coorte_visita??0)-(a.conversao_coorte_visita??0))[0];
  const horasLogadas = equipe.reduce((total,l)=>total+(l.horas_erp??0),0);
  const horasAtivas = equipe.reduce((total,l)=>total+(l.horas_ativas_erp??0),0);
  const horasEscritorio = equipe.reduce((total,l)=>total+(l.horas_no_escritorio??0),0);
  const pulos = equipe.reduce((total,l)=>total+(l.pulos_distribuicao??0),0);
  const recebidos = equipe.reduce((total,l)=>total+(l.recebidos_distribuicao??0),0);

  return <div className="int-secao">
    <Abas atual={aba} mudar={setAba} />

    {aba==="resumo" && <>
      <section className="int-escopo-verdade"><div><span>OPERAÇÃO COBRÁVEL</span><strong>{fmt.inteiro(resumo?.leads_funil_ativos)} leads</strong><small>somente cards ativos no Funil 2.0</small></div><i>≠</i><div className="bolsao"><span>BOLSÃO / PESCA</span><strong>{fmt.inteiro(resumo?.leads_bolsao)} leads</strong><small>estoque de oportunidade; fora de SLA e produtividade</small></div></section>
      <section className="int-decisao-resumo"><div><span className="intp-cab-eyebrow">LEITURA DO DONO</span><h2>{(resumo?.clientes_criticos??0)>0?`${resumo?.clientes_criticos} clientes do Funil 2.0 aguardam há mais de 1 hora`:"Nenhum cliente do Funil 2.0 está crítico por espera"}</h2><p>Esta leitura não inclui nenhum dos {fmt.inteiro(resumo?.leads_bolsao)} leads do Bolsão. A prioridade vem de cliente esperando, ação vencida e capacidade comprovada de converter visita.</p></div><strong className={(resumo?.clientes_criticos??0)>0?"ruim":"bom"}>{fmt.inteiro(acoes.length)} ações</strong></section>
      <GradeKpis colunas={6} itens={[
        {rotulo:"No Funil 2.0",bruto:resumo?.leads_funil_ativos,texto:fmt.inteiro(resumo?.leads_funil_ativos),tile:"laranja",foot:`${fmt.inteiro(resumo?.leads_entraram_periodo)} entraram no período`},
        {rotulo:"Clientes aguardando",bruto:resumo?.clientes_aguardando,texto:fmt.inteiro(resumo?.clientes_aguardando),tile:"vermelho",tom:(resumo?.clientes_criticos??0)>0?"ruim":"neutro",foot:`${fmt.inteiro(resumo?.clientes_criticos)} há mais de 1 hora`},
        {rotulo:"Ações vencidas",bruto:resumo?.followups_vencidos,texto:fmt.inteiro(resumo?.followups_vencidos),tile:"ambar",foot:"Pescados sem prazo não entram"},
        {rotulo:"Visitas realizadas",bruto:resumo?.visitas_realizadas,texto:fmt.inteiro(resumo?.visitas_realizadas),tile:"roxo",foot:`${fmt.inteiro(resumo?.visitas_canceladas)} canceladas`},
        {rotulo:"Vendas ligadas ao F2",bruto:resumo?.vendas,texto:`${fmt.inteiro(resumo?.vendas)} · ${fmt.dinheiro(resumo?.vgv)}`,tile:"verde",foot:`ticket ${fmt.dinheiro(resumo?.ticket_medio)} · não é o total geral`},
        {rotulo:"Nota da IA",bruto:resumo?.nota_ia,texto:resumo?.nota_ia==null?"—":nota(resumo.nota_ia),tile:"roxo",foot:"somente atendimentos do Funil 2.0"},
      ]}/>
      <Cabecalho eyebrow="DECISÕES DE HOJE" titulo="O que merece sua atenção agora" cor="#8B00CC" />
      <div className="int-decisao-acoes">
        <article className={(resumo?.clientes_criticos??0)>0?"critico":"positivo"}><span>1 · RESPONDER</span><h3>{fmt.inteiro(resumo?.clientes_criticos)} clientes esperando +1h</h3><p>A lista nominal está em Atendimento; cobre a fila exata, não a empresa inteira.</p></article>
        <article className={(resumo?.followups_vencidos??0)>0?"atencao":"positivo"}><span>2 · RECUPERAR</span><h3>{pior?`${pior.nome}: ${pior.followups_vencidos} ações vencidas`:"Sem ações vencidas"}</h3><p>Reorganize a carteira antes de enviar mais oportunidade.</p></article>
        <article className={melhor?"positivo":"atencao"}><span>3 · DISTRIBUIR</span><h3>{melhor?`${melhor.nome}: ${fmt.porcento(melhor.conversao_coorte_visita,1)} lead → visita`:"Amostra ainda pequena"}</h3><p>A comparação usa a coorte que entrou no período, evitando dividir visitas por leads sem relação.</p></article>
        <article className={(resumo?.visitas_canceladas??0)>0?"atencao":"positivo"}><span>4 · QUALIFICAR</span><h3>{fmt.porcento(resumo?.realizacao_visita,1)} das visitas aconteceram</h3><p>Cancelamento alto pede confirmação, aderência do imóvel e qualidade de agendamento.</p></article>
      </div>
    </>}

    {aba==="corretores" && <>
      <Cabecalho eyebrow="COMPARAÇÃO JUSTA" titulo="Carteira, atendimento, conversão e resultado na mesma régua" nota="clique em um corretor" />
      <Tabela colunas={[{titulo:"Corretor"},{titulo:"Funil 2.0",num:true},{titulo:"Aguardando",num:true},{titulo:"Resposta",num:true},{titulo:"Lead→visita",num:true},{titulo:"Visitas R/C",num:true},{titulo:"Vendas",num:true},{titulo:"VGV",num:true},{titulo:"Nota IA",num:true},{titulo:"Presença/falta",num:true}]} linhas={tabelaCorretores} ordenadaEm="VGV" foot="Lead→visita usa a mesma coorte. Presença/falta = dias confirmados / dias úteis sem confirmação." />
      {selecionado && <CorretorFoco linha={selecionado}/>}
    </>}

    {aba==="funil" && <>
      <section className="int-escopo-verdade"><div><span>FUNIL 2.0 ATIVO</span><strong>{fmt.inteiro(resumo?.leads_funil_ativos)}</strong><small>entra em carteira, SLA e conversão</small></div><i>≠</i><div className="bolsao"><span>FORA DO FUNIL</span><strong>{fmt.inteiro(resumo?.leads_bolsao)}</strong><small>entra somente como Bolsão/Pesca</small></div></section>
      <div className="int-duas"><div className="int-col"><Cabecalho eyebrow="CARTEIRA ATIVA" titulo="Leads por etapa do Funil 2.0"/><div className="int-painel"><BarraFunil itens={op?.funil??[]}/></div></div><div className="int-col"><Cabecalho eyebrow="ESTOQUE" titulo="De onde vêm os leads do Bolsão"/><div className="int-painel"><BarraFunil itens={(op?.bolsao?.origens??[]).map(x=>({etapa:x.origem,quantidade:x.quantidade}))}/></div></div></div>
      <Cabecalho eyebrow="PESCA" titulo={`${fmt.inteiro(resumo?.disponiveis_pesca)} leads disponíveis — melhores sinais primeiro`} nota="última interação mais recente" />
      <Tabela colunas={[{titulo:"Lead"},{titulo:"Origem"},{titulo:"Última interação"},{titulo:"Recebidas",num:true},{titulo:"Enviadas",num:true},{titulo:"Negócio",num:true}]} linhas={(op?.bolsao?.oportunidades??[]).map(l=>({chave:String(l.id),celulas:[{texto:l.nome,forte:true},{texto:l.origem},{texto:fmt.hora(l.ultima_interacao)},{texto:fmt.inteiro(l.qtd_recebidas),num:true},{texto:fmt.inteiro(l.qtd_enviadas),num:true},{texto:`#${l.negocio_id}`,num:true}]}))} foot="Esses leads podem ser pescados, mas não entram nas métricas de trabalho enquanto estiverem fora do Funil 2.0." />
    </>}

    {aba==="atendimento" && <>
      <Cabecalho eyebrow="FILA REAL" titulo="Clientes do Funil 2.0 que precisam de ação" nota="Bolsão excluído" />
      <Tabela colunas={[{titulo:"Lead"},{titulo:"Corretor"},{titulo:"Etapa"},{titulo:"Motivo"},{titulo:"Espera",num:true}]} linhas={acoes.map(a=>({chave:a.id,celulas:[{texto:a.lead,forte:true},{texto:a.corretor},{texto:a.etapa.replaceAll("_"," ")},{texto:a.motivo},{texto:a.espera_min==null?"—":fmt.duracaoMin(a.espera_min),num:true,cor:a.prioridade===1?"#D93E3E":undefined}]}))} ordenadaEm="Espera" foot="Espera começa na última mensagem recebida do cliente e termina quando o corretor responde." />
      <Cabecalho eyebrow="QUALIDADE" titulo="Velocidade, nota da IA e forma de atendimento" />
      <Tabela colunas={[{titulo:"Corretor"},{titulo:"Mediana",num:true},{titulo:"P90",num:true},{titulo:"Respondidas",num:true},{titulo:"Sem resposta",num:true},{titulo:"Nota IA",num:true},{titulo:"Textos",num:true},{titulo:"Áudios",num:true},{titulo:"Imagens",num:true}]} linhas={equipe.map(l=>({chave:String(l.corretor_id),celulas:[{texto:l.nome,forte:true},{texto:fmt.duracaoMin(l.resposta_mediana_min),num:true},{texto:fmt.duracaoMin(l.resposta_p90_min),num:true},{texto:fmt.inteiro(l.conversas_respondidas),num:true},{texto:fmt.inteiro(l.conversas_sem_resposta),num:true},{texto:nota(l.nota_ia),num:true},{texto:fmt.inteiro(l.mensagens_texto),num:true},{texto:fmt.inteiro(l.audios),num:true},{texto:fmt.inteiro(l.imagens),num:true}]}))} ordenadaEm="Nota IA" foot="A nota considera apenas atendimentos vinculados a leads ativos no Funil 2.0." />
    </>}

    {aba==="trabalho" && <>
      <GradeKpis colunas={5} itens={[
        {rotulo:"Horas logadas",bruto:horasLogadas,texto:horas(horasLogadas),tile:"roxo",foot:"ERP aberto e respondendo ao heartbeat"},
        {rotulo:"Horas ativas",bruto:horasAtivas,texto:horas(horasAtivas),tile:"verde",foot:"tela visível e interação recente"},
        {rotulo:"Horas no escritório",bruto:horasEscritorio,texto:horas(horasEscritorio),tile:"laranja",foot:"rede do escritório confirmada pelo servidor"},
        {rotulo:"Pulos por inelegibilidade",bruto:pulos,texto:fmt.inteiro(pulos),tile:"vermelho",foot:"rodízio normal não entra"},
        {rotulo:"Leads recebidos",bruto:recebidos,texto:fmt.inteiro(recebidos),tile:"verde",foot:"decisões registradas pela roleta"},
      ]}/>
      <Cabecalho eyebrow="TRABALHO COMPROVADO" titulo="Tempo no ERP, presença e oportunidades perdidas" nota="clique em um corretor para ver cada dia" />
      <Tabela colunas={[{titulo:"Corretor"},{titulo:"Logado",num:true},{titulo:"Ativo",num:true},{titulo:"No escritório",num:true},{titulo:"Presença/falta",num:true},{titulo:"Pulos",num:true},{titulo:"Recebeu",num:true},{titulo:"Principal motivo"}]} linhas={equipe.map(l=>({chave:String(l.corretor_id),abrir:()=>setSelecionadoId(l.corretor_id),destaque:l.corretor_id===selecionado?.corretor_id,celulas:[{texto:l.nome,forte:true,sub:l.no_escritorio_agora?"no escritório agora":undefined},{texto:horas(l.horas_erp),num:true},{texto:horas(l.horas_ativas_erp),num:true,forte:true},{texto:horas(l.horas_no_escritorio),num:true},{texto:`${l.dias_presenca}/${l.dias_uteis_sem_confirmacao}`,num:true},{texto:fmt.inteiro(l.pulos_distribuicao),num:true,cor:(l.pulos_distribuicao??0)>0?"#D93E3E":undefined},{texto:fmt.inteiro(l.recebidos_distribuicao),num:true},{texto:motivoPulo(l.pulos_motivos?.[0]?.motivo),sub:l.pulos_motivos?.[0]?`${l.pulos_motivos[0].quantidade} ocorrência(s)`:undefined}]}))} ordenadaEm="Horas ativas" foot="Pulo = estava configurado na distribuição, mas inelegível naquele instante. Estar elegível e aguardar o rodízio não conta como pulo." />
      {selecionado && <>
        <Cabecalho eyebrow="DIA A DIA" titulo={`Horas de ${selecionado.nome}`} nota="logado / ativo / escritório" />
        <Tabela colunas={[{titulo:"Dia"},{titulo:"Logado",num:true},{titulo:"Ativo",num:true},{titulo:"No escritório",num:true}]} linhas={(selecionado.atividade_diaria??[]).map(d=>({chave:d.dia,celulas:[{texto:new Date(`${d.dia}T12:00:00`).toLocaleDateString("pt-BR")},{texto:horas(d.horas_logado),num:true},{texto:horas(d.horas_ativas),num:true,forte:true},{texto:horas(d.horas_no_escritorio),num:true}]}))} foot={selecionado.horas_erp_motivo} />
      </>}
    </>}

    {aba==="resultado" && <>
      <GradeKpis colunas={5} itens={[
        {rotulo:"Agendadas",bruto:resumo?.visitas_agendadas,texto:fmt.inteiro(resumo?.visitas_agendadas),tile:"laranja"},{rotulo:"Realizadas",bruto:resumo?.visitas_realizadas,texto:fmt.inteiro(resumo?.visitas_realizadas),tile:"verde"},{rotulo:"Canceladas",bruto:resumo?.visitas_canceladas,texto:fmt.inteiro(resumo?.visitas_canceladas),tile:"vermelho"},{rotulo:"Vendas vinculadas",bruto:resumo?.vendas,texto:fmt.inteiro(resumo?.vendas),tile:"roxo"},{rotulo:"VGV vinculado",bruto:resumo?.vgv,texto:fmt.dinheiro(resumo?.vgv),tile:"verde"}
      ]}/>
      <Cabecalho eyebrow="PRODUTIVIDADE COMERCIAL" titulo="Quem transforma os leads que recebeu em visita e venda" />
      <Tabela colunas={[{titulo:"Corretor"},{titulo:"Coorte",num:true},{titulo:"Com visita",num:true},{titulo:"Lead→visita",num:true},{titulo:"Agendadas",num:true},{titulo:"Realizadas",num:true},{titulo:"Canceladas",num:true},{titulo:"Realização",num:true},{titulo:"Vendas",num:true},{titulo:"VGV",num:true},{titulo:"Ticket",num:true},{titulo:"Comissão",num:true}]} linhas={equipe.map(l=>({chave:String(l.corretor_id),celulas:[{texto:l.nome,forte:true},{texto:fmt.inteiro(l.leads_novos),num:true},{texto:fmt.inteiro(l.cohort_com_visita),num:true},{texto:fmt.porcento(l.conversao_coorte_visita,1),num:true},{texto:fmt.inteiro(l.visitas_agendadas),num:true},{texto:fmt.inteiro(l.visitas_realizadas),num:true},{texto:fmt.inteiro(l.visitas_canceladas),num:true},{texto:fmt.porcento(l.realizacao_visita,1),num:true},{texto:fmt.inteiro(l.vendas),num:true},{texto:fmt.dinheiro(l.vgv),num:true},{texto:fmt.dinheiro(l.ticket_medio),num:true},{texto:fmt.porcento(l.comissao_media_pct,2),num:true}]}))} ordenadaEm="VGV" foot="Coorte = leads que entraram no Funil 2.0 no período. Venda/VGV = fatos canônicos vinculados a cards do Funil 2.0." />
    </>}

    <RodapeFontes fontes={["f2_lead", "D-API / wa_mensagens", "sla_msg_cache", "visitas", "vendas", "ia_notas_atendimento", "corretor_presencas", "corretor_atividade_diaria", "motor_roleta_eventos", "empreendimentos e unidades"]} pendencias={["horas e pulos começam na ativação desta telemetria; o passado não é estimado"]} atualizado={fmt.hora(op?.atualizado_em)} />
  </div>;
}
