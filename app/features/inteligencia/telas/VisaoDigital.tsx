"use client";

import { useMemo, useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Banner, Cabecalho, GradeKpis, Tabela } from "../pecas";
import { useResumoInteligencia, type AnuncioMidia, type CampanhaMarketing } from "../usar-resumo";

type Aba = "resumo" | "campanhas" | "site" | "tracking";
const abas: Array<{ chave: Aba; nome: string }> = [{chave:"resumo",nome:"Resumo do marketing"},{chave:"campanhas",nome:"Campanhas e anúncios"},{chave:"site",nome:"Site e comportamento"},{chave:"tracking",nome:"Tracking e privacidade"}];
const pct = (p:number|null|undefined,t:number|null|undefined)=>t&&p!=null?100*p/t:null;
const tempo=(s:number|null|undefined)=>s==null?"—":s<60?`${Math.round(s)}s`:`${Math.floor(s/60)}min ${Math.round(s%60)}s`;
const rotulos:Record<string,string>={page_view:"Página vista",view_item:"Imóvel visualizado",gallery_interaction:"Interação com galeria",favorite_toggle:"Imóvel favoritado",form_start:"Formulário iniciado",generate_lead:"Lead enviado",whatsapp_click:"Clique no WhatsApp",phone_click:"Clique no telefone",cta_click:"Clique em chamada",scroll_depth:"Rolagem da página",engagement_time:"Tempo de atenção",page_exit:"Saída da página",schedule_start:"Agendamento iniciado",schedule_complete:"Agendamento concluído",financing_open:"Simulação aberta",property_search:"Busca de imóvel"};

function Abas({atual,mudar}:{atual:Aba;mudar:(a:Aba)=>void}){return <nav className="int-subabas" aria-label="Leituras de marketing">{abas.map(a=><button type="button" key={a.chave} className={atual===a.chave?"ativo":""} onClick={()=>mudar(a.chave)}>{a.nome}</button>)}</nav>}
function Status({nome,status,motivo}:{nome:string;status:string;motivo:string}){const ok=status==="conectado"||status==="ok";const parcial=status==="parcial"||status==="sem_permissao";return <article className={`int-decisao-fonte status-${ok?"ok":parcial?"parcial":"erro"}`}><div><i/><strong>{nome}</strong><span>{ok?"Conectado":parcial?"Parcial":"Não conectado"}</span></div><p>{motivo}</p></article>}

function linhaAnuncio(a:AnuncioMidia){return {chave:`${a.plataforma}-${a.anuncio_id??a.anuncio}`,celulas:[{texto:a.plataforma,chip:a.plataforma,chipTom:a.plataforma==="Meta"?("roxo" as const):("bom" as const)},{texto:a.campanha,forte:true,sub:a.conjunto},{texto:a.anuncio},{texto:a.status,chip:a.status,chipTom:"bom" as const},{texto:fmt.dinheiro(a.investimento),num:true},{texto:fmt.inteiro(a.impressoes),num:true},{texto:fmt.inteiro(a.cliques),num:true},{texto:fmt.porcento(a.ctr,2),num:true},{texto:fmt.dinheiro(a.cpc),num:true},{texto:fmt.inteiro(a.leads_plataforma),num:true},{texto:fmt.dinheiro(a.cpl_plataforma),num:true}]};}

