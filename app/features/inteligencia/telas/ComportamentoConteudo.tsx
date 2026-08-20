"use client";

/* COMPORTAMENTO — mostra somente eventos e páginas realmente agregados. Blocos
 * de rolagem, Clarity e atribuição foram removidos enquanto não têm dado. */

import type { PropsTela } from "../CascaInteligencia";
import { BlocoSemDado, fmt, RodapeFontes } from "../dado";
import { EsqueletoAviso, EsqueletoKpis, EsqueletoTabela } from "../esqueleto";
import { Cabecalho, GradeKpis, Tabela, type Kpi } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { ComportamentoPayload } from "../../../lib/inteligencia/tipos";

function hhmm(iso: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function ComportamentoConteudo({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<ComportamentoPayload>("comportamento", accessToken, recorte);

  if (leitura.estado === "carregando") {
    return <div className="int-secao"><EsqueletoAviso texto="Agregando páginas e interações reais." /><EsqueletoKpis colunas={3} /><EsqueletoTabela colunas={3} linhas={6} /></div>;
  }
  if (leitura.estado === "erro") {
    return <div className="int-secao"><BlocoSemDado titulo="Não foi possível atualizar Comportamento" motivo="fonte" detalhe={`${leitura.erro ?? "A fonte não respondeu."} Nenhuma visualização anterior foi mantida.`} /></div>;
  }
  const p = leitura.payload;
  if (!p) return <div className="int-secao"><BlocoSemDado titulo="Comportamento ainda sem leitura" detalhe="A consulta terminou sem dados para o período." /></div>;

  const principal = p.eventos[0] ?? null;
  const kpis: Kpi[] = [
    { rotulo: "Visualizações de página", bruto: p.total_pageviews, texto: fmt.inteiro(p.total_pageviews), tile: "laranja" },
    { rotulo: "Eventos observados", bruto: p.total_eventos, texto: fmt.inteiro(p.total_eventos), tile: "roxo" },
    { rotulo: "Interação mais frequente", bruto: principal?.total ?? null, texto: principal ? fmt.inteiro(principal.total) : "—", tile: "verde", foot: principal?.evento ?? "sem evento no período" },
  ];

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="COMPORTAMENTO NO SITE" titulo="O que as pessoas realmente acessaram e fizeram" nota={recorte.periodo} />
      <GradeKpis itens={kpis} colunas={3} />

      <div className="intp-op-duas">
        <Tabela
          colunas={[{ titulo: "Página" }, { titulo: "Visualizações", num: true }, { titulo: "Eventos", num: true }]}
          ordenadaEm="Visualizações"
          linhas={p.paginas.map((pagina) => ({
            chave: pagina.pagina,
            celulas: [
              { texto: pagina.pagina, forte: true },
              { texto: fmt.inteiro(pagina.pageviews), num: true },
              { texto: fmt.inteiro(pagina.eventos), num: true },
            ],
          }))}
          foot="páginas agregadas pela telemetria própria; nenhum lead é atribuído à página sem vínculo"
        />

        <Tabela
          colunas={[{ titulo: "Interação" }, { titulo: "Ocorrências", num: true }]}
          ordenadaEm="Ocorrências"
          linhas={p.eventos.map((evento) => ({
            chave: evento.evento,
            celulas: [{ texto: evento.evento, forte: true }, { texto: fmt.inteiro(evento.total), num: true }],
          }))}
          foot="contagem real de eventos no período selecionado"
        />
      </div>

      <Cabecalho eyebrow="DISPOSITIVOS" titulo="Onde o site foi acessado" cor="#8B00CC" />
      <Tabela
        colunas={[{ titulo: "Dispositivo" }, { titulo: "Visualizações", num: true }, { titulo: "Eventos", num: true }]}
        ordenadaEm="Visualizações"
        linhas={p.dispositivos.map((dispositivo) => ({
          chave: dispositivo.dispositivo,
          celulas: [
            { texto: dispositivo.dispositivo, forte: true },
            { texto: fmt.inteiro(dispositivo.pageviews), num: true },
            { texto: fmt.inteiro(dispositivo.eventos ?? 0), num: true },
          ],
        }))}
        foot="dispositivo inferido pela coleta própria do site"
      />

      <RodapeFontes
        fontes={["coleta própria do site"]}
        pendencias={["mapas e gravações não aparecem porque o Clarity não está integrado", "leads por página não aparecem sem vínculo site → CRM"]}
        atualizado={hhmm(p.atualizado_em)}
      />
    </div>
  );
}
