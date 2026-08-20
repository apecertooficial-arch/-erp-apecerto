"use client";

/* AQUISIÇÃO — uma única tela, sem gráfico ilustrativo, drawer ou números de mídia
 * inventados. CRM e site aparecem lado a lado, com a carga Aquário explicitada. */

import type { PropsTela } from "../CascaInteligencia";
import { BlocoSemDado, fmt, RodapeFontes } from "../dado";
import { EsqueletoAviso, EsqueletoKpis, EsqueletoTabela } from "../esqueleto";
import { Banner, Cabecalho, GradeKpis, Tabela, type Kpi } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { AquisicaoPayload } from "../../../lib/inteligencia/tipos";

function hhmm(iso: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function AquisicaoCampanhas({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<AquisicaoPayload>("aquisicao", accessToken, recorte);

  if (leitura.estado === "carregando") {
    return <div className="int-secao"><EsqueletoAviso texto="Separando aquisição operacional e cargas históricas." /><EsqueletoKpis colunas={4} /><EsqueletoTabela colunas={5} linhas={6} /></div>;
  }
  if (leitura.estado === "erro") {
    return <div className="int-secao"><BlocoSemDado titulo="Não foi possível atualizar Aquisição" motivo="fonte" detalhe={`${leitura.erro ?? "A fonte não respondeu."} Nenhuma tendência foi desenhada no lugar.`} /></div>;
  }
  const p = leitura.payload;
  if (!p) return <div className="int-secao"><BlocoSemDado titulo="Aquisição ainda sem leitura" detalhe="A consulta terminou sem dados para o período." /></div>;

  const kpis: Kpi[] = [
    { rotulo: `Leads operacionais · ${recorte.periodo}`, bruto: p.leads_operacionais, texto: fmt.inteiro(p.leads_operacionais), tile: "laranja", foot: "exclui somente a carga histórica Aquário, mostrada abaixo" },
    { rotulo: "Negócios criados · período", bruto: p.negocios, texto: fmt.inteiro(p.negocios), tile: "roxo", foot: "Funil 2.0 com data de criação no recorte" },
    { rotulo: "Visitas · vendas · período", bruto: p.visitas, texto: `${fmt.inteiro(p.visitas)} · ${fmt.inteiro(p.vendas)}`, tile: "verde", foot: "produção registrada no mesmo intervalo" },
    { rotulo: "Página · ações de intenção", bruto: p.visualizacoes, texto: `${fmt.inteiro(p.visualizacoes)} · ${fmt.inteiro(p.intencao)}`, tile: "ambar", foot: "telemetria própria do site" },
  ];

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="AQUISIÇÃO" titulo="De onde chegam os leads e quantos viram oportunidade" nota={recorte.periodo} />

      {p.leads_carga_historica > 0 ? (
        <Banner
          tom="aviso"
          forte={`${fmt.inteiro(p.leads_carga_historica)} registros da base Aquário entraram neste recorte.`}
          texto={`Eles continuam visíveis na tabela e no total bruto de ${fmt.inteiro(p.leads)} registros, mas não contam como aquisição operacional.`}
        />
      ) : null}

      <GradeKpis itens={kpis} colunas={4} />

      <div className="intp-fin-duas">
        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Leitura rápida</span>
          <div className="intp-detalhe-linha"><span>Leads operacionais</span><b>{fmt.inteiro(p.leads_operacionais)}</b></div>
          <div className="intp-detalhe-linha"><span>Carga histórica Aquário</span><b>{fmt.inteiro(p.leads_carga_historica)}</b></div>
          <div className="intp-detalhe-linha"><span>Sem origem registrada</span><b>{fmt.inteiro(p.nao_atribuido)}</b></div>
          <small className="intp-kpi-foot">Nenhum lead sem origem é redistribuído artificialmente entre canais.</small>
        </div>

        <div className="intp-cartao">
          <span className="intp-cartao-titulo">O que ainda não pode ser decidido aqui</span>
          <p style={{ margin: 0, fontSize: 12, color: "#6E6760", lineHeight: 1.55 }}>
            CPL, custo por negócio e ROAS exigem Google Ads e Meta Ads conectados. Primeiro e último toque exigem UTM vinculada ao lead. Esses indicadores foram retirados da tabela enquanto não têm fonte.
          </p>
        </div>
      </div>

      <Tabela
        colunas={[{ titulo: "Origem registrada" }, { titulo: "Classificação" }, { titulo: "Leads", num: true }, { titulo: "Leads com negócio", num: true }, { titulo: "Lead → negócio", num: true }]}
        ordenadaEm="Leads"
        linhas={p.linhas.map((linha) => ({
          chave: linha.origem,
          destaque: linha.carga_historica,
          celulas: [
            { texto: linha.origem, forte: true },
            linha.carga_historica ? { texto: "", chip: "carga histórica", chipTom: "aviso" as const } : { texto: "", chip: "operacional", chipTom: "bom" as const },
            { texto: fmt.inteiro(linha.leads), num: true },
            { texto: fmt.inteiro(linha.negocios), num: true },
            { texto: fmt.porcento(linha.leadNeg, 1), num: true, forte: true },
          ],
        }))}
        foot={`${p.linhas.length} origens reais do CRM · negócio contado quando foi criado no mesmo período do lead`}
      />

      <RodapeFontes
        fontes={["coleta própria do site", "leads e negócios do Funil 2.0", "visitas", "vendas concluídas"]}
        pendencias={["Google Ads e Meta Ads não conectados", "atribuição entre clique do site e lead ainda incompleta"]}
        atualizado={hhmm(p.atualizado_em)}
      />
    </div>
  );
}
