"use client";

import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Banner, Cabecalho, GradeKpis, Tabela } from "../pecas";
import { useResumoInteligencia, type CampanhaMarketing } from "../usar-resumo";

const pct = (parte: number | null | undefined, total: number | null | undefined) =>
  total && parte !== null && parte !== undefined ? (100 * parte) / total : null;

function tempo(segundos: number | null | undefined) {
  if (segundos === null || segundos === undefined) return "—";
  if (segundos < 60) return `${Math.round(segundos)}s`;
  return `${Math.floor(segundos / 60)}min ${Math.round(segundos % 60)}s`;
}

function Integracao({ nome, status, explicacao }: { nome: string; status: "ok" | "erro" | "parcial"; explicacao: string }) {
  const rotulo = status === "ok" ? "Funcionando" : status === "erro" ? "Não conectado" : "Parcial";
  return (
    <article className={`int-decisao-fonte status-${status}`}>
      <div><i /><strong>{nome}</strong><span>{rotulo}</span></div>
      <p>{explicacao}</p>
    </article>
  );
}

export function VisaoDigital({ accessToken, recorte }: PropsTela) {
  const { data, loading, error } = useResumoInteligencia(accessToken, recorte.periodo);
  const marketing = data?.marketing;
  const resumo = marketing?.resumo;
  const comportamento = marketing?.comportamento;
  const saude = marketing?.saude;
  const campanhas = marketing?.campanhas ?? [];
  const atribuicao = saude?.atribuicao;
  const topCampanha = campanhas.find((item) => item.campaign !== "Sem campanha") ?? campanhas[0];
  const topImovel = marketing?.imoveis?.[0];
  const coberturaCampanha = pct(atribuicao?.com_campanha, atribuicao?.total);
  const conversaoLeadVisita = pct(
    campanhas.reduce((total, item) => total + item.visitas_realizadas, 0),
    campanhas.reduce((total, item) => total + item.leads, 0),
  );

  if (loading) return <Banner tom="tint-roxo" forte="Carregando a leitura real." texto="Campanhas, site e CRM estão sendo reconciliados." />;
  if (error) return <Banner forte="A Inteligência não respondeu." texto={error} />;

  const semMidia = !saude?.meta_ads_conectado && !saude?.google_ads_conectado;
  const campanhasLinhas = campanhas.slice(0, 12).map((item: CampanhaMarketing) => ({
    chave: `${item.source}-${item.medium}-${item.campaign}`,
    destaque: item === topCampanha,
    celulas: [
      { texto: item.campaign, forte: true, sub: `${item.source} · ${item.medium}` },
      { texto: fmt.dinheiro(item.investimento), num: true },
      { texto: fmt.porcento(item.ctr), num: true },
      { texto: fmt.dinheiro(item.cpl), num: true },
      { texto: fmt.inteiro(item.leads), num: true },
      { texto: fmt.inteiro(item.visitas_realizadas), num: true, forte: true },
      { texto: fmt.porcento(pct(item.visitas_realizadas, item.leads)), num: true },
      { texto: fmt.inteiro(item.vendas), num: true },
      { texto: fmt.dinheiro(item.vgv), num: true },
    ],
  }));

  return (
    <div className="int-secao">
      <section className="int-decisao-resumo">
        <div>
          <span className="intp-cab-eyebrow">LEITURA EXECUTIVA</span>
          <h2>{semMidia ? "O site mede comportamento, mas o investimento ainda está cego" : "Campanhas ligadas ao resultado comercial"}</h2>
          <p>
            {semMidia
              ? "Há dados próprios de visita, CTA, lead e CRM. Sem as contas de Google e Meta, não é possível calcular gasto, CTR, CPL ou retorno com segurança."
              : "Acompanhe cada campanha até visita e venda; pause gasto sem retorno e amplie o que produz visita realizada."}
          </p>
        </div>
        <strong className={saude?.tracking_atrasado ? "ruim" : "bom"}>{saude?.tracking_atrasado ? "COLETA PARADA" : "COLETA ATIVA"}</strong>
      </section>

      <Cabecalho eyebrow="O QUE FAZER AGORA" titulo="Três decisões, não trinta números" cor="#8B00CC" />
      <div className="int-decisao-acoes">
        <article className={semMidia ? "critico" : "positivo"}>
          <span>{semMidia ? "1 · LIGAR MÍDIA" : "1 · OTIMIZAR MÍDIA"}</span>
          <h3>{semMidia ? "Conectar Google Ads e Meta Ads" : "Realocar verba pelas visitas realizadas"}</h3>
          <p>{semMidia ? "Sem custo e impressão, o ERP não consegue calcular CTR, CPC, CPL, ROAS nem formar públicos semelhantes." : "Use visita realizada e venda como objetivo; clique e lead são sinais intermediários."}</p>
        </article>
        <article className={(coberturaCampanha ?? 0) < 80 ? "atencao" : "positivo"}>
          <span>2 · CORRIGIR ATRIBUIÇÃO</span>
          <h3>{fmt.porcento(coberturaCampanha, 0)} dos leads têm campanha identificada</h3>
          <p>{(coberturaCampanha ?? 0) < 80 ? "UTM e click ID precisam acompanhar o lead até o CRM; sem isso, a campanha perde o crédito da visita e da venda." : "A cobertura permite comparar origem, campanha e resultado comercial."}</p>
        </article>
        <article className={topCampanha?.visitas_realizadas ? "positivo" : "atencao"}>
          <span>3 · ESCALAR O QUE FUNCIONA</span>
          <h3>{topCampanha?.visitas_realizadas ? `${topCampanha.campaign}: ${topCampanha.visitas_realizadas} visitas realizadas` : "Ainda não há campanha comprovada em visita"}</h3>
          <p>{topCampanha?.visitas_realizadas ? "Esta é a melhor evidência disponível para decidir onde aprofundar investimento e criativo." : "Antes de aumentar orçamento, feche o vínculo campanha → lead → visita."}</p>
        </article>
      </div>

      <Cabecalho eyebrow="DA VISITA À VENDA" titulo="O funil que realmente importa" nota={recorte.periodo} />
      <GradeKpis colunas={6} itens={[
        { rotulo: "Visitas ao site", bruto: resumo?.visitas_rastreadas, texto: fmt.inteiro(resumo?.visitas_rastreadas), tile: "laranja", foot: `${fmt.inteiro(resumo?.page_views)} páginas vistas` },
        { rotulo: "Cliques em CTA", bruto: resumo?.cliques_cta, texto: fmt.inteiro(resumo?.cliques_cta), tile: "roxo", foot: `${fmt.porcento(pct(resumo?.cliques_cta, resumo?.visitas_rastreadas),1)} das visitas` },
        { rotulo: "Leads gerados", bruto: resumo?.leads_gerados, texto: fmt.inteiro(resumo?.leads_gerados), tile: "verde", foot: `${fmt.porcento(pct(resumo?.leads_gerados,resumo?.visitas_rastreadas),1)} das visitas` },
        { rotulo: "Lead → visita", bruto: conversaoLeadVisita, texto: fmt.porcento(conversaoLeadVisita,1), tile: "verde", foot: "visitas realizadas, não só agendadas" },
        { rotulo: "Tempo de atenção", bruto: comportamento?.tempo_engajamento_medio_seg, texto: tempo(comportamento?.tempo_engajamento_medio_seg), tile: "ambar", foot: "tempo observável com interação" },
        { rotulo: "Saída rápida", bruto: comportamento?.saida_rapida_pct, texto: fmt.porcento(comportamento?.saida_rapida_pct,1), tile: "vermelho", tom: (comportamento?.saida_rapida_pct ?? 0)>50 ? "ruim" : "neutro", foot: "sem interação em até 10 segundos" },
      ]} />

      <Cabecalho eyebrow="CAMPANHAS" titulo="Qual campanha vira visita e venda" nota="métricas de mídia aparecem automaticamente quando Google/Meta forem conectados" />
      <Tabela
        colunas={[
          { titulo: "Campanha" }, { titulo: "Investimento", num: true }, { titulo: "CTR", num: true }, { titulo: "CPL", num: true },
          { titulo: "Leads", num: true }, { titulo: "Visitas", num: true }, { titulo: "Lead→visita", num: true }, { titulo: "Vendas", num: true }, { titulo: "VGV", num: true },
        ]}
        linhas={campanhasLinhas}
        ordenadaEm="Visitas"
        foot="— em investimento/CTR/CPL significa conta de mídia não conectada; os demais números vêm do site e do CRM."
      />

      <div className="int-duas">
        <div className="int-col">
          <Cabecalho eyebrow="COMPORTAMENTO" titulo="Onde as pessoas demonstram interesse" />
          <div className="int-decisao-lista">
            <div><span>Imóvel mais visto</span><strong>{topImovel?.imovel ?? "—"}</strong><small>{topImovel ? `${fmt.inteiro(topImovel.visualizacoes)} visualizações · ${topImovel.bairro ?? "bairro não informado"}` : "nenhum imóvel identificado no recorte"}</small></div>
            <div><span>Formulários abandonados</span><strong>{fmt.inteiro(comportamento?.abandono_formulario)}</strong><small>começaram e não enviaram</small></div>
            <div><span>Chegaram ao final da página</span><strong>{fmt.inteiro(comportamento?.chegou_final)}</strong><small>rolagem observada até 90%</small></div>
          </div>
        </div>
        <div className="int-col">
          <Cabecalho eyebrow="EVENTOS MAIS DISPARADOS" titulo="O que realmente acontece no site" />
          <div className="int-decisao-lista compacta">
            {(marketing?.eventos ?? []).slice(0,8).map((item) => <div key={item.evento}><span>{item.evento}</span><strong>{fmt.inteiro(item.quantidade)}</strong></div>)}
          </div>
        </div>
      </div>

      <Cabecalho eyebrow="SAÚDE DO TRACKING" titulo="O que está funcionando e o que está impedindo decisão" cor="#8B00CC" />
      <div className="int-decisao-fontes">
        <Integracao nome="Coleta própria do site" status={saude?.tracking_atrasado ? "erro" : "ok"} explicacao={saude?.tracking_atrasado ? "Nenhum evento recente. Visitas podem estar acontecendo sem chegar ao ERP." : `${fmt.inteiro(saude?.total_eventos)} eventos recebidos; último às ${fmt.hora(saude?.ultimo_evento_em)}.`} />
        <Integracao nome="Meta Pixel / API de Conversões" status={saude?.meta_ads_conectado ? "ok" : "erro"} explicacao={saude?.meta_ads_conectado ? `${fmt.inteiro(saude?.entrega_midia?.entregues)} eventos confirmados pela fila.` : "Nenhum evento enviado pela integração do ERP. Públicos e otimização da Meta ficam sem sinal comprovado."} />
        <Integracao nome="Google Ads / Analytics" status={saude?.google_ads_conectado ? "ok" : "erro"} explicacao={saude?.google_ads_conectado ? "Conta e conversões recebidas." : "Conta de mídia e conversões não estão conectadas ao ERP; gasto, cliques e CPL permanecem indisponíveis."} />
        <Integracao nome="Google Tag Manager" status={saude?.gtm_containers ? "ok" : "parcial"} explicacao={saude?.gtm_containers ? `${saude.gtm_containers} containers inventariados.` : (saude?.gtm_motivo ?? "Inventário de containers e tags não disponível.")} />
      </div>

      <RodapeFontes
        fontes={["site_events_anon", "site_leads", "lead_attribution", "CRM Funil 2.0", "visitas", "vendas"]}
        pendencias={["contas de Google e Meta", "inventário do GTM", "mapa de calor/Clarity"]}
        atualizado={fmt.hora(marketing?.atualizado_em)}
      />
    </div>
  );
}