export function VisaoDigital({accessToken,recorte}:PropsTela){
  const {data,loading,error}=useResumoInteligencia(accessToken,recorte.periodo);
  const m=data?.marketing; const resumo=m?.resumo; const comportamento=m?.comportamento; const saude=m?.saude;
  const [aba,setAba]=useState<Aba>("resumo");
  const anuncios=useMemo(()=>[...(m?.midia?.meta?.anuncios??[]),...(m?.midia?.google?.anuncios??[])],[m?.midia]);
  const totalMidia=useMemo(()=>anuncios.reduce((a,x)=>({investimento:a.investimento+x.investimento,impressoes:a.impressoes+x.impressoes,cliques:a.cliques+x.cliques,leads:a.leads+x.leads_plataforma}),{investimento:0,impressoes:0,cliques:0,leads:0}),[anuncios]);
  const ctr=pct(totalMidia.cliques,totalMidia.impressoes); const cpl=totalMidia.leads?totalMidia.investimento/totalMidia.leads:null;
  const meta=m?.midia?.meta; const google=m?.midia?.google; const metaOk=meta?.status==="conectado"; const googleOk=google?.status==="conectado";
  if(loading)return <Banner tom="tint-roxo" forte="Carregando marketing e tracking." texto="Site, Meta, Google e CRM estão sendo reconciliados."/>;
  if(error)return <Banner forte="A Inteligência não respondeu." texto={error}/>;
  const campanhas=m?.campanhas??[]; const topImovel=m?.imoveis?.[0];
  const campanhaRows=campanhas.map((c:CampanhaMarketing)=>({chave:`${c.source}-${c.medium}-${c.campaign}`,celulas:[{texto:c.campaign,forte:true,sub:`${c.source} · ${c.medium}`},{texto:fmt.inteiro(c.page_views),num:true},{texto:fmt.inteiro(c.cta_clicks),num:true},{texto:fmt.inteiro(c.leads),num:true},{texto:fmt.inteiro(c.visitas_agendadas),num:true},{texto:fmt.inteiro(c.visitas_realizadas),num:true,forte:true},{texto:fmt.porcento(pct(c.visitas_realizadas,c.leads),1),num:true},{texto:fmt.inteiro(c.vendas),num:true},{texto:fmt.dinheiro(c.vgv),num:true}]}));
  const atribuicao=saude?.atribuicao; const cobertura=pct(atribuicao?.com_campanha,atribuicao?.total);
  const eventos=(m?.eventos??[]).map(e=>({...e,nome:rotulos[e.evento]??e.evento.replaceAll("_"," ")})); const maxEvento=Math.max(1,...eventos.map(e=>e.quantidade));

  return <div className="int-secao"><Abas atual={aba} mudar={setAba}/>
    {aba==="resumo"&&<>
      <section className="int-decisao-resumo"><div><span className="intp-cab-eyebrow">LEITURA DO MARKETING</span><h2>{anuncios.length?`${anuncios.length} anúncios ativos com gasto e resultado no mesmo lugar`:"O site está medindo comportamento, mas as contas de mídia ainda não entregam a visão completa"}</h2><p>{anuncios.length?"Decida pela cadeia completa: anúncio → lead → Funil 2.0 → visita → venda.":"A coleta própria existe. O próximo passo obrigatório é dar permissão de leitura às contas de Meta e Google; eventos enviados à Meta não substituem métricas do Gerenciador."}</p></div><strong className={saude?.tracking_atrasado?"ruim":"bom"}>{saude?.tracking_atrasado?"COLETA PARADA":"SITE ATIVO"}</strong></section>
      <GradeKpis colunas={6} itens={[
        {rotulo:"Investimento",bruto:anuncios.length?totalMidia.investimento:null,texto:fmt.dinheiro(anuncios.length?totalMidia.investimento:null),tile:"laranja",foot:`${anuncios.length} anúncios com entrega`},
        {rotulo:"CTR",bruto:ctr,texto:fmt.porcento(ctr,2),tile:"roxo",foot:`${fmt.inteiro(totalMidia.cliques)} cliques`},
        {rotulo:"CPL da plataforma",bruto:cpl,texto:fmt.dinheiro(cpl),tile:"ambar",foot:`${fmt.inteiro(totalMidia.leads)} conversões reportadas`},
        {rotulo:"Visitas ao site",bruto:resumo?.visitas_rastreadas,texto:fmt.inteiro(resumo?.visitas_rastreadas),tile:"laranja",foot:`${fmt.inteiro(resumo?.page_views)} páginas vistas`},
        {rotulo:"Leads do site",bruto:resumo?.leads_gerados,texto:fmt.inteiro(resumo?.leads_gerados),tile:"verde",foot:`${fmt.porcento(pct(resumo?.leads_gerados,resumo?.visitas_rastreadas),1)} das visitas`},
        {rotulo:"Tempo de atenção",bruto:comportamento?.tempo_engajamento_medio_seg,texto:tempo(comportamento?.tempo_engajamento_medio_seg),tile:"roxo",foot:`${fmt.porcento(comportamento?.saida_rapida_pct,1)} saem rápido`}
      ]}/>
      <Cabecalho eyebrow="DECISÕES" titulo="O que fazer com estes dados" cor="#8B00CC"/>
      <div className="int-decisao-acoes">
        <article className={metaOk?"positivo":"critico"}><span>1 · META</span><h3>{metaOk?`${meta?.anuncios?.length??0} anúncios ativos lidos`:"Dar acesso de leitura ao Meta Ads"}</h3><p>{metaOk?"Compare campanha, conjunto e anúncio pelo custo e pelas visitas do CRM.":meta?.motivo??"O token atual só envia eventos; ele não lê o Gerenciador."}</p></article>
        <article className={googleOk?"positivo":"critico"}><span>2 · GOOGLE</span><h3>{googleOk?`${google?.anuncios?.length??0} anúncios ativos lidos`:"Conectar Google Ads"}</h3><p>{googleOk?"Cliques, custo e conversões já podem ser comparados.":google?.motivo??"A conta ainda não fornece campanhas ao ERP."}</p></article>
        <article className={(cobertura??0)>=80?"positivo":"atencao"}><span>3 · ATRIBUIÇÃO</span><h3>{atribuicao?.total?`${fmt.inteiro(atribuicao.com_campanha)} de ${fmt.inteiro(atribuicao.total)} leads atribuídos identificam campanha`:"Nenhum lead atribuído no período"}</h3><p>UTM, click ID e campanha precisam chegar ao CRM para creditar visita e venda. O percentual sozinho não é usado com amostra pequena.</p></article>
        <article className={(comportamento?.abandono_formulario??0)>0?"atencao":"positivo"}><span>4 · SITE</span><h3>{fmt.inteiro(comportamento?.abandono_formulario)} formulários abandonados</h3><p>Revise o ponto de abandono antes de aumentar tráfego pago.</p></article>
      </div>
    </>}

    {aba==="campanhas"&&<>
      <Cabecalho eyebrow="MÍDIA ATIVA" titulo="Campanha, conjunto e anúncio — sem esconder a hierarquia" nota={recorte.periodo}/>
      <Tabela colunas={[{titulo:"Canal"},{titulo:"Campanha / conjunto"},{titulo:"Anúncio"},{titulo:"Status"},{titulo:"Gasto",num:true},{titulo:"Impressões",num:true},{titulo:"Cliques",num:true},{titulo:"CTR",num:true},{titulo:"CPC",num:true},{titulo:"Leads mídia",num:true},{titulo:"CPL mídia",num:true}]} linhas={anuncios.map(linhaAnuncio)} ordenadaEm="Gasto" foot="Leads/CPL da mídia são os números reportados pela plataforma. A tabela abaixo mostra o desfecho real no CRM."/>
      {!anuncios.length&&<div className="int-conexao-clara"><strong>As credenciais de leitura ainda não existem ou não têm permissão.</strong><p>Meta precisa de `ads_read` e acesso à conta; Google precisa de OAuth, developer token e customer ID. A estrutura está pronta e mostrará dados reais assim que essas permissões forem concedidas.</p></div>}
      <Cabecalho eyebrow="ATRIBUIÇÃO REAL" titulo="Origem e campanha até visita e venda"/>
      <Tabela colunas={[{titulo:"Campanha"},{titulo:"Visitas site",num:true},{titulo:"CTAs",num:true},{titulo:"Leads CRM",num:true},{titulo:"Agendadas",num:true},{titulo:"Realizadas",num:true},{titulo:"Lead→visita",num:true},{titulo:"Vendas",num:true},{titulo:"VGV",num:true}]} linhas={campanhaRows} ordenadaEm="Realizadas" foot="Campanhas técnicas de QA não aparecem na visão executiva; o contador técnico permanece na saúde do tracking."/>
    </>}

    {aba==="site"&&<>
      <GradeKpis colunas={6} itens={[
        {rotulo:"Visitas",bruto:resumo?.visitas_rastreadas,texto:fmt.inteiro(resumo?.visitas_rastreadas),tile:"laranja"},{rotulo:"Engajadas",bruto:resumo?.visitas_engajadas,texto:fmt.inteiro(resumo?.visitas_engajadas),tile:"verde"},{rotulo:"Imóveis vistos",bruto:resumo?.visualizacoes_imovel,texto:fmt.inteiro(resumo?.visualizacoes_imovel),tile:"roxo"},{rotulo:"Cliques CTA",bruto:resumo?.cliques_cta,texto:fmt.inteiro(resumo?.cliques_cta),tile:"laranja"},{rotulo:"Leads",bruto:resumo?.leads_gerados,texto:fmt.inteiro(resumo?.leads_gerados),tile:"verde"},{rotulo:"Saída rápida",bruto:comportamento?.saida_rapida_pct,texto:fmt.porcento(comportamento?.saida_rapida_pct,1),tile:"vermelho"}
      ]}/>
      <div className="int-duas"><div className="int-col"><Cabecalho eyebrow="MAPA DE INTERAÇÃO" titulo="O que as pessoas fazem no site"/><div className="int-painel int-mapa-eventos">{eventos.slice(0,12).map(e=><div key={e.evento}><span>{e.nome}</span><i><b style={{width:`${Math.max(3,100*e.quantidade/maxEvento)}%`}}/></i><strong>{e.quantidade}</strong></div>)}</div></div><div className="int-col"><Cabecalho eyebrow="SINAIS DE INTERESSE" titulo="Onde agir"/><div className="int-decisao-lista"><div><span>Imóvel mais visto</span><strong>{topImovel?.imovel??"—"}</strong><small>{topImovel?`${topImovel.visualizacoes} visualizações · ${topImovel.bairro??"bairro não informado"}`:"sem identificação no período"}</small></div><div><span>Formulários abandonados</span><strong>{fmt.inteiro(comportamento?.abandono_formulario)}</strong><small>começaram e não enviaram</small></div><div><span>Chegaram ao fim</span><strong>{fmt.inteiro(comportamento?.chegou_final)}</strong><small>rolagem observada até 90%</small></div></div></div></div>
      <Cabecalho eyebrow="PÁGINAS" titulo="Onde entram, interagem e convertem"/>
      <Tabela colunas={[{titulo:"Página"},{titulo:"Visualizações",num:true},{titulo:"Cliques CTA",num:true},{titulo:"Leads",num:true}]} linhas={(m?.paginas??[]).map(p=>({chave:p.page_path,celulas:[{texto:p.page_path,forte:true},{texto:fmt.inteiro(p.visualizacoes),num:true},{texto:fmt.inteiro(p.cliques_cta),num:true},{texto:fmt.inteiro(p.leads),num:true}]}))} ordenadaEm="Visualizações" foot="O rastreamento próprio registra comportamento mesmo quando Analytics não está conectado."/>
      <Cabecalho eyebrow="GOOGLE ANALYTICS" titulo="Sessões, canais e dispositivos"/>
      {m?.ga4?.totais?<GradeKpis colunas={4} itens={[{rotulo:"Sessões GA4",bruto:m.ga4.totais.sessoes,texto:fmt.inteiro(m.ga4.totais.sessoes),tile:"laranja"},{rotulo:"Visualizações GA4",bruto:m.ga4.totais.visualizacoes,texto:fmt.inteiro(m.ga4.totais.visualizacoes),tile:"roxo"},{rotulo:"Sessões engajadas",bruto:m.ga4.totais.sessoesEngajadas,texto:fmt.inteiro(m.ga4.totais.sessoesEngajadas),tile:"verde"},{rotulo:"Taxa de engajamento",bruto:m.ga4.totais.taxaEngajamento,texto:fmt.porcento(m.ga4.totais.taxaEngajamento,1),tile:"verde"}]}/>:<div className="int-conexao-clara"><strong>Google Analytics ainda não está autorizado no ERP.</strong><p>A coleta própria continua funcionando, mas a comparação oficial de canais do GA4 exige propriedade e conta de serviço.</p></div>}
    </>}

    {aba==="tracking"&&<>
      <Cabecalho eyebrow="SAÚDE DAS CONEXÕES" titulo="O que funciona, o que está parcial e o que falta" cor="#8B00CC"/>
      <div className="int-decisao-fontes">
        <Status nome="Coleta própria do site" status={saude?.tracking_atrasado?"erro":"conectado"} motivo={saude?.tracking_atrasado?"Nenhum evento recente chegou ao ERP.":`${fmt.inteiro(saude?.total_eventos)} eventos; último ${fmt.hora(saude?.ultimo_evento_em)}.`}/>
        <Status nome="Meta Pixel + CAPI" status={(saude?.entrega_midia?.entregues??0)>0?"conectado":"erro"} motivo={`${fmt.inteiro(saude?.entrega_midia?.entregues)} eventos entregues; ${fmt.inteiro(saude?.entrega_midia?.falhas)} falhas.`}/>
        <Status nome="Leitura do Meta Ads" status={meta?.status??"erro"} motivo={metaOk?"Campanhas, conjuntos, anúncios e métricas disponíveis.":meta?.motivo??"Sem autorização de leitura."}/>
        <Status nome="Google Ads" status={google?.status??"erro"} motivo={googleOk?"Campanhas e métricas disponíveis.":google?.motivo??"Sem credenciais."}/>
        <Status nome="Google Analytics" status={m?.ga4?"conectado":"erro"} motivo={m?.ga4?"Relatórios oficiais do GA4 disponíveis.":"Propriedade/conta de serviço não configurada."}/>
        <Status nome="Google Tag Manager" status={saude?.gtm_containers?"conectado":"parcial"} motivo={saude?.gtm_containers?`${saude.gtm_containers} containers inventariados.`:saude?.gtm_motivo??"O ERP ainda não lê containers e tags."}/>
        <Status nome="Atribuição ao CRM" status={(cobertura??0)>=80?"conectado":"parcial"} motivo={atribuicao?.total?`${fmt.inteiro(atribuicao.com_campanha)} de ${fmt.inteiro(atribuicao.total)} leads atribuídos têm campanha identificada.`:"Nenhum lead atribuído no período."}/>
        <Status nome="Mapa de calor visual" status="erro" motivo="Ainda não há coleta de coordenadas/Clarity. O mapa de interação acima usa eventos reais, sem fingir heatmap."/>
      </div>
      <Cabecalho eyebrow="PRIVACIDADE NA PRÁTICA" titulo="O que cada escolha do visitante libera"/>
      <div className="int-privacidade"><article><span>Essencial</span><strong>Site funciona</strong><p>Segurança e funcionamento básico. Não cria sessão persistente nem envia evento de marketing.</p></article><article><span>Analytics</span><strong>Entendemos uso e abandono</strong><p>Permite sessão, tempo de atenção, páginas, rolagem, busca e comportamento agregado.</p></article><article><span>Marketing</span><strong>Campanhas recebem sinais</strong><p>Além da análise, permite Pixel/CAPI, atribuição e formação de públicos, com deduplicação por event ID.</p></article></div>
      <RodapeFontes fontes={["site_events_anon","site_leads","lead_attribution","tracking_delivery_logs","Meta Marketing API","Google Ads API","GA4 Data API"]} pendencias={["permissão ads_read da Meta, se ainda recusada","credenciais Google Ads/GA4","inventário GTM","heatmap por coordenadas"]} atualizado={fmt.hora(m?.atualizado_em)}/>
    </>}
  </div>;
}
